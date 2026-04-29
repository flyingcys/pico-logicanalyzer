<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Connection,
  DocumentChecked,
  Download,
  QuestionFilled,
  RefreshRight,
  VideoPause,
  VideoPlay
} from '@element-plus/icons-vue';
import { useDeviceStore } from '../../core/stores/deviceStore';
import {
  buildWebviewExportRequest,
  mergeWaveformRegionsIntoLacDocument
} from '../../core/services/exportRequestService';
import { useSessionStore } from '../../core/stores/sessionStore';
import { useUiStore } from '../../core/stores/uiStore';
import { useWaveformStore } from '../../core/stores/waveformStore';
import { useHost } from '../composables/useHost';
import { createDeviceCaptureCommands } from '../composables/deviceCaptureCommands';
import LanguageSwitcher from './LanguageSwitcher.vue';
import ShortcutHelpDialog from './ShortcutHelpDialog.vue';

const props = defineProps<{
  title: string;
  hasDocument: boolean;
}>();

const uiStore = useUiStore();
const deviceStore = useDeviceStore();
const sessionStore = useSessionStore();
const waveformStore = useWaveformStore();
const host = useHost({ fallback: 'auto' });
const captureCommands = createDeviceCaptureCommands({
  host,
  deviceStore,
  sessionStore,
  notify: ElMessage
});

const subtitle = computed(() => (props.hasDocument ? '会话已加载' : '等待文档'));
const canStartCapture = computed(() => deviceStore.isConnected && !deviceStore.isCapturing);
const canStopCapture = computed(() => deviceStore.isConnected && deviceStore.isCapturing);
const canRepeatCapture = computed(() =>
  deviceStore.isConnected &&
  !deviceStore.isCapturing &&
  Boolean(deviceStore.lastCaptureConfig)
);
const canExportData = computed(() =>
  sessionStore.documentState === 'samples' &&
  waveformStore.totalSamples > 0 &&
  waveformStore.channels.length > 0
);
const canSaveRegions = computed(() =>
  Boolean(sessionStore.documentContent) &&
  sessionStore.documentState !== 'invalid'
);

function openShortcutHelp() {
  uiStore.showShortcutHelp = true;
}

async function connectDevice() {
  await captureCommands.connectDevice();
}

async function startCapture() {
  if (!canStartCapture.value) {
    return;
  }

  await captureCommands.startCapture();
}

async function stopCapture() {
  if (!deviceStore.isConnected) {
    return;
  }

  await captureCommands.stopCapture();
}

async function repeatCapture() {
  if (!canRepeatCapture.value) {
    return;
  }

  await captureCommands.repeatCapture();
}

async function exportData() {
  if (!canExportData.value) {
    return;
  }

  const result = await host.sendCommand(
    'exportData',
    buildWebviewExportRequest(sessionStore, waveformStore, 'csv')
  );
  if (!result.success) {
    ElMessage.error(result.error || '导出失败');
  }
}

async function saveRegions() {
  if (!canSaveRegions.value) {
    return;
  }

  try {
    await host.saveDocument(
      mergeWaveformRegionsIntoLacDocument(sessionStore.documentContent, waveformStore)
    );
    ElMessage.success('区域已保存');
  } catch (error) {
    ElMessage.error(`区域保存失败: ${error}`);
  }
}
</script>

<template>
  <div class="app-header">
    <div class="app-header__title-group">
      <p class="app-header__eyebrow">
        Pico Logic Analyzer
      </p>
      <h1 class="app-header__title">
        {{ title }}
      </h1>
      <p class="app-header__subtitle">
        {{ subtitle }}
      </p>
    </div>

    <div class="app-header__actions">
      <el-tooltip
        content="连接设备"
        placement="bottom"
      >
        <el-button
          circle
          :loading="deviceStore.isConnecting"
          :icon="Connection"
          @click="connectDevice"
        />
      </el-tooltip>

      <el-tooltip
        content="开始采集"
        placement="bottom"
      >
        <el-button
          circle
          type="primary"
          data-testid="webview-start-capture-button"
          :disabled="!canStartCapture"
          :loading="deviceStore.isCapturing"
          :icon="VideoPlay"
          @click="startCapture"
        />
      </el-tooltip>

      <el-tooltip
        content="停止采集"
        placement="bottom"
      >
        <el-button
          circle
          type="danger"
          :disabled="!canStopCapture"
          :icon="VideoPause"
          @click="stopCapture"
        />
      </el-tooltip>

      <el-tooltip
        content="重复上次采集"
        placement="bottom"
      >
        <el-button
          circle
          :disabled="!canRepeatCapture"
          :icon="RefreshRight"
          @click="repeatCapture"
        />
      </el-tooltip>

      <el-tooltip
        content="导出数据"
        placement="bottom"
      >
        <el-button
          circle
          data-testid="webview-export-button"
          :disabled="!canExportData"
          :icon="Download"
          @click="exportData"
        />
      </el-tooltip>

      <el-tooltip
        content="保存区域"
        placement="bottom"
      >
        <el-button
          circle
          data-testid="webview-save-regions-button"
          :disabled="!canSaveRegions"
          :icon="DocumentChecked"
          @click="saveRegions"
        />
      </el-tooltip>

      <el-tooltip
        content="快捷键帮助"
        placement="bottom"
      >
        <el-button
          circle
          :icon="QuestionFilled"
          @click="openShortcutHelp"
        />
      </el-tooltip>

      <LanguageSwitcher />
    </div>
    <ShortcutHelpDialog v-model="uiStore.showShortcutHelp" />
  </div>
</template>

<style scoped>
.app-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: #0b1120;
}

.app-header__title-group {
  min-width: 0;
}

.app-header__eyebrow,
.app-header__subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
}

.app-header__eyebrow {
  text-transform: uppercase;
}

.app-header__title {
  margin: 4px 0;
  color: #f8fafc;
  font-size: 20px;
  line-height: 1.2;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .app-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-header__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
