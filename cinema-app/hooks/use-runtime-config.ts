import { useRuntimeConfigContext } from '@/providers/runtime-config-provider';

export function useRuntimeConfig() {
  return useRuntimeConfigContext();
}
