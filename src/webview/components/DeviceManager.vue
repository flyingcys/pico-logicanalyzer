<!--
设备管理器组件
基于 @logicanalyzer/Software 的设备管理功能
提供现代化的设备列表、连接状态和配置界面
-->

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import {
    Connection,
    Refresh,
    Plus,
    Search,
    DataLine,
    Timer,
    Monitor
  } from '@element-plus/icons-vue';
  import { ElMessage, ElMessageBox } from 'element-plus';

  // 设备接口定义
  interface Device {
    id: string;
    name: string;
    version: string;
    description: string;
    channels: number;
    maxFrequency: number;
    bufferSize: number;
    available: boolean;
    isNetwork: boolean;
    networkAddress?: string;
    capabilities?: {
      maxSampleRate: number;
      minSampleRate: number;
      streamingSupport: boolean;
      triggerTypes?: string[];
      triggerChannels?: number;
    };
  }

  // 响应式数据
  const isScanning = ref(false);
  const isDisconnecting = ref(false);
  const isCapturing = ref(false);
  const connectingDeviceId = ref<string | null>(null);
  const selectedDeviceId = ref<string | null>(null);
  const searchQuery = ref('');

  const currentDevice = ref<Device | null>(null);
  const availableDevices = ref<Device[]>([]);

  // 对话框状态
  const showAddDeviceDialog = ref(false);
  const showDeviceInfoDialog = ref(false);
  const selectedDeviceForInfo = ref<Device | null>(null);

  // 添加设备表单
  const newDeviceForm = ref({
    type: '',
    ipAddress: '',
    port: 8080,
    serialPort: '',
    baudRate: 115200
  });

  const availableSerialPorts = ref<string[]>([]);

  // 计算属性
  const filteredDevices = computed(() => {
    if (!searchQuery.value) {
      return availableDevices.value;
    }

    const query = searchQuery.value.toLowerCase();
    return availableDevices.value.filter(
      device =>
        device.name.toLowerCase().includes(query) ||
        device.description.toLowerCase().includes(query) ||
        device.id.toLowerCase().includes(query)
    );
  });

  // 方法
  const scanDevices = async () => {
    isScanning.value = true;
    try {
      // 模拟设备扫描 - 实际实现中应该调用后端API
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟发现的设备
      availableDevices.value = [
        {
          id: 'pico-001',
          name: 'Pico Logic Analyzer',
          version: 'v2.1.0',
          description: 'Raspberry Pi Pico 逻辑分析器',
          channels: 24,
          maxFrequency: 120000000,
          bufferSize: 16384,
          available: true,
          isNetwork: false,
          capabilities: {
            maxSampleRate: 120000000,
            minSampleRate: 1000,
            streamingSupport: true,
            triggerTypes: ['edge', 'pattern', 'complex'],
            triggerChannels: 24
          }
        },
        {
          id: 'network-001',
          name: 'Network Logic Analyzer',
          version: 'v1.5.2',
          description: '网络逻辑分析器设备',
          channels: 16,
          maxFrequency: 100000000,
          bufferSize: 32768,
          available: true,
          isNetwork: true,
          networkAddress: '192.168.1.100:8080',
          capabilities: {
            maxSampleRate: 100000000,
            minSampleRate: 1000,
            streamingSupport: false,
            triggerTypes: ['edge', 'pattern'],
            triggerChannels: 16
          }
        }
      ];

      ElMessage.success(`发现 ${availableDevices.value.length} 个设备`);
    } catch (error) {
      ElMessage.error('设备扫描失败');
    } finally {
      isScanning.value = false;
    }
  };

  const selectDevice = (device: Device) => {
    selectedDeviceId.value = device.id;
  };

  const connectToDevice = async (device: Device) => {
    connectingDeviceId.value = device.id;
    try {
      // 模拟连接过程
      await new Promise(resolve => setTimeout(resolve, 1500));

      currentDevice.value = { ...device };
      ElMessage.success(`已连接到设备: ${device.name}`);
    } catch (error) {
      ElMessage.error('设备连接失败');
    } finally {
      connectingDeviceId.value = null;
    }
  };

  const disconnectDevice = async () => {
    if (!currentDevice.value) return;

    try {
      await ElMessageBox.confirm(
        `确定要断开与设备 "${currentDevice.value.name}" 的连接吗？`,
        '确认断开',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );

      isDisconnecting.value = true;
      // 模拟断开连接
      await new Promise(resolve => setTimeout(resolve, 1000));

      ElMessage.success(`已断开与设备 "${currentDevice.value.name}" 的连接`);
      currentDevice.value = null;
    } catch {
      // 用户取消
    } finally {
      isDisconnecting.value = false;
    }
  };

  const showDeviceInfo = (device: Device) => {
    selectedDeviceForInfo.value = device;
    showDeviceInfoDialog.value = true;
  };

  const addDevice = async () => {
    // 实现添加设备逻辑
    ElMessage.success('设备添加功能开发中...');
    showAddDeviceDialog.value = false;
  };

  // 格式化函数
  const formatFrequency = (freq: number): string => {
    if (freq >= 1000000000) {
      return `${(freq / 1000000000).toFixed(1)} GHz`;
    } else if (freq >= 1000000) {
      return `${(freq / 1000000).toFixed(1)} MHz`;
    } else if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)} KHz`;
    }
    return `${freq} Hz`;
  };

  const formatSize = (size: number): string => {
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    } else if (size >= 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${size} B`;
  };

  // 生命周期
  onMounted(() => {
    scanDevices();
  });

  onUnmounted(() => {
    // 清理资源
  });
</script>

<template>
  <div class="device-manager">
    <!-- 设备管理头部 -->
    <div class="device-header">
      <h3 class="device-title">
        <el-icon><Connection /></el-icon>
        设备管理
      </h3>
      <div class="device-actions">
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="isScanning"
          size="small"
          @click="scanDevices"
        >
          {{ isScanning ? '扫描中...' : '扫描设备' }}
        </el-button>
        <el-button
          type="success"
          :icon="Plus"
          size="small"
          @click="showAddDeviceDialog = true"
        >
          添加设备
        </el-button>
      </div>
    </div>

    <!-- 当前连接设备 -->
    <div
      v-if="currentDevice"
      class="current-device"
    >
      <el-card
        shadow="never"
        class="device-card current"
      >
        <template #header>
          <div class="card-header">
            <span class="device-status connected">
              <el-icon><Connection /></el-icon>
              当前连接设备
            </span>
            <el-button
              type="danger"
              size="small"
              :loading="isDisconnecting"
              @click="disconnectDevice"
            >
              断开连接
            </el-button>
          </div>
        </template>

        <div class="device-info">
          <div class="device-main">
            <h4 class="device-name">
              {{ currentDevice.name }}
            </h4>
            <p class="device-desc">
              {{ currentDevice.version }}
            </p>

            <div class="device-capabilities">
              <el-tag
                size="small"
                class="capability-tag"
              >
                <el-icon><DataLine /></el-icon>
                {{ currentDevice.channels }}通道
              </el-tag>
              <el-tag
                size="small"
                class="capability-tag"
              >
                <el-icon><Timer /></el-icon>
                {{ formatFrequency(currentDevice.maxFrequency) }}
              </el-tag>
              <el-tag
                size="small"
                class="capability-tag"
              >
                <el-icon><Monitor /></el-icon>
                {{ formatSize(currentDevice.bufferSize) }}
              </el-tag>
            </div>
          </div>

          <div class="device-status-info">
            <div class="status-item">
              <span class="status-label">连接状态:</span>
              <el-tag
                type="success"
                size="small"
              >
                已连接
              </el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">采集状态:</span>
              <el-tag
                :type="isCapturing ? 'warning' : 'info'"
                size="small"
              >
                {{ isCapturing ? '采集中' : '空闲' }}
              </el-tag>
            </div>
            <div
              v-if="currentDevice.isNetwork"
              class="status-item"
            >
              <span class="status-label">网络地址:</span>
              <span class="status-value">{{ currentDevice.networkAddress }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 可用设备列表 -->
    <div class="available-devices">
      <div class="section-header">
        <h4>可用设备 ({{ availableDevices.length }})</h4>
        <el-input
          v-model="searchQuery"
          placeholder="搜索设备..."
          :prefix-icon="Search"
          size="small"
          class="search-input"
          clearable
        />
      </div>

      <div
        v-if="filteredDevices.length === 0"
        class="no-devices"
      >
        <el-empty
          :image-size="80"
          description="暂无可用设备"
        >
          <el-button
            type="primary"
            :icon="Refresh"
            @click="scanDevices"
          >
            扫描设备
          </el-button>
        </el-empty>
      </div>

      <div
        v-else
        class="device-grid"
      >
        <el-card
          v-for="device in filteredDevices"
          :key="device.id"
          class="device-card"
          shadow="hover"
          :class="{
            'device-unavailable': !device.available,
            'device-selected': selectedDeviceId === device.id
          }"
          @click="selectDevice(device)"
        >
          <div class="device-info">
            <div class="device-main">
              <div class="device-header-info">
                <h4 class="device-name">
                  {{ device.name }}
                </h4>
                <div class="device-badges">
                  <el-tag
                    v-if="device.isNetwork"
                    size="small"
                    type="info"
                  >
                    网络
                  </el-tag>
                  <el-tag
                    v-if="!device.available"
                    size="small"
                    type="danger"
                  >
                    不可用
                  </el-tag>
                </div>
              </div>

              <p class="device-desc">
                {{ device.description }}
              </p>

              <div class="device-capabilities">
                <el-tag
                  size="small"
                  class="capability-tag"
                >
                  <el-icon><DataLine /></el-icon>
                  {{ device.channels }}通道
                </el-tag>
                <el-tag
                  size="small"
                  class="capability-tag"
                >
                  <el-icon><Timer /></el-icon>
                  {{ formatFrequency(device.maxFrequency) }}
                </el-tag>
                <el-tag
                  size="small"
                  class="capability-tag"
                >
                  <el-icon><Monitor /></el-icon>
                  {{ formatSize(device.bufferSize) }}
                </el-tag>
              </div>
            </div>

            <div class="device-actions-row">
              <el-button
                type="primary"
                size="small"
                :disabled="!device.available || device.id === currentDevice?.id"
                :loading="connectingDeviceId === device.id"
                @click.stop="connectToDevice(device)"
              >
                {{ connectingDeviceId === device.id ? '连接中...' : '连接' }}
              </el-button>
              <el-button
                size="small"
                @click.stop="showDeviceInfo(device)"
              >
                详情
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 添加设备对话框 -->
    <el-dialog
      v-model="showAddDeviceDialog"
      title="添加设备"
      width="500px"
    >
      <el-form
        :model="newDeviceForm"
        label-width="80px"
      >
        <el-form-item label="设备类型">
          <el-select
            v-model="newDeviceForm.type"
            placeholder="选择设备类型"
          >
            <el-option
              label="网络设备"
              value="network"
            />
            <el-option
              label="串口设备"
              value="serial"
            />
            <el-option
              label="模拟设备"
              value="emulated"
            />
          </el-select>
        </el-form-item>

        <template v-if="newDeviceForm.type === 'network'">
          <el-form-item label="IP地址">
            <el-input
              v-model="newDeviceForm.ipAddress"
              placeholder="192.168.1.100"
            />
          </el-form-item>
          <el-form-item label="端口">
            <el-input-number
              v-model="newDeviceForm.port"
              :min="1"
              :max="65535"
            />
          </el-form-item>
        </template>

        <template v-if="newDeviceForm.type === 'serial'">
          <el-form-item label="串口">
            <el-select
              v-model="newDeviceForm.serialPort"
              placeholder="选择串口"
            >
              <el-option
                v-for="port in availableSerialPorts"
                :key="port"
                :label="port"
                :value="port"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="波特率">
            <el-select v-model="newDeviceForm.baudRate">
              <el-option
                label="115200"
                :value="115200"
              />
              <el-option
                label="921600"
                :value="921600"
              />
            </el-select>
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="showAddDeviceDialog = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="addDevice"
        >
          添加
        </el-button>
      </template>
    </el-dialog>

    <!-- 设备详情对话框 -->
    <el-dialog
      v-model="showDeviceInfoDialog"
      :title="selectedDeviceForInfo?.name || '设备详情'"
      width="600px"
    >
      <div
        v-if="selectedDeviceForInfo"
        class="device-detail"
      >
        <el-descriptions
          :column="2"
          border
        >
          <el-descriptions-item label="设备名称">
            {{ selectedDeviceForInfo.name }}
          </el-descriptions-item>
          <el-descriptions-item label="设备版本">
            {{ selectedDeviceForInfo.version }}
          </el-descriptions-item>
          <el-descriptions-item label="连接方式">
            {{ selectedDeviceForInfo.isNetwork ? '网络' : '串口' }}
          </el-descriptions-item>
          <el-descriptions-item label="可用状态">
            <el-tag :type="selectedDeviceForInfo.available ? 'success' : 'danger'">
              {{ selectedDeviceForInfo.available ? '可用' : '不可用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="通道数量">
            {{ selectedDeviceForInfo.channels }}
          </el-descriptions-item>
          <el-descriptions-item label="最大频率">
            {{ formatFrequency(selectedDeviceForInfo.maxFrequency) }}
          </el-descriptions-item>
          <el-descriptions-item label="缓冲区大小">
            {{ formatSize(selectedDeviceForInfo.bufferSize) }}
          </el-descriptions-item>
          <el-descriptions-item label="设备ID">
            {{ selectedDeviceForInfo.id }}
          </el-descriptions-item>
        </el-descriptions>

        <div
          v-if="selectedDeviceForInfo.capabilities"
          class="capabilities-section"
        >
          <h4>设备能力</h4>
          <div class="capabilities-grid">
            <div class="capability-item">
              <strong>采样能力:</strong>
              <ul>
                <li>
                  最大采样率:
                  {{ formatFrequency(selectedDeviceForInfo.capabilities.maxSampleRate) }}
                </li>
                <li>
                  最小采样率:
                  {{ formatFrequency(selectedDeviceForInfo.capabilities.minSampleRate) }}
                </li>
                <li>
                  支持流式采集:
                  {{ selectedDeviceForInfo.capabilities.streamingSupport ? '是' : '否' }}
                </li>
              </ul>
            </div>
            <div class="capability-item">
              <strong>触发能力:</strong>
              <ul>
                <li>
                  触发类型:
                  {{ selectedDeviceForInfo.capabilities.triggerTypes?.join(', ') || '基础触发' }}
                </li>
                <li>
                  触发通道: {{ selectedDeviceForInfo.capabilities.triggerChannels || '全部' }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
  .device-manager {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .device-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .device-actions {
    display: flex;
    gap: 8px;
  }

  .current-device {
    margin-bottom: 24px;
  }

  .device-card {
    margin-bottom: 12px;
    transition: all 0.3s ease;
  }

  .device-card.current {
    border-color: #67c23a;
  }

  .device-card.device-unavailable {
    opacity: 0.6;
  }

  .device-card.device-selected {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .device-status.connected {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #67c23a;
    font-weight: 500;
  }

  .device-info {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .device-main {
    flex: 1;
  }

  .device-header-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .device-name {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .device-desc {
    margin: 0 0 12px 0;
    color: #606266;
    font-size: 14px;
  }

  .device-badges {
    display: flex;
    gap: 4px;
  }

  .device-capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .capability-tag {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .device-status-info {
    min-width: 200px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .status-label {
    font-size: 14px;
    color: #606266;
  }

  .status-value {
    font-size: 14px;
    font-family: monospace;
  }

  .available-devices {
    margin-top: 24px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .section-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .search-input {
    width: 200px;
  }

  .no-devices {
    text-align: center;
    padding: 40px;
  }

  .device-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 16px;
  }

  .device-actions-row {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .device-detail {
    max-height: 60vh;
    overflow-y: auto;
  }

  .capabilities-section {
    margin-top: 20px;
  }

  .capabilities-section h4 {
    margin-bottom: 12px;
  }

  .capabilities-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .capability-item ul {
    margin: 8px 0;
    padding-left: 20px;
  }

  .capability-item li {
    margin-bottom: 4px;
    font-size: 14px;
  }
</style>
