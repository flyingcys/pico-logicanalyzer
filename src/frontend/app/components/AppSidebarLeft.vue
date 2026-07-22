<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useDeviceStore, type FrontendTriggerType } from '../../core/stores/deviceStore';
import { useSessionStore } from '../../core/stores/sessionStore';
import { useHost } from '../composables/useHost';
import { createDeviceCaptureCommands } from '../composables/deviceCaptureCommands';

const deviceStore = useDeviceStore();
const sessionStore = useSessionStore();
const host = useHost({ fallback: 'auto' });
const captureCommands = createDeviceCaptureCommands({
  host,
  deviceStore,
  sessionStore,
  notify: ElMessage
});
const manualSerialPath = ref('');
const manualNetworkAddress = ref('');
const scannedDevices = ref<Array<{
  id?: string;
  name?: string;
  ipAddress?: string;
  port?: number;
  connectionString?: string;
  connectionPath?: string;
}>>([]);

const triggerTypes: Array<{ label: string; value: FrontendTriggerType }> = [
  { label: 'Edge', value: 'Edge' },
  { label: 'Fast', value: 'Fast' },
  { label: 'Complex', value: 'Complex' },
  { label: 'Blast', value: 'Blast' }
];

const deviceStatus = computed(() => {
  if (deviceStore.isCapturing) {
    return '采集中';
  }

  if (deviceStore.isConnecting) {
    return '连接中';
  }

  if (deviceStore.isConnected) {
    return '已连接';
  }

  return '未连接';
});

const activeModeLimits = computed(() => deviceStore.activeModeLimits);
const frequencyMin = computed(() => Math.max(deviceStore.limits?.minFrequency ?? 1000, 1));
const frequencyMax = computed(() => deviceStore.limits?.maxFrequency ?? 100000000);
const channelOptions = computed(() => deviceStore.captureConfig.channels.map(channel => ({
  label: channel.name || `Channel ${channel.number + 1}`,
  value: channel.number
})));
const selectedChannels = computed({
  get: () => deviceStore.captureConfig.channels
    .filter(channel => channel.enabled)
    .map(channel => channel.number),
  set: (selected: number[]) => {
    deviceStore.captureConfig.channels.forEach(channel => {
      channel.enabled = selected.includes(channel.number);
    });
  }
});

const selectedChannelRows = computed(() =>
  deviceStore.captureConfig.channels.filter(channel => channel.enabled)
);

const summaryItems = computed(() => [
  {
    label: '文档',
    value: sessionStore.fileName || '未加载'
  },
  {
    label: '设备',
    value: deviceStatus.value
  },
  {
    label: '连接',
    value: deviceStore.deviceLabel
  },
  {
    label: '数据',
    value: sessionStore.hasData ? '已解析' : '无数据'
  }
]);

async function refreshStatus() {
  await captureCommands.refreshStatus();
}

async function detectDevices() {
  const result = await host.sendCommand('detectDevices');
  if (!result.success) {
    ElMessage.error(result.error || '设备检测失败');
    return;
  }

  ElMessage.success(`检测到 ${Array.isArray(result.data) ? result.data.length : 0} 个设备`);
}

async function scanNetworkDevices() {
  const result = await captureCommands.scanNetworkDevices({ timeoutMs: 5000 });
  if (!result.success) {
    return;
  }

  scannedDevices.value = Array.isArray(result.data) ? result.data as typeof scannedDevices.value : [];
  ElMessage.success(`扫描到 ${scannedDevices.value.length} 个网络设备`);
}

async function connectManual(kind: 'serial' | 'network') {
  const value = (kind === 'serial' ? manualSerialPath.value : manualNetworkAddress.value).trim();
  if (!value) {
    ElMessage.error(kind === 'serial' ? '请输入串口路径' : '请输入网络地址');
    return;
  }

  await captureCommands.connectDevice({
    type: kind,
    address: value
  });
}

async function connectScannedNetworkDevice(device: typeof scannedDevices.value[number]) {
  const address = device.connectionString ||
    (device.ipAddress && device.port ? `${device.ipAddress}:${device.port}` : '');
  if (!address) {
    ElMessage.error('扫描结果缺少网络地址');
    return;
  }

  manualNetworkAddress.value = address;
  await captureCommands.connectDevice({
    type: 'network',
    address,
    deviceId: device.id
  });
}

async function disconnectDevice() {
  await captureCommands.disconnectDevice();
}

function selectAllChannels() {
  deviceStore.captureConfig.channels.forEach(channel => {
    channel.enabled = true;
  });
}

function clearChannels() {
  deviceStore.captureConfig.channels.forEach(channel => {
    channel.enabled = false;
  });
}

function invertChannels() {
  deviceStore.captureConfig.channels.forEach(channel => {
    channel.enabled = !channel.enabled;
  });
}

onMounted(() => {
  void refreshStatus();
});
</script>

<template>
  <section class="app-sidebar-left">
    <header class="app-sidebar-left__header">
      <h2 class="app-sidebar-left__title">
        设备与采集
      </h2>
      <el-tag
        size="small"
        :type="deviceStore.isConnected ? 'success' : 'info'"
      >
        {{ deviceStatus }}
      </el-tag>
    </header>

    <dl class="app-sidebar-left__summary">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="app-sidebar-left__row"
      >
        <dt>{{ item.label }}</dt>
        <dd>{{ item.value }}</dd>
      </div>
    </dl>

    <div class="app-sidebar-left__commands">
      <el-button
        size="small"
        @click="detectDevices"
      >
        检测
      </el-button>
      <el-button
        size="small"
        @click="scanNetworkDevices"
      >
        扫描网络
      </el-button>
    </div>

    <div class="connection-fields">
      <el-input
        v-model="manualSerialPath"
        size="small"
        placeholder="/dev/ttyUSB0 或 COM3"
        clearable
      >
        <template #append>
          <el-button @click="connectManual('serial')">
            串口
          </el-button>
        </template>
      </el-input>
      <el-input
        v-model="manualNetworkAddress"
        size="small"
        placeholder="192.168.1.100:4045"
        clearable
      >
        <template #append>
          <el-button @click="connectManual('network')">
            网络
          </el-button>
        </template>
      </el-input>
      <el-button
        size="small"
        class="connection-fields__disconnect"
        :disabled="!deviceStore.isConnected"
        @click="disconnectDevice"
      >
        断开
      </el-button>
    </div>

    <ul
      v-if="scannedDevices.length > 0"
      class="scanned-devices"
    >
      <li
        v-for="device in scannedDevices"
        :key="device.id || device.connectionString || device.connectionPath || device.name"
      >
        <span>{{ device.name || device.connectionString || '网络设备' }}</span>
        <el-button
          size="small"
          link
          @click="connectScannedNetworkDevice(device)"
        >
          连接
        </el-button>
      </li>
    </ul>

    <el-form
      label-position="top"
      class="capture-form"
    >
      <el-form-item label="采样频率">
        <el-input-number
          v-model="deviceStore.captureConfig.frequency"
          :min="frequencyMin"
          :max="frequencyMax"
          :step="100000"
          controls-position="right"
        />
        <p :class="['capture-form__hint', `capture-form__hint--${deviceStore.frequencyJitterLevel}`]">
          {{ deviceStore.frequencyJitterText }}
        </p>
      </el-form-item>

      <div class="capture-form__grid">
        <el-form-item label="Pre Samples">
          <el-input-number
            v-model="deviceStore.captureConfig.preTriggerSamples"
            :min="activeModeLimits?.minPreSamples ?? 0"
            :max="activeModeLimits?.maxPreSamples ?? 1000000"
            controls-position="right"
          />
        </el-form-item>

        <el-form-item label="Post Samples">
          <el-input-number
            v-model="deviceStore.captureConfig.postTriggerSamples"
            :min="activeModeLimits?.minPostSamples ?? 1"
            :max="activeModeLimits?.maxPostSamples ?? 1000000"
            controls-position="right"
          />
        </el-form-item>
      </div>

      <el-form-item label="触发模式">
        <el-radio-group
          v-model="deviceStore.captureConfig.triggerType"
          size="small"
        >
          <el-radio-button
            v-for="triggerType in triggerTypes"
            :key="triggerType.value"
            :label="triggerType.value"
          >
            {{ triggerType.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <div class="capture-form__grid">
        <el-form-item label="触发通道">
          <el-select v-model="deviceStore.captureConfig.triggerChannel">
            <el-option
              v-for="channel in channelOptions"
              :key="channel.value"
              :label="channel.label"
              :value="channel.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="触发反相">
          <el-switch v-model="deviceStore.captureConfig.triggerInverted" />
        </el-form-item>
      </div>

      <div
        v-if="deviceStore.captureConfig.triggerType !== 'Edge'"
        class="capture-form__grid"
      >
        <el-form-item label="Pattern">
          <el-input-number
            v-model="deviceStore.captureConfig.triggerPattern"
            :min="0"
            :max="65535"
            controls-position="right"
          />
        </el-form-item>

        <el-form-item label="Bit Count">
          <el-input-number
            v-model="deviceStore.captureConfig.triggerBitCount"
            :min="1"
            :max="16"
            controls-position="right"
          />
        </el-form-item>
      </div>

      <div
        v-if="deviceStore.captureConfig.triggerType === 'Blast'"
        class="capture-form__grid"
      >
        <el-form-item label="Loop Count">
          <el-input-number
            v-model="deviceStore.captureConfig.loopCount"
            :min="0"
            :max="255"
            controls-position="right"
          />
        </el-form-item>

        <el-form-item label="Burst 测量">
          <el-switch v-model="deviceStore.captureConfig.measureBursts" />
        </el-form-item>
      </div>

      <el-form-item label="采集通道">
        <el-select
          v-model="selectedChannels"
          multiple
          collapse-tags
          collapse-tags-tooltip
        >
          <el-option
            v-for="channel in channelOptions"
            :key="channel.value"
            :label="channel.label"
            :value="channel.value"
          />
        </el-select>
        <div class="capture-form__channel-tools">
          <el-button
            size="small"
            @click="selectAllChannels"
          >
            全选
          </el-button>
          <el-button
            size="small"
            @click="clearChannels"
          >
            全不选
          </el-button>
          <el-button
            size="small"
            @click="invertChannels"
          >
            反选
          </el-button>
        </div>
      </el-form-item>

      <div class="channel-names">
        <label
          v-for="channel in selectedChannelRows"
          :key="channel.number"
          class="channel-names__row"
        >
          <span>CH{{ channel.number + 1 }}</span>
          <el-input
            v-model="channel.name"
            size="small"
          />
        </label>
      </div>
    </el-form>
  </section>
</template>

<style scoped>
.app-sidebar-left {
  display: grid;
  gap: 16px;
  min-height: 100%;
  padding: 16px;
  overflow: auto;
}

.app-sidebar-left__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.app-sidebar-left__title {
  margin: 0;
  color: #f8fafc;
  font-size: 18px;
}

.app-sidebar-left__summary {
  display: grid;
  gap: 10px;
  margin: 0;
}

.app-sidebar-left__row {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
}

.app-sidebar-left__row dt {
  color: #94a3b8;
  font-size: 12px;
}

.app-sidebar-left__row dd {
  margin: 0;
  color: #e2e8f0;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.app-sidebar-left__commands,
.capture-form__channel-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.connection-fields {
  display: grid;
  gap: 8px;
}

.connection-fields__disconnect {
  justify-self: start;
}

.scanned-devices {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.scanned-devices li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: #cbd5e1;
  font-size: 12px;
}

.scanned-devices span {
  overflow-wrap: anywhere;
}

.capture-form {
  display: grid;
  gap: 8px;
}

.capture-form :deep(.el-form-item) {
  margin-bottom: 8px;
}

.capture-form :deep(.el-input-number),
.capture-form :deep(.el-select),
.capture-form :deep(.el-radio-group) {
  width: 100%;
}

.capture-form__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.capture-form__hint {
  margin: 6px 0 0;
  font-size: 12px;
}

.capture-form__hint--normal {
  color: #22c55e;
}

.capture-form__hint--medium {
  color: #facc15;
}

.capture-form__hint--high {
  color: #fb7185;
}

.channel-names {
  display: grid;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
}

.channel-names__row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: #cbd5e1;
  font-size: 12px;
}

@media (max-width: 720px) {
  .capture-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
