import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const scriptsDirectory = path.dirname(currentFile);
const backendRoot = path.resolve(scriptsDirectory, '..');
const projectRoot = path.resolve(backendRoot, '..');
const bootstrapFile = path.join(projectRoot, 'mobile-bootstrap.json');
const backendHealthUrl = 'http://127.0.0.1:8000';

let tunnelProcess = null;
let currentLanApiBaseUrl = null;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requestBackend() {
  return new Promise((resolve, reject) => {
    const request = http.get(backendHealthUrl, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });

    request.setTimeout(2000, () => {
      request.destroy(new Error('timeout'));
    });

    request.on('error', reject);
  });
}

async function isBackendReady() {
  try {
    const statusCode = await requestBackend();
    return statusCode > 0;
  } catch {
    return false;
  }
}

async function waitForBackend(timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendReady()) {
      return;
    }

    await sleep(1000);
  }

  throw new Error('Backend did not start in time.');
}

function startBackendWindow() {
  return new Promise((resolve, reject) => {
    const launcher = path.join(backendRoot, 'start-mobile-server.cmd');
    const child = spawn('cmd.exe', ['/c', launcher], {
      cwd: backendRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });

    child.once('error', reject);
    child.unref();
    resolve();
  });
}

function runGit(args, allowFailure = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0 || allowFailure) {
        resolve({ code: code ?? 0, stderr, stdout });
        return;
      }

      reject(new Error(stderr || stdout || `git ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function publishBootstrap({
  apiBaseUrl,
  lanApiBaseUrl = null,
  publicApiBaseUrl = null,
  source = 'public-tunnel',
}) {
  const payload = {
    apiBaseUrl,
    lanApiBaseUrl,
    publicApiBaseUrl,
    source,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(bootstrapFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const status = await runGit(['status', '--short', '--', 'mobile-bootstrap.json'], true);
  if (!status.stdout.trim()) {
    console.log('Bootstrap URL is already up to date.');
    return;
  }

  await runGit(['add', '--', 'mobile-bootstrap.json']);

  const commit = await runGit(
    ['commit', '-m', 'Update mobile bootstrap URL', '--', 'mobile-bootstrap.json'],
    true,
  );

  if (commit.code !== 0 && !/nothing to commit/i.test(`${commit.stdout}\n${commit.stderr}`)) {
    console.warn('Bootstrap file was updated locally, but git commit failed.');
    console.warn(commit.stderr || commit.stdout);
    return;
  }

  const push = await runGit(['push', 'origin', 'main'], true);

  if (push.code !== 0) {
    console.warn('Bootstrap commit was created locally, but git push failed.');
    console.warn(push.stderr || push.stdout);
    return;
  }

  console.log('Bootstrap URL published to GitHub.');
}

function isPrivateIpv4(address) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function resolveLanApiBaseUrl() {
  const interfaces = os.networkInterfaces();
  const preferredAliases = ['Ethernet', 'Wi-Fi', 'WLAN'];

  for (const preferredAlias of preferredAliases) {
    const candidates = interfaces[preferredAlias] ?? [];

    for (const candidate of candidates) {
      if (candidate.family === 'IPv4' && !candidate.internal && isPrivateIpv4(candidate.address)) {
        return `http://${candidate.address}:8000/api`;
      }
    }
  }

  for (const candidates of Object.values(interfaces)) {
    for (const candidate of candidates ?? []) {
      if (candidate.family === 'IPv4' && !candidate.internal && isPrivateIpv4(candidate.address)) {
        return `http://${candidate.address}:8000/api`;
      }
    }
  }

  return null;
}

function wireTunnelOutput(stream, onLine) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();

    while (buffer.includes('\n')) {
      const lineBreakIndex = buffer.indexOf('\n');
      const line = buffer.slice(0, lineBreakIndex).replace(/\r$/, '');
      buffer = buffer.slice(lineBreakIndex + 1);
      onLine(line);
    }
  });

  stream.on('end', () => {
    const finalLine = buffer.trim();
    if (finalLine) {
      onLine(finalLine);
    }
  });
}

function startTunnel(provider) {
  const providerName = provider.name;

  return new Promise((resolve, reject) => {
    const child = spawn('ssh', provider.args, {
      cwd: backendRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    tunnelProcess = child;
    let resolved = false;

    const handleLine = async (line) => {
      console.log(line);

      if (resolved) {
        return;
      }

      if (provider.lineHint && !line.includes(provider.lineHint)) {
        return;
      }

      const urlMatch = line.match(provider.urlPattern);
      if (!urlMatch) {
        return;
      }

      resolved = true;

      const publicUrl = urlMatch[0];
      const publicApiBaseUrl = `${publicUrl}/api`;
      const apiBaseUrl = currentLanApiBaseUrl ?? publicApiBaseUrl;

      console.log('');
      console.log(`Public URL: ${publicUrl}`);
      console.log(`Public API URL: ${publicApiBaseUrl}`);
      if (currentLanApiBaseUrl) {
        console.log(`LAN API URL: ${currentLanApiBaseUrl}`);
        console.log(`Preferred API URL: ${apiBaseUrl}`);
      }
      console.log('');
      console.log('Publishing the current API address for the mobile app...');

      try {
        await publishBootstrap({
          apiBaseUrl,
          lanApiBaseUrl: currentLanApiBaseUrl,
          publicApiBaseUrl,
          source: currentLanApiBaseUrl ? 'lan-plus-public' : 'public-tunnel',
        });
      } catch (error) {
        console.warn('Unable to publish bootstrap URL automatically.');
        console.warn(error instanceof Error ? error.message : String(error));
      }

      console.log('');
      console.log('The mobile app will pick this address automatically on startup.');
      console.log('Keep this window open while you use the app.');
      console.log('');

      resolve();
    };

    wireTunnelOutput(child.stdout, handleLine);
    wireTunnelOutput(child.stderr, handleLine);

    child.once('error', reject);
    child.once('close', (code) => {
      if (!resolved) {
        reject(new Error(`${providerName} tunnel exited with code ${code ?? 0}.`));
        return;
      }

      console.log('');
      console.log(`${providerName} tunnel has stopped.`);
      process.exit(code ?? 0);
    });
  });
}

const TUNNEL_PROVIDERS = [
  {
    name: 'localhost.run',
    args: [
      '-N',
      '-T',
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'ServerAliveInterval=30',
      '-R',
      '80:localhost:8000',
      'nokey@localhost.run',
    ],
    lineHint: 'tunneled with tls termination',
    urlPattern: /https:\/\/[^\s]+\.(?:lhr\.life|localhost\.run)/,
  },
  {
    name: 'serveo',
    args: [
      '-N',
      '-T',
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'ServerAliveInterval=30',
      '-R',
      '80:localhost:8000',
      'serveo.net',
    ],
    lineHint: 'Forwarding HTTP traffic from',
    urlPattern: /https:\/\/[^\s]+\.serveousercontent\.com/,
  },
];

async function startPublicTunnel() {
  let lastError = null;

  for (const provider of TUNNEL_PROVIDERS) {
    console.log('');
    console.log(`Starting public ${provider.name} tunnel...`);
    console.log('');

    try {
      await startTunnel(provider);
      return;
    } catch (error) {
      lastError = error;
      console.warn(error instanceof Error ? error.message : String(error));
      console.warn(`Unable to keep ${provider.name} tunnel alive, trying the next option...`);
    }
  }

  throw lastError ?? new Error('Unable to start any public tunnel.');
}

async function main() {
  if (!(await isBackendReady())) {
    console.log('Starting Cinema backend in a new window...');
    await startBackendWindow();
  } else {
    console.log('Cinema backend is already running.');
  }

  console.log(`Waiting for backend on ${backendHealthUrl} ...`);
  await waitForBackend();

  const lanApiBaseUrl = resolveLanApiBaseUrl();
  currentLanApiBaseUrl = lanApiBaseUrl;

  if (lanApiBaseUrl) {
    console.log('');
    console.log(`Publishing LAN API URL first: ${lanApiBaseUrl}`);
    try {
      await publishBootstrap({
        apiBaseUrl: lanApiBaseUrl,
        lanApiBaseUrl,
        source: 'lan-fallback',
      });
      console.log('Same-network phones can connect immediately.');
    } catch (error) {
      console.warn('Unable to publish LAN bootstrap URL.');
      console.warn(error instanceof Error ? error.message : String(error));
    }
  }

  await startPublicTunnel();
}

process.on('SIGINT', () => {
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill();
  }

  process.exit(0);
});

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
