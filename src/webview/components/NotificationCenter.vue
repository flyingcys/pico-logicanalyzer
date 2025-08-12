<!--
通知中心组件
提供统一的错误处理、消息提示和操作指导
-->

<script setup lang="ts">
  import { ref, reactive, onMounted, onUnmounted } from 'vue';
  import {
    Close,
    Warning,
    QuestionFilled,
    MemoryCard,
    Connection,
    Disconnect,
    Loading,
    SuccessFilled,
    InfoFilled,
    CircleCloseFilled,
    Eleme
  } from '@element-plus/icons-vue';
  import { ElMessage, ElMessageBox } from 'element-plus';

  // 接口定义
  interface OperationTooltip {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'help';
    title: string;
    description?: string;
    icon: any;
    position: { x: number; y: number };
    duration: number; // 自动消失时间，-1 表示不自动消失
    actions?: TooltipAction[];
  }

  interface TooltipAction {
    id: string;
    label: string;
    type: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'text';
    size?: 'large' | 'default' | 'small';
    action: () => void;
  }

  interface ConnectionStatus {
    show: boolean;
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    text: string;
    icon: any;
    progress: number; // -1 表示不显示进度
  }

  interface PerformanceWarning {
    show: boolean;
    level: 'low' | 'medium' | 'high' | 'critical';
    details: string;
  }

  interface MemoryUsage {
    show: boolean;
    used: number;
    total: number;
    isHigh: boolean;
  }

  interface GlobalLoading {
    show: boolean;
    text: string;
    detail: string;
    progress: number; // -1 表示不显示进度
    status: 'success' | 'exception' | 'warning' | undefined;
    cancellable: boolean;
  }

  interface HelpBubble {
    show: boolean;
    title: string;
    text: string;
    target: HTMLElement | null;
    position: 'top' | 'bottom' | 'left' | 'right';
    actions?: { id: string; label: string; type: string; action: () => void }[];
  }

  // Props
  interface Props {
    showPerformanceIndicator?: boolean;
    showMemoryUsage?: boolean;
    autoHideTooltips?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    showPerformanceIndicator: true,
    showMemoryUsage: true,
    autoHideTooltips: true
  });

  // Emits
  const emit = defineEmits<{
    'global-operation-cancelled': [];
    'performance-warning-clicked': [];
    'memory-details-requested': [];
    'connection-details-requested': [];
  }>();

  // 响应式数据
  const activeTooltips = ref<OperationTooltip[]>([]);
  const tooltipIdCounter = ref(0);

  const globalLoading = reactive<GlobalLoading>({
    show: false,
    text: '',
    detail: '',
    progress: -1,
    status: undefined,
    cancellable: false
  });

  const connectionStatus = reactive<ConnectionStatus>({
    show: true,
    status: 'disconnected',
    text: '未连接',
    icon: Disconnect,
    progress: -1
  });

  const performanceWarning = reactive<PerformanceWarning>({
    show: false,
    level: 'low',
    details: ''
  });

  const memoryUsage = reactive<MemoryUsage>({
    show: props.showMemoryUsage,
    used: 0,
    total: 0,
    isHigh: false
  });

  const helpBubble = reactive<HelpBubble>({
    show: false,
    title: '',
    text: '',
    target: null,
    position: 'top'
  });

  // 方法
  const showTooltip = (tooltip: Omit<OperationTooltip, 'id'>) => {
    const id = `tooltip-${++tooltipIdCounter.value}`;
    const fullTooltip: OperationTooltip = { ...tooltip, id };

    activeTooltips.value.push(fullTooltip);

    // 自动消失
    if (props.autoHideTooltips && tooltip.duration > 0) {
      setTimeout(() => {
        dismissTooltip(id);
      }, tooltip.duration);
    }

    return id;
  };

  const dismissTooltip = (id: string) => {
    const index = activeTooltips.value.findIndex(t => t.id === id);
    if (index >= 0) {
      activeTooltips.value.splice(index, 1);
    }
  };

  const executeTooltipAction = (tooltipId: string, action: TooltipAction) => {
    try {
      action.action();
      dismissTooltip(tooltipId);
    } catch (error) {
      console.error('执行提示操作失败:', error);
      ElMessage.error('操作失败');
    }
  };

  const getTooltipStyle = (tooltip: OperationTooltip) => ({
    left: `${tooltip.position.x}px`,
    top: `${tooltip.position.y}px`
  });

  const showGlobalLoading = (
    text: string,
    detail: string = '',
    cancellable: boolean = false
  ) => {
    globalLoading.show = true;
    globalLoading.text = text;
    globalLoading.detail = detail;
    globalLoading.progress = -1;
    globalLoading.status = undefined;
    globalLoading.cancellable = cancellable;
  };

  const updateGlobalLoadingProgress = (
    progress: number,
    detail?: string,
    status?: GlobalLoading['status']
  ) => {
    globalLoading.progress = progress;
    if (detail !== undefined) {
      globalLoading.detail = detail;
    }
    if (status !== undefined) {
      globalLoading.status = status;
    }
  };

  const hideGlobalLoading = () => {
    globalLoading.show = false;
  };

  const cancelGlobalOperation = () => {
    emit('global-operation-cancelled');
    hideGlobalLoading();
  };

  const updateConnectionStatus = (
    status: ConnectionStatus['status'],
    text?: string,
    progress?: number
  ) => {
    connectionStatus.status = status;
    connectionStatus.progress = progress ?? -1;

    const statusConfig = {
      connected: { text: '已连接', icon: Connection },
      connecting: { text: '连接中', icon: Loading },
      disconnected: { text: '未连接', icon: Disconnect },
      error: { text: '连接错误', icon: CircleCloseFilled }
    };

    const config = statusConfig[status];
    connectionStatus.text = text || config.text;
    connectionStatus.icon = config.icon;
  };

  const updatePerformanceWarning = (level: PerformanceWarning['level'], details: string) => {
    performanceWarning.show = level !== 'low';
    performanceWarning.level = level;
    performanceWarning.details = details;

    if (level === 'critical') {
      ElMessage.warning('系统性能严重不足，建议减少数据处理量');
    }
  };

  const updateMemoryUsage = (used: number, total: number) => {
    memoryUsage.used = used;
    memoryUsage.total = total;
    memoryUsage.isHigh = used / total > 0.8;

    if (memoryUsage.isHigh) {
      performanceWarning.show = true;
      if (performanceWarning.level === 'low') {
        performanceWarning.level = 'medium';
        performanceWarning.details = '内存使用率过高';
      }
    }
  };

  const showHelpBubble = (
    title: string,
    text: string,
    target: HTMLElement,
    position: HelpBubble['position'] = 'top',
    actions?: HelpBubble['actions']
  ) => {
    helpBubble.show = true;
    helpBubble.title = title;
    helpBubble.text = text;
    helpBubble.target = target;
    helpBubble.position = position;
    helpBubble.actions = actions;
  };

  const hideHelpBubble = () => {
    helpBubble.show = false;
  };

  const getHelpBubbleStyle = () => {
    if (!helpBubble.target) return {};

    const rect = helpBubble.target.getBoundingClientRect();
    const offset = 10;

    switch (helpBubble.position) {
      case 'top':
        return {
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.top - offset}px`,
          transform: 'translateX(-50%) translateY(-100%)'
        };
      case 'bottom':
        return {
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.bottom + offset}px`,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          left: `${rect.left - offset}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: 'translateX(-100%) translateY(-50%)'
        };
      case 'right':
        return {
          left: `${rect.right + offset}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: 'translateY(-50%)'
        };
      default:
        return {};
    }
  };

  const executeHelpAction = (action: any) => {
    try {
      action.action();
      hideHelpBubble();
    } catch (error) {
      console.error('执行帮助操作失败:', error);
    }
  };

  const showConnectionDetails = () => {
    emit('connection-details-requested');
  };

  const showPerformanceDetails = () => {
    emit('performance-warning-clicked');
    ElMessageBox.alert(performanceWarning.details, '性能警告', {
      type: 'warning'
    });
  };

  const showMemoryDetails = () => {
    emit('memory-details-requested');
    ElMessageBox.alert(
      `内存使用: ${formatBytes(memoryUsage.used)} / ${formatBytes(memoryUsage.total)}`,
      '内存使用情况',
      { type: 'info' }
    );
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

  // 监听全局事件
  const handleGlobalError = (event: ErrorEvent) => {
    showTooltip({
      type: 'error',
      title: '发生错误',
      description: event.message,
      icon: CircleCloseFilled,
      position: { x: window.innerWidth / 2, y: 100 },
      duration: 5000
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    showTooltip({
      type: 'error',
      title: 'Promise 错误',
      description: event.reason?.message || '未处理的Promise拒绝',
      icon: CircleCloseFilled,
      position: { x: window.innerWidth / 2, y: 100 },
      duration: 5000
    });
  };

  // 生命周期
  onMounted(() => {
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 模拟性能监控
    if (props.showPerformanceIndicator) {
      setInterval(() => {
        const cpuUsage = Math.random() * 100;
        const memUsage = Math.random() * 200 * 1024 * 1024; // 0-200MB

        updateMemoryUsage(memUsage, 512 * 1024 * 1024); // 总内存512MB

        if (cpuUsage > 80) {
          updatePerformanceWarning('high', 'CPU使用率过高');
        } else if (cpuUsage > 60) {
          updatePerformanceWarning('medium', 'CPU使用率较高');
        } else {
          updatePerformanceWarning('low', '');
        }
      }, 5000);
    }
  });

  onUnmounted(() => {
    window.removeEventListener('error', handleGlobalError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  });

  // 暴露方法
  defineExpose({
    showTooltip,
    dismissTooltip,
    showGlobalLoading,
    updateGlobalLoadingProgress,
    hideGlobalLoading,
    updateConnectionStatus,
    updatePerformanceWarning,
    updateMemoryUsage,
    showHelpBubble,
    hideHelpBubble
  });
</script>

<template>
  <div class="notification-center">
    <!-- 全局加载指示器 -->
    <div
      v-if="globalLoading.show"
      class="global-loading-overlay"
    >
      <div class="loading-content">
        <el-loading
          :text="globalLoading.text"
          :spinner="Eleme"
          background="rgba(0, 0, 0, 0.7)"
          element-loading-text="Loading..."
        />
        <div
          v-if="globalLoading.progress >= 0"
          class="loading-progress"
        >
          <el-progress
            :percentage="globalLoading.progress"
            :status="globalLoading.status"
            :stroke-width="6"
          />
          <div class="progress-details">
            <span class="progress-text">{{ globalLoading.detail }}</span>
            <span class="progress-percent">{{ globalLoading.progress }}%</span>
          </div>
        </div>
        <el-button
          v-if="globalLoading.cancellable"
          type="danger"
          size="small"
          class="cancel-button"
          @click="cancelGlobalOperation"
        >
          取消操作
        </el-button>
      </div>
    </div>

    <!-- 操作提示 -->
    <transition-group
      name="tooltip"
      tag="div"
      class="tooltips-container"
    >
      <div
        v-for="tooltip in activeTooltips"
        :key="tooltip.id"
        class="operation-tooltip"
        :class="tooltip.type"
        :style="getTooltipStyle(tooltip)"
      >
        <div class="tooltip-content">
          <el-icon class="tooltip-icon">
            <component :is="tooltip.icon" />
          </el-icon>
          <div class="tooltip-text">
            <div class="tooltip-title">
              {{ tooltip.title }}
            </div>
            <div
              v-if="tooltip.description"
              class="tooltip-description"
            >
              {{ tooltip.description }}
            </div>
          </div>
          <el-button
            type="text"
            :icon="Close"
            class="tooltip-close"
            @click="dismissTooltip(tooltip.id)"
          />
        </div>
        <div
          v-if="tooltip.actions"
          class="tooltip-actions"
        >
          <el-button
            v-for="action in tooltip.actions"
            :key="action.id"
            :type="action.type"
            :size="action.size || 'small'"
            @click="executeTooltipAction(tooltip.id, action)"
          >
            {{ action.label }}
          </el-button>
        </div>
      </div>
    </transition-group>

    <!-- 状态指示器 -->
    <div class="status-indicators">
      <!-- 连接状态 -->
      <div
        v-if="connectionStatus.show"
        class="status-indicator connection-status"
        :class="connectionStatus.status"
        @click="showConnectionDetails"
      >
        <el-icon class="status-icon">
          <component :is="connectionStatus.icon" />
        </el-icon>
        <span class="status-text">{{ connectionStatus.text }}</span>
        <div
          v-if="connectionStatus.progress >= 0"
          class="status-progress"
        >
          <div
            class="progress-bar"
            :style="{ width: `${connectionStatus.progress}%` }"
          />
        </div>
      </div>

      <!-- 性能警告 -->
      <div
        v-if="performanceWarning.show"
        class="status-indicator performance-warning"
        @click="showPerformanceDetails"
      >
        <el-icon class="status-icon">
          <Warning />
        </el-icon>
        <span class="status-text">性能</span>
        <div class="warning-badge">
          {{ performanceWarning.level }}
        </div>
      </div>

      <!-- 内存使用 -->
      <div
        v-if="memoryUsage.show"
        class="status-indicator memory-usage"
        :class="{ warning: memoryUsage.isHigh }"
        @click="showMemoryDetails"
      >
        <el-icon class="status-icon">
          <MemoryCard />
        </el-icon>
        <span class="status-text">{{ formatBytes(memoryUsage.used) }}</span>
      </div>
    </div>

    <!-- 帮助气泡 -->
    <div
      v-if="helpBubble.show"
      class="help-bubble"
      :style="getHelpBubbleStyle()"
    >
      <div class="bubble-content">
        <div class="bubble-title">
          <el-icon><QuestionFilled /></el-icon>
          {{ helpBubble.title }}
        </div>
        <div class="bubble-text">
          {{ helpBubble.text }}
        </div>
        <div
          v-if="helpBubble.actions"
          class="bubble-actions"
        >
          <el-button
            v-for="action in helpBubble.actions"
            :key="action.id"
            :type="action.type"
            size="small"
            @click="executeHelpAction(action)"
          >
            {{ action.label }}
          </el-button>
        </div>
      </div>
      <div class="bubble-arrow" />
    </div>
  </div>
</template>

<style scoped>
  .notification-center {
    position: relative;
    pointer-events: none;
  }

  .global-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: all;
  }

  .loading-content {
    background: #fff;
    border-radius: 8px;
    padding: 32px;
    min-width: 300px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .loading-progress {
    margin-top: 24px;
  }

  .progress-details {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 12px;
    color: #909399;
  }

  .cancel-button {
    margin-top: 16px;
  }

  .tooltips-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 8000;
  }

  .operation-tooltip {
    position: absolute;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    border: 1px solid #e4e7ed;
    max-width: 350px;
    min-width: 200px;
    pointer-events: all;
    z-index: 8001;
  }

  .operation-tooltip.error {
    border-color: #f56c6c;
  }

  .operation-tooltip.warning {
    border-color: #e6a23c;
  }

  .operation-tooltip.success {
    border-color: #67c23a;
  }

  .operation-tooltip.info {
    border-color: #409eff;
  }

  .tooltip-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }

  .tooltip-icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .tooltip-text {
    flex: 1;
  }

  .tooltip-title {
    font-weight: 600;
    color: #303133;
    margin-bottom: 4px;
  }

  .tooltip-description {
    font-size: 13px;
    color: #606266;
    line-height: 1.4;
  }

  .tooltip-close {
    flex-shrink: 0;
    margin-top: -4px;
    margin-right: -4px;
  }

  .tooltip-actions {
    padding: 0 16px 16px 16px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    border-top: 1px solid #f0f0f0;
    margin-top: 12px;
    padding-top: 12px;
  }

  .status-indicators {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: all;
    z-index: 7000;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .status-indicator:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .connection-status.connected {
    border-color: #67c23a;
    color: #67c23a;
  }

  .connection-status.connecting {
    border-color: #e6a23c;
    color: #e6a23c;
  }

  .connection-status.disconnected {
    border-color: #909399;
    color: #909399;
  }

  .connection-status.error {
    border-color: #f56c6c;
    color: #f56c6c;
  }

  .status-progress {
    width: 60px;
    height: 2px;
    background: #f0f0f0;
    border-radius: 1px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: currentColor;
    transition: width 0.3s;
  }

  .performance-warning {
    border-color: #e6a23c;
    color: #e6a23c;
  }

  .warning-badge {
    background: currentColor;
    color: #fff;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    text-transform: uppercase;
  }

  .memory-usage {
    border-color: #409eff;
    color: #409eff;
  }

  .memory-usage.warning {
    border-color: #e6a23c;
    color: #e6a23c;
  }

  .help-bubble {
    position: fixed;
    background: #303133;
    color: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    max-width: 280px;
    font-size: 13px;
    z-index: 8500;
    pointer-events: all;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .bubble-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bubble-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .bubble-text {
    line-height: 1.4;
  }

  .bubble-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .bubble-arrow {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #303133;
    transform: rotate(45deg);
  }

  /* 动画效果 */
  .tooltip-enter-active,
  .tooltip-leave-active {
    transition: all 0.3s ease;
  }

  .tooltip-enter-from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }

  .tooltip-leave-to {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
</style>
