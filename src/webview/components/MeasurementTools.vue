<!--
测量工具栏组件
基于 @logicanalyzer/Software 的 MeasureDialog 和 ChannelMeasures 功能
提供信号测量、频率分析和统计功能
-->

<template>
  <div class="measurement-tools">
    <!-- 测量工具头部 -->
    <div class="measurement-header">
      <h3 class="measurement-title">
        <el-icon><DataAnalysis /></el-icon>
        测量工具
      </h3>
      <div class="measurement-actions">
        <el-button-group size="small">
          <el-button :icon="VideoPlay" @click="startMeasurement" :disabled="!hasData">
            开始测量
          </el-button>
          <el-button :icon="VideoPause" @click="stopMeasurement" :disabled="!isMeasuring">
            停止测量
          </el-button>
          <el-button :icon="RefreshRight" @click="refreshMeasurement" :disabled="!hasData">
            刷新
          </el-button>
        </el-button-group>
        <el-dropdown @command="handleMeasurementAction">
          <el-button size="small" :icon="More">
            更多
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export-results">导出结果</el-dropdown-item>
              <el-dropdown-item command="save-report">保存报告</el-dropdown-item>
              <el-dropdown-item command="reset-measurements">重置测量</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 全局统计信息 -->
    <el-card shadow="never" class="global-stats">
      <template #header>
        <div class="card-header">
          <span>全局统计</span>
          <el-tag v-if="isMeasuring" type="success" size="small">测量中</el-tag>
        </div>
      </template>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">总样本数</div>
          <div class="stat-value">{{ formatNumber(globalStats.totalSamples) }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">采样周期</div>
          <div class="stat-value">{{ formatTime(globalStats.samplePeriod) }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">总持续时间</div>
          <div class="stat-value">{{ formatTime(globalStats.totalDuration) }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">采样频率</div>
          <div class="stat-value">{{ formatFrequency(globalStats.sampleRate) }}</div>
        </div>
      </div>
    </el-card>

    <!-- 通道测量结果 -->
    <div class="channel-measurements">
      <div class="measurements-header">
        <h4>通道测量结果</h4>
        <div class="filter-controls">
          <el-select
            v-model="channelFilter"
            placeholder="筛选通道"
            size="small"
            multiple
            collapse-tags
            collapse-tags-tooltip
            class="channel-filter"
          >
            <el-option
              v-for="channel in availableChannels"
              :key="channel.number"
              :label="channel.name"
              :value="channel.number"
            />
          </el-select>
          <el-select
            v-model="measurementMode"
            size="small"
            class="mode-select"
            @change="onMeasurementModeChange"
          >
            <el-option label="标准测量" value="standard" />
            <el-option label="高精度测量" value="precision" />
            <el-option label="快速测量" value="fast" />
          </el-select>
        </div>
      </div>

      <div v-if="filteredChannelMeasurements.length === 0" class="no-measurements">
        <el-empty :image-size="80" description="暂无测量数据">
          <el-button v-if="hasData" type="primary" @click="startMeasurement">
            开始测量
          </el-button>
        </el-empty>
      </div>

      <div v-else class="measurements-list">
        <el-card
          v-for="measurement in filteredChannelMeasurements"
          :key="measurement.channelNumber"
          class="measurement-card"
          shadow="hover"
        >
          <template #header>
            <div class="measurement-card-header">
              <div class="channel-info">
                <div
                  class="channel-color"
                  :style="{ backgroundColor: measurement.channelColor }"
                />
                <span class="channel-name">{{ measurement.channelName }}</span>
                <el-tag size="small" type="info">CH{{ measurement.channelNumber }}</el-tag>
              </div>
              <div class="measurement-status">
                <el-tag
                  :type="measurement.isActive ? 'success' : 'info'"
                  size="small"
                >
                  {{ measurement.isActive ? '活跃' : '静止' }}
                </el-tag>
              </div>
            </div>
          </template>

          <div class="measurement-content">
            <!-- 脉冲统计 -->
            <div class="pulse-stats">
              <div class="stat-section">
                <h5>正脉冲</h5>
                <div class="pulse-info">
                  <div class="pulse-item">
                    <span class="pulse-label">数量:</span>
                    <span class="pulse-value">{{ measurement.positivePulses.count }}</span>
                  </div>
                  <div class="pulse-item">
                    <span class="pulse-label">平均持续:</span>
                    <span class="pulse-value">{{ formatTime(measurement.positivePulses.avgDuration) }}</span>
                  </div>
                  <div class="pulse-item">
                    <span class="pulse-label">预测持续:</span>
                    <span class="pulse-value">{{ formatTime(measurement.positivePulses.predictedDuration) }}</span>
                  </div>
                </div>
              </div>

              <div class="stat-section">
                <h5>负脉冲</h5>
                <div class="pulse-info">
                  <div class="pulse-item">
                    <span class="pulse-label">数量:</span>
                    <span class="pulse-value">{{ measurement.negativePulses.count }}</span>
                  </div>
                  <div class="pulse-item">
                    <span class="pulse-label">平均持续:</span>
                    <span class="pulse-value">{{ formatTime(measurement.negativePulses.avgDuration) }}</span>
                  </div>
                  <div class="pulse-item">
                    <span class="pulse-label">预测持续:</span>
                    <span class="pulse-value">{{ formatTime(measurement.negativePulses.predictedDuration) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 频率统计 -->
            <div class="frequency-stats">
              <div class="freq-item">
                <div class="freq-label">平均频率</div>
                <div class="freq-value">{{ formatFrequency(measurement.avgFrequency) }}</div>
              </div>
              <div class="freq-item">
                <div class="freq-label">预测频率</div>
                <div class="freq-value">{{ formatFrequency(measurement.predictedFrequency) }}</div>
              </div>
              <div class="freq-item">
                <div class="freq-label">占空比</div>
                <div class="freq-value">{{ (measurement.dutyCycle * 100).toFixed(1) }}%</div>
              </div>
            </div>

            <!-- 高级统计 -->
            <el-collapse v-model="expandedMeasurements" accordion>
              <el-collapse-item
                :title="`高级统计 - CH${measurement.channelNumber}`"
                :name="measurement.channelNumber"
              >
                <div class="advanced-stats">
                  <div class="stats-row">
                    <div class="advanced-stat">
                      <span class="stat-label">最小脉冲宽度:</span>
                      <span class="stat-value">{{ formatTime(measurement.advanced.minPulseWidth) }}</span>
                    </div>
                    <div class="advanced-stat">
                      <span class="stat-label">最大脉冲宽度:</span>
                      <span class="stat-value">{{ formatTime(measurement.advanced.maxPulseWidth) }}</span>
                    </div>
                  </div>
                  <div class="stats-row">
                    <div class="advanced-stat">
                      <span class="stat-label">上升沿计数:</span>
                      <span class="stat-value">{{ measurement.advanced.risingEdges }}</span>
                    </div>
                    <div class="advanced-stat">
                      <span class="stat-label">下降沿计数:</span>
                      <span class="stat-value">{{ measurement.advanced.fallingEdges }}</span>
                    </div>
                  </div>
                  <div class="stats-row">
                    <div class="advanced-stat">
                      <span class="stat-label">抖动(RMS):</span>
                      <span class="stat-value">{{ formatTime(measurement.advanced.jitterRms) }}</span>
                    </div>
                    <div class="advanced-stat">
                      <span class="stat-label">噪声水平:</span>
                      <span class="stat-value">{{ (measurement.advanced.noiseLevel * 100).toFixed(2) }}%</span>
                    </div>
                  </div>
                </div>

                <!-- 脉冲宽度分布图 -->
                <div class="pulse-distribution">
                  <h6>脉冲宽度分布</h6>
                  <div class="distribution-chart">
                    <div
                      v-for="(bin, index) in measurement.advanced.pulseWidthDistribution"
                      :key="index"
                      class="distribution-bar"
                      :style="{
                        height: `${(bin.count / measurement.advanced.maxBinCount) * 100}%`,
                        backgroundColor: getDistributionColor(bin.count, measurement.advanced.maxBinCount)
                      }"
                      :title="`宽度: ${formatTime(bin.width)}, 数量: ${bin.count}`"
                    />
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 比较分析工具 -->
    <el-card v-if="channelMeasurements.length > 1" shadow="never" class="comparison-tools">
      <template #header>
        <span>比较分析</span>
      </template>

      <div class="comparison-content">
        <div class="comparison-selector">
          <el-select
            v-model="comparisonChannels"
            placeholder="选择要比较的通道"
            multiple
            size="small"
            style="width: 100%"
          >
            <el-option
              v-for="measurement in channelMeasurements"
              :key="measurement.channelNumber"
              :label="measurement.channelName"
              :value="measurement.channelNumber"
            />
          </el-select>
        </div>

        <div v-if="comparisonChannels.length >= 2" class="comparison-results">
          <el-table :data="comparisonData" size="small" border>
            <el-table-column prop="metric" label="指标" width="120" />
            <el-table-column
              v-for="channelNum in comparisonChannels"
              :key="channelNum"
              :label="getChannelName(channelNum)"
              :prop="`channel_${channelNum}`"
            />
          </el-table>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import {
    DataAnalysis,
    VideoPlay,
    VideoPause,
    RefreshRight,
    More,
    ArrowDown
  } from '@element-plus/icons-vue';
  import { ElMessage } from 'element-plus';

  // 接口定义
  interface ChannelMeasurement {
    channelNumber: number;
    channelName: string;
    channelColor: string;
    isActive: boolean;
    positivePulses: {
      count: number;
      avgDuration: number;
      predictedDuration: number;
    };
    negativePulses: {
      count: number;
      avgDuration: number;
      predictedDuration: number;
    };
    avgFrequency: number;
    predictedFrequency: number;
    dutyCycle: number;
    advanced: {
      minPulseWidth: number;
      maxPulseWidth: number;
      risingEdges: number;
      fallingEdges: number;
      jitterRms: number;
      noiseLevel: number;
      pulseWidthDistribution: Array<{
        width: number;
        count: number;
      }>;
      maxBinCount: number;
    };
  }

  interface GlobalStats {
    totalSamples: number;
    samplePeriod: number;
    totalDuration: number;
    sampleRate: number;
  }

  interface ChannelInfo {
    number: number;
    name: string;
    color: string;
    samples?: Uint8Array;
  }

  // Props
  interface Props {
    channels?: ChannelInfo[];
    sampleRate?: number;
    isCapturing?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    channels: () => [],
    sampleRate: 100000000,
    isCapturing: false
  });

  // Emits
  const emit = defineEmits<{
    'measurement-started': [];
    'measurement-stopped': [];
    'measurement-updated': [measurements: ChannelMeasurement[]];
  }>();

  // 响应式数据
  const isMeasuring = ref(false);
  const channelFilter = ref<number[]>([]);
  const measurementMode = ref('standard');
  const expandedMeasurements = ref<number | null>(null);
  const comparisonChannels = ref<number[]>([]);

  const channelMeasurements = ref<ChannelMeasurement[]>([]);
  const globalStats = ref<GlobalStats>({
    totalSamples: 0,
    samplePeriod: 0,
    totalDuration: 0,
    sampleRate: 0
  });

  // 计算属性
  const hasData = computed(() => {
    return props.channels.some(ch => ch.samples && ch.samples.length > 0);
  });

  const availableChannels = computed(() => {
    return props.channels.filter(ch => ch.samples && ch.samples.length > 0);
  });

  const filteredChannelMeasurements = computed(() => {
    if (channelFilter.value.length === 0) {
      return channelMeasurements.value;
    }
    return channelMeasurements.value.filter(m => 
      channelFilter.value.includes(m.channelNumber)
    );
  });

  const comparisonData = computed(() => {
    if (comparisonChannels.value.length < 2) return [];

    const metrics = [
      { key: 'avgFrequency', label: '平均频率', formatter: formatFrequency },
      { key: 'predictedFrequency', label: '预测频率', formatter: formatFrequency },
      { key: 'dutyCycle', label: '占空比', formatter: (v: number) => `${(v * 100).toFixed(1)}%` },
      { key: 'positivePulses.count', label: '正脉冲数', formatter: (v: number) => v.toString() },
      { key: 'negativePulses.count', label: '负脉冲数', formatter: (v: number) => v.toString() }
    ];

    return metrics.map(metric => {
      const row: any = { metric: metric.label };
      
      comparisonChannels.value.forEach(channelNum => {
        const measurement = channelMeasurements.value.find(m => m.channelNumber === channelNum);
        if (measurement) {
          const value = getNestedValue(measurement, metric.key);
          row[`channel_${channelNum}`] = metric.formatter(value);
        }
      });

      return row;
    });
  });

  // 方法
  const startMeasurement = async () => {
    if (!hasData.value) {
      ElMessage.warning('没有可用的数据进行测量');
      return;
    }

    isMeasuring.value = true;
    emit('measurement-started');

    try {
      await performMeasurement();
      ElMessage.success('测量完成');
    } catch (error) {
      ElMessage.error('测量过程中发生错误');
      console.error('Measurement error:', error);
    } finally {
      isMeasuring.value = false;
    }
  };

  const stopMeasurement = () => {
    isMeasuring.value = false;
    emit('measurement-stopped');
    ElMessage.info('测量已停止');
  };

  const refreshMeasurement = async () => {
    if (isMeasuring.value) return;
    await startMeasurement();
  };

  const performMeasurement = async () => {
    // 更新全局统计
    updateGlobalStats();

    // 清空现有测量结果
    channelMeasurements.value = [];

    // 对每个有数据的通道进行测量
    for (const channel of availableChannels.value) {
      const measurement = await measureChannel(channel);
      channelMeasurements.value.push(measurement);
    }

    emit('measurement-updated', channelMeasurements.value);
  };

  const updateGlobalStats = () => {
    const firstChannel = availableChannels.value[0];
    if (!firstChannel?.samples) return;

    const sampleCount = firstChannel.samples.length;
    const samplePeriod = 1.0 / props.sampleRate;
    const totalDuration = sampleCount * samplePeriod;

    globalStats.value = {
      totalSamples: sampleCount,
      samplePeriod,
      totalDuration,
      sampleRate: props.sampleRate
    };
  };

  const measureChannel = async (channel: ChannelInfo): Promise<ChannelMeasurement> => {
    const samples = channel.samples!;
    const sampleRate = props.sampleRate;
    
    // 分析脉冲
    const pulseAnalysis = analyzePulses(samples);
    
    // 计算频率
    const frequencies = calculateFrequencies(pulseAnalysis, sampleRate);
    
    // 高级分析
    const advancedStats = performAdvancedAnalysis(samples, sampleRate);

    return {
      channelNumber: channel.number,
      channelName: channel.name,
      channelColor: channel.color,
      isActive: pulseAnalysis.totalTransitions > 0,
      positivePulses: {
        count: pulseAnalysis.positivePulses.length,
        avgDuration: pulseAnalysis.positivePulses.length > 0 
          ? (pulseAnalysis.positivePulses.reduce((sum, p) => sum + p, 0) / pulseAnalysis.positivePulses.length) / sampleRate
          : 0,
        predictedDuration: pulseAnalysis.predictedPosDuration / sampleRate
      },
      negativePulses: {
        count: pulseAnalysis.negativePulses.length,
        avgDuration: pulseAnalysis.negativePulses.length > 0
          ? (pulseAnalysis.negativePulses.reduce((sum, p) => sum + p, 0) / pulseAnalysis.negativePulses.length) / sampleRate
          : 0,
        predictedDuration: pulseAnalysis.predictedNegDuration / sampleRate
      },
      avgFrequency: frequencies.avgFrequency,
      predictedFrequency: frequencies.predictedFrequency,
      dutyCycle: frequencies.dutyCycle,
      advanced: advancedStats
    };
  };

  const analyzePulses = (samples: Uint8Array) => {
    let currentPulse = -1;
    let currentCount = 0;
    let totalTransitions = 0;

    const positivePulses: number[] = [];
    const negativePulses: number[] = [];

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      
      if (sample !== currentPulse) {
        if (currentPulse === 1) {
          positivePulses.push(currentCount);
        } else if (currentPulse === 0) {
          negativePulses.push(currentCount);
        }
        
        currentPulse = sample;
        currentCount = 1;
        totalTransitions++;
      } else {
        currentCount++;
      }
    }

    // 添加最后一个脉冲
    if (currentPulse === 1) {
      positivePulses.push(currentCount);
    } else if (currentPulse === 0) {
      negativePulses.push(currentCount);
    }

    // 计算预测持续时间（基于原版算法，过滤5%的异常值）
    const predictedPosDuration = calculatePredictedDuration(positivePulses);
    const predictedNegDuration = calculatePredictedDuration(negativePulses);

    return {
      positivePulses,
      negativePulses,
      predictedPosDuration,
      predictedNegDuration,
      totalTransitions
    };
  };

  const calculatePredictedDuration = (pulses: number[]): number => {
    if (pulses.length === 0) return 0;

    // 按长度分组并排序
    const grouped = pulses.reduce((acc, pulse) => {
      acc[pulse] = (acc[pulse] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const sortedByCount = Object.entries(grouped)
      .sort((a, b) => a[1] - b[1])
      .flatMap(([length, count]) => Array(count).fill(parseInt(length)));

    // 过滤掉5%的异常值
    const fivePercent = Math.floor(sortedByCount.length * 0.95);
    const filteredPulses = sortedByCount.slice(fivePercent);

    return filteredPulses.length > 0 
      ? filteredPulses.reduce((sum, p) => sum + p, 0) / filteredPulses.length
      : 0;
  };

  const calculateFrequencies = (pulseAnalysis: any, sampleRate: number) => {
    const { positivePulses, negativePulses, predictedPosDuration, predictedNegDuration } = pulseAnalysis;

    // 平均频率
    const avgPosDuration = positivePulses.length > 0 
      ? (positivePulses.reduce((sum: number, p: number) => sum + p, 0) / positivePulses.length) / sampleRate
      : 0;
    const avgNegDuration = negativePulses.length > 0
      ? (negativePulses.reduce((sum: number, p: number) => sum + p, 0) / negativePulses.length) / sampleRate
      : 0;

    const avgPeriod = avgPosDuration + avgNegDuration;
    const avgFrequency = avgPeriod > 0 ? 1.0 / avgPeriod : 0;

    // 预测频率
    const predPosDuration = predictedPosDuration / sampleRate;
    const predNegDuration = predictedNegDuration / sampleRate;
    const predPeriod = predPosDuration + predNegDuration;
    const predictedFrequency = predPeriod > 0 ? 1.0 / predPeriod : 0;

    // 占空比
    const dutyCycle = avgPeriod > 0 ? avgPosDuration / avgPeriod : 0;

    return {
      avgFrequency,
      predictedFrequency,
      dutyCycle
    };
  };

  const performAdvancedAnalysis = (samples: Uint8Array, sampleRate: number) => {
    const pulseWidths: number[] = [];
    let risingEdges = 0;
    let fallingEdges = 0;
    let currentPulse = -1;
    let currentCount = 0;

    // 边沿检测和脉冲宽度分析
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      
      if (sample !== currentPulse) {
        if (currentPulse !== -1) {
          pulseWidths.push(currentCount / sampleRate);
        }
        
        if (currentPulse === 0 && sample === 1) {
          risingEdges++;
        } else if (currentPulse === 1 && sample === 0) {
          fallingEdges++;
        }
        
        currentPulse = sample;
        currentCount = 1;
      } else {
        currentCount++;
      }
    }

    // 脉冲宽度统计
    const minPulseWidth = pulseWidths.length > 0 ? Math.min(...pulseWidths) : 0;
    const maxPulseWidth = pulseWidths.length > 0 ? Math.max(...pulseWidths) : 0;

    // 抖动计算(RMS)
    const avgPulseWidth = pulseWidths.length > 0 
      ? pulseWidths.reduce((sum, w) => sum + w, 0) / pulseWidths.length 
      : 0;
    const jitterRms = pulseWidths.length > 0
      ? Math.sqrt(pulseWidths.reduce((sum, w) => sum + Math.pow(w - avgPulseWidth, 2), 0) / pulseWidths.length)
      : 0;

    // 噪声水平估计
    const transitions = risingEdges + fallingEdges;
    const noiseLevel = samples.length > 0 ? transitions / samples.length : 0;

    // 脉冲宽度分布
    const distribution = createPulseWidthDistribution(pulseWidths);

    return {
      minPulseWidth,
      maxPulseWidth,
      risingEdges,
      fallingEdges,
      jitterRms,
      noiseLevel,
      pulseWidthDistribution: distribution.bins,
      maxBinCount: distribution.maxCount
    };
  };

  const createPulseWidthDistribution = (pulseWidths: number[]) => {
    if (pulseWidths.length === 0) {
      return { bins: [], maxCount: 0 };
    }

    const minWidth = Math.min(...pulseWidths);
    const maxWidth = Math.max(...pulseWidths);
    const binCount = Math.min(20, pulseWidths.length);
    const binSize = (maxWidth - minWidth) / binCount;

    const bins: Array<{ width: number; count: number }> = [];
    let maxCount = 0;

    for (let i = 0; i < binCount; i++) {
      const binStart = minWidth + i * binSize;
      const binEnd = binStart + binSize;
      const count = pulseWidths.filter(w => w >= binStart && w < binEnd).length;
      
      bins.push({
        width: (binStart + binEnd) / 2,
        count
      });

      maxCount = Math.max(maxCount, count);
    }

    return { bins, maxCount };
  };

  const handleMeasurementAction = (command: string) => {
    switch (command) {
      case 'export-results':
        exportMeasurementResults();
        break;
      case 'save-report':
        saveMeasurementReport();
        break;
      case 'reset-measurements':
        resetMeasurements();
        break;
    }
  };

  const exportMeasurementResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      globalStats: globalStats.value,
      channelMeasurements: channelMeasurements.value
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `measurement-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    ElMessage.success('测量结果已导出');
  };

  const saveMeasurementReport = () => {
    ElMessage.info('保存报告功能开发中...');
  };

  const resetMeasurements = () => {
    channelMeasurements.value = [];
    globalStats.value = {
      totalSamples: 0,
      samplePeriod: 0,
      totalDuration: 0,
      sampleRate: 0
    };
    expandedMeasurements.value = null;
    comparisonChannels.value = [];
    ElMessage.success('测量结果已重置');
  };

  const onMeasurementModeChange = () => {
    if (channelMeasurements.value.length > 0) {
      refreshMeasurement();
    }
  };

  const getChannelName = (channelNumber: number): string => {
    const measurement = channelMeasurements.value.find(m => m.channelNumber === channelNumber);
    return measurement?.channelName || `CH${channelNumber}`;
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const getDistributionColor = (count: number, maxCount: number): string => {
    const intensity = maxCount > 0 ? count / maxCount : 0;
    const hue = 200; // 蓝色
    const saturation = 70;
    const lightness = 90 - intensity * 40; // 从浅到深
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // 格式化函数
  const formatTime = (seconds: number): string => {
    if (seconds >= 1) {
      return `${seconds.toFixed(3)}s`;
    } else if (seconds >= 0.001) {
      return `${(seconds * 1000).toFixed(3)}ms`;
    } else if (seconds >= 0.000001) {
      return `${(seconds * 1000000).toFixed(3)}µs`;
    } else {
      return `${(seconds * 1000000000).toFixed(3)}ns`;
    }
  };

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000000000) {
      return `${(freq / 1000000000).toFixed(3)}GHz`;
    } else if (freq >= 1000000) {
      return `${(freq / 1000000).toFixed(3)}MHz`;
    } else if (freq >= 1000) {
      return `${(freq / 1000).toFixed(3)}KHz`;
    }
    return `${freq.toFixed(3)}Hz`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // 监听器
  watch(() => props.channels, () => {
    if (hasData.value && isMeasuring.value) {
      performMeasurement();
    }
  }, { deep: true });

  // 生命周期
  onMounted(() => {
    if (hasData.value) {
      updateGlobalStats();
    }
  });
</script>

<style scoped>
  .measurement-tools {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow: hidden;
  }

  .measurement-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .measurement-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .measurement-actions {
    display: flex;
    gap: 8px;
  }

  .global-stats {
    margin-bottom: 16px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }

  .stat-item {
    text-align: center;
  }

  .stat-label {
    display: block;
    font-size: 14px;
    color: #909399;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: #409eff;
    font-family: monospace;
  }

  .channel-measurements {
    flex: 1;
    overflow-y: auto;
  }

  .measurements-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .measurements-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .filter-controls {
    display: flex;
    gap: 8px;
  }

  .channel-filter {
    width: 200px;
  }

  .mode-select {
    width: 120px;
  }

  .no-measurements {
    padding: 40px;
    text-align: center;
  }

  .measurements-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .measurement-card {
    transition: box-shadow 0.3s;
  }

  .measurement-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .measurement-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .channel-color {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #ddd;
  }

  .channel-name {
    font-weight: 500;
  }

  .measurement-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .pulse-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .stat-section h5 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #606266;
  }

  .pulse-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pulse-item {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .pulse-label {
    color: #909399;
  }

  .pulse-value {
    font-weight: 500;
    font-family: monospace;
  }

  .frequency-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 16px;
    background-color: #f8f9fa;
    border-radius: 4px;
  }

  .freq-item {
    text-align: center;
  }

  .freq-label {
    font-size: 12px;
    color: #909399;
    margin-bottom: 4px;
  }

  .freq-value {
    font-size: 18px;
    font-weight: 600;
    color: #67c23a;
    font-family: monospace;
  }

  .advanced-stats {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .advanced-stat {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .pulse-distribution {
    margin-top: 16px;
  }

  .pulse-distribution h6 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
  }

  .distribution-chart {
    display: flex;
    align-items: flex-end;
    height: 80px;
    gap: 2px;
    background-color: #f5f7fa;
    padding: 8px;
    border-radius: 4px;
  }

  .distribution-bar {
    flex: 1;
    min-height: 2px;
    transition: all 0.3s;
    cursor: pointer;
  }

  .distribution-bar:hover {
    opacity: 0.7;
  }

  .comparison-tools {
    margin-top: 16px;
  }

  .comparison-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .comparison-results {
    max-height: 300px;
    overflow-y: auto;
  }
</style>