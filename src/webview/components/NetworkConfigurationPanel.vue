<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Connection, Search, Close, Refresh, CircleFilled,
  Tools, Download
} from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import type { WiFiDeviceInfo, NetworkScanResult } from '../../services/WiFiDeviceDiscovery';

// 组合式API
const { t } = useI18n();

// 响应式数据
const isScanning = ref(false);
const scanProgress = ref(0);
const scanStatus = ref<'normal' | 'success' | 'exception'>('normal');
const scanStatusText = ref('');
const scanDuration = ref(0);
const discoveredDevices = ref<WiFiDeviceInfo[]>([]);
const selectedDevice = ref<WiFiDeviceInfo | null>(null);
const currentConnection = ref<WiFiDeviceInfo | null>(null);
const connectionStatus = ref<'connected' | 'disconnected' | 'connecting'>('disconnected');
const isConnecting = ref(false);
const isSendingConfig = ref(false);
const expandedSections = ref(['manual']);
const isDiagnosticRunning = ref(false);
const diagnosticResults = ref<any[] | null>(null);

// 手动连接表单
const manualConnection = reactive({
  ipAddress: '192.168.1.100',
  port: 4045
});

// WiFi配置表单
const wifiConfig = reactive({
  ssid: '',
  password: '',
  staticIp: '192.168.1.100',
  port: 4045
});

// 表单验证规则
const connectionRules = {
  ipAddress: [
    { required: true, message: t('network.validation.ipRequired'), trigger: 'blur' },
    {
      pattern: /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      message: t('network.validation.ipInvalid'),
      trigger: 'blur'
    }
  ],
  port: [
    { required: true, message: t('network.validation.portRequired'), trigger: 'blur' }
  ]
};

const wifiRules = {
  ssid: [
    { required: true, message: t('network.validation.ssidRequired'), trigger: 'blur' },
    { min: 1, max: 32, message: t('network.validation.ssidLength'), trigger: 'blur' }
  ],
  password: [
    { min: 8, max: 63, message: t('network.validation.passwordLength'), trigger: 'blur' }
  ],
  staticIp: [
    {
      pattern: /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      message: t('network.validation.ipInvalid'),
      trigger: 'blur'
    }
  ]
};

// 计算属性
const onlineDevicesCount = computed(() =>
  discoveredDevices.value.filter(device => device.isOnline).length
);

// 扫描进度格式化
const formatProgress = (percentage: number) => {
  if (percentage === 100 && scanStatus.value === 'success') {
    return t('network.scan.completed');
  }
  return `${percentage}%`;
};

// 时间格式化
const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

// 方法定义
const startDeviceDiscovery = async () => {
  isScanning.value = true;
  scanProgress.value = 0;
  scanStatus.value = 'normal';
  scanStatusText.value = t('network.scan.starting');
  scanDuration.value = 0;

  try {
    // 模拟扫描进度
    const progressInterval = setInterval(() => {
      if (scanProgress.value < 90) {
        scanProgress.value += Math.random() * 15;
        if (scanProgress.value > 90) scanProgress.value = 90;
      }
    }, 500);

    // 通过vscode API调用WiFiDeviceDiscovery服务
    const result = await window.vscode.postMessage({
      command: 'scanForDevices',
      payload: {
        timeout: 5000,
        concurrency: 30,
        deepScan: true,
        enableBroadcast: true
      }
    });

    clearInterval(progressInterval);

    if (result.success) {
      discoveredDevices.value = result.data.devices;
      scanProgress.value = 100;
      scanStatus.value = 'success';
      scanStatusText.value = t('network.scan.found', { count: result.data.devices.length });
      scanDuration.value = result.data.scanDuration;

      ElMessage.success(
        t('network.scan.success', {
          count: result.data.devices.length,
          duration: Math.round(result.data.scanDuration / 1000)
        })
      );
    } else {
      throw new Error(result.error || 'Scan failed');
    }
  } catch (error) {
    scanProgress.value = 100;
    scanStatus.value = 'exception';
    scanStatusText.value = t('network.scan.failed');

    ElMessage.error(t('network.scan.error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  } finally {
    isScanning.value = false;
  }
};

const stopDeviceDiscovery = async () => {
  try {
    await window.vscode.postMessage({
      command: 'stopScan'
    });

    isScanning.value = false;
    scanStatusText.value = t('network.scan.stopped');
    ElMessage.info(t('network.scan.stopped'));
  } catch (error) {
    ElMessage.error(t('network.scan.stopError'));
  }
};

const refreshDeviceList = async () => {
  try {
    const result = await window.vscode.postMessage({
      command: 'getCachedDevices'
    });

    if (result.success) {
      discoveredDevices.value = result.data;
      ElMessage.success(t('network.refresh.success'));
    }
  } catch (error) {
    ElMessage.error(t('network.refresh.error'));
  }
};

const selectDevice = (device: WiFiDeviceInfo) => {
  selectedDevice.value = device;
  // 自动填充手动连接表单
  manualConnection.ipAddress = device.ipAddress;
  manualConnection.port = device.port;
};

const connectToDevice = async (device: WiFiDeviceInfo) => {
  if (!device.isOnline) {
    ElMessage.warning(t('network.connect.deviceOffline'));
    return;
  }

  await connectManually(device.ipAddress, device.port);
};

const connectManually = async (ip?: string, port?: number) => {
  const targetIp = ip || manualConnection.ipAddress;
  const targetPort = port || manualConnection.port;

  if (!targetIp || !targetPort) {
    ElMessage.error(t('network.connect.invalidParams'));
    return;
  }

  isConnecting.value = true;
  connectionStatus.value = 'connecting';

  try {
    const result = await window.vscode.postMessage({
      command: 'connectToDevice',
      payload: {
        ipAddress: targetIp,
        port: targetPort
      }
    });

    if (result.success) {
      currentConnection.value = result.data.deviceInfo;
      connectionStatus.value = 'connected';
      ElMessage.success(t('network.connect.success', {
        device: result.data.deviceInfo.name
      }));
    } else {
      throw new Error(result.error || 'Connection failed');
    }
  } catch (error) {
    connectionStatus.value = 'disconnected';
    ElMessage.error(t('network.connect.error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  } finally {
    isConnecting.value = false;
  }
};

const disconnectDevice = async () => {
  try {
    await window.vscode.postMessage({
      command: 'disconnectDevice'
    });

    currentConnection.value = null;
    connectionStatus.value = 'disconnected';
    ElMessage.success(t('network.disconnect.success'));
  } catch (error) {
    ElMessage.error(t('network.disconnect.error'));
  }
};

const sendWifiConfig = async () => {
  if (!selectedDevice.value) {
    ElMessage.warning(t('network.wifi.noDeviceSelected'));
    return;
  }

  // 验证表单
  const wifiForm = document.querySelector('.wifi-config form') as any;
  if (wifiForm) {
    const isValid = await wifiForm.validate();
    if (!isValid) return;
  }

  const confirm = await ElMessageBox.confirm(
    t('network.wifi.sendConfigConfirm'),
    t('network.wifi.configTitle'),
    {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).catch(() => false);

  if (!confirm) return;

  isSendingConfig.value = true;

  try {
    const result = await window.vscode.postMessage({
      command: 'sendNetworkConfig',
      payload: {
        device: selectedDevice.value,
        config: {
          ssid: wifiConfig.ssid,
          password: wifiConfig.password,
          ipAddress: wifiConfig.staticIp,
          port: wifiConfig.port
        }
      }
    });

    if (result.success) {
      ElMessage.success(t('network.wifi.configSent'));
      resetWifiForm();
    } else {
      throw new Error(result.error || 'Config send failed');
    }
  } catch (error) {
    ElMessage.error(t('network.wifi.configError', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  } finally {
    isSendingConfig.value = false;
  }
};

const resetWifiForm = () => {
  wifiConfig.ssid = '';
  wifiConfig.password = '';
  wifiConfig.staticIp = '192.168.1.100';
  wifiConfig.port = 4045;
};

const runNetworkDiagnostics = async () => {
  if (!currentConnection.value) {
    ElMessage.warning(t('network.diagnostics.noConnection'));
    return;
  }

  isDiagnosticRunning.value = true;

  try {
    const result = await window.vscode.postMessage({
      command: 'runNetworkDiagnostics',
      payload: {
        device: currentConnection.value
      }
    });

    if (result.success) {
      diagnosticResults.value = result.data;
      ElMessage.success(t('network.diagnostics.completed'));
    } else {
      throw new Error(result.error || 'Diagnostics failed');
    }
  } catch (error) {
    ElMessage.error(t('network.diagnostics.error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  } finally {
    isDiagnosticRunning.value = false;
  }
};

const exportDiagnostics = () => {
  if (!diagnosticResults.value) return;

  const data = JSON.stringify(diagnosticResults.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `network-diagnostics-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
  ElMessage.success(t('network.diagnostics.exported'));
};

// 生命周期
onMounted(() => {
  // 自动加载缓存的设备列表
  refreshDeviceList();
});

onUnmounted(() => {
  // 清理资源
  if (isScanning.value) {
    stopDeviceDiscovery();
  }
});

// 为了支持VSCode webview通信
declare global {
  interface Window {
    vscode: {
      postMessage: (message: any) => Promise<any>;
    };
  }
}
</script>

<template>
  <div class="network-configuration-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <el-icon><Connection /></el-icon>
        {{ t('network.configuration.title') }}
      </h3>
      <div class="header-actions">
        <el-button
          v-if="!isScanning"
          type="primary"
          size="small"
          :loading="isScanning"
          @click="startDeviceDiscovery"
        >
          <el-icon><Search /></el-icon>
          {{ t('network.scan.start') }}
        </el-button>
        <el-button
          v-else
          type="danger"
          size="small"
          @click="stopDeviceDiscovery"
        >
          <el-icon><Close /></el-icon>
          {{ t('network.scan.stop') }}
        </el-button>
        <el-button
          size="small"
          :disabled="isScanning"
          @click="refreshDeviceList"
        >
          <el-icon><Refresh /></el-icon>
          {{ t('network.refresh') }}
        </el-button>
      </div>
    </div>

    <!-- 扫描状态和进度 -->
    <div
      v-if="isScanning"
      class="scan-status"
    >
      <el-progress
        :percentage="scanProgress"
        :status="scanStatus"
        :format="formatProgress"
      />
      <div class="scan-info">
        <span>{{ scanStatusText }}</span>
        <span v-if="scanDuration > 0">{{ t('network.scan.duration', { duration: scanDuration }) }}</span>
      </div>
    </div>

    <!-- 设备列表 -->
    <div class="device-section">
      <div class="section-header">
        <h4>{{ t('network.devices.discovered') }} ({{ discoveredDevices.length }})</h4>
        <el-tag
          v-if="onlineDevicesCount > 0"
          type="success"
          size="small"
        >
          {{ t('network.devices.online', { count: onlineDevicesCount }) }}
        </el-tag>
      </div>

      <!-- 设备表格 -->
      <el-table
        :data="discoveredDevices"
        class="device-table"
        :empty-text="t('network.devices.empty')"
        @row-click="selectDevice"
      >
        <el-table-column width="50">
          <template #default="{ row }">
            <el-icon
              :color="row.isOnline ? '#67C23A' : '#F56C6C'"
              size="16"
            >
              <CircleFilled />
            </el-icon>
          </template>
        </el-table-column>

        <el-table-column
          :label="t('network.device.name')"
          prop="deviceName"
          min-width="150"
        >
          <template #default="{ row }">
            <div class="device-name">
              <strong>{{ row.deviceName || 'Unknown Device' }}</strong>
              <small v-if="row.version">v{{ row.version }}</small>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          :label="t('network.device.address')"
          prop="ipAddress"
          width="120"
        />

        <el-table-column
          :label="t('network.device.port')"
          prop="port"
          width="80"
        />

        <el-table-column
          :label="t('network.device.responseTime')"
          width="100"
        >
          <template #default="{ row }">
            {{ row.responseTime }}ms
          </template>
        </el-table-column>

        <el-table-column
          :label="t('network.device.lastSeen')"
          width="120"
        >
          <template #default="{ row }">
            {{ formatTime(row.lastSeen) }}
          </template>
        </el-table-column>

        <el-table-column
          :label="t('common.actions')"
          width="120"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :disabled="!row.isOnline"
              @click.stop="connectToDevice(row)"
            >
              {{ t('network.connect') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 手动连接区域 -->
    <el-collapse
      v-model="expandedSections"
      class="manual-connect"
    >
      <el-collapse-item
        :title="t('network.manual.title')"
        name="manual"
      >
        <el-form
          ref="connectionForm"
          :model="manualConnection"
          :rules="connectionRules"
          label-width="100px"
          size="small"
        >
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item
                :label="t('network.manual.ip')"
                prop="ipAddress"
              >
                <el-input
                  v-model="manualConnection.ipAddress"
                  :placeholder="t('network.manual.ipPlaceholder')"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="t('network.manual.port')"
                prop="port"
              >
                <el-input-number
                  v-model="manualConnection.port"
                  :min="1"
                  :max="65535"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item>
                <el-button
                  type="primary"
                  :loading="isConnecting"
                  @click="connectManually"
                >
                  {{ t('network.connect') }}
                </el-button>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-collapse-item>
    </el-collapse>

    <!-- WiFi配置区域 -->
    <el-collapse
      v-model="expandedSections"
      class="wifi-config"
    >
      <el-collapse-item
        :title="t('network.wifi.configTitle')"
        name="wifi-config"
      >
        <el-alert
          :title="t('network.wifi.configWarning')"
          type="warning"
          :closable="false"
          show-icon
          class="config-warning"
        />

        <el-form
          ref="wifiForm"
          :model="wifiConfig"
          :rules="wifiRules"
          label-width="120px"
          size="small"
        >
          <el-form-item
            :label="t('network.wifi.ssid')"
            prop="ssid"
          >
            <el-input
              v-model="wifiConfig.ssid"
              :placeholder="t('network.wifi.ssidPlaceholder')"
              maxlength="32"
              show-word-limit
            />
          </el-form-item>

          <el-form-item
            :label="t('network.wifi.password')"
            prop="password"
          >
            <el-input
              v-model="wifiConfig.password"
              type="password"
              :placeholder="t('network.wifi.passwordPlaceholder')"
              maxlength="63"
              show-word-limit
              show-password
            />
          </el-form-item>

          <el-form-item
            :label="t('network.wifi.staticIp')"
            prop="staticIp"
          >
            <el-input
              v-model="wifiConfig.staticIp"
              :placeholder="t('network.wifi.staticIpPlaceholder')"
            />
          </el-form-item>

          <el-form-item
            :label="t('network.wifi.port')"
            prop="port"
          >
            <el-input-number
              v-model="wifiConfig.port"
              :min="1024"
              :max="65535"
              :step="1"
              controls-position="right"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              :loading="isSendingConfig"
              :disabled="!selectedDevice"
              @click="sendWifiConfig"
            >
              {{ t('network.wifi.sendConfig') }}
            </el-button>
            <el-button @click="resetWifiForm">
              {{ t('common.reset') }}
            </el-button>
            <small class="form-hint">
              {{ t('network.wifi.configHint') }}
            </small>
          </el-form-item>
        </el-form>
      </el-collapse-item>
    </el-collapse>

    <!-- 连接状态显示 -->
    <div
      v-if="currentConnection"
      class="connection-status"
    >
      <el-card class="status-card">
        <template #header>
          <div class="card-header">
            <span>{{ t('network.connection.current') }}</span>
            <el-button
              type="danger"
              size="small"
              text
              @click="disconnectDevice"
            >
              {{ t('network.disconnect') }}
            </el-button>
          </div>
        </template>

        <div class="connection-info">
          <div class="info-item">
            <strong>{{ t('network.device.name') }}:</strong>
            {{ currentConnection.deviceName }}
          </div>
          <div class="info-item">
            <strong>{{ t('network.device.address') }}:</strong>
            {{ currentConnection.ipAddress }}:{{ currentConnection.port }}
          </div>
          <div class="info-item">
            <strong>{{ t('network.device.version') }}:</strong>
            {{ currentConnection.version }}
          </div>
          <div class="info-item">
            <strong>{{ t('network.connection.status') }}:</strong>
            <el-tag
              :type="connectionStatus === 'connected' ? 'success' : 'danger'"
              size="small"
            >
              {{ t(`network.connection.${connectionStatus}`) }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 网络诊断区域 -->
    <el-collapse
      v-model="expandedSections"
      class="network-diagnostics"
    >
      <el-collapse-item
        :title="t('network.diagnostics.title')"
        name="diagnostics"
      >
        <div class="diagnostics-actions">
          <el-button
            :loading="isDiagnosticRunning"
            type="primary"
            size="small"
            @click="runNetworkDiagnostics"
          >
            <el-icon><Tools /></el-icon>
            {{ t('network.diagnostics.run') }}
          </el-button>
          <el-button
            :disabled="!diagnosticResults"
            size="small"
            @click="exportDiagnostics"
          >
            <el-icon><Download /></el-icon>
            {{ t('network.diagnostics.export') }}
          </el-button>
        </div>

        <div
          v-if="diagnosticResults"
          class="diagnostic-results"
        >
          <el-table
            :data="diagnosticResults"
            size="small"
          >
            <el-table-column
              :label="t('network.diagnostics.test')"
              prop="testName"
            />
            <el-table-column
              :label="t('network.diagnostics.result')"
              width="100"
            >
              <template #default="{ row }">
                <el-tag
                  :type="row.passed ? 'success' : 'danger'"
                  size="small"
                >
                  {{ row.passed ? t('common.passed') : t('common.failed') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('network.diagnostics.details')"
              prop="details"
            />
          </el-table>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.network-configuration-panel {
  padding: 16px;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vscode-widget-border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.scan-status {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--vscode-input-background);
  border-radius: 6px;
  border: 1px solid var(--vscode-input-border);
}

.scan-info {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.device-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.device-table {
  border: 1px solid var(--vscode-widget-border);
  border-radius: 6px;
}

.device-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-name small {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}

.manual-connect,
.wifi-config,
.network-diagnostics {
  margin-bottom: 16px;
}

.config-warning {
  margin-bottom: 16px;
}

.form-hint {
  color: var(--vscode-descriptionForeground);
  margin-left: 8px;
}

.connection-status {
  margin-bottom: 16px;
}

.status-card {
  border: 1px solid var(--vscode-widget-border);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-item {
  font-size: 13px;
}

.diagnostics-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.diagnostic-results {
  margin-top: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .header-actions {
    justify-content: space-between;
  }

  .connection-info {
    grid-template-columns: 1fr;
  }
}
</style>
