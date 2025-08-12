<!--
采集设置对话框组件
基于 @logicanalyzer/Software 的 CaptureDialog 功能
提供完整的采集参数配置界面
-->

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import {
    DataLine,
    Check,
    Close,
    RefreshRight,
    Setting,
    InfoFilled
  } from '@element-plus/icons-vue';
  import { ElMessage } from 'element-plus';
  import {
    TriggerProcessor,
    TriggerProcessorFactory,
    TriggerLevelConfig as ITriggerLevelConfig,
    TriggerValidationResult,
    TriggerValidationError
  } from '../../models/TriggerProcessor';
  import { TriggerType } from '../../models/AnalyzerTypes';

  // 接口定义
  interface ChannelConfig {
    number: number;
    enabled: boolean;
    name: string;
    color: string;
  }

  interface CaptureConfig {
    frequency: number;
    preTriggerSamples: number;
    postTriggerSamples: number;
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

  interface TriggerLevelConfig extends ITriggerLevelConfig {
    signalType: 'TTL' | 'CMOS' | 'LVDS' | 'Custom';
  }

  interface DeviceLimits {
    minFrequency: number;
    maxFrequency: number;
    blastFrequency: number;
    channelCount: number;
  }

  interface CaptureLimits {
    minPreSamples: number;
    maxPreSamples: number;
    minPostSamples: number;
    maxPostSamples: number;
    maxTotalSamples: number;
  }

  // Props
  interface Props {
    visible: boolean;
    deviceInfo?: any;
    driverType?: 'single' | 'multi' | 'emulated';
  }

  const props = withDefaults(defineProps<Props>(), {
    visible: false,
    driverType: 'single'
  });

  // Emits
  const emit = defineEmits<{
    'update:visible': [value: boolean];
    confirm: [config: CaptureConfig, channels: ChannelConfig[]];
    cancel: [];
  }>();

  // 响应式数据
  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  });

  const isMultiDeviceMode = computed(() => props.driverType === 'multi');
  const isEmulatedMode = computed(() => props.driverType === 'emulated');

  // 设备限制
  const deviceLimits = ref<DeviceLimits>({
    minFrequency: 1000,
    maxFrequency: 120000000,
    blastFrequency: 120000000,
    channelCount: 24
  });

  // 当前限制（根据选中通道动态计算）
  const currentLimits = ref<CaptureLimits>({
    minPreSamples: 0,
    maxPreSamples: 65536,
    minPostSamples: 1,
    maxPostSamples: 65536,
    maxTotalSamples: 131072
  });

  // 通道配置
  const channels = ref<ChannelConfig[]>([]);

  // 采集配置
  const captureConfig = ref<CaptureConfig>({
    frequency: 100000000,
    preTriggerSamples: 512,
    postTriggerSamples: 1024,
    triggerType: 'edge',
    triggerChannel: 0,
    triggerInverted: false,
    triggerPattern: '',
    patternTriggerChannel: 1,
    fastTrigger: false,
    isBlastMode: false,
    burstEnabled: false,
    burstCount: 2,
    measureBursts: false
  });

  // 颜色选择器
  const showColorPicker = ref(false);
  const currentColor = ref('#ff0000');
  const selectedChannelForColor = ref<ChannelConfig | null>(null);

  const presetColors = [
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#ff00ff',
    '#00ffff',
    '#ffa500',
    '#800080',
    '#008000',
    '#000080',
    '#808080',
    '#ffc0cb'
  ];

  // 触发电平配置
  const triggerLevelConfig = ref<TriggerLevelConfig>({
    signalType: 'CMOS',
    threshold: 1.65,
    hysteresis: 0.2,
    inputImpedance: 1000000
  });

  // 触发处理器
  const triggerProcessor = ref<TriggerProcessor | null>(null);

  // 验证状态
  const patternError = ref('');
  const triggerValidationResults = ref<TriggerValidationResult[]>([]);

  // 计算属性
  const channelGroups = computed(() => {
    const groups: ChannelConfig[][] = [];
    for (let i = 0; i < Math.ceil(channels.value.length / 8); i++) {
      groups.push(channels.value.slice(i * 8, (i + 1) * 8));
    }
    return groups;
  });

  const selectedChannelCount = computed(() => {
    return channels.value.filter(ch => ch.enabled).length;
  });

  const totalSamples = computed(() => {
    const loops = captureConfig.value.burstEnabled ? captureConfig.value.burstCount - 1 : 0;
    return captureConfig.value.preTriggerSamples +
           (captureConfig.value.postTriggerSamples * (loops + 1));
  });

  const jitterText = ref('抖动: 0.000%');
  const jitterLevel = ref('low');

  const configErrors = computed(() => {
    const errors: string[] = [];

    if (selectedChannelCount.value === 0) {
      errors.push('至少选择一个通道');
    }

    if (totalSamples.value > currentLimits.value.maxTotalSamples) {
      errors.push('总样本数超出限制');
    }

    if (captureConfig.value.triggerType === 'pattern') {
      if (!captureConfig.value.triggerPattern.trim()) {
        errors.push('触发模式不能为空');
      } else if (patternError.value) {
        errors.push(patternError.value);
      }
    }

    return errors;
  });

  const isConfigValid = computed(() => {
    return configErrors.value.length === 0;
  });

  // 方法
  const initializeChannels = () => {
    channels.value = [];
    for (let i = 0; i < deviceLimits.value.channelCount; i++) {
      channels.value.push({
        number: i,
        enabled: i < 8, // 默认启用前8个通道
        name: `CH${i}`,
        color: getChannelColor(i)
      });
    }
    updateChannelLimits();
  };

  const getChannelColor = (channelNumber: number): string => {
    const colors = [
      '#ff0000', '#00ff00', '#0000ff', '#ffff00',
      '#ff00ff', '#00ffff', '#ffa500', '#800080',
      '#008000', '#000080', '#808080', '#ffc0cb',
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24',
      '#6c5ce7', '#a29bfe', '#fd79a8', '#e17055',
      '#00b894', '#0984e3', '#b2bec3', '#636e72'
    ];
    return colors[channelNumber % colors.length];
  };

  const selectAllChannels = () => {
    channels.value.forEach(ch => (ch.enabled = true));
    updateChannelLimits();
  };

  const selectNoneChannels = () => {
    channels.value.forEach(ch => (ch.enabled = false));
    updateChannelLimits();
  };

  const invertChannelSelection = () => {
    channels.value.forEach(ch => (ch.enabled = !ch.enabled));
    updateChannelLimits();
  };

  const selectGroupChannels = (groupIndex: number) => {
    const startIndex = groupIndex * 8;
    const endIndex = Math.min(startIndex + 8, channels.value.length);
    for (let i = startIndex; i < endIndex; i++) {
      channels.value[i].enabled = true;
    }
    updateChannelLimits();
  };

  const deselectGroupChannels = (groupIndex: number) => {
    const startIndex = groupIndex * 8;
    const endIndex = Math.min(startIndex + 8, channels.value.length);
    for (let i = startIndex; i < endIndex; i++) {
      channels.value[i].enabled = false;
    }
    updateChannelLimits();
  };

  const invertGroupChannels = (groupIndex: number) => {
    const startIndex = groupIndex * 8;
    const endIndex = Math.min(startIndex + 8, channels.value.length);
    for (let i = startIndex; i < endIndex; i++) {
      channels.value[i].enabled = !channels.value[i].enabled;
    }
    updateChannelLimits();
  };

  const showChannelColorPicker = (channel: ChannelConfig) => {
    selectedChannelForColor.value = channel;
    currentColor.value = channel.color;
    showColorPicker.value = true;
  };

  const selectColor = (color: string) => {
    currentColor.value = color;
  };

  const confirmColorSelection = () => {
    if (selectedChannelForColor.value) {
      selectedChannelForColor.value.color = currentColor.value;
    }
    showColorPicker.value = false;
  };

  const updateChannelLimits = () => {
    const enabledChannels = channels.value.filter(ch => ch.enabled);
    const channelCount = enabledChannels.length;

    // 根据通道数计算限制（模拟原版逻辑）
    if (channelCount <= 8) {
      currentLimits.value = {
        minPreSamples: 0,
        maxPreSamples: 65536,
        minPostSamples: 1,
        maxPostSamples: 65536,
        maxTotalSamples: 131072
      };
    } else if (channelCount <= 16) {
      currentLimits.value = {
        minPreSamples: 0,
        maxPreSamples: 32768,
        minPostSamples: 1,
        maxPostSamples: 32768,
        maxTotalSamples: 65536
      };
    } else {
      currentLimits.value = {
        minPreSamples: 0,
        maxPreSamples: 16384,
        minPostSamples: 1,
        maxPostSamples: 16384,
        maxTotalSamples: 32768
      };
    }

    // 调整当前值以符合新限制
    if (captureConfig.value.preTriggerSamples > currentLimits.value.maxPreSamples) {
      captureConfig.value.preTriggerSamples = currentLimits.value.maxPreSamples;
    }
    if (captureConfig.value.postTriggerSamples > currentLimits.value.maxPostSamples) {
      captureConfig.value.postTriggerSamples = currentLimits.value.maxPostSamples;
    }
  };

  const updateJitter = () => {
    const selectedFreq = captureConfig.value.frequency;
    if (selectedFreq === 0) return;

    const div = Math.floor(deviceLimits.value.maxFrequency / selectedFreq);
    const actualFreq = deviceLimits.value.maxFrequency / div;
    const diff = actualFreq - selectedFreq;
    const pct = (diff * 100.0) / selectedFreq;

    jitterText.value = `抖动: ${pct.toFixed(3)}%`;

    if (pct < 1) {
      jitterLevel.value = 'low';
    } else if (pct < 10) {
      jitterLevel.value = 'medium';
    } else {
      jitterLevel.value = 'high';
    }
  };

  const onTriggerTypeChange = () => {
    if (captureConfig.value.triggerType === 'pattern') {
      captureConfig.value.isBlastMode = false;
    }
  };

  const onBlastModeChange = (enabled: boolean) => {
    if (enabled) {
      captureConfig.value.frequency = deviceLimits.value.blastFrequency;
      captureConfig.value.preTriggerSamples = 0;
      captureConfig.value.burstEnabled = false;
      captureConfig.value.measureBursts = false;
      jitterText.value = '抖动: 0.000%';
      jitterLevel.value = 'low';
    } else {
      updateJitter();
    }
  };

  const onFastTriggerChange = (enabled: boolean) => {
    if (enabled && captureConfig.value.triggerPattern.length > 5) {
      captureConfig.value.triggerPattern = captureConfig.value.triggerPattern.substring(0, 5);
    }
  };

  const validatePattern = () => {
    const pattern = captureConfig.value.triggerPattern.trim();
    patternError.value = '';

    if (pattern.length === 0) {
      patternError.value = '模式不能为空';
      return;
    }

    if (!/^[01]+$/.test(pattern)) {
      patternError.value = '只能包含0和1';
      return;
    }

    if (captureConfig.value.fastTrigger && pattern.length > 5) {
      patternError.value = '快速触发限制5位';
      return;
    }

    if (pattern.length > 16) {
      patternError.value = '最多16位';
      return;
    }

    if (captureConfig.value.patternTriggerChannel + pattern.length > 16) {
      patternError.value = '超出通道范围';
      return;
    }
  };

  // 信号类型改变时的处理
  const onSignalTypeChange = (signalType: 'TTL' | 'CMOS' | 'LVDS' | 'Custom') => {
    if (triggerProcessor.value && signalType !== 'Custom') {
      const recommended = triggerProcessor.value.getRecommendedTriggerLevel(signalType);
      triggerLevelConfig.value.threshold = recommended.threshold;
      triggerLevelConfig.value.hysteresis = recommended.hysteresis;
      triggerLevelConfig.value.inputImpedance = recommended.inputImpedance;
    }
    validateTriggerLevel();
  };

  // 验证触发电平
  const validateTriggerLevel = () => {
    if (!triggerProcessor.value) return;

    const validation = triggerProcessor.value.validateTriggerLevel(triggerLevelConfig.value);
    if (!validation.isValid) {
      ElMessage.warning(validation.errorMessage || '触发电平配置无效');
    }
    return validation;
  };

  // 重置触发设置
  const resetTriggerSettings = () => {
    captureConfig.value.triggerType = 'edge';
    captureConfig.value.triggerChannel = 0;
    captureConfig.value.triggerInverted = false;
    captureConfig.value.triggerPattern = '';
    captureConfig.value.patternTriggerChannel = 1;
    captureConfig.value.fastTrigger = false;
    captureConfig.value.isBlastMode = false;
    captureConfig.value.burstEnabled = false;
    captureConfig.value.burstCount = 2;
    captureConfig.value.measureBursts = false;

    // 重置触发电平
    triggerLevelConfig.value = {
      signalType: 'CMOS',
      threshold: 1.65,
      hysteresis: 0.2,
      inputImpedance: 1000000
    };

    ElMessage.success('触发设置已重置');
  };

  const resetToDefaults = () => {
    captureConfig.value = {
      frequency: deviceLimits.value.maxFrequency,
      preTriggerSamples: 512,
      postTriggerSamples: 1024,
      triggerType: 'edge',
      triggerChannel: 0,
      triggerInverted: false,
      triggerPattern: '',
      patternTriggerChannel: 1,
      fastTrigger: false,
      isBlastMode: false,
      burstEnabled: false,
      burstCount: 2,
      measureBursts: false
    };

    channels.value.forEach((ch, index) => {
      ch.enabled = index < 8;
      ch.name = `CH${index}`;
      ch.color = getChannelColor(index);
    });

    // 重置触发电平
    resetTriggerSettings();

    updateChannelLimits();
    updateJitter();
    ElMessage.success('已重置为默认设置');
  };

  const handleConfirm = () => {
    if (!isConfigValid.value) {
      ElMessage.error('请检查配置错误');
      return;
    }

    const enabledChannels = channels.value.filter(ch => ch.enabled);
    emit('confirm', captureConfig.value, enabledChannels);
    dialogVisible.value = false;
  };

  const handleCancel = () => {
    emit('cancel');
    dialogVisible.value = false;
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

  const formatSampleCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatVoltage = (voltage: number): string => {
    if (voltage >= 1.0) {
      return `${voltage.toFixed(2)}V`;
    } else {
      return `${(voltage * 1000).toFixed(0)}mV`;
    }
  };

  // 监听器
  watch(() => props.visible, (visible) => {
    if (visible) {
      updateJitter();
    }
  });

  watch(() => captureConfig.value.frequency, updateJitter);
  watch(() => captureConfig.value.triggerPattern, validatePattern);

  // 生命周期
  onMounted(() => {
    initializeChannels();
    updateJitter();

    // 初始化触发处理器
    triggerProcessor.value = TriggerProcessorFactory.createForDevice({
      channelCount: deviceLimits.value.channelCount,
      maxFrequency: deviceLimits.value.maxFrequency,
      minFrequency: deviceLimits.value.minFrequency,
      blastFrequency: deviceLimits.value.blastFrequency,
      bufferSize: 131072
    });
  });
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="采集设置"
    width="900px"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="capture-settings">
      <!-- 左侧：通道选择 -->
      <div class="settings-section channels-section">
        <div class="section-header">
          <h4>
            <el-icon><DataLine /></el-icon>
            通道选择
          </h4>
          <div class="channel-actions">
            <el-button-group size="small">
              <el-button
                title="选择全部"
                @click="selectAllChannels"
              >
                <el-icon><Check /></el-icon>
              </el-button>
              <el-button
                title="取消全部"
                @click="selectNoneChannels"
              >
                <el-icon><Close /></el-icon>
              </el-button>
              <el-button
                title="反选"
                @click="invertChannelSelection"
              >
                <el-icon><RefreshRight /></el-icon>
              </el-button>
            </el-button-group>
          </div>
        </div>

        <div class="channels-grid">
          <div
            v-for="(channelGroup, groupIndex) in channelGroups"
            :key="groupIndex"
            class="channel-group"
          >
            <div class="group-header">
              <span class="group-title">CH{{ groupIndex * 8 }}-{{ groupIndex * 8 + 7 }}</span>
              <div class="group-actions">
                <el-button
                  size="small"
                  text
                  @click="selectGroupChannels(groupIndex)"
                >
                  <el-icon><Check /></el-icon>
                </el-button>
                <el-button
                  size="small"
                  text
                  @click="deselectGroupChannels(groupIndex)"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
                <el-button
                  size="small"
                  text
                  @click="invertGroupChannels(groupIndex)"
                >
                  <el-icon><RefreshRight /></el-icon>
                </el-button>
              </div>
            </div>

            <div class="channels-row">
              <div
                v-for="channel in channelGroup"
                :key="channel.number"
                class="channel-item"
                :class="{ active: channel.enabled }"
              >
                <el-checkbox
                  v-model="channel.enabled"
                  :label="`CH${channel.number}`"
                  @change="updateChannelLimits"
                />
                <div
                  class="channel-color"
                  :style="{ backgroundColor: channel.color }"
                  @click="showChannelColorPicker(channel)"
                />
                <el-input
                  v-model="channel.name"
                  size="small"
                  placeholder="名称"
                  class="channel-name-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：采集参数 -->
      <div class="settings-section parameters-section">
        <!-- 基本参数 -->
        <el-card
          shadow="never"
          class="parameter-card"
        >
          <template #header>
            <div class="card-header">
              <span>基本参数</span>
              <el-button
                size="small"
                @click="resetToDefaults"
              >
                重置默认
              </el-button>
            </div>
          </template>

          <el-form
            :model="captureConfig"
            label-width="120px"
            size="small"
          >
            <el-form-item label="采样频率">
              <div class="frequency-input">
                <el-input-number
                  v-model="captureConfig.frequency"
                  :min="deviceLimits.minFrequency"
                  :max="deviceLimits.maxFrequency"
                  :step="1000000"
                  controls-position="right"
                  @change="updateJitter"
                />
                <span class="unit">Hz</span>
                <div class="frequency-display">
                  {{ formatFrequency(captureConfig.frequency) }}
                </div>
              </div>
              <div
                class="jitter-indicator"
                :class="jitterLevel"
              >
                {{ jitterText }}
              </div>
            </el-form-item>

            <el-form-item label="触发前样本">
              <div class="sample-input">
                <el-input-number
                  v-model="captureConfig.preTriggerSamples"
                  :min="currentLimits.minPreSamples"
                  :max="currentLimits.maxPreSamples"
                  :step="1"
                  controls-position="right"
                  :disabled="captureConfig.isBlastMode"
                />
                <div class="sample-info">
                  {{ formatSampleCount(captureConfig.preTriggerSamples) }}
                  <span class="limits">
                    ({{ formatSampleCount(currentLimits.minPreSamples) }} -
                    {{ formatSampleCount(currentLimits.maxPreSamples) }})
                  </span>
                </div>
              </div>
            </el-form-item>

            <el-form-item label="触发后样本">
              <div class="sample-input">
                <el-input-number
                  v-model="captureConfig.postTriggerSamples"
                  :min="currentLimits.minPostSamples"
                  :max="currentLimits.maxPostSamples"
                  :step="1"
                  controls-position="right"
                />
                <div class="sample-info">
                  {{ formatSampleCount(captureConfig.postTriggerSamples) }}
                  <span class="limits">
                    ({{ formatSampleCount(currentLimits.minPostSamples) }} -
                    {{ formatSampleCount(currentLimits.maxPostSamples) }})
                  </span>
                </div>
              </div>
            </el-form-item>

            <el-form-item label="总样本数">
              <div class="total-samples">
                {{ formatSampleCount(totalSamples) }}
                <span
                  v-if="totalSamples > currentLimits.maxTotalSamples"
                  class="error"
                >
                  (超出限制: {{ formatSampleCount(currentLimits.maxTotalSamples) }})
                </span>
              </div>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 触发设置 -->
        <el-card
          v-if="!isEmulatedMode"
          shadow="never"
          class="parameter-card"
        >
          <template #header>
            <div class="card-header">
              <span>触发设置</span>
              <el-button
                size="small"
                @click="resetTriggerSettings"
              >
                重置触发
              </el-button>
            </div>
          </template>

          <el-form
            :model="captureConfig"
            label-width="120px"
            size="small"
          >
            <el-form-item label="触发类型">
              <el-radio-group
                v-model="captureConfig.triggerType"
                @change="onTriggerTypeChange"
              >
                <el-radio
                  label="edge"
                  :disabled="isMultiDeviceMode"
                >
                  边沿触发
                </el-radio>
                <el-radio label="pattern">
                  模式触发
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 边沿触发设置 -->
            <template v-if="captureConfig.triggerType === 'edge'">
              <el-form-item label="触发通道">
                <el-select v-model="captureConfig.triggerChannel">
                  <el-option
                    v-for="n in 24"
                    :key="n - 1"
                    :label="`Channel ${n}`"
                    :value="n - 1"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="触发极性">
                <el-checkbox v-model="captureConfig.triggerInverted">
                  负极性触发
                </el-checkbox>
              </el-form-item>

              <el-form-item label="突发模式">
                <el-checkbox
                  v-model="captureConfig.isBlastMode"
                  :disabled="captureConfig.triggerType !== 'edge'"
                  @change="onBlastModeChange"
                >
                  启用突发模式
                </el-checkbox>
              </el-form-item>

              <el-form-item
                v-if="!captureConfig.isBlastMode"
                label="突发采集"
              >
                <div class="burst-settings">
                  <el-checkbox v-model="captureConfig.burstEnabled">
                    启用突发采集
                  </el-checkbox>
                  <template v-if="captureConfig.burstEnabled">
                    <el-input-number
                      v-model="captureConfig.burstCount"
                      :min="2"
                      :max="256"
                      size="small"
                      style="margin-left: 8px"
                    />
                    <span>次</span>
                    <el-checkbox
                      v-model="captureConfig.measureBursts"
                      style="margin-left: 16px"
                    >
                      测量间隔
                    </el-checkbox>
                  </template>
                </div>
              </el-form-item>
            </template>

            <!-- 模式触发设置 -->
            <template v-if="captureConfig.triggerType === 'pattern'">
              <el-form-item label="起始通道">
                <el-input-number
                  v-model="captureConfig.patternTriggerChannel"
                  :min="1"
                  :max="16"
                  controls-position="right"
                />
              </el-form-item>

              <el-form-item label="触发模式">
                <div class="pattern-input">
                  <el-input
                    v-model="captureConfig.triggerPattern"
                    placeholder="输入二进制模式 (如: 10110)"
                    :maxlength="captureConfig.fastTrigger ? 5 : 16"
                    @input="validatePattern"
                  />
                  <div class="pattern-info">
                    长度: {{ captureConfig.triggerPattern.length }} 位
                    <span
                      v-if="patternError"
                      class="error"
                    >{{ patternError }}</span>
                  </div>
                </div>
              </el-form-item>

              <el-form-item label="快速触发">
                <el-checkbox
                  v-model="captureConfig.fastTrigger"
                  @change="onFastTriggerChange"
                >
                  启用快速触发 (限制5位)
                </el-checkbox>
              </el-form-item>
            </template>

            <!-- 触发电平设置 -->
            <el-divider content-position="left">
              触发电平
            </el-divider>

            <el-form-item label="信号类型">
              <el-select
                v-model="triggerLevelConfig.signalType"
                @change="onSignalTypeChange"
              >
                <el-option
                  label="TTL (1.4V)"
                  value="TTL"
                />
                <el-option
                  label="CMOS 3.3V (1.65V)"
                  value="CMOS"
                />
                <el-option
                  label="LVDS (1.2V)"
                  value="LVDS"
                />
                <el-option
                  label="自定义"
                  value="Custom"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="触发阈值">
              <div class="threshold-input">
                <el-input-number
                  v-model="triggerLevelConfig.threshold"
                  :min="0"
                  :max="5.0"
                  :step="0.1"
                  :precision="2"
                  controls-position="right"
                  :disabled="triggerLevelConfig.signalType !== 'Custom'"
                />
                <span class="unit">V</span>
              </div>
              <div class="threshold-info">
                <span class="current-level">{{ formatVoltage(triggerLevelConfig.threshold) }}</span>
                <span
                  v-if="triggerLevelConfig.hysteresis"
                  class="hysteresis-info"
                >
                  (±{{ formatVoltage(triggerLevelConfig.hysteresis) }} 滞回)
                </span>
              </div>
            </el-form-item>

            <el-form-item
              v-if="triggerLevelConfig.signalType === 'Custom'"
              label="滞回电压"
            >
              <div class="hysteresis-input">
                <el-input-number
                  v-model="triggerLevelConfig.hysteresis"
                  :min="0"
                  :max="1.0"
                  :step="0.1"
                  :precision="2"
                  controls-position="right"
                />
                <span class="unit">V</span>
              </div>
              <div class="hysteresis-help">
                <el-icon><InfoFilled /></el-icon>
                滞回电压可减少噪音影响
              </div>
            </el-form-item>

            <el-form-item
              v-if="triggerLevelConfig.signalType === 'Custom'"
              label="输入阻抗"
            >
              <div class="impedance-input">
                <el-input-number
                  v-model="triggerLevelConfig.inputImpedance"
                  :min="50"
                  :max="10000000"
                  :step="1000"
                  controls-position="right"
                />
                <span class="unit">Ω</span>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </div>

    <!-- 颜色选择器对话框 -->
    <el-dialog
      v-model="showColorPicker"
      title="选择颜色"
      width="400px"
    >
      <div class="color-picker">
        <div class="preset-colors">
          <div
            v-for="color in presetColors"
            :key="color"
            class="color-item"
            :style="{ backgroundColor: color }"
            @click="selectColor(color)"
          />
        </div>
        <el-input
          v-model="currentColor"
          placeholder="#RRGGBB"
          class="color-input"
        />
      </div>
      <template #footer>
        <el-button @click="showColorPicker = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="confirmColorSelection"
        >
          确定
        </el-button>
      </template>
    </el-dialog>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-info">
          <span v-if="selectedChannelCount > 0">
            已选择 {{ selectedChannelCount }} 个通道
          </span>
          <span
            v-if="configErrors.length > 0"
            class="error"
          >
            {{ configErrors.join(', ') }}
          </span>
        </div>
        <div class="footer-buttons">
          <el-button @click="handleCancel">
            取消
          </el-button>
          <el-button
            type="primary"
            :disabled="!isConfigValid"
            @click="handleConfirm"
          >
            确定
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
  .capture-settings {
    display: flex;
    gap: 20px;
    height: 500px;
  }

  .settings-section {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .channels-section {
    flex: 2;
  }

  .parameters-section {
    flex: 1;
    overflow-y: auto;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #ebeef5;
  }

  .section-header h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .channels-grid {
    flex: 1;
    overflow-y: auto;
  }

  .channel-group {
    margin-bottom: 20px;
    border: 1px solid #ebeef5;
    border-radius: 4px;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f5f7fa;
    padding: 8px 12px;
    border-bottom: 1px solid #ebeef5;
  }

  .group-title {
    font-weight: 500;
    color: #606266;
  }

  .group-actions {
    display: flex;
    gap: 4px;
  }

  .channels-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 12px;
  }

  .channel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border-radius: 4px;
    transition: background-color 0.3s;
  }

  .channel-item.active {
    background-color: #f0f9ff;
  }

  .channel-color {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid #ddd;
    flex-shrink: 0;
  }

  .channel-name-input {
    width: 60px;
  }

  .parameter-card {
    margin-bottom: 16px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .frequency-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .unit {
    color: #909399;
    font-size: 14px;
  }

  .frequency-display {
    font-size: 14px;
    color: #409eff;
    font-weight: 500;
  }

  .jitter-indicator {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
  }

  .jitter-indicator.low {
    background-color: #f0f9ff;
    color: #1890ff;
  }

  .jitter-indicator.medium {
    background-color: #fff7e6;
    color: #fa8c16;
  }

  .jitter-indicator.high {
    background-color: #fff2f0;
    color: #ff4d4f;
  }

  .sample-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sample-info {
    font-size: 12px;
    color: #666;
  }

  .limits {
    color: #999;
  }

  .total-samples {
    font-size: 14px;
    font-weight: 500;
  }

  .total-samples .error {
    color: #ff4d4f;
  }

  .pattern-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pattern-info {
    font-size: 12px;
    color: #666;
  }

  .pattern-info .error {
    color: #ff4d4f;
    margin-left: 8px;
  }

  .burst-settings {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .color-picker {
    padding: 16px;
  }

  .preset-colors {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .color-item {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.3s;
  }

  .color-item:hover {
    border-color: #409eff;
  }

  .color-input {
    width: 100%;
  }

  .dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-info {
    font-size: 14px;
    color: #666;
  }

  .footer-info .error {
    color: #ff4d4f;
  }

  .footer-buttons {
    display: flex;
    gap: 8px;
  }

  /* 触发电平设置样式 */
  .threshold-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .threshold-info {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  }

  .current-level {
    font-weight: 500;
    color: #409eff;
  }

  .hysteresis-info {
    color: #909399;
    margin-left: 8px;
  }

  .hysteresis-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hysteresis-help {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .impedance-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
