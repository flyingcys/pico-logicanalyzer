import { defineStore } from 'pinia';

export const useDeviceStore = defineStore('frontend-device', {
  state: () => ({
    isConnected: false,
    isConnecting: false,
    isCapturing: false,
    currentDevice: null as unknown | null
  })
});
