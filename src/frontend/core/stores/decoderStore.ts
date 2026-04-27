import { defineStore } from 'pinia';

export const useDecoderStore = defineStore('frontend-decoder', {
  state: () => ({
    activeDecoderConfigs: [] as unknown[],
    decoderErrors: [] as string[],
    channelConflicts: [] as string[]
  })
});
