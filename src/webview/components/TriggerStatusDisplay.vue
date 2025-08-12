<!--
触发状态显示组件
显示当前触发配置和状态信息
-->

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import {
    Setting,
    SuccessFilled,
    Loading,
    WarningFilled,
    CircleCloseFilled
  } from '@element-plus/icons-vue';
  import {
    TriggerProcessor,
    TriggerValidationResult,
    TriggerLevelConfig
  } from '../../models/TriggerProcessor';
  import { TriggerType } from '../../models/AnalyzerTypes';

  // 接口定义
  interface TriggerConfig {
    triggerType: 'edge' | 'pattern';
    triggerChannel: number;
    triggerInverted: boolean;
    triggerPattern: string;
    patternTriggerChannel: number;
    fastTrigger: boolean;
    isBlastMode: boolean;
    burstEnabled: boolean;
    burstCount: number;
    measureBursts: boolean;
  }

  // Props
  interface Props {
    triggerConfig: TriggerConfig;
    levelConfig: TriggerLevelConfig & { signalType: string };
    triggerProcessor?: TriggerProcessor;
    captureChannels?: any[];
  }

  const props = withDefaults(defineProps<Props>(), {
    captureChannels: () => []
  });

  // Emits
  const emit = defineEmits<{
    validate: [];
    configure: [];
  }>();

  // 响应式数据
  const showAdvanced = ref(false);
  const triggerStatus = ref<'ready' | 'waiting' | 'warning' | 'error'>('ready');
  const validationResults = ref<TriggerValidationResult[]>([]);

  // 计算属性
  const triggerTypeText = computed(() => {
    const typeMap = {
      'edge': '边沿触发',
      'pattern': '模式触发'
    };
    return typeMap[props.triggerConfig.triggerType] || '未知类型';
  });

  const statusText = computed(() => {
    const statusMap = {
      'ready': '就绪',
      'waiting': '等待触发',
      'warning': '配置警告',
      'error': '配置错误'
    };
    return statusMap[triggerStatus.value];
  });

  const statusClass = computed(() => ({
    'status-ready': triggerStatus.value === 'ready',
    'status-waiting': triggerStatus.value === 'waiting',
    'status-warning': triggerStatus.value === 'warning',
    'status-error': triggerStatus.value === 'error'
  }));

  // 方法
  const formatVoltage = (voltage: number): string => {
    if (voltage >= 1.0) {
      return `${voltage.toFixed(2)}V`;
    } else {
      return `${(voltage * 1000).toFixed(0)}mV`;
    }
  };

  const validateTrigger = async () => {
    if (!props.triggerProcessor) {
      validationResults.value = [{
        isValid: false,
        errorMessage: '触发处理器未初始化',
        errorCode: undefined
      }];
      triggerStatus.value = 'error';
      return;
    }

    validationResults.value = [];

    try {
      // 验证电平配置
      const levelValidation = props.triggerProcessor.validateTriggerLevel(props.levelConfig);
      validationResults.value.push(levelValidation);

      // 根据触发类型进行具体验证
      if (props.triggerConfig.triggerType === 'edge') {
        const edgeValidation = props.triggerProcessor.validateEdgeTrigger(
          props.triggerConfig.triggerChannel,
          props.triggerConfig.triggerInverted,
          props.triggerConfig.isBlastMode,
          props.triggerConfig.burstEnabled,
          props.triggerConfig.burstCount,
          props.triggerConfig.measureBursts
        );
        validationResults.value.push(edgeValidation);
      } else if (props.triggerConfig.triggerType === 'pattern') {
        const patternValidation = props.triggerProcessor.validatePatternTrigger(
          props.triggerConfig.patternTriggerChannel - 1, // UI显示从1开始，内部从0开始
          props.triggerConfig.triggerPattern,
          props.triggerConfig.fastTrigger
        );
        validationResults.value.push(patternValidation);
      }

      // 更新状态
      const hasErrors = validationResults.value.some(r => !r.isValid);
      triggerStatus.value = hasErrors ? 'error' : 'ready';

      emit('validate');
    } catch (error) {
      validationResults.value = [{
        isValid: false,
        errorMessage: `验证失败: ${error}`,
        errorCode: undefined
      }];
      triggerStatus.value = 'error';
    }
  };

  // 监听器
  watch(() => [props.triggerConfig, props.levelConfig], () => {
    // 配置改变时自动验证
    validateTrigger();
  }, { deep: true, immediate: true });
</script>

<template>
  <div class="trigger-status">
    <div class="status-header">
      <h4>
        <el-icon><Setting /></el-icon>
        触发状态
      </h4>
      <div
        class="status-indicator"
        :class="statusClass"
      >
        <el-icon>
          <SuccessFilled v-if="triggerStatus === 'ready'" />
          <Loading v-else-if="triggerStatus === 'waiting'" />
          <WarningFilled v-else-if="triggerStatus === 'warning'" />
          <CircleCloseFilled v-else />
        </el-icon>
        {{ statusText }}
      </div>
    </div>

    <div class="status-content">
      <!-- 基本触发信息 -->
      <div class="trigger-info">
        <div class="info-row">
          <label>触发类型:</label>
          <span class="value">{{ triggerTypeText }}</span>
        </div>

        <div
          v-if="triggerConfig.triggerType === 'edge'"
          class="info-row"
        >
          <label>触发通道:</label>
          <span class="value">Channel {{ triggerConfig.triggerChannel + 1 }}</span>
        </div>

        <div
          v-if="triggerConfig.triggerType === 'edge'"
          class="info-row"
        >
          <label>触发极性:</label>
          <span class="value">{{ triggerConfig.triggerInverted ? '下降沿' : '上升沿' }}</span>
        </div>

        <div
          v-if="triggerConfig.triggerType === 'pattern'"
          class="info-row"
        >
          <label>触发模式:</label>
          <span class="value pattern-value">{{ triggerConfig.triggerPattern || '未设置' }}</span>
        </div>

        <div
          v-if="triggerConfig.triggerType === 'pattern'"
          class="info-row"
        >
          <label>起始通道:</label>
          <span class="value">Channel {{ triggerConfig.patternTriggerChannel }}</span>
        </div>

        <div class="info-row">
          <label>触发阈值:</label>
          <span class="value">{{ formatVoltage(levelConfig.threshold) }}</span>
        </div>
      </div>

      <!-- 高级配置 -->
      <div
        v-if="showAdvanced"
        class="advanced-info"
      >
        <el-divider>高级配置</el-divider>

        <div
          v-if="triggerConfig.isBlastMode"
          class="info-row highlight"
        >
          <label>突发模式:</label>
          <span class="value">已启用</span>
        </div>

        <div
          v-if="triggerConfig.burstEnabled && !triggerConfig.isBlastMode"
          class="info-row"
        >
          <label>突发采集:</label>
          <span class="value">{{ triggerConfig.burstCount }} 次</span>
        </div>

        <div
          v-if="triggerConfig.measureBursts"
          class="info-row"
        >
          <label>测量间隔:</label>
          <span class="value">已启用</span>
        </div>

        <div
          v-if="triggerConfig.fastTrigger"
          class="info-row highlight"
        >
          <label>快速触发:</label>
          <span class="value">已启用</span>
        </div>

        <div class="info-row">
          <label>信号类型:</label>
          <span class="value">{{ levelConfig.signalType }}</span>
        </div>

        <div
          v-if="levelConfig.hysteresis"
          class="info-row"
        >
          <label>滞回电压:</label>
          <span class="value">±{{ formatVoltage(levelConfig.hysteresis) }}</span>
        </div>
      </div>

      <!-- 验证结果 -->
      <div
        v-if="validationResults.length > 0"
        class="validation-results"
      >
        <el-divider>验证结果</el-divider>
        <div
          v-for="(result, index) in validationResults"
          :key="index"
          class="validation-item"
          :class="{ 'validation-error': !result.isValid }"
        >
          <el-icon>
            <SuccessFilled v-if="result.isValid" />
            <CircleCloseFilled v-else />
          </el-icon>
          <span>{{ result.errorMessage || '验证通过' }}</span>
        </div>
      </div>
    </div>

    <div class="status-actions">
      <el-button
        size="small"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? '隐藏详情' : '显示详情' }}
      </el-button>
      <el-button
        size="small"
        type="primary"
        @click="validateTrigger"
      >
        验证配置
      </el-button>
    </div>
  </div>
</template>

<style scoped>
  .trigger-status {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 16px;
    font-size: 14px;
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #dee2e6;
  }

  .status-header h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #495057;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-ready {
    background: #d4edda;
    color: #155724;
  }

  .status-waiting {
    background: #d1ecf1;
    color: #0c5460;
  }

  .status-warning {
    background: #fff3cd;
    color: #856404;
  }

  .status-error {
    background: #f8d7da;
    color: #721c24;
  }

  .status-content {
    margin-bottom: 16px;
  }

  .trigger-info,
  .advanced-info {
    margin-bottom: 16px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #f1f3f4;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-row label {
    font-weight: 500;
    color: #6c757d;
    min-width: 80px;
  }

  .info-row .value {
    font-weight: 600;
    color: #495057;
  }

  .info-row.highlight .value {
    color: #007bff;
  }

  .pattern-value {
    font-family: 'Courier New', monospace;
    background: #f8f9fa;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #dee2e6;
  }

  .validation-results {
    margin-top: 16px;
  }

  .validation-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin: 4px 0;
    border-radius: 4px;
    background: #d4edda;
    color: #155724;
  }

  .validation-error {
    background: #f8d7da;
    color: #721c24;
  }

  .status-actions {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .el-divider {
    margin: 12px 0;
  }
</style>
