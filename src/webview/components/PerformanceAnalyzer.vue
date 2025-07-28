<template>
  <div class="performance-analyzer">
    <el-card shadow="never" class="analyzer-card">
      <template #header>
        <div class="card-header">
          <span>性能分析工具</span>
          <div class="header-controls">
            <el-switch
              v-model="isAnalyzing"
              active-text="启用分析"
              inactive-text="停止分析"
              @change="onAnalysisToggle"
            />
            <el-button size="small" @click="resetMetrics">重置指标</el-button>
            <el-button size="small" @click="exportReport">导出报告</el-button>
          </div>
        </div>
      </template>

      <!-- 实时性能指标 -->
      <div class="metrics-overview">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-card shadow="never" class="metric-card">
              <el-statistic
                title="渲染FPS"
                :value="renderingFPS"
                :precision="1"
                suffix="fps"
              >
                <template #suffix>
                  <el-icon :color="getFPSColor(renderingFPS)"><VideoPlay /></el-icon>
                </template>
              </el-statistic>
              <div class="metric-trend">
                <span :class="getFPSTrendClass(renderingFPS)">
                  {{ getFPSTrendText(renderingFPS) }}
                </span>
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="6">
            <el-card shadow="never" class="metric-card">
              <el-statistic
                title="内存使用"
                :value="memoryUsage"
                :precision="1"
                suffix="MB"
              >
                <template #suffix>
                  <el-icon :color="getMemoryColor(memoryUsage)"><Cpu /></el-icon>
                </template>
              </el-statistic>
              <div class="metric-trend">
                <el-progress
                  :percentage="memoryUsagePercent"
                  :stroke-width="4"
                  :show-text="false"
                  :status="memoryUsagePercent > 80 ? 'exception' : ''"
                />
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="6">
            <el-card shadow="never" class="metric-card">
              <el-statistic
                title="解码延迟"
                :value="decodingLatency"
                :precision="2"
                suffix="ms"
              >
                <template #suffix>
                  <el-icon :color="getLatencyColor(decodingLatency)"><Timer /></el-icon>
                </template>
              </el-statistic>
              <div class="metric-trend">
                <span :class="getLatencyTrendClass(decodingLatency)">
                  {{ getLatencyTrendText(decodingLatency) }}
                </span>
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="6">
            <el-card shadow="never" class="metric-card">
              <el-statistic
                title="CPU使用率"
                :value="cpuUsage"
                :precision="1"
                suffix="%"
              >
                <template #suffix>
                  <el-icon :color="getCPUColor(cpuUsage)"><Setting /></el-icon>
                </template>
              </el-statistic>
              <div class="metric-trend">
                <el-progress
                  :percentage="cpuUsage"
                  :stroke-width="4"
                  :show-text="false"
                  :status="cpuUsage > 80 ? 'exception' : ''"
                />
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 详细性能数据 -->
      <el-tabs v-model="activeTab" class="performance-tabs">
        <!-- 渲染性能 -->
        <el-tab-pane label="渲染性能" name="rendering">
          <div class="performance-section">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-card shadow="never" class="section-card">
                  <template #header>
                    <span>渲染统计</span>
                  </template>
                  <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="平均帧时间">
                      {{ averageFrameTime.toFixed(2) }}ms
                    </el-descriptions-item>
                    <el-descriptions-item label="最大帧时间">
                      {{ maxFrameTime.toFixed(2) }}ms
                    </el-descriptions-item>
                    <el-descriptions-item label="最小帧时间">
                      {{ minFrameTime.toFixed(2) }}ms
                    </el-descriptions-item>
                    <el-descriptions-item label="帧时间方差">
                      {{ frameTimeVariance.toFixed(2) }}ms²
                    </el-descriptions-item>
                    <el-descriptions-item label="渲染调用次数">
                      {{ renderCallCount }}
                    </el-descriptions-item>
                    <el-descriptions-item label="跳帧次数">
                      {{ droppedFrames }}
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
              
              <el-col :span="12">
                <el-card shadow="never" class="section-card">
                  <template #header>
                    <span>Canvas性能</span>
                  </template>
                  <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="绘制调用">
                      {{ canvasDrawCalls }}
                    </el-descriptions-item>
                    <el-descriptions-item label="填充操作">
                      {{ canvasFillOps }}
                    </el-descriptions-item>
                    <el-descriptions-item label="描边操作">
                      {{ canvasStrokeOps }}
                    </el-descriptions-item>
                    <el-descriptions-item label="文本渲染">
                      {{ canvasTextOps }}
                    </el-descriptions-item>
                    <el-descriptions-item label="像素数据">
                      {{ formatBytes(pixelDataSize) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="缓存命中率">
                      {{ cacheHitRate.toFixed(1) }}%
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>

        <!-- 解码性能 -->
        <el-tab-pane label="解码性能" name="decoding">
          <div class="performance-section">
            <el-table
              :data="decoderPerformance"
              style="width: 100%"
              size="small"
              border
            >
              <el-table-column prop="name" label="解码器" width="120" />
              <el-table-column prop="samplesPerSecond" label="处理速度" width="120">
                <template #default="{ row }">
                  {{ formatNumber(row.samplesPerSecond) }} sps
                </template>
              </el-table-column>
              <el-table-column prop="averageLatency" label="平均延迟" width="100">
                <template #default="{ row }">
                  {{ row.averageLatency.toFixed(2) }}ms
                </template>
              </el-table-column>
              <el-table-column prop="memoryUsage" label="内存使用" width="100">
                <template #default="{ row }">
                  {{ formatBytes(row.memoryUsage) }}
                </template>
              </el-table-column>
              <el-table-column prop="cpuUsage" label="CPU使用" width="100">
                <template #default="{ row }">
                  {{ row.cpuUsage.toFixed(1) }}%
                </template>
              </el-table-column>
              <el-table-column prop="successRate" label="成功率" width="100">
                <template #default="{ row }">
                  <el-progress
                    :percentage="row.successRate"
                    :stroke-width="6"
                    :show-text="false"
                    :status="row.successRate < 95 ? 'exception' : 'success'"
                  />
                  <span class="success-rate-text">{{ row.successRate.toFixed(1) }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="errorCount" label="错误次数" width="80" />
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button-group size="small">
                    <el-button type="primary" @click="showDecoderProfile(row)">
                      分析
                    </el-button>
                    <el-button type="warning" @click="optimizeDecoder(row)">
                      优化
                    </el-button>
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- 内存分析 -->
        <el-tab-pane label="内存分析" name="memory">
          <div class="performance-section">
            <el-row :gutter="16">
              <el-col :span="8">
                <el-card shadow="never" class="section-card">
                  <template #header>
                    <span>内存分布</span>
                  </template>
                  <div class="memory-breakdown">
                    <div v-for="item in memoryBreakdown" :key="item.name" class="memory-item">
                      <div class="memory-label">
                        <span class="memory-name">{{ item.name }}</span>
                        <span class="memory-size">{{ formatBytes(item.size) }}</span>
                      </div>
                      <el-progress
                        :percentage="(item.size / totalMemoryUsage) * 100"
                        :stroke-width="8"
                        :show-text="false"
                        :color="item.color"
                      />
                    </div>
                  </div>
                </el-card>
              </el-col>
              
              <el-col :span="8">
                <el-card shadow="never" class="section-card">
                  <template #header>
                    <span>垃圾回收</span>
                  </template>
                  <el-descriptions :column="1" border size="small">
                    <el-descriptions-item label="GC次数">
                      {{ gcCount }}
                    </el-descriptions-item>
                    <el-descriptions-item label="平均GC时间">
                      {{ averageGCTime.toFixed(2) }}ms
                    </el-descriptions-item>
                    <el-descriptions-item label="最大GC时间">
                      {{ maxGCTime.toFixed(2) }}ms
                    </el-descriptions-item>
                    <el-descriptions-item label="回收内存">
                      {{ formatBytes(reclaimedMemory) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="内存泄漏检测">
                      <el-tag :type="memoryLeakDetected ? 'danger' : 'success'" size="small">
                        {{ memoryLeakDetected ? '检测到泄漏' : '无泄漏' }}
                      </el-tag>
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
              
              <el-col :span="8">
                <el-card shadow="never" class="section-card">
                  <template #header>
                    <span>内存警告</span>
                  </template>
                  <div class="memory-warnings">
                    <div
                      v-for="warning in memoryWarnings"
                      :key="warning.id"
                      class="warning-item"
                    >
                      <el-tag :type="warning.level" size="small">
                        {{ warning.level.toUpperCase() }}
                      </el-tag>
                      <span class="warning-message">{{ warning.message }}</span>
                      <span class="warning-time">{{ formatTime(warning.timestamp) }}</span>
                    </div>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>

        <!-- 瓶颈分析 -->
        <el-tab-pane label="瓶颈分析" name="bottlenecks">
          <div class="performance-section">
            <el-alert
              title="性能瓶颈检测"
              type="info"
              :closable="false"
              show-icon
            >
              <p>系统自动检测到的性能瓶颈和优化建议</p>
            </el-alert>

            <div class="bottleneck-list">
              <el-card
                v-for="bottleneck in bottlenecks"
                :key="bottleneck.id"
                shadow="never"
                class="bottleneck-card"
              >
                <div class="bottleneck-header">
                  <el-tag :type="getBottleneckSeverityType(bottleneck.severity)" size="large">
                    {{ bottleneck.severity.toUpperCase() }}
                  </el-tag>
                  <span class="bottleneck-title">{{ bottleneck.title }}</span>
                  <span class="bottleneck-impact">影响: {{ bottleneck.impact }}</span>
                </div>
                
                <div class="bottleneck-content">
                  <p class="bottleneck-description">{{ bottleneck.description }}</p>
                  
                  <div class="bottleneck-metrics">
                    <el-row :gutter="16">
                      <el-col :span="8">
                        <el-statistic
                          title="当前值"
                          :value="bottleneck.currentValue"
                          :suffix="bottleneck.unit"
                          :precision="2"
                        />
                      </el-col>
                      <el-col :span="8">
                        <el-statistic
                          title="建议值"
                          :value="bottleneck.recommendedValue"
                          :suffix="bottleneck.unit"
                          :precision="2"
                        />
                      </el-col>
                      <el-col :span="8">
                        <el-statistic
                          title="改进潜力"
                          :value="bottleneck.improvementPotential"
                          suffix="%"
                          :precision="1"
                        />
                      </el-col>
                    </el-row>
                  </div>
                  
                  <div class="bottleneck-recommendations">
                    <h4>优化建议:</h4>
                    <ul>
                      <li v-for="(rec, index) in bottleneck.recommendations" :key="index">
                        {{ rec }}
                      </li>
                    </ul>
                  </div>
                  
                  <div class="bottleneck-actions">
                    <el-button type="primary" @click="applyOptimization(bottleneck)">
                      应用优化
                    </el-button>
                    <el-button @click="dismissBottleneck(bottleneck)">
                      忽略
                    </el-button>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 性能分析报告对话框 -->
    <el-dialog
      v-model="reportDialogVisible"
      title="性能分析报告"
      width="900px"
      :close-on-click-modal="false"
    >
      <div class="performance-report">
        <div class="report-summary">
          <h3>性能概要</h3>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="分析时长">
              {{ formatDuration(analysisRuntime) }}
            </el-descriptions-item>
            <el-descriptions-item label="平均FPS">
              {{ averageFPS.toFixed(1) }}
            </el-descriptions-item>
            <el-descriptions-item label="内存峰值">
              {{ formatBytes(peakMemoryUsage) }}
            </el-descriptions-item>
            <el-descriptions-item label="瓶颈数量">
              {{ bottlenecks.length }}
            </el-descriptions-item>
            <el-descriptions-item label="优化建议">
              {{ optimizationCount }}
            </el-descriptions-item>
            <el-descriptions-item label="总体评分">
              <el-rate
                v-model="performanceScore"
                disabled
                show-score
                text-color="#ff9900"
                score-template="{value}/5"
              />
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="report-details">
          <h3>详细分析</h3>
          <pre class="report-text">{{ generateDetailedReport() }}</pre>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="reportDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="downloadReport">下载报告</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  VideoPlay,
  Cpu,
  Timer,
  Setting
} from '@element-plus/icons-vue';

// 接口定义
interface DecoderPerformance {
  id: string;
  name: string;
  samplesPerSecond: number;
  averageLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  successRate: number;
  errorCount: number;
}

interface MemoryBreakdown {
  name: string;
  size: number;
  color: string;
}

interface MemoryWarning {
  id: string;
  level: 'warning' | 'danger';
  message: string;
  timestamp: number;
}

interface PerformanceBottleneck {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  currentValue: number;
  recommendedValue: number;
  unit: string;
  improvementPotential: number;
  recommendations: string[];
}

// 响应式数据
const isAnalyzing = ref(false);
const activeTab = ref('rendering');
const reportDialogVisible = ref(false);

// 实时性能指标
const renderingFPS = ref(60);
const memoryUsage = ref(25.6);
const decodingLatency = ref(12.8);
const cpuUsage = ref(35.2);

// 渲染性能数据
const averageFrameTime = ref(16.67);
const maxFrameTime = ref(33.33);
const minFrameTime = ref(8.33);
const frameTimeVariance = ref(25.8);
const renderCallCount = ref(1250);
const droppedFrames = ref(3);
const canvasDrawCalls = ref(856);
const canvasFillOps = ref(245);
const canvasStrokeOps = ref(423);
const canvasTextOps = ref(188);
const pixelDataSize = ref(2048 * 1024);
const cacheHitRate = ref(87.5);

// 解码性能数据
const decoderPerformance = ref<DecoderPerformance[]>([
  {
    id: 'i2c',
    name: 'I2C',
    samplesPerSecond: 125000,
    averageLatency: 8.5,
    memoryUsage: 2.8 * 1024 * 1024,
    cpuUsage: 15.2,
    successRate: 98.7,
    errorCount: 2
  },
  {
    id: 'spi',
    name: 'SPI',
    samplesPerSecond: 250000,
    averageLatency: 6.2,
    memoryUsage: 3.5 * 1024 * 1024,
    cpuUsage: 22.8,
    successRate: 99.2,
    errorCount: 1
  },
  {
    id: 'uart',
    name: 'UART',
    samplesPerSecond: 95000,
    averageLatency: 11.8,
    memoryUsage: 2.1 * 1024 * 1024,
    cpuUsage: 18.5,
    successRate: 96.8,
    errorCount: 5
  }
]);

// 内存分析数据
const memoryBreakdown = ref<MemoryBreakdown[]>([
  { name: '波形数据', size: 12.5 * 1024 * 1024, color: '#409eff' },
  { name: '解码结果', size: 8.2 * 1024 * 1024, color: '#67c23a' },
  { name: '渲染缓存', size: 3.8 * 1024 * 1024, color: '#e6a23c' },
  { name: '系统开销', size: 1.5 * 1024 * 1024, color: '#f56c6c' }
]);

const gcCount = ref(15);
const averageGCTime = ref(2.8);
const maxGCTime = ref(8.5);
const reclaimedMemory = ref(5.2 * 1024 * 1024);
const memoryLeakDetected = ref(false);

const memoryWarnings = ref<MemoryWarning[]>([
  {
    id: '1',
    level: 'warning',
    message: '内存使用量接近阈值',
    timestamp: Date.now() - 30000
  }
]);

// 瓶颈数据
const bottlenecks = ref<PerformanceBottleneck[]>([
  {
    id: '1',
    severity: 'medium',
    title: '渲染帧率不稳定',
    description: '波形渲染过程中帧率存在较大波动，影响用户体验',
    impact: '用户体验下降',
    currentValue: 45.2,
    recommendedValue: 60.0,
    unit: 'fps',
    improvementPotential: 25.0,
    recommendations: [
      '启用硬件加速渲染',
      '优化Canvas绘制调用',
      '实现帧率限制机制',
      '减少不必要的重绘'
    ]
  },
  {
    id: '2',
    severity: 'high',
    title: 'UART解码器性能较差',
    description: 'UART解码器的处理速度明显低于其他解码器',
    impact: '解码延迟增加',
    currentValue: 95000,
    recommendedValue: 150000,
    unit: 'sps',
    improvementPotential: 40.0,
    recommendations: [
      '优化位收集算法',
      '实现批处理模式',
      '减少内存分配',
      '缓存计算结果'
    ]
  }
]);

// 分析计时器
let analysisTimer: number | null = null;
const analysisStartTime = ref(0);

// 计算属性
const memoryUsagePercent = computed(() => (memoryUsage.value / 100) * 100);
const totalMemoryUsage = computed(() => 
  memoryBreakdown.value.reduce((sum, item) => sum + item.size, 0)
);
const analysisRuntime = computed(() => 
  isAnalyzing.value ? Date.now() - analysisStartTime.value : 0
);
const averageFPS = computed(() => 
  renderingFPS.value // 简化计算
);
const peakMemoryUsage = computed(() => memoryUsage.value * 1024 * 1024);
const optimizationCount = computed(() => 
  bottlenecks.value.reduce((sum, b) => sum + b.recommendations.length, 0)
);
const performanceScore = computed(() => {
  let score = 5;
  if (renderingFPS.value < 30) score -= 1;
  if (memoryUsage.value > 50) score -= 1;
  if (decodingLatency.value > 20) score -= 1;
  if (cpuUsage.value > 70) score -= 1;
  if (bottlenecks.value.some(b => b.severity === 'critical')) score -= 1;
  return Math.max(1, score);
});

// 生命周期
onMounted(() => {
  // 模拟性能数据
  simulatePerformanceData();
});

onUnmounted(() => {
  stopAnalysis();
});

// 方法
function onAnalysisToggle(enabled: boolean): void {
  if (enabled) {
    startAnalysis();
  } else {
    stopAnalysis();
  }
}

function startAnalysis(): void {
  if (analysisTimer) return;
  
  analysisStartTime.value = Date.now();
  analysisTimer = window.setInterval(() => {
    updatePerformanceMetrics();
  }, 1000);
  
  ElMessage.success('性能分析已启动');
}

function stopAnalysis(): void {
  if (analysisTimer) {
    clearInterval(analysisTimer);
    analysisTimer = null;
  }
  
  ElMessage.info('性能分析已停止');
}

function updatePerformanceMetrics(): void {
  // 模拟性能数据更新
  renderingFPS.value = 60 + (Math.random() - 0.5) * 20;
  memoryUsage.value = Math.max(20, memoryUsage.value + (Math.random() - 0.5) * 2);
  decodingLatency.value = Math.max(5, decodingLatency.value + (Math.random() - 0.5) * 3);
  cpuUsage.value = Math.max(10, cpuUsage.value + (Math.random() - 0.5) * 10);
  
  // 更新其他指标
  averageFrameTime.value = 1000 / renderingFPS.value;
  canvasDrawCalls.value += Math.floor(Math.random() * 5);
  
  // 检测性能问题
  checkPerformanceIssues();
}

function checkPerformanceIssues(): void {
  // 检测FPS问题
  if (renderingFPS.value < 30 && !bottlenecks.value.find(b => b.id === 'fps_low')) {
    bottlenecks.value.push({
      id: 'fps_low',
      severity: 'high',
      title: 'FPS过低',
      description: '渲染帧率低于30fps，严重影响用户体验',
      impact: '用户体验极差',
      currentValue: renderingFPS.value,
      recommendedValue: 60,
      unit: 'fps',
      improvementPotential: 50,
      recommendations: ['优化渲染算法', '启用硬件加速', '减少绘制调用']
    });
  }
  
  // 检测内存问题
  if (memoryUsage.value > 80 && !memoryWarnings.value.find(w => w.message.includes('内存过高'))) {
    memoryWarnings.value.unshift({
      id: Date.now().toString(),
      level: 'danger',
      message: '内存使用过高，可能导致系统卡顿',
      timestamp: Date.now()
    });
  }
}

function resetMetrics(): void {
  ElMessageBox.confirm('确定要重置所有性能指标吗？', '确认重置', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    // 重置所有指标
    renderingFPS.value = 60;
    memoryUsage.value = 25.6;
    decodingLatency.value = 12.8;
    cpuUsage.value = 35.2;
    renderCallCount.value = 0;
    droppedFrames.value = 0;
    canvasDrawCalls.value = 0;
    gcCount.value = 0;
    memoryWarnings.value = [];
    bottlenecks.value = [];
    
    ElMessage.success('性能指标已重置');
  }).catch(() => {
    // 用户取消
  });
}

function exportReport(): void {
  reportDialogVisible.value = true;
}

function downloadReport(): void {
  const report = generateDetailedReport();
  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `performance-report-${new Date().toISOString().slice(0, 19)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  ElMessage.success('性能报告已下载');
  reportDialogVisible.value = false;
}

function generateDetailedReport(): string {
  return `
Logic Analyzer Performance Analysis Report
Generated: ${new Date().toISOString()}
Analysis Duration: ${formatDuration(analysisRuntime.value)}

=== PERFORMANCE OVERVIEW ===
Average FPS: ${averageFPS.value.toFixed(1)}
Memory Usage: ${formatBytes(memoryUsage.value * 1024 * 1024)}
Decoding Latency: ${decodingLatency.value.toFixed(2)}ms
CPU Usage: ${cpuUsage.value.toFixed(1)}%
Performance Score: ${performanceScore.value}/5

=== RENDERING PERFORMANCE ===
Average Frame Time: ${averageFrameTime.value.toFixed(2)}ms
Max Frame Time: ${maxFrameTime.value.toFixed(2)}ms
Min Frame Time: ${minFrameTime.value.toFixed(2)}ms
Render Calls: ${renderCallCount.value}
Dropped Frames: ${droppedFrames.value}
Canvas Draw Calls: ${canvasDrawCalls.value}
Cache Hit Rate: ${cacheHitRate.value.toFixed(1)}%

=== DECODER PERFORMANCE ===
${decoderPerformance.value.map(d => 
  `${d.name}: ${formatNumber(d.samplesPerSecond)} sps, ` +
  `${d.averageLatency.toFixed(2)}ms latency, ` +
  `${d.successRate.toFixed(1)}% success rate`
).join('\n')}

=== MEMORY ANALYSIS ===
Total Memory: ${formatBytes(totalMemoryUsage.value)}
${memoryBreakdown.value.map(m => 
  `${m.name}: ${formatBytes(m.size)} (${((m.size / totalMemoryUsage.value) * 100).toFixed(1)}%)`
).join('\n')}

GC Count: ${gcCount.value}
Average GC Time: ${averageGCTime.value.toFixed(2)}ms
Reclaimed Memory: ${formatBytes(reclaimedMemory.value)}

=== PERFORMANCE BOTTLENECKS ===
${bottlenecks.value.map(b => 
  `[${b.severity.toUpperCase()}] ${b.title}: ${b.description}\n` +
  `Current: ${b.currentValue} ${b.unit}, Recommended: ${b.recommendedValue} ${b.unit}\n` +
  `Improvement Potential: ${b.improvementPotential}%\n` +
  `Recommendations: ${b.recommendations.join(', ')}`
).join('\n\n')}

=== OPTIMIZATION SUGGESTIONS ===
${optimizationCount.value > 0 ? 
  bottlenecks.value.flatMap(b => b.recommendations).join('\n- ') : 
  'No specific optimizations needed at this time.'
}
`.trim();
}

function showDecoderProfile(decoder: DecoderPerformance): void {
  ElMessageBox.alert(
    `解码器: ${decoder.name}\n` +
    `处理速度: ${formatNumber(decoder.samplesPerSecond)} sps\n` +
    `平均延迟: ${decoder.averageLatency.toFixed(2)}ms\n` +
    `内存使用: ${formatBytes(decoder.memoryUsage)}\n` +
    `CPU使用: ${decoder.cpuUsage.toFixed(1)}%\n` +
    `成功率: ${decoder.successRate.toFixed(1)}%\n` +
    `错误次数: ${decoder.errorCount}`,
    '解码器性能分析',
    { confirmButtonText: '确定' }
  );
}

function optimizeDecoder(decoder: DecoderPerformance): void {
  ElMessage.info(`正在优化 ${decoder.name} 解码器性能...`);
  
  // 模拟优化过程
  setTimeout(() => {
    decoder.samplesPerSecond *= 1.2;
    decoder.averageLatency *= 0.8;
    decoder.cpuUsage *= 0.9;
    decoder.successRate = Math.min(100, decoder.successRate * 1.02);
    
    ElMessage.success(`${decoder.name} 解码器优化完成`);
  }, 2000);
}

function applyOptimization(bottleneck: PerformanceBottleneck): void {
  ElMessage.info(`正在应用 ${bottleneck.title} 的优化方案...`);
  
  // 模拟应用优化
  setTimeout(() => {
    const index = bottlenecks.value.findIndex(b => b.id === bottleneck.id);
    if (index !== -1) {
      bottlenecks.value.splice(index, 1);
    }
    
    ElMessage.success('优化方案已应用');
  }, 1500);
}

function dismissBottleneck(bottleneck: PerformanceBottleneck): void {
  const index = bottlenecks.value.findIndex(b => b.id === bottleneck.id);
  if (index !== -1) {
    bottlenecks.value.splice(index, 1);
    ElMessage.info('瓶颈已忽略');
  }
}

// 工具函数
function getFPSColor(fps: number): string {
  if (fps >= 50) return '#67c23a';
  if (fps >= 30) return '#e6a23c';
  return '#f56c6c';
}

function getFPSTrendClass(fps: number): string {
  if (fps >= 50) return 'trend-good';
  if (fps >= 30) return 'trend-warning';
  return 'trend-danger';
}

function getFPSTrendText(fps: number): string {
  if (fps >= 50) return '流畅';
  if (fps >= 30) return '一般';
  return '卡顿';
}

function getMemoryColor(memory: number): string {
  if (memory < 50) return '#67c23a';
  if (memory < 80) return '#e6a23c';
  return '#f56c6c';
}

function getLatencyColor(latency: number): string {
  if (latency < 10) return '#67c23a';
  if (latency < 20) return '#e6a23c';
  return '#f56c6c';
}

function getLatencyTrendClass(latency: number): string {
  if (latency < 10) return 'trend-good';
  if (latency < 20) return 'trend-warning';
  return 'trend-danger';
}

function getLatencyTrendText(latency: number): string {
  if (latency < 10) return '优秀';
  if (latency < 20) return '良好';
  return '较慢';
}

function getCPUColor(cpu: number): string {
  if (cpu < 50) return '#67c23a';
  if (cpu < 80) return '#e6a23c';
  return '#f56c6c';
}

function getBottleneckSeverityType(severity: string): string {
  switch (severity) {
    case 'low': return 'info';
    case 'medium': return 'warning';
    case 'high': return 'danger';
    case 'critical': return 'danger';
    default: return 'info';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(1)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function simulatePerformanceData(): void {
  // 初始化一些模拟数据
  renderingFPS.value = 58.5;
  memoryUsage.value = 32.8;
  decodingLatency.value = 9.2;
  cpuUsage.value = 28.6;
}
</script>

<style scoped>
.performance-analyzer {
  height: 100%;
}

.analyzer-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.analyzer-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.metrics-overview {
  margin-bottom: 24px;
}

.metric-card {
  text-align: center;
}

.metric-trend {
  margin-top: 8px;
  font-size: 12px;
}

.trend-good { color: #67c23a; }
.trend-warning { color: #e6a23c; }
.trend-danger { color: #f56c6c; }

.performance-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.performance-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
}

.performance-section {
  padding: 16px;
}

.section-card {
  margin-bottom: 16px;
}

.success-rate-text {
  margin-left: 8px;
  font-size: 12px;
}

.memory-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.memory-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.memory-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.memory-name {
  font-weight: 500;
}

.memory-size {
  color: #666;
}

.memory-warnings {
  max-height: 200px;
  overflow-y: auto;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 12px;
}

.warning-message {
  flex: 1;
}

.warning-time {
  color: #666;
}

.bottleneck-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bottleneck-card {
  border-left: 4px solid #e6a23c;
}

.bottleneck-card.critical {
  border-left-color: #f56c6c;
}

.bottleneck-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.bottleneck-title {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.bottleneck-impact {
  color: #666;
  font-size: 12px;
}

.bottleneck-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bottleneck-description {
  color: #666;
  line-height: 1.5;
}

.bottleneck-recommendations h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.bottleneck-recommendations ul {
  margin: 0;
  padding-left: 20px;
}

.bottleneck-recommendations li {
  margin-bottom: 4px;
  color: #666;
}

.bottleneck-actions {
  display: flex;
  gap: 8px;
}

.performance-report {
  max-height: 60vh;
  overflow-y: auto;
}

.report-summary {
  margin-bottom: 24px;
}

.report-text {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  gap: 8px;
}
</style>