/**
 * Engines 模块增强测试
 * 专注于提高engines模块中各个文件的代码覆盖率
 * @jest-environment jsdom
 */

// Mock Canvas API
const mockCanvas = {
  getContext: jest.fn().mockReturnValue({
    save: jest.fn(),
    restore: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 100 }),
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
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1
  }),
  width: 800,
  height: 600,
  getBoundingClientRect: jest.fn().mockReturnValue({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600
  })
};

// Mock document.createElement
global.document.createElement = jest.fn().mockImplementation((tagName) => {
  if (tagName === 'canvas') {
    return mockCanvas;
  }
  return {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    style: {},
    className: '',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
});

describe('Engines 模块增强测试 - 覆盖率提升', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('AnnotationRenderer 边界条件', () => {
    it('应该处理各种注释形状', () => {
      const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');
      const { ProtocolAnalyzerSegmentShape } = require('../../../../src/webview/engines/AnnotationTypes');
      
      const renderer = new AnnotationRenderer(mockCanvas);
      
      expect(() => {
        renderer.beginUpdate();
        
        // 测试所有形状类型
        const testGroup = {
          groupId: 'test',
          groupName: 'Test Group',
          groupColor: '#ff0000',
          annotations: [{
            annotationId: 'test1',
            annotationName: 'Test 1',
            decoderId: 'test',
            segments: [
              {
                firstSample: 0,
                lastSample: 10,
                typeId: 0,
                value: ['Circle'],
                shape: ProtocolAnalyzerSegmentShape.Circle
              },
              {
                firstSample: 20,
                lastSample: 30,
                typeId: 1,
                value: ['Rectangle'],
                shape: ProtocolAnalyzerSegmentShape.Rectangle
              },
              {
                firstSample: 40,
                lastSample: 50,
                typeId: 2,
                value: ['RoundRectangle'],
                shape: ProtocolAnalyzerSegmentShape.RoundRectangle
              },
              {
                firstSample: 60,
                lastSample: 70,
                typeId: 3,
                value: ['Hexagon'],
                shape: ProtocolAnalyzerSegmentShape.Hexagon
              }
            ]
          }]
        };
        
        renderer.addAnnotationsGroup(testGroup);
        renderer.endUpdate();
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该处理空的注释组', () => {
      const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');
      
      const renderer = new AnnotationRenderer(mockCanvas);
      
      expect(() => {
        renderer.beginUpdate();
        renderer.addAnnotationsGroup({
          groupId: 'empty',
          groupName: 'Empty',
          groupColor: '#000000',
          annotations: []
        });
        renderer.endUpdate();
      }).not.toThrow();
    });

    it('应该处理用户标记设置', () => {
      const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');
      
      const renderer = new AnnotationRenderer(mockCanvas);
      
      expect(() => {
        renderer.setUserMarker(100);
        renderer.setUserMarker(null);
        renderer.setUserMarker(-50);
        renderer.setUserMarker(Number.MAX_SAFE_INTEGER);
      }).not.toThrow();
    });
  });

  describe('AnnotationTypes 功能覆盖', () => {
    it('应该正确生成颜色', () => {
      const { AnnotationColorManager } = require('../../../../src/webview/engines/AnnotationTypes');
      
      const colorManager = AnnotationColorManager.getInstance();
      
      expect(() => {
        // 测试各种颜色索引
        for (let i = 0; i < 100; i++) {
          const color = colorManager.getColor(i);
          expect(typeof color).toBe('string');
          expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }).not.toThrow();
    });

    it('应该正确判断对比文本颜色', () => {
      const { AnnotationColorManager } = require('../../../../src/webview/engines/AnnotationTypes');
      
      const colorManager = AnnotationColorManager.getInstance();
      
      expect(() => {
        const testColors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080'];
        testColors.forEach(color => {
          const textColor = colorManager.getContrastTextColor(color);
          expect(typeof textColor).toBe('string');
          expect(['#ffffff', '#000000']).toContain(textColor);
        });
      }).not.toThrow();
    });
  });

  describe('PerformanceOptimizer 各种场景', () => {
    it('应该处理不同的性能配置', () => {
      const { PerformanceOptimizer } = require('../../../../src/webview/engines/PerformanceOptimizer');
      
      expect(() => {
        const optimizer = new PerformanceOptimizer();
        
        // 测试不同的数据量
        optimizer.analyzePerformance({ sampleCount: 1000, channelCount: 4 });
        optimizer.analyzePerformance({ sampleCount: 100000, channelCount: 16 });
        optimizer.analyzePerformance({ sampleCount: 1000000, channelCount: 32 });
        
        // 测试性能建议
        const suggestions = optimizer.getOptimizationSuggestions();
        expect(Array.isArray(suggestions)).toBe(true);
        
        // 测试应用优化
        optimizer.applyOptimizations(['reduce-samples', 'enable-virtualization']);
        
        optimizer.dispose();
      }).not.toThrow();
    });

    it('应该处理性能监控', () => {
      const { PerformanceOptimizer } = require('../../../../src/webview/engines/PerformanceOptimizer');
      
      const optimizer = new PerformanceOptimizer();
      
      expect(() => {
        // 模拟性能监控
        for (let i = 0; i < 10; i++) {
          optimizer.recordFrameTime(16.67 + Math.random() * 10);
        }
        
        const metrics = optimizer.getPerformanceMetrics();
        expect(typeof metrics).toBe('object');
      }).not.toThrow();
    });
  });

  describe('MarkerTools 边界条件', () => {
    it('应该处理各种标记操作', () => {
      const { MarkerTools } = require('../../../../src/webview/engines/MarkerTools');
      
      expect(() => {
        const markerTools = new MarkerTools(mockCanvas);
        
        // 测试添加标记
        markerTools.addMarker({ sample: 100, label: 'Test Marker', color: '#ff0000' });
        markerTools.addMarker({ sample: -50, label: 'Negative', color: '#00ff00' });
        markerTools.addMarker({ sample: Number.MAX_SAFE_INTEGER, label: 'Max', color: '#0000ff' });
        
        // 测试标记选择
        markerTools.selectMarker(100);
        markerTools.selectMarker(-1);
        
        // 测试标记移除
        markerTools.removeMarker(100);
        markerTools.removeAllMarkers();
        
        markerTools.dispose();
      }).not.toThrow();
    });

    it('应该处理标记测量', () => {
      const { MarkerTools } = require('../../../../src/webview/engines/MarkerTools');
      
      const markerTools = new MarkerTools(mockCanvas);
      
      expect(() => {
        markerTools.addMarker({ sample: 100, label: 'A', color: '#ff0000' });
        markerTools.addMarker({ sample: 200, label: 'B', color: '#00ff00' });
        
        const measurements = markerTools.getMeasurements();
        expect(typeof measurements).toBe('object');
      }).not.toThrow();
    });
  });

  describe('MeasurementTools 功能覆盖', () => {
    it('应该处理各种测量类型', () => {
      const { MeasurementTools } = require('../../../../src/webview/engines/MeasurementTools');
      
      expect(() => {
        const measurementTools = new MeasurementTools(mockCanvas);
        
        // 测试时间测量
        measurementTools.measureTime(100, 200, 100000000); // 100MHz
        measurementTools.measureTime(0, 1000000, 50000000); // 50MHz
        
        // 测试频率测量
        measurementTools.measureFrequency([100, 200, 300, 400], 100000000);
        measurementTools.measureFrequency([], 100000000); // 空数组
        
        // 测试占空比
        measurementTools.measureDutyCycle([100, 150, 200, 250], 100000000);
        
        measurementTools.dispose();
      }).not.toThrow();
    });

    it('应该处理测量结果导出', () => {
      const { MeasurementTools } = require('../../../../src/webview/engines/MeasurementTools');
      
      const measurementTools = new MeasurementTools(mockCanvas);
      
      expect(() => {
        measurementTools.measureTime(100, 200, 100000000);
        
        const results = measurementTools.exportMeasurements();
        expect(typeof results).toBe('string');
      }).not.toThrow();
    });
  });

  describe('VirtualizationRenderer 性能测试', () => {
    it('应该处理大数据量虚拟化', () => {
      const { VirtualizationRenderer } = require('../../../../src/webview/engines/VirtualizationRenderer');
      
      expect(() => {
        const renderer = new VirtualizationRenderer(mockCanvas);
        
        // 模拟大数据量
        const largeData = Array.from({ length: 1000000 }, (_, i) => ({
          sample: i,
          channel: i % 16,
          value: Math.random() > 0.5 ? 1 : 0
        }));
        
        renderer.setData(largeData);
        renderer.updateVisibleRange(0, 10000);
        renderer.render();
        
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该处理虚拟化配置', () => {
      const { VirtualizationRenderer } = require('../../../../src/webview/engines/VirtualizationRenderer');
      
      const renderer = new VirtualizationRenderer(mockCanvas);
      
      expect(() => {
        renderer.setVirtualizationThreshold(50000);
        renderer.setRenderBatchSize(1000);
        renderer.enableVirtualization(true);
        renderer.enableVirtualization(false);
      }).not.toThrow();
    });
  });

  describe('错误处理和资源管理', () => {
    it('应该处理Canvas上下文错误', () => {
      const badCanvas = {
        ...mockCanvas,
        getContext: jest.fn().mockReturnValue(null)
      };
      
      expect(() => {
        const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');
        new AnnotationRenderer(badCanvas);
      }).not.toThrow();
    });

    it('应该正确清理资源', () => {
      const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');
      const { MarkerTools } = require('../../../../src/webview/engines/MarkerTools');
      const { MeasurementTools } = require('../../../../src/webview/engines/MeasurementTools');
      
      expect(() => {
        const renderer = new AnnotationRenderer(mockCanvas);
        const markerTools = new MarkerTools(mockCanvas);
        const measurementTools = new MeasurementTools(mockCanvas);
        
        // 多次dispose调用应该安全
        renderer.dispose();
        renderer.dispose();
        
        markerTools.dispose();
        markerTools.dispose();
        
        measurementTools.dispose();
        measurementTools.dispose();
      }).not.toThrow();
    });
  });

  describe('性能基准测试', () => {
    it('应该在合理时间内完成复杂操作', () => {
      const { AnnotationRenderer } = require('../../../../src/webview/engines/AnnotationRenderer');
      
      const startTime = performance.now();
      
      const renderer = new AnnotationRenderer(mockCanvas);
      
      // 添加大量注释
      for (let i = 0; i < 100; i++) {
        renderer.addAnnotationsGroup({
          groupId: `group_${i}`,
          groupName: `Group ${i}`,
          groupColor: `#${i.toString(16).padStart(6, '0')}`,
          annotations: [{
            annotationId: `annotation_${i}`,
            annotationName: `Annotation ${i}`,
            decoderId: 'test',
            segments: [{
              firstSample: i * 100,
              lastSample: i * 100 + 50,
              typeId: i % 4,
              value: [`Value ${i}`],
              shape: i % 4
            }]
          }]
        });
      }
      
      renderer.dispose();
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(2000); // 应该在2秒内完成
    });
  });
});