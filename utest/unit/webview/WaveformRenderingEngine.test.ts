/**
 * 波形渲染引擎单元测试套件
 * 测试WaveformRenderer和InteractionEngine的完整功能
 * @jest-environment jsdom
 */

import '../../../src/tests/setup';
import '../../../src/tests/matchers';
import { SignalGenerator, TestUtils, TestScenarioBuilder } from '../../../src/tests/mocks';
import { WaveformRenderer } from '../../../src/webview/engines/WaveformRenderer';
import { InteractionEngine } from '../../../src/webview/engines/InteractionEngine';
import type { 
  SampleRegion, 
  Interval, 
  WaveformConfig, 
  AnalyzerColors,
  InteractionConfig,
  ViewportState,
  InteractionEvent
} from '../../../src/webview/engines/WaveformRenderer';

// Mock Canvas API for testing
class MockCanvas {
  public width = 800;
  public height = 600;
  private ctx: MockCanvasRenderingContext2D;
  
  constructor() {
    this.ctx = new MockCanvasRenderingContext2D(this);
  }
  
  getContext(type: string): MockCanvasRenderingContext2D | null {
    if (type === '2d') {
      return this.ctx;
    }
    return null;
  }
  
  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      right: this.width,
      bottom: this.height,
      width: this.width,
      height: this.height,
      x: 0,
      y: 0
    };
  }
  
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn();
  
  // Simulate events for testing
  simulateMouseEvent(type: string, x: number, y: number, button = 0) {
    const event = new MouseEvent(type, {
      clientX: x,
      clientY: y,
      button
    });
    
    const listeners = this.addEventListener.mock.calls
      .filter(call => call[0] === type)
      .map(call => call[1]);
    
    listeners.forEach(listener => listener(event));
  }
  
  simulateWheelEvent(deltaY: number, x: number, y: number) {
    const event = new WheelEvent('wheel', {
      deltaY,
      clientX: x,
      clientY: y
    });
    
    const listeners = this.addEventListener.mock.calls
      .filter(call => call[0] === 'wheel')
      .map(call => call[1]);
    
    listeners.forEach(listener => listener(event));
  }
}

class MockCanvasRenderingContext2D {
  private canvas: MockCanvas;
  private commands: Array<{ method: string; args: any[] }> = [];
  
  // 绘制状态
  public fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  public strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  public lineWidth: number = 1;
  public font: string = '10px sans-serif';
  public textAlign: CanvasTextAlign = 'start';
  public textBaseline: CanvasTextBaseline = 'alphabetic';
  public globalAlpha: number = 1;
  public lineCap: CanvasLineCap = 'butt';
  public lineJoin: CanvasLineJoin = 'miter';
  
  constructor(canvas: MockCanvas) {
    this.canvas = canvas;
  }
  
  // 记录绘制命令
  private recordCommand(method: string, args: any[]) {
    this.commands.push({ method, args: [...args] });
  }
  
  // Canvas API methods
  beginPath() { this.recordCommand('beginPath', []); }
  closePath() { this.recordCommand('closePath', []); }
  moveTo(x: number, y: number) { this.recordCommand('moveTo', [x, y]); }
  lineTo(x: number, y: number) { this.recordCommand('lineTo', [x, y]); }
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
    this.recordCommand('arc', [x, y, radius, startAngle, endAngle]);
  }
  rect(x: number, y: number, width: number, height: number) {
    this.recordCommand('rect', [x, y, width, height]);
  }
  fillRect(x: number, y: number, width: number, height: number) {
    this.recordCommand('fillRect', [x, y, width, height]);
  }
  strokeRect(x: number, y: number, width: number, height: number) {
    this.recordCommand('strokeRect', [x, y, width, height]);
  }
  clearRect(x: number, y: number, width: number, height: number) {
    this.recordCommand('clearRect', [x, y, width, height]);
  }
  fill() { this.recordCommand('fill', []); }
  stroke() { this.recordCommand('stroke', []); }
  
  fillText(text: string, x: number, y: number, maxWidth?: number) {
    this.recordCommand('fillText', [text, x, y, maxWidth]);
  }
  strokeText(text: string, x: number, y: number, maxWidth?: number) {
    this.recordCommand('strokeText', [text, x, y, maxWidth]);
  }
  
  measureText(text: string): TextMetrics {
    return {
      width: text.length * 8, // 简化的文本宽度计算
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: -2,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: -3,
      alphabeticBaseline: 0,
      emHeightAscent: 10,
      emHeightDescent: -2,
      hangingBaseline: 8,
      ideographicBaseline: -2
    };
  }
  
  save() { this.recordCommand('save', []); }
  restore() { this.recordCommand('restore', []); }
  
  translate(x: number, y: number) { this.recordCommand('translate', [x, y]); }
  rotate(angle: number) { this.recordCommand('rotate', [angle]); }
  scale(x: number, y: number) { this.recordCommand('scale', [x, y]); }
  
  setLineDash(segments: number[]) { this.recordCommand('setLineDash', [segments]); }
  getLineDash(): number[] { return []; }
  
  // 测试辅助方法
  getCommands() { return [...this.commands]; }
  getCommandCount(method: string): number {
    return this.commands.filter(cmd => cmd.method === method).length;
  }
  clearCommands() { this.commands = []; }
  getLastCommand() { return this.commands[this.commands.length - 1]; }
}

// 测试数据生成辅助类
class WaveformTestDataGenerator {
  /**
   * 生成测试用的通道数据
   */
  static generateChannelData(channelCount: number, sampleCount: number): any[] {
    const channels = [];
    
    for (let ch = 0; ch < channelCount; ch++) {
      const samples = new Uint8Array(Math.ceil(sampleCount / 8));
      
      // 为不同通道生成不同的信号模式
      for (let i = 0; i < samples.length; i++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const sampleIndex = i * 8 + bit;
          if (sampleIndex >= sampleCount) break;
          
          let bitValue = 0;
          switch (ch % 4) {
            case 0: // 方波
              bitValue = Math.floor(sampleIndex / 50) % 2;
              break;
            case 1: // 时钟
              bitValue = sampleIndex % 2;
              break;
            case 2: // 随机
              bitValue = Math.random() > 0.5 ? 1 : 0;
              break;
            case 3: // 脉冲
              bitValue = (sampleIndex % 100) < 5 ? 1 : 0;
              break;
          }
          
          if (bitValue) {
            byte |= (1 << bit);
          }
        }
        samples[i] = byte;
      }
      
      channels.push({
        channelNumber: ch,
        channelName: `Channel ${ch}`,
        samples,
        hidden: false
      });
    }
    
    return channels;
  }
  
  /**
   * 生成测试用的时间间隔数据
   */
  static generateIntervals(channelData: any[], sampleRate: number): Interval[][] {
    const intervals: Interval[][] = [];
    
    for (const channel of channelData) {
      const channelIntervals: Interval[] = [];
      let currentValue = 0;
      let intervalStart = 0;
      
      const samples = channel.samples;
      const totalSamples = samples.length * 8;
      
      for (let i = 0; i < totalSamples; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        const bitValue = (samples[byteIndex] >> bitIndex) & 1;
        
        if (bitValue !== currentValue) {
          if (i > intervalStart) {
            channelIntervals.push({
              value: currentValue === 1,
              start: intervalStart,
              end: i - 1,
              duration: (i - intervalStart) / sampleRate
            });
          }
          
          currentValue = bitValue;
          intervalStart = i;
        }
      }
      
      // 添加最后一个间隔
      if (intervalStart < totalSamples) {
        channelIntervals.push({
          value: currentValue === 1,
          start: intervalStart,
          end: totalSamples - 1,
          duration: (totalSamples - intervalStart) / sampleRate
        });
      }
      
      intervals.push(channelIntervals);
    }
    
    return intervals;
  }
  
  /**
   * 生成测试用的样本区域
   */
  static generateSampleRegions(): SampleRegion[] {
    return [
      {
        firstSample: 100,
        lastSample: 200,
        sampleCount: 100,
        regionName: 'Region 1',
        regionColor: '#ff000080'
      },
      {
        firstSample: 300,
        lastSample: 450,
        sampleCount: 150,
        regionName: 'Region 2',
        regionColor: '#00ff0080'
      },
      {
        firstName: 500,
        lastSample: 600,
        sampleCount: 100,
        regionName: 'Region 3',
        regionColor: '#0000ff80'
      }
    ];
  }
}

describe('波形渲染引擎测试套件', () => {
  let mockCanvas: MockCanvas;
  let mockCtx: MockCanvasRenderingContext2D;
  
  beforeEach(() => {
    mockCanvas = new MockCanvas();
    mockCtx = mockCanvas.getContext('2d') as MockCanvasRenderingContext2D;
    
    // Mock global Canvas API
    global.HTMLCanvasElement = jest.fn(() => mockCanvas) as any;
    global.CanvasRenderingContext2D = jest.fn(() => mockCtx) as any;
  });
  
  afterEach(() => {
    mockCtx.clearCommands();
  });
  
  describe('WaveformRenderer 基础功能测试', () => {
    let renderer: WaveformRenderer;
    
    beforeEach(() => {
      renderer = new WaveformRenderer(mockCanvas as any);
    });
    
    it('应该正确初始化WaveformRenderer', () => {
      expect(renderer).toBeDefined();
      expect(renderer.firstSample).toBe(0);
      expect(renderer.visibleSamples).toBe(0);
      expect(renderer.regions).toEqual([]);
      expect(renderer.userMarker).toBeNull();
    });
    
    it('应该正确设置事件监听器', () => {
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });
    
    it('应该正确更新可见样本范围', () => {
      renderer.updateVisibleSamples(100, 1000);
      
      expect(renderer.firstSample).toBe(100);
      expect(renderer.visibleSamples).toBe(1000);
    });
    
    it('应该正确管理样本区域', () => {
      const regions = WaveformTestDataGenerator.generateSampleRegions();
      
      // 添加单个区域
      renderer.addRegion(regions[0]);
      expect(renderer.regions).toHaveLength(1);
      expect(renderer.regions[0]).toEqual(regions[0]);
      
      // 添加多个区域
      renderer.addRegions(regions.slice(1));
      expect(renderer.regions).toHaveLength(3);
      
      // 移除区域
      const removed = renderer.removeRegion(regions[0]);
      expect(removed).toBe(true);
      expect(renderer.regions).toHaveLength(2);
      
      // 清除所有区域
      renderer.clearRegions();
      expect(renderer.regions).toHaveLength(0);
    });
    
    it('应该正确设置用户标记', () => {
      renderer.setUserMarker(500);
      expect(renderer.userMarker).toBe(500);
      
      renderer.setUserMarker(null);
      expect(renderer.userMarker).toBeNull();
    });
    
    it('应该正确处理通道数据设置', () => {
      const channelData = WaveformTestDataGenerator.generateChannelData(4, 1000);
      const intervals = WaveformTestDataGenerator.generateIntervals(channelData, 24000000);
      
      renderer.setChannels(channelData);
      renderer.setIntervals(intervals);
      renderer.setSampleFrequency(24000000);
      
      expect(renderer.getChannelCount()).toBe(4);
      expect(renderer.getSampleFrequency()).toBe(24000000);
    });
  });
  
  describe('WaveformRenderer 渲染功能测试', () => {
    let renderer: WaveformRenderer;
    
    beforeEach(() => {
      renderer = new WaveformRenderer(mockCanvas as any);
      
      const channelData = WaveformTestDataGenerator.generateChannelData(8, 2000);
      const intervals = WaveformTestDataGenerator.generateIntervals(channelData, 24000000);
      
      renderer.setChannels(channelData);
      renderer.setIntervals(intervals);
      renderer.setSampleFrequency(24000000);
      renderer.updateVisibleSamples(0, 1000);
    });
    
    it('应该正确执行基础渲染', () => {
      const startTime = Date.now();
      renderer.render();
      const renderTime = Date.now() - startTime;
      
      expect(renderTime).toBeWithinPerformanceBudget(100); // 100ms内完成渲染
      
      // 验证基本绘制命令被调用
      expect(mockCtx.getCommandCount('clearRect')).toBeGreaterThan(0);
      expect(mockCtx.getCommandCount('fillRect')).toBeGreaterThan(0);
      expect(mockCtx.getCommandCount('strokeRect')).toBeGreaterThan(0);
    });
    
    it('应该正确渲染通道背景', () => {
      renderer.render();
      
      // 验证背景矩形绘制
      const fillRectCommands = mockCtx.getCommands().filter(cmd => cmd.method === 'fillRect');
      expect(fillRectCommands.length).toBeGreaterThan(0);
      
      // 验证使用了正确的背景颜色
      const fillStyles = mockCtx.getCommands()
        .filter(cmd => cmd.method === 'fillRect')
        .map(() => mockCtx.fillStyle);
      expect(fillStyles.some(style => typeof style === 'string')).toBe(true);
    });
    
    it('应该正确渲染波形数据', () => {
      renderer.render();
      
      // 验证线条绘制
      expect(mockCtx.getCommandCount('beginPath')).toBeGreaterThan(0);
      expect(mockCtx.getCommandCount('moveTo')).toBeGreaterThan(0);
      expect(mockCtx.getCommandCount('lineTo')).toBeGreaterThan(0);
      expect(mockCtx.getCommandCount('stroke')).toBeGreaterThan(0);
    });
    
    it('应该正确渲染样本区域', () => {
      const regions = WaveformTestDataGenerator.generateSampleRegions();
      renderer.addRegions(regions);
      renderer.render();
      
      // 验证区域渲染
      const commands = mockCtx.getCommands();
      const regionCommands = commands.filter(cmd => 
        cmd.method === 'fillRect' && 
        mockCtx.fillStyle.toString().includes('80') // 半透明颜色
      );
      expect(regionCommands.length).toBeGreaterThan(0);
    });
    
    it('应该正确渲染用户标记', () => {
      renderer.setUserMarker(500);
      renderer.render();
      
      // 验证标记线绘制
      const strokeCommands = mockCtx.getCommands().filter(cmd => cmd.method === 'stroke');
      expect(strokeCommands.length).toBeGreaterThan(0);
    });
    
    it('应该正确处理大数据量渲染', () => {
      // 生成大量数据
      const largeChannelData = WaveformTestDataGenerator.generateChannelData(24, 100000);
      const largeIntervals = WaveformTestDataGenerator.generateIntervals(largeChannelData, 100000000);
      
      renderer.setChannels(largeChannelData);
      renderer.setIntervals(largeIntervals);
      renderer.updateVisibleSamples(0, 50000);
      
      const startTime = Date.now();
      renderer.render();
      const renderTime = Date.now() - startTime;
      
      expect(renderTime).toBeWithinPerformanceBudget(1000); // 1秒内完成大数据渲染
      
      // 验证渲染统计
      const stats = renderer.getRenderStats();
      expect(stats.renderTime).toBeGreaterThan(0);
      expect(stats.samplesRendered).toBeGreaterThan(0);
    });
  });
  
  describe('WaveformRenderer 性能测试', () => {
    let renderer: WaveformRenderer;
    
    beforeEach(() => {
      renderer = new WaveformRenderer(mockCanvas as any);
    });
    
    it('应该在目标帧率下稳定渲染', async () => {
      const channelData = WaveformTestDataGenerator.generateChannelData(8, 10000);
      const intervals = WaveformTestDataGenerator.generateIntervals(channelData, 24000000);
      
      renderer.setChannels(channelData);
      renderer.setIntervals(intervals);
      renderer.updateVisibleSamples(0, 5000);
      
      // 模拟连续渲染
      const renderTimes: number[] = [];
      const targetFPS = 60;
      const testDuration = 1000; // 1秒
      
      const startTime = Date.now();
      let frameCount = 0;
      
      while (Date.now() - startTime < testDuration) {
        const frameStart = performance.now();
        renderer.render();
        const frameTime = performance.now() - frameStart;
        
        renderTimes.push(frameTime);
        frameCount++;
        
        // 模拟帧间隔
        await TestUtils.delay(1000 / targetFPS);
      }
      
      const actualFPS = frameCount / (testDuration / 1000);
      const averageFrameTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      
      expect({ averageFPS: actualFPS, droppedFrames: Math.max(0, targetFPS - actualFPS) })
        .toRenderWithinFPS(targetFPS * 0.8); // 允许20%的性能波动
      
      expect(averageFrameTime).toBeWithinPerformanceBudget(16.67); // 60fps = 16.67ms per frame
    });
    
    it('渲染不应导致内存泄漏', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 连续渲染多次
      for (let i = 0; i < 100; i++) {
        const channelData = WaveformTestDataGenerator.generateChannelData(4, 1000);
        const intervals = WaveformTestDataGenerator.generateIntervals(channelData, 24000000);
        
        renderer.setChannels(channelData);
        renderer.setIntervals(intervals);
        renderer.render();
        
        // 偶尔触发垃圾收集
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      expect({ memoryGrowth, leakDetected: memoryGrowth > 50 * 1024 * 1024 })
        .toHaveMemoryLeakBelow(50 * 1024 * 1024); // 50MB阈值
    });
  });
  
  describe('InteractionEngine 功能测试', () => {
    let engine: InteractionEngine;
    let mockViewport: ViewportState;
    
    beforeEach(() => {
      const config: InteractionConfig = {
        enableZoom: true,
        enablePan: true,
        enableSelection: true,
        zoomSensitivity: 0.1,
        panSensitivity: 1.0,
        minZoomLevel: 0.01,
        maxZoomLevel: 1000.0
      };
      
      engine = new InteractionEngine(mockCanvas as any, config);
      
      mockViewport = {
        startSample: 0,
        endSample: 1000,
        samplesPerPixel: 1,
        pixelsPerSample: 1,
        zoomLevel: 1,
        centerSample: 500
      };
      
      engine.setViewport(mockViewport);
    });
    
    it('应该正确初始化InteractionEngine', () => {
      expect(engine).toBeDefined();
      expect(engine.getViewport()).toMatchObject({
        startSample: expect.any(Number),
        endSample: expect.any(Number),
        zoomLevel: expect.any(Number)
      });
    });
    
    it('应该正确处理缩放操作', () => {
      let zoomEvents: InteractionEvent[] = [];
      engine.on('zoom', (event) => zoomEvents.push(event));
      
      // 模拟鼠标滚轮缩放
      mockCanvas.simulateWheelEvent(-100, 400, 300); // 向上滚动，放大
      
      expect(zoomEvents).toHaveLength(1);
      expect(zoomEvents[0].type).toBe('zoom');
      expect(zoomEvents[0].data.direction).toBe('in');
      
      const viewport = engine.getViewport();
      expect(viewport.zoomLevel).toBeGreaterThan(1);
    });
    
    it('应该正确处理平移操作', () => {
      let panEvents: InteractionEvent[] = [];
      engine.on('pan', (event) => panEvents.push(event));
      
      // 模拟鼠标拖拽平移
      mockCanvas.simulateMouseEvent('mousedown', 400, 300, 0);
      mockCanvas.simulateMouseEvent('mousemove', 350, 300, 0);
      mockCanvas.simulateMouseEvent('mouseup', 350, 300, 0);
      
      expect(panEvents.length).toBeGreaterThan(0);
      expect(panEvents[0].type).toBe('pan');
      
      const viewport = engine.getViewport();
      expect(viewport.startSample).not.toBe(mockViewport.startSample);
    });
    
    it('应该正确处理选择操作', () => {
      let selectionEvents: InteractionEvent[] = [];
      engine.on('select', (event) => selectionEvents.push(event));
      
      // 模拟区域选择
      mockCanvas.simulateMouseEvent('mousedown', 200, 100, 0);
      mockCanvas.simulateMouseEvent('mousemove', 600, 100, 0);
      mockCanvas.simulateMouseEvent('mouseup', 600, 100, 0);
      
      expect(selectionEvents.length).toBeGreaterThan(0);
      expect(selectionEvents[0].type).toBe('select');
      expect(selectionEvents[0].data).toHaveProperty('startSample');
      expect(selectionEvents[0].data).toHaveProperty('endSample');
    });
    
    it('应该正确处理双击缩放', () => {
      const initialZoom = engine.getViewport().zoomLevel;
      
      // 模拟双击
      mockCanvas.simulateMouseEvent('dblclick', 400, 300, 0);
      
      const finalZoom = engine.getViewport().zoomLevel;
      expect(finalZoom).not.toBe(initialZoom);
    });
    
    it('应该遵守缩放限制', () => {
      const config = engine.getConfig();
      
      // 测试最大缩放限制
      for (let i = 0; i < 100; i++) {
        mockCanvas.simulateWheelEvent(-100, 400, 300); // 连续放大
      }
      
      const maxZoomViewport = engine.getViewport();
      expect(maxZoomViewport.zoomLevel).toBeLessThanOrEqual(config.maxZoomLevel);
      
      // 测试最小缩放限制
      for (let i = 0; i < 200; i++) {
        mockCanvas.simulateWheelEvent(100, 400, 300); // 连续缩小
      }
      
      const minZoomViewport = engine.getViewport();
      expect(minZoomViewport.zoomLevel).toBeGreaterThanOrEqual(config.minZoomLevel);
    });
    
    it('应该正确响应键盘快捷键', () => {
      let keyboardEvents: InteractionEvent[] = [];
      engine.on('keyboard', (event) => keyboardEvents.push(event));
      
      // 模拟键盘事件
      const keyEvent = new KeyboardEvent('keydown', { key: '+', ctrlKey: true });
      mockCanvas.dispatchEvent(keyEvent);
      
      // 验证键盘事件处理
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
  
  describe('InteractionEngine 性能测试', () => {
    let engine: InteractionEngine;
    
    beforeEach(() => {
      engine = new InteractionEngine(mockCanvas as any);
    });
    
    it('交互响应应该在性能预算内', () => {
      const responsesTimes: number[] = [];
      
      // 测试100次交互响应时间
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        
        // 模拟快速连续的交互
        mockCanvas.simulateMouseEvent('mousedown', 100 + i, 100, 0);
        mockCanvas.simulateMouseEvent('mousemove', 150 + i, 100, 0);
        mockCanvas.simulateMouseEvent('mouseup', 150 + i, 100, 0);
        
        const responseTime = performance.now() - startTime;
        responsesTimes.push(responseTime);
      }
      
      const averageResponseTime = responsesTimes.reduce((sum, time) => sum + time, 0) / responsesTimes.length;
      expect(averageResponseTime).toBeWithinPerformanceBudget(5); // 5ms内响应
    });
    
    it('大量事件处理不应导致性能下降', () => {
      const startTime = Date.now();
      
      // 模拟大量快速交互
      for (let i = 0; i < 1000; i++) {
        mockCanvas.simulateWheelEvent(i % 2 === 0 ? -10 : 10, 400, 300);
        
        if (i % 100 === 0) {
          mockCanvas.simulateMouseEvent('mousedown', 200, 200, 0);
          mockCanvas.simulateMouseEvent('mousemove', 250, 200, 0);
          mockCanvas.simulateMouseEvent('mouseup', 250, 200, 0);
        }
      }
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeWithinPerformanceBudget(2000); // 2秒内处理1000个事件
    });
  });
  
  describe('集成测试场景', () => {
    let renderer: WaveformRenderer;
    let engine: InteractionEngine;
    
    beforeEach(() => {
      renderer = new WaveformRenderer(mockCanvas as any);
      engine = new InteractionEngine(mockCanvas as any);
      
      // 设置测试数据
      const channelData = WaveformTestDataGenerator.generateChannelData(8, 10000);
      const intervals = WaveformTestDataGenerator.generateIntervals(channelData, 24000000);
      
      renderer.setChannels(channelData);
      renderer.setIntervals(intervals);
      renderer.setSampleFrequency(24000000);
      renderer.updateVisibleSamples(0, 5000);
    });
    
    it('缩放和渲染联动场景', async () => {
      const scenario = new TestScenarioBuilder()
        .name('缩放和渲染联动')
        .description('测试缩放操作和波形渲染的联动')
        .execute(async () => {
          // 初始渲染
          const initialRenderTime = performance.now();
          renderer.render();
          const initialTime = performance.now() - initialRenderTime;
          
          // 执行缩放操作
          mockCanvas.simulateWheelEvent(-100, 400, 300);
          const viewport = engine.getViewport();
          
          // 根据新的视口更新渲染
          renderer.updateVisibleSamples(viewport.startSample, viewport.endSample - viewport.startSample);
          
          const zoomedRenderTime = performance.now();
          renderer.render();
          const zoomedTime = performance.now() - zoomedRenderTime;
          
          return {
            success: true,
            initialRenderTime: initialTime,
            zoomedRenderTime: zoomedTime,
            zoomLevel: viewport.zoomLevel
          };
        })
        .verify((result) => 
          result.success && 
          result.zoomLevel > 1 && 
          result.initialRenderTime < 100 && 
          result.zoomedRenderTime < 100
        )
        .build();
      
      const result = await scenario.execute();
      const isValid = scenario.verify(result);
      
      expect(isValid).toBe(true);
    });
    
    it('大数据量交互性能场景', async () => {
      const scenario = new TestScenarioBuilder()
        .name('大数据量交互性能')
        .description('测试大数据量下的交互和渲染性能')
        .setup(async () => {
          // 设置大数据量
          const largeData = WaveformTestDataGenerator.generateChannelData(24, 1000000);
          const largeIntervals = WaveformTestDataGenerator.generateIntervals(largeData, 100000000);
          
          renderer.setChannels(largeData);
          renderer.setIntervals(largeIntervals);
          renderer.updateVisibleSamples(0, 100000);
        })
        .execute(async () => {
          const operations = [];
          
          // 测试多种交互操作的性能
          const startTime = Date.now();
          
          // 渲染测试
          const renderStart = performance.now();
          renderer.render();
          const renderTime = performance.now() - renderStart;
          operations.push({ type: 'render', time: renderTime });
          
          // 缩放测试
          const zoomStart = performance.now();
          mockCanvas.simulateWheelEvent(-100, 400, 300);
          const zoomTime = performance.now() - zoomStart;
          operations.push({ type: 'zoom', time: zoomTime });
          
          // 平移测试
          const panStart = performance.now();
          mockCanvas.simulateMouseEvent('mousedown', 400, 300, 0);
          mockCanvas.simulateMouseEvent('mousemove', 350, 300, 0);
          mockCanvas.simulateMouseEvent('mouseup', 350, 300, 0);
          const panTime = performance.now() - panStart;
          operations.push({ type: 'pan', time: panTime });
          
          const totalTime = Date.now() - startTime;
          
          return {
            success: true,
            operations,
            totalTime,
            averageOperationTime: operations.reduce((sum, op) => sum + op.time, 0) / operations.length
          };
        })
        .verify((result) => 
          result.success && 
          result.averageOperationTime < 50 && // 平均操作时间小于50ms
          result.totalTime < 500 // 总时间小于500ms
        )
        .build();
      
      await scenario.setup();
      const result = await scenario.execute();
      const isValid = scenario.verify(result);
      
      expect(isValid).toBe(true);
    });
  });
  
  describe('边界条件和错误处理', () => {
    it('WaveformRenderer应该处理空数据', () => {
      const renderer = new WaveformRenderer(mockCanvas as any);
      
      expect(() => {
        renderer.render();
      }).not.toThrow();
      
      expect(() => {
        renderer.setChannels([]);
        renderer.setIntervals([]);
        renderer.render();
      }).not.toThrow();
    });
    
    it('InteractionEngine应该处理无效事件', () => {
      const engine = new InteractionEngine(mockCanvas as any);
      
      expect(() => {
        mockCanvas.simulateMouseEvent('mousedown', -100, -100, 0);
        mockCanvas.simulateMouseEvent('mousemove', 10000, 10000, 0);
        mockCanvas.simulateWheelEvent(Infinity, 400, 300);
      }).not.toThrow();
    });
    
    it('应该处理Canvas上下文获取失败', () => {
      const brokenCanvas = {
        getContext: () => null,
        addEventListener: jest.fn(),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
      };
      
      expect(() => {
        new WaveformRenderer(brokenCanvas as any);
      }).toThrow('无法获取Canvas 2D上下文');
    });
    
    it('应该处理极端缩放值', () => {
      const engine = new InteractionEngine(mockCanvas as any);
      
      // 测试极端缩放
      for (let i = 0; i < 1000; i++) {
        mockCanvas.simulateWheelEvent(-1000, 400, 300);
      }
      
      const viewport = engine.getViewport();
      expect(viewport.zoomLevel).toBeFinite();
      expect(viewport.zoomLevel).toBeGreaterThan(0);
    });
  });
});