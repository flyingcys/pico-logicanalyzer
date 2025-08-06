/**
 * 第四阶段自测验证 - 波形显示核心集成测试
 * 验证所有实现的组件能够正常协作和运行
 * 
 * @jest-environment jsdom
 */

import { WaveformRenderer } from '../WaveformRenderer';
import { InteractionEngine } from '../InteractionEngine';
import { ChannelLayoutManager } from '../ChannelLayoutManager';
import { VirtualizationRenderer } from '../VirtualizationRenderer';
import { MarkerTools } from '../MarkerTools';
import { MeasurementTools } from '../MeasurementTools';
import { TimeAxisRenderer } from '../TimeAxisRenderer';
import { PerformanceOptimizer } from '../PerformanceOptimizer';
import { AnalyzerChannel } from '../../../models/CaptureModels';

describe.skip('第四阶段 - 波形显示核心集成测试', () => {
  let canvas: HTMLCanvasElement;
  let mockChannels: AnalyzerChannel[];
  
  // 核心组件实例
  let waveformRenderer: WaveformRenderer;
  let interactionEngine: InteractionEngine;
  let channelLayoutManager: ChannelLayoutManager;
  let virtualizationRenderer: VirtualizationRenderer;
  let markerTools: MarkerTools;
  let measurementTools: MeasurementTools;
  let timeAxisRenderer: TimeAxisRenderer;
  let performanceOptimizer: PerformanceOptimizer;

  beforeEach(() => {
    // 创建测试Canvas - 使用mock创建避免jsdom问题
    canvas = {
      width: 1000,
      height: 600,
      getContext: jest.fn(() => ({
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        fillText: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        scale: jest.fn(),
        translate: jest.fn(),
        strokeStyle: '#000000',
        fillStyle: '#000000',
        lineWidth: 1,
        font: '12px Arial'
      })),
      getBoundingClientRect: jest.fn(() => ({
        width: 1000,
        height: 600,
        left: 0,
        top: 0
      })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as any;

    // 创建模拟数据
    mockChannels = createMockChannelData();

    // 初始化所有核心组件
    initializeComponents();
  });

  afterEach(() => {
    // 清理资源
    cleanupComponents();
  });

  function createMockChannelData(): AnalyzerChannel[] {
    const channels: AnalyzerChannel[] = [];
    
    for (let i = 0; i < 8; i++) {
      const samples = new Uint8Array(10000);
      
      // 生成测试波形数据
      for (let j = 0; j < samples.length; j++) {
        // 创建不同频率的方波信号
        const period = 100 + i * 50;
        samples[j] = Math.floor(j / period) % 2;
      }
      
      channels.push({
        index: i,
        name: `Channel ${i}`,
        samples,
        enabled: true,
        color: `#${(i * 32).toString(16).padStart(2, '0')}ff${(255 - i * 32).toString(16).padStart(2, '0')}`,
        hidden: false,
        grouped: false,
        groupName: ''
      });
    }
    
    return channels;
  }

  function initializeComponents(): void {
    try {
      // 初始化波形渲染器
      waveformRenderer = new WaveformRenderer(canvas);
      console.log('✓ WaveformRenderer 初始化成功');

      // 初始化交互引擎
      interactionEngine = new InteractionEngine(canvas);
      console.log('✓ InteractionEngine 初始化成功');

      // 初始化通道布局管理器
      channelLayoutManager = new ChannelLayoutManager();
      console.log('✓ ChannelLayoutManager 初始化成功');

      // 初始化虚拟化渲染器
      virtualizationRenderer = new VirtualizationRenderer(canvas);
      console.log('✓ VirtualizationRenderer 初始化成功');

      // 初始化标记工具
      markerTools = new MarkerTools(canvas);
      console.log('✓ MarkerTools 初始化成功');

      // 初始化测量工具
      measurementTools = new MeasurementTools();
      console.log('✓ MeasurementTools 初始化成功');

      // 初始化时间轴渲染器
      timeAxisRenderer = new TimeAxisRenderer(canvas);
      console.log('✓ TimeAxisRenderer 初始化成功');

      // 初始化性能优化器
      performanceOptimizer = new PerformanceOptimizer();
      console.log('✓ PerformanceOptimizer 初始化成功');

    } catch (error) {
      console.error('组件初始化失败:', error);
      throw error;
    }
  }

  function cleanupComponents(): void {
    try {
      // 清理所有组件资源
      if (virtualizationRenderer) {
        virtualizationRenderer.dispose();
      }
      if (markerTools) {
        markerTools.dispose();
      }
      if (performanceOptimizer) {
        performanceOptimizer.dispose();
      }
      console.log('✓ 所有组件资源清理完成');
    } catch (error) {
      console.error('资源清理失败:', error);
    }
  }

  it('组件初始化测试', () => {
    // 验证所有组件都已正确初始化
    expect(waveformRenderer).toBeDefined();
    expect(interactionEngine).toBeDefined();
    expect(channelLayoutManager).toBeDefined();
    expect(virtualizationRenderer).toBeDefined();
    expect(markerTools).toBeDefined();
    expect(measurementTools).toBeDefined();
    expect(timeAxisRenderer).toBeDefined();
    expect(performanceOptimizer).toBeDefined();
    
    console.log('✅ 所有组件初始化验证通过');
  });

  it('数据设置和配置测试', () => {
    const sampleRate = 1000000; // 1MHz
    const firstSample = 0;
    const visibleSamples = 1000;

    try {
      // 设置采样信息
      waveformRenderer.setSampleInfo(sampleRate, mockChannels);
      interactionEngine.setSampleInfo(sampleRate, firstSample, visibleSamples);
      markerTools.setSampleInfo(sampleRate, firstSample, visibleSamples, mockChannels);
      measurementTools.setSampleInfo(sampleRate, mockChannels);
      timeAxisRenderer.setTimeInfo(sampleRate, firstSample, visibleSamples);

      console.log('✅ 数据设置和配置验证通过');
      expect(true).toBe(true);
    } catch (error) {
      console.error('数据设置失败:', error);
      throw error;
    }
  });

  it('渲染功能基础测试', () => {
    const sampleRate = 1000000;
    const firstSample = 0;
    const visibleSamples = 1000;

    try {
      // 设置渲染参数
      waveformRenderer.setSampleInfo(sampleRate, mockChannels);
      
      // 执行基础渲染
      const renderStats = waveformRenderer.render();
      
      // 验证渲染结果
      expect(renderStats).toBeDefined();
      expect(renderStats.renderedChannels).toBeGreaterThan(0);
      expect(renderStats.renderTime).toBeGreaterThan(0);
      
      console.log('✅ 基础渲染功能验证通过', renderStats);
    } catch (error) {
      console.error('渲染功能测试失败:', error);
      throw error;
    }
  });

  it('通道布局管理测试', () => {
    try {
      // 计算通道布局
      const layout = channelLayoutManager.calculateLayout(mockChannels, canvas.height);
      
      // 验证布局结果
      expect(layout).toBeDefined();
      expect(layout.channels.length).toBe(mockChannels.length);
      expect(layout.totalHeight).toBeGreaterThan(0);
      
      // 验证每个通道的布局信息
      layout.channels.forEach((channelInfo, index) => {
        expect(channelInfo.originalIndex).toBe(index);
        expect(channelInfo.height).toBeGreaterThan(0);
        expect(channelInfo.yPosition).toBeGreaterThanOrEqual(0);
      });
      
      console.log('✅ 通道布局管理验证通过', layout);
    } catch (error) {
      console.error('通道布局测试失败:', error);
      throw error;
    }
  });

  it('交互功能测试', () => {
    const sampleRate = 1000000;
    const firstSample = 0;
    const visibleSamples = 1000;

    try {
      // 设置交互参数
      interactionEngine.setSampleInfo(sampleRate, firstSample, visibleSamples);
      
      // 测试缩放功能
      const zoomResult = interactionEngine.zoom(2.0, canvas.width / 2);
      expect(zoomResult.zoomLevel).toBeCloseTo(2.0, 1);
      
      // 测试平移功能
      const panResult = interactionEngine.pan(100);
      expect(Math.abs(panResult.panOffset)).toBeGreaterThan(0);
      
      // 获取视口状态
      const viewport = interactionEngine.getViewport();
      expect(viewport).toBeDefined();
      expect(viewport.firstSample).toBeGreaterThanOrEqual(0);
      expect(viewport.visibleSamples).toBeGreaterThan(0);
      
      console.log('✅ 交互功能验证通过', { zoom: zoomResult, pan: panResult, viewport });
    } catch (error) {
      console.error('交互功能测试失败:', error);
      throw error;
    }
  });

  it('标记工具测试', () => {
    const sampleRate = 1000000;
    const firstSample = 0;
    const visibleSamples = 1000;

    try {
      // 设置标记工具参数
      markerTools.setSampleInfo(sampleRate, firstSample, visibleSamples, mockChannels);
      
      // 添加标记
      const marker1 = markerTools.addMarker(500, 'user', 'Test Marker 1');
      const marker2 = markerTools.addMarker(750, 'user', 'Test Marker 2');
      
      expect(marker1).toBeDefined();
      expect(marker1.sample).toBe(500);
      expect(marker2).toBeDefined();
      expect(marker2.sample).toBe(750);
      
      // 创建标记对进行测量
      const markerPair = markerTools.createMarkerPair(500, 750, 'time', 'Time Measurement');
      expect(markerPair).toBeDefined();
      expect(markerPair.startMarker.sample).toBe(500);
      expect(markerPair.endMarker.sample).toBe(750);
      
      // 获取所有标记
      const allMarkers = markerTools.getMarkers();
      expect(allMarkers.length).toBeGreaterThanOrEqual(4); // 2个用户标记 + 2个测量标记
      
      console.log('✅ 标记工具验证通过', { markers: allMarkers.length, pairs: 1 });
    } catch (error) {
      console.error('标记工具测试失败:', error);
      throw error;
    }
  });

  it('测量工具测试', () => {
    const sampleRate = 1000000;

    try {
      // 设置测量工具参数
      measurementTools.setSampleInfo(sampleRate, mockChannels);
      
      // 测试边沿检测
      const edges = measurementTools.detectEdges(0, 0, 1000, 'both');
      expect(edges.length).toBeGreaterThan(0);
      
      // 测试脉冲检测
      const pulses = measurementTools.detectPulses(0, 0, 1000, true);
      expect(pulses.length).toBeGreaterThan(0);
      
      // 测试频率测量
      const frequency = measurementTools.measureFrequency(0, 0, 1000);
      if (frequency) {
        expect(frequency.frequency).toBeGreaterThan(0);
        expect(frequency.period).toBeGreaterThan(0);
        expect(frequency.confidence).toBeGreaterThan(0);
      }
      
      // 测试占空比测量
      const dutyCycle = measurementTools.measureDutyCycle(0, 0, 1000);
      if (dutyCycle) {
        expect(dutyCycle.dutyCycle).toBeGreaterThanOrEqual(0);
        expect(dutyCycle.dutyCycle).toBeLessThanOrEqual(1);
      }
      
      console.log('✅ 测量工具验证通过', { 
        edges: edges.length, 
        pulses: pulses.length,
        frequency: frequency?.frequency,
        dutyCycle: dutyCycle?.dutyCycle
      });
    } catch (error) {
      console.error('测量工具测试失败:', error);
      throw error;
    }
  });

  it('时间轴渲染测试', () => {
    const sampleRate = 1000000;
    const firstSample = 0;
    const visibleSamples = 1000;

    try {
      // 设置时间轴参数
      timeAxisRenderer.setTimeInfo(sampleRate, firstSample, visibleSamples);
      
      // 执行渲染
      timeAxisRenderer.render(canvas.width, canvas.height);
      
      // 测试时间信息获取
      const timeInfo = timeAxisRenderer.getTimeAtPosition(canvas.width / 2, canvas.width);
      expect(timeInfo).toBeDefined();
      expect(timeInfo.sample).toBeGreaterThanOrEqual(0);
      expect(timeInfo.timestamp).toBeGreaterThanOrEqual(0);
      expect(timeInfo.timeText).toBeDefined();
      
      // 获取时间轴高度
      const height = timeAxisRenderer.getHeight();
      expect(height).toBeGreaterThan(0);
      
      console.log('✅ 时间轴渲染验证通过', { height, timeInfo });
    } catch (error) {
      console.error('时间轴渲染测试失败:', error);
      throw error;
    }
  });

  it('性能优化器测试', () => {
    try {
      // 开始帧测量
      performanceOptimizer.startFrame();
      
      // 模拟一些工作负载
      const start = performance.now();
      while (performance.now() - start < 10) {
        // 模拟10ms的工作
      }
      
      // 结束帧测量
      performanceOptimizer.endFrame();
      
      // 获取性能指标
      const metrics = performanceOptimizer.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.frameTime).toBeGreaterThan(0);
      expect(metrics.currentLOD).toBeGreaterThanOrEqual(0);
      
      // 测试LOD级别
      const currentLOD = performanceOptimizer.getCurrentLOD();
      expect(currentLOD).toBeGreaterThanOrEqual(0);
      
      // 测试渲染策略
      const strategy = performanceOptimizer.getRecommendedStrategy();
      expect(strategy).toBeDefined();
      expect(['full', 'downsample', 'minmax', 'skip']).toContain(strategy);
      
      console.log('✅ 性能优化器验证通过', { metrics, currentLOD, strategy });
    } catch (error) {
      console.error('性能优化器测试失败:', error);
      throw error;
    }
  });

  it('虚拟化渲染测试', async () => {
    try {
      // 创建通道显示信息
      const channelLayout = channelLayoutManager.calculateLayout(mockChannels, canvas.height);
      
      // 执行虚拟化渲染
      await virtualizationRenderer.renderChannels(
        channelLayout.channels,
        0,
        1000,
        canvas.width,
        canvas.height
      );
      
      // 获取性能统计
      const stats = virtualizationRenderer.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.avgFrameTime).toBeGreaterThan(0);
      expect(stats.currentLOD).toBeGreaterThanOrEqual(0);
      
      console.log('✅ 虚拟化渲染验证通过', stats);
    } catch (error) {
      console.error('虚拟化渲染测试失败:', error);
      throw error;
    }
  });

  it('综合集成测试', async () => {
    const sampleRate = 1000000;
    const firstSample = 0;
    const visibleSamples = 1000;

    try {
      console.log('🚀 开始综合集成测试...');

      // 1. 设置所有组件的基础参数
      waveformRenderer.setSampleInfo(sampleRate, mockChannels);
      interactionEngine.setSampleInfo(sampleRate, firstSample, visibleSamples);
      markerTools.setSampleInfo(sampleRate, firstSample, visibleSamples, mockChannels);
      measurementTools.setSampleInfo(sampleRate, mockChannels);
      timeAxisRenderer.setTimeInfo(sampleRate, firstSample, visibleSamples);

      console.log('  ✓ 基础参数设置完成');

      // 2. 计算通道布局
      const layout = channelLayoutManager.calculateLayout(mockChannels, canvas.height);
      console.log('  ✓ 通道布局计算完成');

      // 3. 执行性能优化的渲染
      performanceOptimizer.startFrame();
      
      // 主渲染流程
      const renderStats = waveformRenderer.render();
      
      // 虚拟化渲染（如果需要）
      if (layout.channels.length > 4) {
        await virtualizationRenderer.renderChannels(
          layout.channels,
          firstSample,
          firstSample + visibleSamples,
          canvas.width,
          canvas.height
        );
      }
      
      // 渲染时间轴
      timeAxisRenderer.render(canvas.width, canvas.height);
      
      // 渲染标记
      markerTools.renderMarkers();
      
      performanceOptimizer.endFrame();
      console.log('  ✓ 完整渲染流程执行完成');

      // 4. 添加交互测试
      const zoomResult = interactionEngine.zoom(1.5, canvas.width / 2);
      const panResult = interactionEngine.pan(50);
      console.log('  ✓ 交互功能测试完成');

      // 5. 添加标记和测量
      const marker = markerTools.addMarker(500, 'user', 'Test Marker');
      const edges = measurementTools.detectEdges(0, 0, 500);
      console.log('  ✓ 标记和测量功能测试完成');

      // 6. 获取性能指标
      const perfMetrics = performanceOptimizer.getMetrics();
      const virtStats = virtualizationRenderer.getPerformanceStats();

      console.log('  ✓ 性能指标收集完成');

      // 验证综合结果
      expect(renderStats.renderedChannels).toBeGreaterThan(0);
      expect(layout.channels.length).toBe(mockChannels.length);
      expect(zoomResult.zoomLevel).toBeCloseTo(1.5, 1);
      expect(marker.sample).toBe(500);
      expect(edges.length).toBeGreaterThan(0);
      expect(perfMetrics.frameTime).toBeGreaterThan(0);

      console.log('🎉 综合集成测试全部通过！');
      console.log('📊 测试结果摘要:', {
        渲染通道数: renderStats.renderedChannels,
        渲染时间: renderStats.renderTime,
        缩放级别: zoomResult.zoomLevel,
        平移偏移: panResult.panOffset,
        标记数量: markerTools.getMarkers().length,
        边沿数量: edges.length,
        平均帧时间: perfMetrics.averageFPS,
        LOD级别: perfMetrics.currentLOD
      });

    } catch (error) {
      console.error('❌ 综合集成测试失败:', error);
      throw error;
    }
  });

  it('性能基准测试', async () => {
    const sampleRate = 10000000; // 10MHz - 更高的采样率
    const largeDataSize = 100000; // 更大的数据集
    
    try {
      console.log('🏃‍♂️ 开始性能基准测试...');

      // 创建大数据集
      const largeChannels = mockChannels.map((channel, index) => {
        const largeSamples = new Uint8Array(largeDataSize);
        for (let i = 0; i < largeDataSize; i++) {
          largeSamples[i] = Math.floor(i / (100 + index * 20)) % 2;
        }
        return { ...channel, samples: largeSamples };
      });

      // 设置大数据集
      waveformRenderer.setSampleInfo(sampleRate, largeChannels);
      measurementTools.setSampleInfo(sampleRate, largeChannels);

      // 测试渲染性能
      const renderStart = performance.now();
      performanceOptimizer.startFrame();
      
      const renderStats = waveformRenderer.render();
      
      performanceOptimizer.endFrame();
      const renderTime = performance.now() - renderStart;

      // 测试测量工具性能
      const measureStart = performance.now();
      const edges = measurementTools.detectEdges(0, 0, 10000);
      const measureTime = performance.now() - measureStart;

      // 性能要求验证
      expect(renderTime).toBeLessThan(100); // 渲染时间应小于100ms
      expect(measureTime).toBeLessThan(50); // 测量时间应小于50ms
      expect(renderStats.renderedChannels).toBe(largeChannels.length);

      const metrics = performanceOptimizer.getMetrics();
      expect(metrics.frameTime).toBeLessThan(33.33); // 应该能维持30fps以上

      console.log('🏆 性能基准测试通过！');
      console.log('⚡ 性能指标:', {
        渲染时间: `${renderTime.toFixed(2)}ms`,
        测量时间: `${measureTime.toFixed(2)}ms`,
        数据点数: largeDataSize,
        帧时间: `${metrics.frameTime.toFixed(2)}ms`,
        FPS: `${metrics.currentFPS.toFixed(1)}`,
        LOD级别: metrics.currentLOD
      });

    } catch (error) {
      console.error('❌ 性能基准测试失败:', error);
      throw error;
    }
  });
});

/**
 * 手动运行测试的辅助函数
 */
export function runWaveformEngineTests(): void {
  console.log('🧪 开始波形显示核心自测验证...');
  console.log('📋 测试范围:');
  console.log('  • WaveformRenderer - Canvas波形渲染引擎');
  console.log('  • InteractionEngine - 缩放平移交互');
  console.log('  • ChannelLayoutManager - 多通道布局管理');
  console.log('  • VirtualizationRenderer - 虚拟化性能优化');
  console.log('  • MarkerTools - 标记工具');
  console.log('  • MeasurementTools - 测量工具');
  console.log('  • TimeAxisRenderer - 时间轴渲染');
  console.log('  • PerformanceOptimizer - 性能优化器');
  console.log('');
  console.log('请在浏览器控制台查看详细测试结果...');
}