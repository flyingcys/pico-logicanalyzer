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
    FullScreen,
    SuccessFilled
  } from '@element-plus/icons-vue';
  import LanguageSwitcher from './components/LanguageSwitcher.vue';
  import DecoderPanel from './components/DecoderPanel.vue';
  import ChannelMappingVisualizer from './components/ChannelMappingVisualizer.vue';
  import MeasurementTools from './components/MeasurementTools.vue';
  import DecoderStatusMonitor from './components/DecoderStatusMonitor.vue';
  import PerformanceAnalyzer from './components/PerformanceAnalyzer.vue';
  import ContextMenu, { type MenuItem } from './components/ContextMenu.vue';
  import ShortcutHelpDialog from './components/ShortcutHelpDialog.vue';
  import NotificationCenter from './components/NotificationCenter.vue';
  import StatusBar from './components/StatusBar.vue';
  import { decoderManager } from '../decoders/DecoderManager';
  import { channelMappingManager } from '../decoders/ChannelMapping';
  import type { AnalyzerChannel } from '../models/AnalyzerTypes';
  import { WaveformRenderer } from './engines/WaveformRenderer';
  import { keyboardShortcutManager } from './utils/KeyboardShortcutManager';
  import { layoutManager } from './utils/LayoutManager';

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
  let waveformRenderer: WaveformRenderer | null = null;

  // UI优化相关
  const showShortcutHelp = ref(false);
  const notificationCenterRef = ref<InstanceType<typeof NotificationCenter>>();
  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    items: [] as MenuItem[]
  });

  // 波形渲染状态
  const viewRange = ref({ firstSample: 0, visibleSamples: 1000 });
  const zoomLevel = ref(1);
  const panOffset = ref(0);
  const captureData = ref<AnalyzerChannel[] | null>(null);

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
    setupUIOptimizations();
  });

  onUnmounted(() => {
    cleanupCanvas();
    cleanupUIOptimizations();
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

    try {
      // 创建 WaveformRenderer 实例
      waveformRenderer = new WaveformRenderer(canvas);

      // 设置初始视图范围
      waveformRenderer.updateVisibleSamples(
        viewRange.value.firstSample,
        viewRange.value.visibleSamples
      );

      const resizeCanvas = () => {
        if (waveformRenderer) {
          waveformRenderer.resize();
        }
      };

      window.addEventListener('resize', resizeCanvas);
    } catch (error) {
      console.error('设置Canvas失败:', error);
      ElMessage.error('波形渲染器初始化失败');
    }
  }

  // 清理画布
  function cleanupCanvas() {
    if (waveformRenderer) {
      waveformRenderer.dispose();
      waveformRenderer = null;
    }

    window.removeEventListener('resize', () => {});
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

      // 更新采集数据
      if (data.channels && Array.isArray(data.channels)) {
        captureData.value = data.channels;
        updateDecoderChannelData(data.channels, data.sampleRate);
        updateWaveformData();
      }
    }
  }

  // 更新解码器通道数据
  function updateDecoderChannelData(channelData: AnalyzerChannel[], sampleRate: number) {
    if (decoderPanelRef.value && decoderPanelRef.value.updateChannelData) {
      decoderPanelRef.value.updateChannelData(channelData, sampleRate);
    }
  }

  // 更新波形数据
  function updateWaveformData() {
    if (!waveformRenderer || !captureData.value) return;

    try {
      // 设置通道数据和采样频率
      waveformRenderer.setChannels(captureData.value, sampleRate.value);

      // 更新视图范围
      if (totalSamples.value > 0) {
        const newVisibleSamples = Math.min(viewRange.value.visibleSamples, totalSamples.value);
        viewRange.value.visibleSamples = newVisibleSamples;
        waveformRenderer.updateVisibleSamples(viewRange.value.firstSample, newVisibleSamples);
      }

      console.log('波形数据已更新:', {
        channels: captureData.value.length,
        sampleRate: sampleRate.value,
        totalSamples: totalSamples.value
      });
    } catch (error) {
      console.error('更新波形数据失败:', error);
      ElMessage.error('更新波形数据失败');
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
    if (!waveformRenderer || !captureData.value) return;

    // 更新通道可见性
    const channelData = captureData.value.find(ch => ch.channelNumber === channel.id);
    if (channelData) {
      channelData.hidden = !channel.enabled;
    }

    // 触发重新渲染
    waveformRenderer.invalidateVisual();
  }

  function showColorPicker(channel: any) {
    // TODO: 显示颜色选择器
    ElMessage.info('颜色选择器功能开发中...');
  }

  // 波形操作
  function zoomIn() {
    if (!waveformRenderer || totalSamples.value === 0) return;

    const currentVisible = viewRange.value.visibleSamples;
    const newVisible = Math.max(100, Math.floor(currentVisible * 0.5));

    if (newVisible !== currentVisible) {
      viewRange.value.visibleSamples = newVisible;
      zoomLevel.value *= 2;

      waveformRenderer.updateVisibleSamples(viewRange.value.firstSample, newVisible);

      console.log('放大波形:', { newVisible, zoomLevel: zoomLevel.value });
    }
  }

  function zoomOut() {
    if (!waveformRenderer || totalSamples.value === 0) return;

    const currentVisible = viewRange.value.visibleSamples;
    const newVisible = Math.min(totalSamples.value, Math.floor(currentVisible * 2));

    if (newVisible !== currentVisible) {
      viewRange.value.visibleSamples = newVisible;
      zoomLevel.value *= 0.5;

      // 调整起始位置以保持居中
      const centerSample = viewRange.value.firstSample + currentVisible / 2;
      const newFirstSample = Math.max(0, Math.min(
        totalSamples.value - newVisible,
        Math.floor(centerSample - newVisible / 2)
      ));

      viewRange.value.firstSample = newFirstSample;
      waveformRenderer.updateVisibleSamples(newFirstSample, newVisible);

      console.log('缩小波形:', { newVisible, newFirstSample, zoomLevel: zoomLevel.value });
    }
  }

  function fitToWindow() {
    if (!waveformRenderer || totalSamples.value === 0) return;

    viewRange.value.firstSample = 0;
    viewRange.value.visibleSamples = totalSamples.value;
    zoomLevel.value = 1;

    waveformRenderer.updateVisibleSamples(0, totalSamples.value);

    console.log('适应窗口:', { totalSamples: totalSamples.value });
  }

  // 画布交互状态
  const isDragging = ref(false);
  const dragStartX = ref(0);
  const dragStartFirstSample = ref(0);

  // 画布事件处理
  function onCanvasMouseDown(event: MouseEvent) {
    if (!waveformRenderer || totalSamples.value === 0) return;

    isDragging.value = true;
    dragStartX.value = event.clientX;
    dragStartFirstSample.value = viewRange.value.firstSample;

    event.preventDefault();
  }

  function onCanvasMouseMove(event: MouseEvent) {
    if (!isDragging.value || !waveformRenderer || totalSamples.value === 0) return;

    const canvas = waveformCanvas.value;
    if (!canvas) return;

    // 计算拖拽距离
    const deltaX = event.clientX - dragStartX.value;
    const canvasWidth = canvas.getBoundingClientRect().width;

    // 转换为样本偏移
    const sampleDelta = Math.floor((deltaX / canvasWidth) * viewRange.value.visibleSamples);
    const newFirstSample = Math.max(0, Math.min(
      totalSamples.value - viewRange.value.visibleSamples,
      dragStartFirstSample.value - sampleDelta
    ));

    if (newFirstSample !== viewRange.value.firstSample) {
      viewRange.value.firstSample = newFirstSample;
      waveformRenderer.updateVisibleSamples(newFirstSample, viewRange.value.visibleSamples);
    }

    event.preventDefault();
  }

  function onCanvasMouseUp(event: MouseEvent) {
    isDragging.value = false;
    event.preventDefault();
  }

  function onCanvasWheel(event: WheelEvent) {
    if (!waveformRenderer || totalSamples.value === 0) {
      event.preventDefault();
      return;
    }

    const canvas = waveformCanvas.value;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseRatio = mouseX / rect.width;

    // 计算鼠标位置对应的样本
    const mouseSample = viewRange.value.firstSample +
      Math.floor(mouseRatio * viewRange.value.visibleSamples);

    // 缩放
    const zoomFactor = event.deltaY > 0 ? 1.2 : 0.8;
    const currentVisible = viewRange.value.visibleSamples;
    const newVisible = Math.max(100, Math.min(
      totalSamples.value,
      Math.floor(currentVisible * zoomFactor)
    ));

    if (newVisible !== currentVisible) {
      // 以鼠标位置为中心缩放
      const newFirstSample = Math.max(0, Math.min(
        totalSamples.value - newVisible,
        Math.floor(mouseSample - mouseRatio * newVisible)
      ));

      viewRange.value.firstSample = newFirstSample;
      viewRange.value.visibleSamples = newVisible;
      zoomLevel.value = totalSamples.value / newVisible;

      waveformRenderer.updateVisibleSamples(newFirstSample, newVisible);
    }

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

  // 渲染解码结果
  function renderDecoderResults(results: Map<string, any>) {
    // 使用 WaveformRenderer 的注释系统
    if (waveformRenderer) {
      // TODO: 将解码结果转换为 WaveformRenderer 的注释格式
      console.log('解码结果已更新，需要实现注释显示功能');
    }
  }

  // UI优化相关方法
  function setupUIOptimizations() {
    // 设置键盘快捷键事件监听
    window.addEventListener('waveform-action', handleWaveformAction);
    window.addEventListener('channel-toggle', handleChannelToggle);
    window.addEventListener('panel-toggle', handlePanelToggle);
    window.addEventListener('show-shortcut-help', () => {
      showShortcutHelp.value = true;
    });

    // 加载保存的布局
    const savedLayout = layoutManager.getCurrentLayout();
    applyLayout(savedLayout);

    // 设置连接状态监控
    if (notificationCenterRef.value) {
      notificationCenterRef.value.updateConnectionStatus('disconnected');
    }
  }

  function cleanupUIOptimizations() {
    window.removeEventListener('waveform-action', handleWaveformAction);
    window.removeEventListener('channel-toggle', handleChannelToggle);
    window.removeEventListener('panel-toggle', handlePanelToggle);

    // 保存当前布局
    layoutManager.saveCurrentLayout();

    // 销毁管理器
    keyboardShortcutManager.destroy();
    layoutManager.destroy();
  }

  function handleWaveformAction(event: CustomEvent) {
    const action = event.detail;
    switch (action) {
      case 'zoomIn':
        zoomIn();
        break;
      case 'zoomOut':
        zoomOut();
        break;
      case 'fitToWindow':
        fitToWindow();
        break;
      case 'panLeft':
        panHorizontal(-0.1);
        break;
      case 'panRight':
        panHorizontal(0.1);
        break;
      case 'panUp':
        panVertical(-1);
        break;
      case 'panDown':
        panVertical(1);
        break;
    }
  }

  function handleChannelToggle(event: CustomEvent) {
    const channelIndex = event.detail;
    if (channelIndex >= 0 && channelIndex < channels.value.length) {
      channels.value[channelIndex].enabled = !channels.value[channelIndex].enabled;
      onChannelToggle(channels.value[channelIndex]);
    }
  }

  function handlePanelToggle(event: CustomEvent) {
    const panel = event.detail;
    if (panel === 'decoder') {
      activeTab.value = 'decoder';
    } else if (panel === 'measurement') {
      activeTab.value = 'measurement';
    }
  }

  function panHorizontal(ratio: number) {
    if (!waveformRenderer || totalSamples.value === 0) return;

    const panAmount = Math.floor(viewRange.value.visibleSamples * ratio);
    const newFirstSample = Math.max(0, Math.min(
      totalSamples.value - viewRange.value.visibleSamples,
      viewRange.value.firstSample + panAmount
    ));

    if (newFirstSample !== viewRange.value.firstSample) {
      viewRange.value.firstSample = newFirstSample;
      waveformRenderer.updateVisibleSamples(newFirstSample, viewRange.value.visibleSamples);

      // 更新布局管理器
      layoutManager.updateWaveformState({
        firstSample: newFirstSample,
        visibleSamples: viewRange.value.visibleSamples
      });
    }
  }

  function panVertical(direction: number) {
    // 垂直滚动通道 - 实现通道列表滚动
    const channelList = document.querySelector('.channels-list');
    if (channelList) {
      channelList.scrollTop += direction * 30; // 滚动一个通道的高度
    }
  }

  function onCanvasRightClick(event: MouseEvent) {
    event.preventDefault();

    const items: MenuItem[] = [
      {
        id: 'zoom-in',
        label: '放大',
        icon: ZoomIn,
        shortcut: keyboardShortcutManager.formatShortcut(['Ctrl', '+']),
        action: zoomIn
      },
      {
        id: 'zoom-out',
        label: '缩小',
        icon: ZoomOut,
        shortcut: keyboardShortcutManager.formatShortcut(['Ctrl', '-']),
        action: zoomOut
      },
      {
        id: 'fit-window',
        label: '适应窗口',
        icon: FullScreen,
        shortcut: keyboardShortcutManager.formatShortcut(['Ctrl', '0']),
        action: fitToWindow
      },
      {
        id: 'divider-1',
        type: 'divider'
      },
      {
        id: 'add-marker',
        label: '添加标记',
        icon: ZoomIn,
        action: () => addMarkerAtPosition(event.offsetX)
      },
      {
        id: 'measure-time',
        label: '测量时间间隔',
        icon: ZoomIn,
        action: () => startTimeMeasurement(event.offsetX)
      },
      {
        id: 'divider-2',
        type: 'divider'
      },
      {
        id: 'export-visible',
        label: '导出可见区域',
        icon: ZoomIn,
        action: exportVisibleArea
      },
      {
        id: 'save-region',
        label: '保存为区域',
        icon: ZoomIn,
        action: () => saveAsRegion(event.offsetX)
      }
    ];

    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      items
    };
  }

  function handleContextMenuClick(item: MenuItem) {
    console.log('右键菜单项点击:', item.label);
  }

  function addMarkerAtPosition(x: number) {
    if (!waveformRenderer) return;

    // 计算点击位置对应的样本号
    const canvas = waveformCanvas.value;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ratio = x / rect.width;
      const samplePosition = viewRange.value.firstSample +
        Math.floor(ratio * viewRange.value.visibleSamples);

      // 添加标记 - 这里需要实现标记功能
      console.log('在样本', samplePosition, '位置添加标记');

      if (notificationCenterRef.value) {
        notificationCenterRef.value.showTooltip({
          type: 'success',
          title: '标记已添加',
          description: `在样本 ${samplePosition} 位置添加了标记`,
          icon: SuccessFilled,
          position: { x: event?.clientX || 0, y: event?.clientY || 0 },
          duration: 3000
        });
      }
    }
  }

  function startTimeMeasurement(x: number) {
    console.log('开始时间测量，起始位置:', x);
    if (notificationCenterRef.value) {
      notificationCenterRef.value.showHelpBubble(
        '时间测量',
        '拖拽鼠标到结束位置来测量时间间隔',
        waveformCanvas.value!,
        'top'
      );
    }
  }

  function exportVisibleArea() {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'exportVisibleArea',
        data: {
          firstSample: viewRange.value.firstSample,
          visibleSamples: viewRange.value.visibleSamples
        }
      });
    }
  }

  function saveAsRegion(x: number) {
    console.log('保存为区域，位置:', x);
    // 实现区域保存功能
  }

  function applyLayout(layout: any) {
    // 应用保存的布局配置
    if (layout.panels.leftPanel) {
      // 应用左面板配置
    }
    if (layout.panels.rightPanel) {
      // 应用右面板配置
    }
    if (layout.waveform) {
      // 应用波形视图配置
      viewRange.value.firstSample = layout.waveform.firstSample || 0;
      viewRange.value.visibleSamples = layout.waveform.visibleSamples || 1000;
      zoomLevel.value = layout.waveform.zoomLevel || 1;
    }
    if (layout.channels) {
      // 应用通道配置
      layout.channels.forEach((channelConfig: any, index: number) => {
        if (index < channels.value.length) {
          channels.value[index].enabled = channelConfig.visible;
          if (channelConfig.color) {
            channels.value[index].color = channelConfig.color;
          }
        }
      });
    }
  }

  // 通知中心事件处理
  function handleGlobalOperationCancelled() {
    console.log('全局操作已取消');
  }

  function handlePerformanceWarningClicked() {
    console.log('性能警告被点击');
  }

  function handleMemoryDetailsRequested() {
    console.log('请求内存详情');
  }

  function handleConnectionDetailsRequested() {
    console.log('请求连接详情');
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

<template>
  <div class="logic-analyzer-app">
    <!-- 顶部工具栏 -->
    <el-header class="header">
      <div class="toolbar">
        <el-button-group>
          <el-button
            type="primary"
            :icon="Link"
            :loading="isConnecting"
            @click="connectDevice"
          >
            {{ isConnected ? '已连接' : '连接设备' }}
          </el-button>
          <el-button
            type="success"
            :icon="VideoPlay"
            :disabled="!isConnected || isCapturing"
            :loading="isCapturing"
            @click="startCapture"
          >
            {{ isCapturing ? '采集中...' : '开始采集' }}
          </el-button>
          <el-button
            type="danger"
            :icon="VideoPause"
            :disabled="!isCapturing"
            @click="stopCapture"
          >
            停止采集
          </el-button>
          <el-button
            type="info"
            @click="testCommunication"
          >
            测试通信
          </el-button>
        </el-button-group>

        <div class="device-info">
          <el-tag
            v-if="currentDevice"
            type="info"
          >
            {{ currentDevice.name }}
          </el-tag>
          <el-tag
            v-if="captureStatus"
            :type="captureStatus.type"
          >
            {{ captureStatus.text }}
          </el-tag>
        </div>
      </div>
    </el-header>

    <!-- 主内容区域 -->
    <el-container class="main-container">
      <!-- 左侧面板 - 设备和通道控制 -->
      <el-aside
        width="300px"
        class="left-panel"
      >
        <!-- 设备信息卡片 -->
        <el-card
          shadow="never"
          class="device-card"
        >
          <template #header>
            <div class="card-header">
              <span>设备信息</span>
              <el-button
                size="small"
                text
                @click="refreshDevice"
              >
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </template>

          <div
            v-if="currentDevice"
            class="device-details"
          >
            <p><strong>设备:</strong> {{ currentDevice.name }}</p>
            <p><strong>版本:</strong> {{ currentDevice.version || 'N/A' }}</p>
            <p><strong>通道数:</strong> {{ currentDevice.channels || 24 }}</p>
            <p><strong>最大频率:</strong> {{ formatFrequency(currentDevice.maxFrequency) }}</p>
          </div>
          <div
            v-else
            class="no-device"
          >
            <el-empty
              description="未连接设备"
              :image-size="80"
            />
          </div>
        </el-card>

        <!-- 通道控制卡片 -->
        <el-card
          shadow="never"
          class="channels-card"
        >
          <template #header>
            <span>通道设置</span>
          </template>

          <div class="channels-list">
            <div
              v-for="channel in channels"
              :key="channel.id"
              class="channel-item"
            >
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
        <el-card
          shadow="never"
          class="waveform-card"
        >
          <template #header>
            <div class="card-header">
              <span>波形显示</span>
              <div class="waveform-controls">
                <el-button-group size="small">
                  <el-button
                    :icon="ZoomIn"
                    @click="zoomIn"
                  >
                    放大
                  </el-button>
                  <el-button
                    :icon="ZoomOut"
                    @click="zoomOut"
                  >
                    缩小
                  </el-button>
                  <el-button
                    :icon="FullScreen"
                    @click="fitToWindow"
                  >
                    适应窗口
                  </el-button>
                </el-button-group>
              </div>
            </div>
          </template>

          <!-- 波形画布 -->
          <div
            ref="waveformContainer"
            class="waveform-container"
          >
            <canvas
              ref="waveformCanvas"
              class="waveform-canvas"
              @mousedown="onCanvasMouseDown"
              @mousemove="onCanvasMouseMove"
              @mouseup="onCanvasMouseUp"
              @wheel="onCanvasWheel"
              @contextmenu="onCanvasRightClick"
            />

            <!-- 数据为空时的提示 -->
            <div
              v-if="!hasData"
              class="no-data-overlay"
            >
              <el-empty
                description="暂无数据，请先进行数据采集"
                :image-size="120"
              />
            </div>
          </div>
        </el-card>
      </el-main>

      <!-- 右侧面板 - 解码器和测量 -->
      <el-aside
        width="400px"
        class="right-panel"
      >
        <!-- 解码器面板 -->
        <el-tabs
          v-model="activeTab"
          class="decoder-tabs"
        >
          <el-tab-pane
            label="解码器"
            name="decoder"
          >
            <DecoderPanel
              ref="decoderPanelRef"
              @decoder-results="onDecoderResults"
              @decoder-error="onDecoderError"
            />
          </el-tab-pane>

          <el-tab-pane
            label="通道映射"
            name="channel-mapping"
          >
            <ChannelMappingVisualizer
              v-if="activeDecoderConfigs.length > 0"
              :decoders="activeDecoderConfigs"
              :max-channels="24"
              @mapping-change="onChannelMappingChange"
              @conflict-detected="onChannelConflictDetected"
            />
            <el-empty
              v-else
              description="请先添加解码器"
              :image-size="80"
            />
          </el-tab-pane>

          <el-tab-pane
            label="测量工具"
            name="measurement"
          >
            <MeasurementTools
              v-if="hasData"
              :channels="enabledChannels"
              :sample-rate="sampleRate"
              @measurement-update="onMeasurementUpdate"
            />
            <el-empty
              v-else
              description="请先进行数据采集"
              :image-size="80"
            />
          </el-tab-pane>

          <el-tab-pane
            label="状态监控"
            name="status-monitor"
          >
            <DecoderStatusMonitor
              ref="statusMonitorRef"
              @decoder-status-change="onDecoderStatusChange"
              @performance-alert="onPerformanceAlert"
            />
          </el-tab-pane>

          <el-tab-pane
            label="性能分析"
            name="performance"
          >
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
    <el-footer
      height="32px"
      class="status-bar"
    >
      <StatusBar
        :device-connected="isConnected"
        :device-name="currentDevice?.name"
        :capture-state="captureStatus"
        :sample-data="{ totalSamples, sampleRate, duration: totalSamples / (sampleRate || 1) }"
        :channels="enabledChannels"
        :decoders="activeDecoderConfigs"
        :file-name="fileName"
        :file-modified="false"
        :show-performance="true"
        :show-zoom="true"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @cancel-operation="handleGlobalOperationCancelled"
      />
    </el-footer>

    <!-- 右键菜单 -->
    <ContextMenu
      v-model:visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @item-click="handleContextMenuClick"
    />

    <!-- 快捷键帮助对话框 -->
    <ShortcutHelpDialog v-model="showShortcutHelp" />

    <!-- 通知中心 -->
    <NotificationCenter
      ref="notificationCenterRef"
      :show-performance-indicator="true"
      :show-memory-usage="true"
      @global-operation-cancelled="handleGlobalOperationCancelled"
      @performance-warning-clicked="handlePerformanceWarningClicked"
      @memory-details-requested="handleMemoryDetailsRequested"
      @connection-details-requested="handleConnectionDetailsRequested"
    />
  </div>
</template>

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
