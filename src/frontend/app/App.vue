<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted } from 'vue';
import { initializeFrontend } from '../core/services/bootstrapService';
import { useSessionStore } from '../core/stores/sessionStore';
import type { HostAdapter } from '../platform/host/types';
import { keyboardShortcutManager } from '../core/utils/KeyboardShortcutManager';
import AnalyzerLayout from './layouts/AnalyzerLayout.vue';
import AppHeader from './components/AppHeader.vue';
import AppSidebarLeft from './components/AppSidebarLeft.vue';
import AppSidebarRight from './components/AppSidebarRight.vue';
import AppStatusbar from './components/AppStatusbar.vue';
import AppWaveformStage from './components/AppWaveformStage.vue';

const sessionStore = useSessionStore();
const host = inject<HostAdapter>('host');
const title = computed(() => sessionStore.fileName || 'Logic Analyzer');
const hasDocument = computed(() => Boolean(sessionStore.fileName));

onMounted(async () => {
  if (!host) {
    return;
  }

  keyboardShortcutManager.setCommandDispatcher((command, payload) => host.sendCommand(command, payload));
  await initializeFrontend(host);
});

onUnmounted(() => {
  keyboardShortcutManager.setCommandDispatcher(null);
});
</script>

<template>
  <AnalyzerLayout>
    <template #header>
      <AppHeader
        :title="title"
        :has-document="hasDocument"
      />
    </template>

    <template #left>
      <AppSidebarLeft />
    </template>

    <AppWaveformStage />

    <template #right>
      <AppSidebarRight />
    </template>

    <template #footer>
      <AppStatusbar />
    </template>
  </AnalyzerLayout>
</template>
