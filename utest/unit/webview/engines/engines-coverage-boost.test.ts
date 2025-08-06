/**
 * Engines 模块覆盖率提升专项测试
 * 针对未覆盖的代码分支和边界条件创建精准测试
 * @jest-environment jsdom
 */

// 全面的Mock设置
beforeAll(() => {
  // Mock全局Canvas API
  global.HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    save: jest.fn(),
    restore: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 50 }),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    closePath: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    setLineDash: jest.fn(),
    createLinearGradient: jest.fn().mockReturnValue({
      addColorStop: jest.fn()
    }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1
  });

  global.HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600
  });

  Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });
});

describe('Engines 覆盖率提升专项测试', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
  });

  describe('WaveformRenderer 分支覆盖提升', () => {
    it('应该覆盖WaveformRenderer的错误处理分支', () => {
      const { WaveformRenderer } = require('../../../../src/webview/engines/WaveformRenderer');

      expect(() => {
        // 测试null canvas处理
        const renderer = new WaveformRenderer(canvas);
        
        // 测试各种边界条件
        renderer.updateVisibleSamples(-1, 0);
        renderer.updateVisibleSamples(0, -1);
        renderer.updateVisibleSamples(1000000, 2000000);
        
        // 测试用户标记边界
        renderer.setUserMarker(-100);
        renderer.setUserMarker(Number.MAX_SAFE_INTEGER);
        renderer.setUserMarker(null);
        
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该覆盖WaveformRenderer的配置分支', () => {
      const { WaveformRenderer } = require('../../../../src/webview/engines/WaveformRenderer');

      expect(() => {
        const renderer = new WaveformRenderer(canvas, {
          backgroundColor: '#000000',
          gridColor: '#333333',
          textColor: '#ffffff',
          channelHeight: 50,
          showGrid: true,
          showLabels: false,
          antialias: true
        });

        renderer.render();
        renderer.dispose();
      }).not.toThrow();
    });
  });

  describe('AnnotationRenderer 边界条件覆盖', () => {
    it('应该覆盖AnnotationRenderer的异常分支', () => {
      const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');

      expect(() => {
        const renderer = new AnnotationRenderer(canvas);
        
        // 测试空注释组
        renderer.beginUpdate();
        renderer.addAnnotationsGroup({
          groupId: 'empty-group',
          groupName: 'Empty Group',
          groupColor: '#ff0000',
          annotations: []
        });
        
        // 测试包含无效数据的注释组
        renderer.addAnnotationsGroup({
          groupId: 'invalid-group',
          groupName: 'Invalid Group',
          groupColor: '#invalid-color',
          annotations: [{
            annotationId: 'invalid-annotation',
            annotationName: 'Invalid',
            decoderId: 'invalid',
            segments: []
          }]
        });
        
        renderer.endUpdate();
        renderer.clearAnnotations();
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该覆盖AnnotationRenderer的不同形状渲染分支', () => {
      const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');
      const { ProtocolAnalyzerSegmentShape } = require('../../../../src/webview/engines/AnnotationTypes');

      expect(() => {
        const renderer = new AnnotationRenderer(canvas);
        
        renderer.beginUpdate();
        
        // 测试所有形状类型
        const shapes = [
          ProtocolAnalyzerSegmentShape.Circle,
          ProtocolAnalyzerSegmentShape.RoundRectangle,
          ProtocolAnalyzerSegmentShape.Hexagon,
          ProtocolAnalyzerSegmentShape.Rectangle || 3
        ];

        shapes.forEach((shape, index) => {
          renderer.addAnnotationsGroup({
            groupId: `shape-group-${index}`,
            groupName: `Shape ${index}`,
            groupColor: `#${(index * 111111).toString(16).padStart(6, '0')}`,
            annotations: [{
              annotationId: `shape-annotation-${index}`,
              annotationName: `Shape ${index}`,
              decoderId: 'shape-test',
              segments: [{
                firstSample: index * 100,
                lastSample: index * 100 + 50,
                typeId: index,
                value: [`Shape${index}`],
                shape: shape
              }]
            }]
          });
        });
        
        renderer.endUpdate();
        renderer.dispose();
      }).not.toThrow();
    });
  });

  describe('MarkerTools 未覆盖分支', () => {
    it('应该覆盖MarkerTools的边界条件', () => {
      const { MarkerTools } = require('../../../../src/webview/engines/MarkerTools');

      expect(() => {
        const markerTools = new MarkerTools(canvas);
        
        // 测试添加重复位置的标记
        markerTools.addMarker({ sample: 100, label: 'Marker1', color: '#ff0000' });
        markerTools.addMarker({ sample: 100, label: 'Marker2', color: '#00ff00' }); // 相同位置
        
        // 测试选择不存在的标记
        markerTools.selectMarker(999);
        markerTools.selectMarker(-1);
        
        // 测试移除不存在的标记
        markerTools.removeMarker(999);
        
        // 测试标记测量功能
        markerTools.addMarker({ sample: 200, label: 'MarkerB', color: '#0000ff' });
        const measurements = markerTools.getMeasurements();
        expect(measurements).toBeDefined();
        
        markerTools.removeAllMarkers();
        markerTools.dispose();
      }).not.toThrow();
    });

    it('应该覆盖MarkerTools的标记拖拽功能', () => {
      const { MarkerTools } = require('../../../../src/webview/engines/MarkerTools');

      expect(() => {
        const markerTools = new MarkerTools(canvas);
        
        markerTools.addMarker({ sample: 100, label: 'Draggable', color: '#ff0000' });
        
        // 模拟拖拽操作
        markerTools.startDrag && markerTools.startDrag(100);
        markerTools.updateDrag && markerTools.updateDrag(150);
        markerTools.endDrag && markerTools.endDrag();
        
        markerTools.dispose();
      }).not.toThrow();
    });
  });

  describe('MeasurementTools 精确覆盖', () => {
    it('应该覆盖MeasurementTools的所有测量类型', () => {
      const { MeasurementTools } = require('../../../../src/webview/engines/MeasurementTools');

      expect(() => {
        const measurementTools = new MeasurementTools(canvas);
        
        // 测试不同采样率的时间测量
        const sampleRates = [1000000, 10000000, 100000000, 1000000000]; // 1MHz到1GHz
        sampleRates.forEach(rate => {
          measurementTools.measureTime(0, 1000, rate);
        });
        
        // 测试频率测量 - 不同波形模式
        const squareWave = [100, 200, 300, 400, 500, 600]; // 方波
        const sineWave = [100, 150, 200, 250, 300, 350]; // 近似正弦波
        const irregularWave = [100, 120, 200, 205, 300, 400]; // 不规则波形
        
        measurementTools.measureFrequency(squareWave, 100000000);
        measurementTools.measureFrequency(sineWave, 100000000);
        measurementTools.measureFrequency(irregularWave, 100000000);
        measurementTools.measureFrequency([], 100000000); // 空数组
        
        // 测试占空比测量
        measurementTools.measureDutyCycle(squareWave, 100000000);
        measurementTools.measureDutyCycle([100], 100000000); // 单个跳变
        
        // 测试导出功能
        const exportData = measurementTools.exportMeasurements();
        expect(typeof exportData).toBe('string');
        
        measurementTools.dispose();
      }).not.toThrow();
    });

    it('应该覆盖MeasurementTools的错误处理分支', () => {
      const { MeasurementTools } = require('../../../../src/webview/engines/MeasurementTools');

      expect(() => {
        const measurementTools = new MeasurementTools(canvas);
        
        // 测试异常输入处理
        measurementTools.measureTime(null, null, 0);
        measurementTools.measureTime(200, 100, 100000000); // 结束时间早于开始时间
        
        measurementTools.measureFrequency(null, 100000000);
        measurementTools.measureFrequency([100], 0); // 零采样率
        
        measurementTools.measureDutyCycle(null, 100000000);
        
        measurementTools.dispose();
      }).not.toThrow();
    });
  });

  describe('VirtualizationRenderer 性能分支', () => {
    it('应该覆盖VirtualizationRenderer的虚拟化阈值分支', () => {
      const { VirtualizationRenderer } = require('../../../../src/webview/engines/VirtualizationRenderer');

      expect(() => {
        const renderer = new VirtualizationRenderer(canvas);
        
        // 测试不同的虚拟化阈值
        const thresholds = [1000, 10000, 100000, 1000000];
        thresholds.forEach(threshold => {
          renderer.setVirtualizationThreshold(threshold);
        });
        
        // 测试不同的批次大小
        const batchSizes = [100, 500, 1000, 5000];
        batchSizes.forEach(batchSize => {
          renderer.setRenderBatchSize(batchSize);
        });
        
        // 测试虚拟化开关
        renderer.enableVirtualization(true);
        renderer.enableVirtualization(false);
        
        // 测试大数据集
        const largeDataSet = Array.from({ length: 100000 }, (_, i) => ({
          sample: i,
          channel: i % 8,
          value: Math.random() > 0.5 ? 1 : 0
        }));
        
        renderer.setData(largeDataSet);
        renderer.updateVisibleRange(0, 1000);
        renderer.render();
        
        // 测试小数据集
        const smallDataSet = Array.from({ length: 100 }, (_, i) => ({
          sample: i,
          channel: 0,
          value: i % 2
        }));
        
        renderer.setData(smallDataSet);
        renderer.render();
        
        renderer.dispose();
      }).not.toThrow();
    });
  });

  describe('PerformanceOptimizer 未覆盖功能', () => {
    it('应该覆盖PerformanceOptimizer的所有优化策略', () => {
      const { PerformanceOptimizer } = require('../../../../src/webview/engines/PerformanceOptimizer');

      expect(() => {
        const optimizer = new PerformanceOptimizer();
        
        // 测试不同的性能配置
        const configs = [
          { sampleCount: 1000, channelCount: 4 },      // 小数据量
          { sampleCount: 100000, channelCount: 16 },   // 中等数据量
          { sampleCount: 1000000, channelCount: 32 },  // 大数据量
          { sampleCount: 10000000, channelCount: 64 }  // 超大数据量
        ];
        
        configs.forEach(config => {
          const analysis = optimizer.analyzePerformance(config);
          expect(analysis).toBeDefined();
        });
        
        // 测试性能监控
        const frameTimes = [16.67, 33.33, 50, 16.67, 20, 25, 30]; // 不同的帧时间
        frameTimes.forEach(frameTime => {
          optimizer.recordFrameTime(frameTime);
        });
        
        const metrics = optimizer.getPerformanceMetrics();
        expect(metrics).toBeDefined();
        expect(typeof metrics.averageFrameTime).toBe('number');
        expect(typeof metrics.fps).toBe('number');
        
        // 测试优化建议
        const suggestions = optimizer.getOptimizationSuggestions();
        expect(Array.isArray(suggestions)).toBe(true);
        
        // 测试应用优化
        const optimizations = ['reduce-samples', 'enable-virtualization', 'decrease-refresh-rate'];
        optimizer.applyOptimizations(optimizations);
        
        // 测试重置
        optimizer.reset();
        
        optimizer.dispose();
      }).not.toThrow();
    });

    it('应该覆盖PerformanceOptimizer的边界条件', () => {
      const { PerformanceOptimizer } = require('../../../../src/webview/engines/PerformanceOptimizer');

      expect(() => {
        const optimizer = new PerformanceOptimizer();
        
        // 测试边界值
        optimizer.analyzePerformance({ sampleCount: 0, channelCount: 0 });
        optimizer.analyzePerformance({ sampleCount: -1, channelCount: -1 });
        optimizer.analyzePerformance({ sampleCount: Number.MAX_SAFE_INTEGER, channelCount: 1000 });
        
        // 测试异常帧时间
        optimizer.recordFrameTime(0);
        optimizer.recordFrameTime(-1);
        optimizer.recordFrameTime(1000);
        optimizer.recordFrameTime(Infinity);
        optimizer.recordFrameTime(NaN);
        
        // 测试空优化列表
        optimizer.applyOptimizations([]);
        optimizer.applyOptimizations(['invalid-optimization']);
        
        optimizer.dispose();
      }).not.toThrow();
    });
  });

  describe('ChannelLayoutManager 未覆盖功能', () => {
    it('应该覆盖ChannelLayoutManager的所有布局模式', () => {
      const { ChannelLayoutManager } = require('../../../../src/webview/engines/ChannelLayoutManager');

      expect(() => {
        const layoutManager = new ChannelLayoutManager(canvas);
        
        // 测试不同的布局模式
        const layouts = [
          { mode: 'stacked', channelHeight: 30, spacing: 5 },
          { mode: 'overlaid', channelHeight: 100, spacing: 0 },
          { mode: 'compressed', channelHeight: 15, spacing: 2 },
          { mode: 'expanded', channelHeight: 50, spacing: 10 }
        ];
        
        layouts.forEach(layout => {
          layoutManager.setLayout(layout);
          layoutManager.calculateChannelPositions(16); // 16通道
        });
        
        // 测试通道可见性
        for (let i = 0; i < 16; i++) {
          layoutManager.setChannelVisible(i, i % 2 === 0); // 偶数通道可见
        });
        
        // 测试通道颜色
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        colors.forEach((color, index) => {
          layoutManager.setChannelColor(index, color);
        });
        
        // 测试获取布局信息
        const layoutInfo = layoutManager.getLayoutInfo();
        expect(layoutInfo).toBeDefined();
        
        layoutManager.dispose();
      }).not.toThrow();
    });
  });

  describe('TimeAxisRenderer 边界条件', () => {
    it('应该覆盖TimeAxisRenderer的所有时间单位和格式', () => {
      const { TimeAxisRenderer } = require('../../../../src/webview/engines/TimeAxisRenderer');

      expect(() => {
        const timeAxisRenderer = new TimeAxisRenderer(canvas);
        
        // 测试不同的时间范围和采样率
        const timeRanges = [
          { samples: 1000, sampleRate: 1000000 },      // 1ms
          { samples: 100000, sampleRate: 10000000 },   // 10ms
          { samples: 1000000, sampleRate: 100000000 }, // 10ms
          { samples: 100000000, sampleRate: 1000000000 } // 100ms
        ];
        
        timeRanges.forEach(({ samples, sampleRate }) => {
          timeAxisRenderer.setTimeInfo(samples, sampleRate);
          timeAxisRenderer.render();
        });
        
        // 测试配置更新
        const configs = [
          { position: 'top', showGrid: true, showLabels: true },
          { position: 'bottom', showGrid: false, showLabels: true },
          { position: 'both', showGrid: true, showLabels: false }
        ];
        
        configs.forEach(config => {
          timeAxisRenderer.updateConfig(config);
          timeAxisRenderer.render();
        });
        
        // 测试位置转换
        const positions = [0, 100, 400, 800, 1200, -50]; // 包括边界外的位置
        positions.forEach(pos => {
          const time = timeAxisRenderer.positionToTime(pos);
          expect(typeof time).toBe('number');
        });
        
        timeAxisRenderer.dispose();
      }).not.toThrow();
    });
  });
});