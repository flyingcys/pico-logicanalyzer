<script setup lang="ts">
import { computed } from 'vue';
import StatusBar from './StatusBar.vue';
import { useDeviceStore } from '../../core/stores/deviceStore';
import { useSessionStore } from '../../core/stores/sessionStore';

const sessionStore = useSessionStore();
const deviceStore = useDeviceStore();

const sampleData = computed(() => {
  const duration = sessionStore.sampleRate > 0
    ? sessionStore.totalSamples / sessionStore.sampleRate
    : 0;

  return {
    totalSamples: sessionStore.totalSamples,
    sampleRate: sessionStore.sampleRate,
    duration
  };
});
</script>

<template>
  <StatusBar
    :device-connected="deviceStore.isConnected"
    :sample-data="sampleData"
    :file-name="sessionStore.fileName"
  />
</template>
