<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted } from 'vue';
import {
  buildWebviewExportRequest,
  mergeWaveformRegionsIntoLacDocument
} from '../core/services/exportRequestService';
import { initializeFrontend } from '../core/services/bootstrapService';
import { useSessionStore } from '../core/stores/sessionStore';
import { useWaveformStore } from '../core/stores/waveformStore';
import type { HostAdapter } from '../platform/host/types';
import { keyboardShortcutManager } from '../core/utils/KeyboardShortcutManager';
import AnalyzerLayout from './layouts/AnalyzerLayout.vue';
import AppHeader from './components/AppHeader.vue';
import AppSidebarLeft from './components/AppSidebarLeft.vue';
import AppSidebarRight from './components/AppSidebarRight.vue';
import AppStatusbar from './components/AppStatusbar.vue';
import AppWaveformStage from './components/AppWaveformStage.vue';

const sessionStore = useSessionStore();
const waveformStore = useWaveformStore();
const host = inject<HostAdapter>('host');
const title = computed(() => sessionStore.fileName || 'Logic Analyzer');
const hasDocument = computed(() => Boolean(sessionStore.fileName));

function readExportFormat(payload: unknown): 'lac' | 'csv' | 'json' | 'vcd' {
  if (typeof payload !== 'object' || payload === null) {
    return 'csv';
  }

  const format = (payload as { format?: unknown }).format;
  return format === 'lac' || format === 'csv' || format === 'json' || format === 'vcd'
    ? format
    : 'csv';
}

async function dispatchHostCommand(command: string, payload?: unknown) {
  if (!host) {
    return undefined;
  }

  if (command === 'exportData') {
    return host.sendCommand(
      command,
      buildWebviewExportRequest(sessionStore, waveformStore, readExportFormat(payload))
    );
  }

  if (command === 'saveFile') {
    try {
      if (sessionStore.documentContent) {
        await host.saveDocument(
          mergeWaveformRegionsIntoLacDocument(sessionStore.documentContent, waveformStore)
        );
        return { success: true };
      }
    } catch {
      return host.sendCommand(command, payload);
    }
  }

  return host.sendCommand(command, payload);
}

onMounted(async () => {
  if (!host) {
    return;
  }

  keyboardShortcutManager.setCommandDispatcher(dispatchHostCommand);
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
