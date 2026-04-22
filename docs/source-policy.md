# Source Policy

Cinema Notes must not connect sources that bypass licensing, platform rules or technical restrictions.

## Do not connect

- APIs that return `iframe_url`, `player_url`, `embed_url` or similar links for full anime, movies or series without a licensed source.
- Site parsers that extract `.m3u8`, `.mp4`, `.ts`, manifests or HLS playlists from third-party players.
- Cloudflare or backend proxies that bypass CORS, geo restrictions, ads, referers, signed URLs, tokens or DRM.
- Unknown “universal watch everything” balancers.
- YouTube videos presented as full anime or movies when they are reviews, recaps, clips, AMVs or fragments.
- Hidden video providers. The user must see when a result is YouTube, Internet Archive, Jellyfin or another source.
- Database persistence for suspicious player links.
- Private API keys inside the mobile bundle when a provider forbids public exposure.

## Allowed built-in playback

- User-owned Jellyfin libraries.
- Public Internet Archive video files.
- Direct video files that the user has the right to use.

## Allowed metadata

- TMDB for movie and TV metadata.
- Shikimori for anime metadata.

Metadata providers are not video providers. If metadata has no legal stream, Cinema Notes opens a card or note, not an empty player.

## Code guard

The mobile app uses `cinema-app/lib/video-source-policy.ts` to reject suspicious hosts and paths before a URL can become a playback source.
