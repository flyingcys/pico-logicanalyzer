<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Connection,
  QuestionFilled,
  RefreshRight,
  VideoPause,
  VideoPlay
} from '@element-plus/icons-vue';
import { useDeviceStore } from '../../core/stores/deviceStore';
import { useUiStore } from '../../core/stores/uiStore';
import { useHost } from '../composables/useHost';
import LanguageSwitcher from './LanguageSwitcher.vue';
import ShortcutHelpDialog from './ShortcutHelpDialog.vue';

const props = defineProps<{
  title: string;
  hasDocument: boolean;
}>();

const uiStore = useUiStore();
const deviceStore = useDeviceStore();
const host = useHost({ fallback: 'auto' });

const subtitle = computed(() => (props.hasDocument ? '会话已加载' : '等待文档'));
const canStartCapture = computed(() => deviceStore.isConnected && !deviceStore.isCapturing);
const canStopCapture = computed(() => deviceStore.isConnected && deviceStore.isCapturing);
const canRepeatCapture = computed(() =>
  deviceStore.isConnected &&
  !deviceStore.isCapturing &&
  Boolean(deviceStore.lastCaptureConfig)
);

function openShortcutHelp() {
  uiStore.showShortcutHelp = true;
}

async function refreshStatus() {
  const result = await host.sendCommand('getStatus');
  if (result.success && result.data) {
    deviceStore.applyStatus(result.data as any);
    return;
  }

  if (result.error) {
    deviceStore.setError(result.error);
  }
}

async function connectDevice() {
  deviceStore.setConnecting(true);
  const result = await host.sendCommand('connectDevice');
  deviceStore.setConnecting(false);

  if (!result.success) {
    ElMessage.error(result.error || '连接设备失败');
    return;
  }

  await refreshStatus();
}

async function startCapture() {
  if (!canStartCapture.value) {
    return;
  }

  deviceStore.setCapturing(true);
  const result = await host.sendCommand('startCapture', {
    config: deviceStore.captureConfig
  });
  deviceStore.setCapturing(false);

  if (!result.success) {
    ElMessage.error(result.error || '采集失败');
    await refreshStatus();
    return;
  }

  if (result.data) {
    deviceStore.applyStatus(result.data as any);
  }
}

async function stopCapture() {
  if (!deviceStore.isConnected) {
    return;
  }

  const result = await host.sendCommand('stopCapture');
  if (!result.success) {
    ElMessage.error(result.error || '停止采集失败');
  }

  await refreshStatus();
}

async function repeatCapture() {
  if (!canRepeatCapture.value) {
    return;
  }

  deviceStore.setCapturing(true);
  const result = await host.sendCommand('repeatCapture');
  deviceStore.setCapturing(false);

  if (!result.success) {
    ElMessage.error(result.error || '重复采集失败');
    await refreshStatus();
    return;
  }

  if (result.data) {
    deviceStore.applyStatus(result.data as any);
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
