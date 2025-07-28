<template>
  <div class="logic-analyzer-app">
    <!-- 顶部工具栏 -->
    <el-header class="header">
      <div class="toolbar">
        <el-button-group>
          <el-button type="primary" :icon="Link" @click="connectDevice" :loading="isConnecting">
            {{ isConnected ? '已连接' : '连接设备' }}
          </el-button>
          <el-button
            type="success"
            :icon="VideoPlay"
            @click="startCapture"
            :disabled="!isConnected || isCapturing"
            :loading="isCapturing"
          >
            {{ isCapturing ? '采集中...' : '开始采集' }}
          </el-button>
          <el-button type="danger" :icon="VideoPause" @click="stopCapture" :disabled="!isCapturing">
            停止采集
          </el-button>
          <el-button type="info" @click="testCommunication"> 测试通信 </el-button>
        </el-button-group>

        <div class="device-info">
          <el-tag v-if="currentDevice" type="info">
            {{ currentDevice.name }}
          </el-tag>
          <el-tag v-if="captureStatus" :type="captureStatus.type">
            {{ captureStatus.text }}
          </el-tag>
        </div>
      </div>
    </el-header>

    <!-- 主内容区域 -->
    <el-container class="main-container">
      <!-- 左侧面板 - 设备和通道控制 -->
      <el-aside width="300px" class="left-panel">
        <!-- 设备信息卡片 -->
        <el-card shadow="never" class="device-card">
          <template #header>
            <div class="card-header">
              <span>设备信息</span>
              <el-button size="small" text @click="refreshDevice">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </template>

          <div v-if="currentDevice" class="device-details">
            <p><strong>设备:</strong> {{ currentDevice.name }}</p>
            <p><strong>版本:</strong> {{ currentDevice.version || 'N/A' }}</p>
            <p><strong>通道数:</strong> {{ currentDevice.channels || 24 }}</p>
            <p><strong>最大频率:</strong> {{ formatFrequency(currentDevice.maxFrequency) }}</p>
          </div>
          <div v-else class="no-device">
            <el-empty description="未连接设备" :image-size="80" />
          </div>
        </el-card>

        <!-- 通道控制卡片 -->
        <el-card shadow="never" class="channels-card">
          <template #header>
            <span>通道设置</span>
          </template>

          <div class="channels-list">
            <div v-for="channel in channels" :key="channel.id" class="channel-item">
              <el-checkbox
                v-model="channel.enabled"
                :label="channel.name"
                @change="onChannelToggle(channel)"
              />
              <div
                class="channel-color"
                :style="{ backgroundColor: channel.color }"
                @click="showColorPicker(channel)"
              />
            </div>
          </div>
        </el-card>
      </el-aside>

      <!-- 主内容区 - 波形显示 -->
      <el-main class="waveform-area">
        <el-card shadow="never" class="waveform-card">
          <template #header>
            <div class="card-header">
              <span>波形显示</span>
              <div class="waveform-controls">
                <el-button-group size="small">
                  <el-button :icon="ZoomIn" @click="zoomIn">放大</el-button>
                  <el-button :icon="ZoomOut" @click="zoomOut">缩小</el-button>
                  <el-button :icon="FullScreen" @click="fitToWindow">适应窗口</el-button>
                </el-button-group>
              </div>
            </div>
          </template>

          <!-- 波形画布 -->
          <div class="waveform-container" ref="waveformContainer">
            <canvas
              ref="waveformCanvas"
              class="waveform-canvas"
              @mousedown="onCanvasMouseDown"
              @mousemove="onCanvasMouseMove"
              @mouseup="onCanvasMouseUp"
              @wheel="onCanvasWheel"
            />

            <!-- 数据为空时的提示 -->
            <div v-if="!hasData" class="no-data-overlay">
              <el-empty description="暂无数据，请先进行数据采集" :image-size="120" />
            </div>
          </div>
        </el-card>
      </el-main>

      <!-- 右侧面板 - 解码器和测量 -->
      <el-aside width="400px" class="right-panel">
        <!-- 解码器面板 -->
        <el-tabs v-model="activeTab" class="decoder-tabs">
          <el-tab-pane label="解码器" name="decoder">
            <DecoderPanel
              ref="decoderPanelRef"
              @decoder-results="onDecoderResults"
              @decoder-error="onDecoderError"
            />
          </el-tab-pane>
          
          <el-tab-pane label="通道映射" name="channel-mapping">
            <ChannelMappingVisualizer
              v-if="activeDecoderConfigs.length > 0"
              :decoders="activeDecoderConfigs"
              :max-channels="24"
              @mapping-change="onChannelMappingChange"
              @conflict-detected="onChannelConflictDetected"
            />
            <el-empty v-else description="请先添加解码器" :image-size="80" />
          </el-tab-pane>
          
          <el-tab-pane label="测量工具" name="measurement">
            <MeasurementTools
              v-if="hasData"
              :channels="enabledChannels"
              :sample-rate="sampleRate"
              @measurement-update="onMeasurementUpdate"
            />
            <el-empty v-else description="请先进行数据采集" :image-size="80" />
          </el-tab-pane>
          
          <el-tab-pane label="状态监控" name="status-monitor">
            <DecoderStatusMonitor
              ref="statusMonitorRef"
              @decoder-status-change="onDecoderStatusChange"
              @performance-alert="onPerformanceAlert"
            />
          </el-tab-pane>
          
          <el-tab-pane label="性能分析" name="performance">
            <PerformanceAnalyzer
              ref="performanceAnalyzerRef"
              @bottleneck-detected="onBottleneckDetected"
              @optimization-applied="onOptimizationApplied"
            />
          </el-tab-pane>
        </el-tabs>
      </el-aside>
    </el-container>

    <!-- 底部状态栏 -->
    <el-footer height="32px" class="status-bar">
      <div class="status-left">
        <span v-if="sampleRate">采样率: {{ formatFrequency(sampleRate) }}</span>
        <span v-if="totalSamples">样本数: {{ totalSamples.toLocaleString() }}</span>
      </div>
      <div class="status-right">
        <span>{{ fileName || '未命名文件' }}</span>
      </div>
    </el-footer>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { ElMessage } from 'element-plus';
  import {
    Link,
    VideoPlay,
    VideoPause,
    Refresh,
    ZoomIn,
    ZoomOut,
    FullScreen
  } from '@element-plus/icons-vue';
  import LanguageSwitcher from './components/LanguageSwitcher.vue';
  import DecoderPanel from './components/DecoderPanel.vue';
  import ChannelMappingVisualizer from './components/ChannelMappingVisualizer.vue';
  import MeasurementTools from './components/MeasurementTools.vue';
  import DecoderStatusMonitor from './components/DecoderStatusMonitor.vue';
  import PerformanceAnalyzer from './components/PerformanceAnalyzer.vue';
  import { decoderManager } from '../decoders/DecoderManager';
  import { channelMappingManager } from '../decoders/ChannelMapping';
  import type { AnalyzerChannel } from '../models/AnalyzerTypes';

  // 国际化
  const { t } = useI18n();

  // 响应式数据
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const isCapturing = ref(false);
  const hasData = ref(false);

  const currentDevice = ref<any>(null);
  const captureStatus = ref<any>(null);
  const fileName = ref('');
  const sampleRate = ref(0);
  const totalSamples = ref(0);

  const channels = ref(
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      name: `CH${i}`,
      enabled: i < 8, // 默认启用前8个通道
      color: `hsl(${(i * 360) / 24}, 70%, 50%)`
    }))
  );

  // 解码器相关状态
  const activeTab = ref('decoder');
  const decoderPanelRef = ref<InstanceType<typeof DecoderPanel>>();
  const statusMonitorRef = ref<InstanceType<typeof DecoderStatusMonitor>>();
  const performanceAnalyzerRef = ref<InstanceType<typeof PerformanceAnalyzer>>();
  const activeDecoderConfigs = ref<any[]>([]);
  const decoderResults = ref<Map<string, any>>(new Map());
  const channelConflicts = ref<any[]>([]);
  const measurementResults = ref<any[]>([]);

  // 画布相关
  const waveformContainer = ref<HTMLElement>();
  const waveformCanvas = ref<HTMLCanvasElement>();
  
  // 计算属性
  const enabledChannels = computed<AnalyzerChannel[]>(() => {
    return channels.value
      .filter(ch => ch.enabled)
      .map(ch => ({
        channelNumber: ch.id,
        channelName: ch.name,
        channelColor: ch.color ? parseInt(ch.color.replace('#', ''), 16) : undefined,
        hidden: false,
        samples: undefined // 实际数据需要从采集结果获取
      }));
  });

  // 生命周期
  onMounted(async () => {
    await initializeApp();
    await setupCanvas();
    setupMessageHandlers();
    await initializeDecoders();
  });

  onUnmounted(() => {
    cleanupCanvas();
  });

  // 初始化应用
  async function initializeApp() {
    if (window.documentData) {
      fileName.value = window.documentData.fileName;

      try {
        const data = JSON.parse(window.documentData.content);
        if (data) {
          hasData.value = true;
          sampleRate.value = data.sampleRate || 0;
          totalSamples.value = data.totalSamples || 0;
          
          // 如果有通道数据，更新到解码器面板
          if (data.channels && Array.isArray(data.channels)) {
            updateDecoderChannelData(data.channels, data.sampleRate);
          }
        }
      } catch (error) {
        console.warn('Failed to parse document data:', error);
      }
    }
  }
  
  // 初始化解码器系统
  async function initializeDecoders() {
    try {
      // 这里可以注册解码器
      console.log('解码器系统初始化完成');
    } catch (error) {
      console.error('解码器系统初始化失败:', error);
      ElMessage.error('解码器系统初始化失败');
    }
  }

  // 设置画布
  async function setupCanvas() {
    await nextTick();

    const canvas = waveformCanvas.value;
    const container = waveformContainer.value;

    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      renderWaveform();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始渲染
    renderWaveform();
  }

  // 清理画布
  function cleanupCanvas() {
    // TODO: 清理画布资源
  }

  // 设置消息处理器
  function setupMessageHandlers() {
    if (!window.vscode) return;

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'documentUpdate':
          handleDocumentUpdate(message.data);
          break;
        case 'error':
          ElMessage.error(message.message);
          break;

        case 'testResponse':
          console.log('收到来自VSCode扩展的回复:', message.data);
          ElMessage.success(`通信测试成功！收到回复: ${message.data.message}`);
          break;
      }
    });
  }

  // 处理文档更新
  function handleDocumentUpdate(data: any) {
    hasData.value = !!data;
    if (data) {
      sampleRate.value = data.sampleRate || 0;
      totalSamples.value = data.totalSamples || 0;
      
      // 更新解码器通道数据
      if (data.channels && Array.isArray(data.channels)) {
        updateDecoderChannelData(data.channels, data.sampleRate);
      }
      
      renderWaveform();
    }
  }
  
  // 更新解码器通道数据
  function updateDecoderChannelData(channelData: AnalyzerChannel[], sampleRate: number) {
    if (decoderPanelRef.value && decoderPanelRef.value.updateChannelData) {
      decoderPanelRef.value.updateChannelData(channelData, sampleRate);
    }
  }

  // 设备操作
  async function connectDevice() {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'connectDevice' });
    }
  }

  async function startCapture() {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'startCapture' });
    }
  }

  async function stopCapture() {
    isCapturing.value = false;
    captureStatus.value = null;
  }

  function refreshDevice() {
    // TODO: 刷新设备信息
  }

  // 测试通信功能
  function testCommunication() {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'testMessage',
        data: {
          timestamp: new Date().toISOString(),
          message: '来自Vue前端的测试消息'
        }
      });
      ElMessage.success('测试消息已发送');
    } else {
      ElMessage.error('VSCode API不可用');
    }
  }

  // 通道操作
  function onChannelToggle(channel: any) {
    renderWaveform();
  }

  function showColorPicker(channel: any) {
    // TODO: 显示颜色选择器
  }

  // 波形操作
  function zoomIn() {
    // TODO: 放大波形
  }

  function zoomOut() {
    // TODO: 缩小波形
  }

  function fitToWindow() {
    // TODO: 适应窗口
  }

  // 画布事件处理
  function onCanvasMouseDown(event: MouseEvent) {
    // TODO: 处理鼠标按下
  }

  function onCanvasMouseMove(event: MouseEvent) {
    // TODO: 处理鼠标移动
  }

  function onCanvasMouseUp(event: MouseEvent) {
    // TODO: 处理鼠标释放
  }

  function onCanvasWheel(event: WheelEvent) {
    // TODO: 处理滚轮缩放
    event.preventDefault();
  }

  // 解码器事件处理
  function onDecoderResults(results: Map<string, any>) {
    decoderResults.value = results;
    
    // 在波形上显示解码结果
    renderDecoderResults(results);
    
    // 发送结果到VSCode扩展
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'decoderResults',
        data: Array.from(results.entries())
      });
    }
  }
  
  function onDecoderError(error: { decoderId: string; message: string }) {
    ElMessage.error(`解码器错误 (${error.decoderId}): ${error.message}`);
    
    // 发送错误到VSCode扩展
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'decoderError',
        data: error
      });
    }
  }
  
  function onChannelMappingChange(decoderId: string, mapping: Record<string, number>) {
    // 更新解码器配置
    const configIndex = activeDecoderConfigs.value.findIndex(config => config.id === decoderId);
    if (configIndex >= 0) {
      activeDecoderConfigs.value[configIndex].mapping = mapping;
    }
    
    console.log(`通道映射更新 (${decoderId}):`, mapping);
  }
  
  function onChannelConflictDetected(conflicts: any[]) {
    channelConflicts.value = conflicts;
    
    if (conflicts.length > 0) {
      ElMessage.warning(`检测到 ${conflicts.length} 个通道冲突`);
    }
  }
  
  function onMeasurementUpdate(measurements: any[]) {
    measurementResults.value = measurements;
    
    // 发送测量结果到VSCode扩展
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'measurementResults',
        data: measurements
      });
    }
  }
  
  // 新增的事件处理函数
  function onDecoderStatusChange(statusData: any) {
    console.log('解码器状态变化:', statusData);
    
    // 发送状态变化到VSCode扩展
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'decoderStatusChange',
        data: statusData
      });
    }
  }
  
  function onPerformanceAlert(alertData: any) {
    console.log('性能警告:', alertData);
    ElMessage.warning(`性能警告: ${alertData.message}`);
    
    // 发送性能警告到VSCode扩展
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'performanceAlert',
        data: alertData
      });
    }
  }
  
  function onBottleneckDetected(bottleneckData: any) {
    console.log('检测到性能瓶颈:', bottleneckData);
    ElMessage.warning(`检测到性能瓶颈: ${bottleneckData.title}`);
    
    // 发送瓶颈检测结果到VSCode扩展
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'bottleneckDetected',
        data: bottleneckData
      });
    }
  }
  
  function onOptimizationApplied(optimizationData: any) {
    console.log('优化已应用:', optimizationData);
    ElMessage.success(`优化已应用: ${optimizationData.description}`);
    
    // 发送优化应用结果到VSCode扩展
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'optimizationApplied',
        data: optimizationData
      });
    }
  }

  // 渲染波形
  function renderWaveform() {
    const canvas = waveformCanvas.value;
    if (!canvas || !hasData.value) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!hasData.value) return;

    // 绘制波形
    drawSampleWaveform(ctx, canvas.width, canvas.height);
    
    // 绘制解码结果
    if (decoderResults.value.size > 0) {
      drawDecoderAnnotations(ctx, canvas.width, canvas.height);
    }
  }
  
  // 渲染解码结果
  function renderDecoderResults(results: Map<string, any>) {
    // 触发波形重新渲染以包含解码注释
    renderWaveform();
  }
  
  // 绘制解码器注释
  function drawDecoderAnnotations(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const annotationHeight = 20;
    let yOffset = height - annotationHeight;
    
    for (const [decoderId, results] of decoderResults.value) {
      if (!Array.isArray(results)) continue;
      
      ctx.fillStyle = 'rgba(64, 158, 255, 0.1)';
      ctx.strokeStyle = '#409eff';
      ctx.lineWidth = 1;
      
      for (const result of results.slice(0, 10)) { // 限制显示数量
        const startX = (result.startSample / totalSamples.value) * width;
        const endX = (result.endSample / totalSamples.value) * width;
        
        // 绘制注释背景
        ctx.fillRect(startX, yOffset, endX - startX, annotationHeight);
        ctx.strokeRect(startX, yOffset, endX - startX, annotationHeight);
        
        // 绘制注释文本
        ctx.fillStyle = '#409eff';
        ctx.font = '10px monospace';
        const text = result.values[0] || 'Unknown';
        const textWidth = ctx.measureText(text).width;
        
        if (textWidth <= endX - startX - 4) {
          ctx.fillText(text, startX + 2, yOffset + 12);
        }
      }
      
      yOffset -= annotationHeight + 2;
      if (yOffset < 0) break; // 避免超出画布
    }
  }

  // 绘制示例波形
  function drawSampleWaveform(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const channelHeight = height / Math.max(channels.value.filter(c => c.enabled).length, 1);
    let yOffset = 0;

    channels.value.forEach((channel, index) => {
      if (!channel.enabled) return;

      ctx.strokeStyle = channel.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      // 绘制数字信号波形示例
      const samples = 100;
      let isHigh = false;
      let x = 0;
      const stepWidth = width / samples;

      ctx.moveTo(
        0,
        yOffset + channelHeight / 2 + (isHigh ? -channelHeight / 4 : channelHeight / 4)
      );

      for (let i = 0; i < samples; i++) {
        // 模拟数字信号变化
        if (Math.random() < 0.1) {
          isHigh = !isHigh;
        }

        const y = yOffset + channelHeight / 2 + (isHigh ? -channelHeight / 4 : channelHeight / 4);
        ctx.lineTo(x, y);
        x += stepWidth;
        ctx.lineTo(x, y);
      }

      ctx.stroke();

      // 绘制通道标签
      ctx.fillStyle = '#666';
      ctx.font = '12px monospace';
      ctx.fillText(channel.name, 5, yOffset + 15);

      yOffset += channelHeight;
    });
  }

  // 工具函数
  function formatFrequency(freq: number): string {
    if (freq >= 1000000000) {
      return `${(freq / 1000000000).toFixed(1)}GHz`;
    } else if (freq >= 1000000) {
      return `${(freq / 1000000).toFixed(1)}MHz`;
    } else if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}kHz`;
    } else {
      return `${freq}Hz`;
    }
  }
</script>

<style scoped>
  .logic-analyzer-app {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    border-bottom: 1px solid var(--el-border-color);
    padding: 8px 16px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .device-info {
    display: flex;
    gap: 8px;
  }

  .main-container {
    flex: 1;
    overflow: hidden;
  }

  .left-panel,
  .right-panel {
    border-right: 1px solid var(--el-border-color);
    padding: 8px;
    overflow-y: auto;
  }

  .right-panel {
    border-right: none;
    border-left: 1px solid var(--el-border-color);
    display: flex;
    flex-direction: column;
  }
  
  .decoder-tabs {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .decoder-tabs :deep(.el-tabs__content) {
    flex: 1;
    padding: 0;
  }
  
  .decoder-tabs :deep(.el-tab-pane) {
    height: 100%;
    overflow-y: auto;
  }

  .device-card,
  .channels-card,
  .decoder-card {
    margin-bottom: 16px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .device-details p {
    margin: 8px 0;
    font-size: 14px;
  }

  .no-device {
    text-align: center;
    padding: 20px 0;
  }

  .channels-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .channel-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .channel-color {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid #ddd;
  }

  .waveform-area {
    padding: 8px;
  }

  .waveform-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .waveform-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .waveform-canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
  }

  .no-data-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
  }

  .waveform-controls {
    display: flex;
    gap: 8px;
  }

  .decoder-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .decoder-button {
    flex: 1;
    min-width: 80px;
  }

  .active-decoders h4 {
    margin: 16px 0 8px 0;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }

  .active-decoder-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .status-bar {
    border-top: 1px solid var(--el-border-color);
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .status-left {
    display: flex;
    gap: 16px;
  }
</style>
