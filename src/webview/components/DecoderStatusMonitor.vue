<template>
  <div class="decoder-status-monitor">
    <el-card shadow="never" class="monitor-card">
      <template #header>
        <div class="card-header">
          <span>解码器状态监控</span>
          <div class="header-controls">
            <el-switch
              v-model="isMonitoringEnabled"
              active-text="启用监控"
              inactive-text="禁用监控"
              @change="onMonitoringToggle"
            />
            <el-button size="small" @click="clearLogs">清除日志</el-button>
            <el-button size="small" @click="exportLogs">导出日志</el-button>
          </div>
        </div>
      </template>

      <!-- 总体状态概览 -->
      <div class="status-overview">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-statistic
              title="活跃解码器"
              :value="activeDecoders"
              :precision="0"
            >
              <template #suffix>
                <el-icon color="#409eff"><Cpu /></el-icon>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="总处理时间"
              :value="totalProcessingTime"
              suffix="ms"
              :precision="2"
            >
              <template #suffix>
                <el-icon color="#67c23a"><Timer /></el-icon>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="成功解码"
              :value="successfulDecodings"
              :precision="0"
            >
              <template #suffix>
                <el-icon color="#67c23a"><Check /></el-icon>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="错误数量"
              :value="errorCount"
              :precision="0"
            >
              <template #suffix>
                <el-icon color="#f56c6c"><Close /></el-icon>
              </template>
            </el-statistic>
          </el-col>
        </el-row>
      </div>

      <!-- 解码器详细状态 -->
      <div class="decoder-details">
        <el-table
          :data="decoderStatuses"
          style="width: 100%"
          size="small"
          :default-sort="{ prop: 'lastUpdate', order: 'descending' }"
        >
          <el-table-column prop="name" label="解码器" width="120">
            <template #default="{ row }">
              <div class="decoder-name">
                <el-tag
                  :type="getStatusTagType(row.status)"
                  size="small"
                  :icon="getStatusIcon(row.status)"
                >
                  {{ row.name }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="progress" label="进度" width="100">
            <template #default="{ row }">
              <el-progress
                :percentage="row.progress"
                :status="row.status === 'error' ? 'exception' : row.status === 'completed' ? 'success' : ''"
                :stroke-width="6"
                :show-text="false"
              />
              <span class="progress-text">{{ row.progress }}%</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="samplesProcessed" label="已处理样本" width="100">
            <template #default="{ row }">
              {{ formatNumber(row.samplesProcessed) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="resultsCount" label="结果数量" width="80">
            <template #default="{ row }">
              {{ row.resultsCount }}
            </template>
          </el-table-column>
          
          <el-table-column prop="processingTime" label="处理时间" width="90">
            <template #default="{ row }">
              {{ row.processingTime.toFixed(2) }}ms
            </template>
          </el-table-column>
          
          <el-table-column prop="memoryUsage" label="内存使用" width="90">
            <template #default="{ row }">
              {{ formatMemory(row.memoryUsage) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="lastUpdate" label="最后更新" width="120">
            <template #default="{ row }">
              {{ formatTime(row.lastUpdate) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button-group size="small">
                <el-button 
                  type="primary" 
                  :icon="View" 
                  @click="showDecoderDetails(row)"
                  title="查看详情"
                />
                <el-button 
                  type="warning" 
                  :icon="Refresh" 
                  @click="restartDecoder(row)"
                  title="重启解码器"
                  :disabled="row.status === 'running'"
                />
                <el-button 
                  type="danger" 
                  :icon="Delete" 
                  @click="stopDecoder(row)"
                  title="停止解码器"
                  :disabled="row.status === 'idle'"
                />
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 实时日志 -->
      <div class="log-section">
        <el-divider>实时日志</el-divider>
        <div class="log-container" ref="logContainer">
          <div
            v-for="(log, index) in logs"
            :key="index"
            :class="['log-entry', `log-${log.level}`]"
          >
            <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-decoder">{{ log.decoderId }}</span>
            <span class="log-message">{{ log.message }}</span>
            <pre v-if="log.data" class="log-data">{{ JSON.stringify(log.data, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 解码器详情对话框 -->
    <el-dialog
      v-model="detailsDialogVisible"
      title="解码器详细信息"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedDecoder" class="decoder-details-dialog">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="解码器名称">
            {{ selectedDecoder.name }}
          </el-descriptions-item>
          <el-descriptions-item label="解码器ID">
            {{ selectedDecoder.id }}
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="getStatusTagType(selectedDecoder.status)">
              {{ getStatusText(selectedDecoder.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">
            {{ formatTime(selectedDecoder.startTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="已处理样本">
            {{ formatNumber(selectedDecoder.samplesProcessed) }}
          </el-descriptions-item>
          <el-descriptions-item label="处理速度">
            {{ formatNumber(selectedDecoder.processingSpeed) }} samples/sec
          </el-descriptions-item>
          <el-descriptions-item label="内存使用">
            {{ formatMemory(selectedDecoder.memoryUsage) }}
          </el-descriptions-item>
          <el-descriptions-item label="错误次数">
            {{ selectedDecoder.errorCount }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 性能图表 -->
        <el-divider>性能趋势</el-divider>
        <div class="performance-chart" ref="performanceChart">
          <!-- 这里可以集成图表库，如Chart.js或ECharts -->
          <div class="chart-placeholder">
            <el-empty description="性能图表功能开发中" :image-size="60" />
          </div>
        </div>

        <!-- 最近错误 -->
        <el-divider>最近错误</el-divider>
        <el-table
          :data="selectedDecoder.recentErrors"
          size="small"
          max-height="200"
        >
          <el-table-column prop="timestamp" label="时间" width="120">
            <template #default="{ row }">
              {{ formatTime(row.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column prop="message" label="错误信息" />
          <el-table-column prop="stackTrace" label="堆栈" width="100">
            <template #default="{ row }">
              <el-button
                v-if="row.stackTrace"
                size="small"
                type="text"
                @click="showStackTrace(row.stackTrace)"
              >
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Cpu,
  Timer,
  Check,
  Close,
  View,
  Refresh,
  Delete
} from '@element-plus/icons-vue';

// 接口定义
interface DecoderStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'paused';
  progress: number;
  samplesProcessed: number;
  totalSamples: number;
  resultsCount: number;
  processingTime: number;
  memoryUsage: number;
  lastUpdate: number;
  startTime: number;
  processingSpeed: number;
  errorCount: number;
  recentErrors: LogEntry[];
}

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  decoderId: string;
  message: string;
  data?: any;
  stackTrace?: string;
}

// 响应式数据
const isMonitoringEnabled = ref(true);
const decoderStatuses = ref<DecoderStatus[]>([]);
const logs = ref<LogEntry[]>([]);
const detailsDialogVisible = ref(false);
const selectedDecoder = ref<DecoderStatus | null>(null);

// 引用
const logContainer = ref<HTMLElement>();
const performanceChart = ref<HTMLElement>();

// 监控定时器
let monitoringTimer: number | null = null;
const MAX_LOGS = 1000; // 最大日志条数

// 计算属性
const activeDecoders = computed(() => 
  decoderStatuses.value.filter(d => d.status === 'running').length
);

const totalProcessingTime = computed(() =>
  decoderStatuses.value.reduce((sum, d) => sum + d.processingTime, 0)
);

const successfulDecodings = computed(() =>
  decoderStatuses.value.filter(d => d.status === 'completed').length
);

const errorCount = computed(() =>
  decoderStatuses.value.reduce((sum, d) => sum + d.errorCount, 0)
);

// 生命周期
onMounted(() => {
  if (isMonitoringEnabled.value) {
    startMonitoring();
  }
  
  // 模拟一些初始数据
  simulateDecoderActivity();
});

onUnmounted(() => {
  stopMonitoring();
});

// 方法
function startMonitoring(): void {
  if (monitoringTimer) return;
  
  monitoringTimer = window.setInterval(() => {
    updateDecoderStatuses();
  }, 1000); // 每秒更新一次
}

function stopMonitoring(): void {
  if (monitoringTimer) {
    clearInterval(monitoringTimer);
    monitoringTimer = null;
  }
}

function onMonitoringToggle(enabled: boolean): void {
  if (enabled) {
    startMonitoring();
    addLog('info', 'system', '监控已启用');
  } else {
    stopMonitoring();
    addLog('info', 'system', '监控已禁用');
  }
}

function updateDecoderStatuses(): void {
  if (!isMonitoringEnabled.value) return;
  
  // 模拟状态更新
  decoderStatuses.value.forEach(decoder => {
    if (decoder.status === 'running') {
      // 模拟进度更新
      decoder.progress = Math.min(100, decoder.progress + Math.random() * 5);
      decoder.samplesProcessed += Math.floor(Math.random() * 1000);
      decoder.processingTime += Math.random() * 10;
      decoder.memoryUsage += Math.random() * 0.1 - 0.05; // 内存使用轻微波动
      decoder.lastUpdate = Date.now();
      
      // 计算处理速度
      const elapsedTime = (Date.now() - decoder.startTime) / 1000;
      decoder.processingSpeed = decoder.samplesProcessed / elapsedTime;
      
      // 随机生成一些日志
      if (Math.random() < 0.1) {
        addLog('debug', decoder.id, `已处理 ${decoder.samplesProcessed} 个样本`);
      }
      
      // 随机完成或出错
      if (decoder.progress >= 100) {
        decoder.status = 'completed';
        addLog('info', decoder.id, '解码完成');
      } else if (Math.random() < 0.01) {
        decoder.status = 'error';
        decoder.errorCount++;
        const errorMsg = '解码过程中发生错误';
        decoder.recentErrors.push({
          timestamp: Date.now(),
          level: 'error',
          decoderId: decoder.id,
          message: errorMsg,
          stackTrace: 'Error: Sample processing failed\n  at Decoder.process()\n  at ...'
        });
        addLog('error', decoder.id, errorMsg);
      }
    }
  });
}

function addLog(level: LogEntry['level'], decoderId: string, message: string, data?: any): void {
  const logEntry: LogEntry = {
    timestamp: Date.now(),
    level,
    decoderId,
    message,
    data
  };
  
  logs.value.unshift(logEntry);
  
  // 限制日志数量
  if (logs.value.length > MAX_LOGS) {
    logs.value = logs.value.slice(0, MAX_LOGS);
  }
  
  // 自动滚动到最新日志
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = 0;
    }
  });
}

function clearLogs(): void {
  logs.value = [];
  ElMessage.success('日志已清除');
}

function exportLogs(): void {
  const logData = logs.value.map(log => ({
    time: new Date(log.timestamp).toISOString(),
    level: log.level,
    decoder: log.decoderId,
    message: log.message,
    data: log.data
  }));
  
  const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `decoder-logs-${new Date().toISOString().slice(0, 19)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  ElMessage.success('日志已导出');
}

function getStatusTagType(status: string): string {
  switch (status) {
    case 'running': return 'primary';
    case 'completed': return 'success';
    case 'error': return 'danger';
    case 'paused': return 'warning';
    default: return 'info';
  }
}

function getStatusIcon(status: string): any {
  switch (status) {
    case 'running': return Timer;
    case 'completed': return Check;
    case 'error': return Close;
    default: return Cpu;
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'idle': return '空闲';
    case 'running': return '运行中';
    case 'completed': return '已完成';
    case 'error': return '错误';
    case 'paused': return '已暂停';
    default: return '未知';
  }
}

function showDecoderDetails(decoder: DecoderStatus): void {
  selectedDecoder.value = decoder;
  detailsDialogVisible.value = true;
}

function restartDecoder(decoder: DecoderStatus): void {
  ElMessageBox.confirm(
    `确定要重启解码器 "${decoder.name}" 吗？`,
    '确认重启',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    decoder.status = 'running';
    decoder.progress = 0;
    decoder.samplesProcessed = 0;
    decoder.processingTime = 0;
    decoder.startTime = Date.now();
    decoder.lastUpdate = Date.now();
    
    addLog('info', decoder.id, '解码器已重启');
    ElMessage.success('解码器重启成功');
  }).catch(() => {
    // 用户取消
  });
}

function stopDecoder(decoder: DecoderStatus): void {
  ElMessageBox.confirm(
    `确定要停止解码器 "${decoder.name}" 吗？`,
    '确认停止',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    decoder.status = 'idle';
    decoder.lastUpdate = Date.now();
    
    addLog('warn', decoder.id, '解码器已停止');
    ElMessage.success('解码器已停止');
  }).catch(() => {
    // 用户取消
  });
}

function showStackTrace(stackTrace: string): void {
  ElMessageBox.alert(stackTrace, '错误堆栈', {
    confirmButtonText: '确定',
    type: 'error'
  });
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(1)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function formatLogTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function simulateDecoderActivity(): void {
  // 模拟一些解码器
  decoderStatuses.value = [
    {
      id: 'i2c_1',
      name: 'I2C',
      status: 'running',
      progress: 45,
      samplesProcessed: 125000,
      totalSamples: 1000000,
      resultsCount: 23,
      processingTime: 1250.5,
      memoryUsage: 2.5 * 1024 * 1024,
      lastUpdate: Date.now(),
      startTime: Date.now() - 5000,
      processingSpeed: 25000,
      errorCount: 0,
      recentErrors: []
    },
    {
      id: 'spi_1',
      name: 'SPI',
      status: 'completed',
      progress: 100,
      samplesProcessed: 500000,
      totalSamples: 500000,
      resultsCount: 67,
      processingTime: 890.2,
      memoryUsage: 1.8 * 1024 * 1024,
      lastUpdate: Date.now() - 2000,
      startTime: Date.now() - 15000,
      processingSpeed: 33333,
      errorCount: 0,
      recentErrors: []
    },
    {
      id: 'uart_1',
      name: 'UART',
      status: 'error',
      progress: 78,
      samplesProcessed: 380000,
      totalSamples: 800000,
      resultsCount: 12,
      processingTime: 2100.8,
      memoryUsage: 3.2 * 1024 * 1024,
      lastUpdate: Date.now() - 1000,
      startTime: Date.now() - 8000,
      processingSpeed: 47500,
      errorCount: 2,
      recentErrors: [
        {
          timestamp: Date.now() - 1000,
          level: 'error',
          decoderId: 'uart_1',
          message: '波特率检测失败',
          stackTrace: 'Error: Baud rate detection failed\n  at UARTDecoder.detectBaudRate()\n  ...'
        }
      ]
    }
  ];
  
  // 添加一些初始日志
  addLog('info', 'system', '解码器监控系统已启动');
  addLog('info', 'i2c_1', 'I2C解码器开始运行');
  addLog('info', 'spi_1', 'SPI解码器开始运行');
  addLog('info', 'uart_1', 'UART解码器开始运行');
}
</script>

<style scoped>
.decoder-status-monitor {
  height: 100%;
}

.monitor-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.monitor-card :deep(.el-card__body) {
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

.status-overview {
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.decoder-details {
  flex: 1;
  margin-bottom: 16px;
  overflow: auto;
}

.decoder-name {
  display: flex;
  align-items: center;
}

.progress-text {
  margin-left: 8px;
  font-size: 12px;
  color: #666;
}

.log-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
}

.log-container {
  flex: 1;
  height: 200px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px;
  background: #000;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-entry {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.log-time {
  color: #909399;
  min-width: 100px;
}

.log-level {
  min-width: 60px;
  font-weight: bold;
}

.log-debug { color: #909399; }
.log-info { color: #67c23a; }
.log-warn { color: #e6a23c; }
.log-error { color: #f56c6c; }

.log-decoder {
  color: #409eff;
  min-width: 80px;
}

.log-message {
  color: #ffffff;
  flex: 1;
}

.log-data {
  color: #e6a23c;
  margin-left: 248px;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.2;
}

.decoder-details-dialog {
  max-height: 70vh;
  overflow-y: auto;
}

.performance-chart {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
}

.chart-placeholder {
  text-align: center;
  color: #909399;
}
</style>