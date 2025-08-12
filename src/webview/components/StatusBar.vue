<!--
状态栏组件
基于原版界面的状态栏功能
显示采集状态、进度信息、设备状态等
-->

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import {
    Connection,
    Disconnect,
    DataLine,
    Grid,
    Cpu,
    Monitor,
    MemoryCard,
    Clock,
    Document,
    ZoomIn,
    ZoomOut,
    Close,
    SuccessFilled,
    WarningFilled,
    CircleCloseFilled,
    InfoFilled
  } from '@element-plus/icons-vue';

  // 接口定义
  interface CaptureInfo {
    isActive: boolean;
    status: 'idle' | 'preparing' | 'capturing' | 'processing' | 'completed' | 'error';
    statusText: string;
    progress: number;
    showProgress: boolean;
  }

  interface SampleInfo {
    totalSamples: number;
    sampleRate: number;
    duration: number;
  }

  interface ChannelInfo {
    total: number;
    active: number;
    withData: number;
  }

  interface DecoderInfo {
    active: number;
    results: number;
  }

  interface GlobalProgress {
    show: boolean;
    title: string;
    detail: string;
    percentage: number;
    status: 'success' | 'exception' | 'warning' | undefined;
    cancellable: boolean;
  }

  interface PerformanceInfo {
    show: boolean;
    cpu: number;
    memory: number;
  }

  interface FileInfo {
    name: string;
    modified: boolean;
  }

  interface ZoomInfo {
    show: boolean;
    level: number;
    canZoomIn: boolean;
    canZoomOut: boolean;
  }

  interface NotificationInfo {
    show: boolean;
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
    icon: any;
  }

  // Props
  interface Props {
    deviceConnected?: boolean;
    deviceName?: string;
    captureState?: any;
    sampleData?: any;
    channels?: any[];
    decoders?: any[];
    fileName?: string;
    fileModified?: boolean;
    showPerformance?: boolean;
    showZoom?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    deviceConnected: false,
    deviceName: '',
    channels: () => [],
    decoders: () => [],
    fileName: '',
    fileModified: false,
    showPerformance: false,
    showZoom: false
  });

  // Emits
  const emit = defineEmits<{
    'zoom-in': [];
    'zoom-out': [];
    'cancel-operation': [];
    'notification-dismissed': [];
  }>();

  // 响应式数据
  const currentTime = ref('');
  const timeInterval = ref<NodeJS.Timeout | null>(null);

  const captureInfo = ref<CaptureInfo>({
    isActive: false,
    status: 'idle',
    statusText: '就绪',
    progress: 0,
    showProgress: false
  });

  const sampleInfo = ref<SampleInfo>({
    totalSamples: 0,
    sampleRate: 0,
    duration: 0
  });

  const channelInfo = ref<ChannelInfo>({
    total: 0,
    active: 0,
    withData: 0
  });

  const decoderInfo = ref<DecoderInfo>({
    active: 0,
    results: 0
  });

  const globalProgress = ref<GlobalProgress>({
    show: false,
    title: '',
    detail: '',
    percentage: 0,
    status: undefined,
    cancellable: false
  });

  const performanceInfo = ref<PerformanceInfo>({
    show: props.showPerformance,
    cpu: 0,
    memory: 0
  });

  const fileInfo = ref<FileInfo>({
    name: props.fileName,
    modified: props.fileModified
  });

  const zoomInfo = ref<ZoomInfo>({
    show: props.showZoom,
    level: 100,
    canZoomIn: true,
    canZoomOut: true
  });

  const notification = ref<NotificationInfo>({
    show: false,
    type: 'info',
    message: '',
    icon: InfoFilled
  });

  // 计算属性
  const deviceStatusIcon = computed(() => {
    return props.deviceConnected ? Connection : Disconnect;
  });

  const deviceStatusText = computed(() => {
    if (props.deviceConnected) {
      return props.deviceName || '设备已连接';
    }
    return '设备未连接';
  });

  // 方法
  const updateTime = () => {
    currentTime.value = new Date().toLocaleTimeString();
  };

  const updateChannelInfo = () => {
    channelInfo.value = {
      total: props.channels.length,
      active: props.channels.filter(ch => !ch.hidden).length,
      withData: props.channels.filter(ch => ch.hasData).length
    };
  };

  const updateDecoderInfo = () => {
    decoderInfo.value = {
      active: props.decoders.filter(d => d.active).length,
      results: props.decoders.reduce((sum, d) => sum + (d.resultCount || 0), 0)
    };
  };

  const updateSampleInfo = () => {
    if (props.sampleData) {
      sampleInfo.value = {
        totalSamples: props.sampleData.totalSamples || 0,
        sampleRate: props.sampleData.sampleRate || 0,
        duration: props.sampleData.duration || 0
      };
    }
  };

  const updatePerformanceInfo = () => {
    if (!performanceInfo.value.show) return;

    // 模拟性能数据 - 实际应用中应该从真实的性能监控API获取
    performanceInfo.value.cpu = Math.floor(Math.random() * 20) + 5; // 5-25%
    performanceInfo.value.memory = Math.floor(Math.random() * 100 * 1024 * 1024) + 50 * 1024 * 1024; // 50-150MB
  };

  const showNotification = (type: NotificationInfo['type'], message: string) => {
    const icons = {
      success: SuccessFilled,
      warning: WarningFilled,
      error: CircleCloseFilled,
      info: InfoFilled
    };

    notification.value = {
      show: true,
      type,
      message,
      icon: icons[type]
    };

    // 自动消失
    setTimeout(() => {
      dismissNotification();
    }, 5000);
  };

  const dismissNotification = () => {
    notification.value.show = false;
    emit('notification-dismissed');
  };

  const showGlobalProgress = (title: string, detail: string = '', cancellable: boolean = true) => {
    globalProgress.value = {
      show: true,
      title,
      detail,
      percentage: 0,
      status: undefined,
      cancellable
    };
  };

  const updateGlobalProgress = (percentage: number, detail?: string, status?: GlobalProgress['status']) => {
    globalProgress.value.percentage = percentage;
    if (detail !== undefined) {
      globalProgress.value.detail = detail;
    }
    if (status !== undefined) {
      globalProgress.value.status = status;
    }
  };

  const hideGlobalProgress = () => {
    globalProgress.value.show = false;
  };

  const cancelOperation = () => {
    emit('cancel-operation');
  };

  const zoomIn = () => {
    emit('zoom-in');
  };

  const zoomOut = () => {
    emit('zoom-out');
  };

  const updateZoomInfo = (level: number, canZoomIn: boolean, canZoomOut: boolean) => {
    zoomInfo.value = {
      show: props.showZoom,
      level,
      canZoomIn,
      canZoomOut
    };
  };

  const updateCaptureStatus = (status: CaptureInfo['status'], progress?: number) => {
    const statusTexts = {
      idle: '就绪',
      preparing: '准备中',
      capturing: '采集中',
      processing: '处理中',
      completed: '完成',
      error: '错误'
    };

    captureInfo.value = {
      isActive: status !== 'idle' && status !== 'completed',
      status,
      statusText: statusTexts[status],
      progress: progress || 0,
      showProgress: status === 'capturing' || status === 'processing'
    };
  };

  // 格式化函数
  const formatNumber = (num: number): string => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}G`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000000000) {
      return `${(freq / 1000000000).toFixed(1)}GHz`;
    } else if (freq >= 1000000) {
      return `${(freq / 1000000).toFixed(1)}MHz`;
    } else if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}KHz`;
    }
    return `${freq}Hz`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds >= 1) {
      return `${seconds.toFixed(3)}s`;
    } else if (seconds >= 0.001) {
      return `${(seconds * 1000).toFixed(3)}ms`;
    } else if (seconds >= 0.000001) {
      return `${(seconds * 1000000).toFixed(3)}µs`;
    }
    return `${(seconds * 1000000000).toFixed(3)}ns`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`;
    }
    return `${bytes}B`;
  };

  // 暴露方法给父组件
  defineExpose({
    showNotification,
    showGlobalProgress,
    updateGlobalProgress,
    hideGlobalProgress,
    updateCaptureStatus,
    updateZoomInfo
  });

  // 生命周期
  onMounted(() => {
    updateTime();
    timeInterval.value = setInterval(() => {
      updateTime();
      updatePerformanceInfo();
    }, 1000);

    updateChannelInfo();
    updateDecoderInfo();
    updateSampleInfo();
  });

  onUnmounted(() => {
    if (timeInterval.value) {
      clearInterval(timeInterval.value);
    }
  });

  // 监听props变化
  watch(() => props.channels, updateChannelInfo, { deep: true });
  watch(() => props.decoders, updateDecoderInfo, { deep: true });
  watch(() => props.sampleData, updateSampleInfo, { deep: true });
  watch(() => props.fileName, (newName) => {
    fileInfo.value.name = newName;
  });
  watch(() => props.fileModified, (modified) => {
    fileInfo.value.modified = modified;
  });
</script>

<template>
  <div class="status-bar">
    <!-- 左侧状态信息 -->
    <div class="status-left">
      <!-- 设备状态 -->
      <div class="status-item device-status">
        <el-icon :class="deviceStatusIcon">
          <component :is="deviceStatusIcon" />
        </el-icon>
        <span class="status-text">{{ deviceStatusText }}</span>
      </div>

      <!-- 采集状态 -->
      <div
        v-if="captureInfo.isActive"
        class="status-item capture-status"
      >
        <div
          class="status-indicator"
          :class="captureInfo.status"
        />
        <span class="status-text">{{ captureInfo.statusText }}</span>

        <!-- 进度条 -->
        <div
          v-if="captureInfo.showProgress"
          class="progress-container"
        >
          <el-progress
            :percentage="captureInfo.progress"
            :show-text="false"
            :stroke-width="4"
            class="status-progress"
          />
          <span class="progress-text">{{ captureInfo.progress }}%</span>
        </div>
      </div>

      <!-- 采样信息 -->
      <div
        v-if="sampleInfo.totalSamples > 0"
        class="status-item sample-info"
      >
        <el-icon><DataLine /></el-icon>
        <span class="status-text">
          样本: {{ formatNumber(sampleInfo.totalSamples) }}
        </span>
        <span class="status-divider">|</span>
        <span class="status-text">
          频率: {{ formatFrequency(sampleInfo.sampleRate) }}
        </span>
        <span class="status-divider">|</span>
        <span class="status-text">
          持续: {{ formatTime(sampleInfo.duration) }}
        </span>
      </div>

      <!-- 通道信息 -->
      <div
        v-if="channelInfo.total > 0"
        class="status-item channel-info"
      >
        <el-icon><Grid /></el-icon>
        <span class="status-text">
          通道: {{ channelInfo.active }}/{{ channelInfo.total }}
        </span>
        <span
          v-if="channelInfo.withData > 0"
          class="status-text"
        >
          ({{ channelInfo.withData }} 有数据)
        </span>
      </div>

      <!-- 解码器状态 -->
      <div
        v-if="decoderInfo.active > 0"
        class="status-item decoder-info"
      >
        <el-icon><Cpu /></el-icon>
        <span class="status-text">
          解码器: {{ decoderInfo.active }}
        </span>
        <span
          v-if="decoderInfo.results > 0"
          class="status-text"
        >
          ({{ decoderInfo.results }} 结果)
        </span>
      </div>
    </div>

    <!-- 中间进度显示区域 -->
    <div
      v-if="globalProgress.show"
      class="status-center"
    >
      <div class="global-progress">
        <div class="progress-info">
          <span class="progress-title">{{ globalProgress.title }}</span>
          <span class="progress-detail">{{ globalProgress.detail }}</span>
        </div>
        <el-progress
          :percentage="globalProgress.percentage"
          :status="globalProgress.status"
          :stroke-width="6"
          class="main-progress"
        />
        <div class="progress-actions">
          <el-button
            v-if="globalProgress.cancellable"
            size="small"
            type="danger"
            @click="cancelOperation"
          >
            取消
          </el-button>
        </div>
      </div>
    </div>

    <!-- 右侧系统信息 -->
    <div class="status-right">
      <!-- 性能监控 -->
      <div
        v-if="performanceInfo.show"
        class="status-item performance-info"
      >
        <el-tooltip
          content="CPU使用率"
          placement="top"
        >
          <div class="perf-item">
            <el-icon><Monitor /></el-icon>
            <span class="perf-value">{{ performanceInfo.cpu }}%</span>
          </div>
        </el-tooltip>
        <el-tooltip
          content="内存使用"
          placement="top"
        >
          <div class="perf-item">
            <el-icon><MemoryCard /></el-icon>
            <span class="perf-value">{{ formatBytes(performanceInfo.memory) }}</span>
          </div>
        </el-tooltip>
      </div>

      <!-- 时间戳 -->
      <div class="status-item timestamp">
        <el-icon><Clock /></el-icon>
        <span class="status-text">{{ currentTime }}</span>
      </div>

      <!-- 文件状态 -->
      <div
        v-if="fileInfo.name"
        class="status-item file-info"
      >
        <el-icon><Document /></el-icon>
        <span class="status-text">{{ fileInfo.name }}</span>
        <el-tag
          v-if="fileInfo.modified"
          size="small"
          type="warning"
          class="modified-indicator"
        >
          *
        </el-tag>
      </div>

      <!-- 缩放信息 -->
      <div
        v-if="zoomInfo.show"
        class="status-item zoom-info"
      >
        <el-button-group size="small">
          <el-button
            :icon="ZoomOut"
            :disabled="!zoomInfo.canZoomOut"
            @click="zoomOut"
          />
          <el-button
            class="zoom-level"
            disabled
          >
            {{ zoomInfo.level }}%
          </el-button>
          <el-button
            :icon="ZoomIn"
            :disabled="!zoomInfo.canZoomIn"
            @click="zoomIn"
          />
        </el-button-group>
      </div>
    </div>

    <!-- 通知弹出 -->
    <transition name="notification-slide">
      <div
        v-if="notification.show"
        class="status-notification"
        :class="notification.type"
      >
        <el-icon>
          <component :is="notification.icon" />
        </el-icon>
        <span class="notification-text">{{ notification.message }}</span>
        <el-button
          type="text"
          :icon="Close"
          class="notification-close"
          @click="dismissNotification"
        />
      </div>
    </transition>
  </div>
</template>

<style scoped>
  .status-bar {
    display: flex;
    align-items: center;
    height: 32px;
    background-color: #f5f7fa;
    border-top: 1px solid #ebeef5;
    padding: 0 16px;
    font-size: 12px;
    color: #606266;
    position: relative;
    z-index: 100;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .status-left {
    flex: 1;
  }

  .status-right {
    flex-shrink: 0;
  }

  .status-center {
    flex: 2;
    display: flex;
    justify-content: center;
    padding: 0 32px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .status-text {
    font-size: 12px;
  }

  .status-divider {
    color: #c0c4cc;
    margin: 0 4px;
  }

  .device-status .el-icon {
    font-size: 14px;
  }

  .device-status .el-icon.Connection {
    color: #67c23a;
  }

  .device-status .el-icon.Disconnect {
    color: #f56c6c;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  .status-indicator.capturing {
    background-color: #67c23a;
  }

  .status-indicator.processing {
    background-color: #e6a23c;
  }

  .status-indicator.error {
    background-color: #f56c6c;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 8px;
  }

  .status-progress {
    width: 80px;
  }

  .progress-text {
    font-size: 11px;
    color: #909399;
    min-width: 30px;
  }

  .global-progress {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    max-width: 500px;
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 120px;
  }

  .progress-title {
    font-weight: 500;
    color: #303133;
  }

  .progress-detail {
    font-size: 11px;
    color: #909399;
  }

  .main-progress {
    flex: 1;
  }

  .progress-actions {
    flex-shrink: 0;
  }

  .performance-info {
    display: flex;
    gap: 12px;
  }

  .perf-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .perf-value {
    font-family: monospace;
    font-size: 11px;
  }

  .modified-indicator {
    margin-left: 4px;
  }

  .zoom-level {
    font-family: monospace;
    font-size: 11px;
    min-width: 50px;
  }

  .status-notification {
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 4px;
    background-color: #fff;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    border: 1px solid #ebeef5;
    z-index: 1000;
  }

  .status-notification.success {
    border-color: #67c23a;
    color: #67c23a;
  }

  .status-notification.warning {
    border-color: #e6a23c;
    color: #e6a23c;
  }

  .status-notification.error {
    border-color: #f56c6c;
    color: #f56c6c;
  }

  .status-notification.info {
    border-color: #409eff;
    color: #409eff;
  }

  .notification-text {
    font-size: 13px;
  }

  .notification-close {
    margin-left: 8px;
    padding: 0;
    width: 16px;
    height: 16px;
  }

  .notification-slide-enter-active,
  .notification-slide-leave-active {
    transition: all 0.3s ease;
  }

  .notification-slide-enter-from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }

  .notification-slide-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
</style>
