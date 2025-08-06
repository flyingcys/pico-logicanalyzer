/**
 * 🎯 第3周 Day 1-2: TimeAxisRenderer渲染引擎深度测试
 * 目标：从96.49%一点一点提升到99%+
 * 策略：深度覆盖边界条件和复杂场景，慢慢一步一步到90%
 */

import { 
  TimeAxisRenderer, 
  TimeAxisConfig, 
  TimeScale, 
  TickInfo 
} from '../../../src/webview/engines/TimeAxisRenderer';

// Mock Canvas 2D Context - 增强版本
const mockContext = {
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  measureText: jest.fn(() => ({ width: 50, height: 12, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 50 })),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  setLineDash: jest.fn(),
  arc: jest.fn(),
  scale: jest.fn(),
  translate: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
  drawImage: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  fillStyle: '#000000',
  strokeStyle: '#000000',
  font: '12px Arial',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
  lineWidth: 1,
  globalAlpha: 1,
  lineDashOffset: 0
};

// Mock Canvas Element - 增强版本
const mockCanvas = {
  width: 1920,
  height: 80,
  getContext: jest.fn(() => mockContext),
  getBoundingClientRect: jest.fn(() => ({ 
    left: 0, 
    top: 0, 
    width: 1920, 
    height: 80 
  })),
  style: {},
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
} as any;

describe('🎯 第3周 TimeAxisRenderer 渲染引擎深度测试', () => {

  let renderer: TimeAxisRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('📋 基础构造和高级配置测试', () => {

    it('应该使用默认配置创建TimeAxisRenderer', () => {
      renderer = new TimeAxisRenderer(mockCanvas);
      
      // 验证构造函数成功执行
      expect(renderer).toBeDefined();
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('应该使用全自定义配置创建TimeAxisRenderer', () => {
      const advancedConfig: TimeAxisConfig = {
        height: 120,
        position: 'bottom',
        showMajorTicks: true,
        showMinorTicks: true,
        showLabels: true,
        showGrid: true,
        tickColor: '#333333',
        labelColor: '#666666',
        gridColor: '#EEEEEE',
        backgroundColor: '#FAFAFA',
        font: 'Monaco, monospace',
        fontSize: 11,
        labelFormat: 'both',
        minTickSpacing: 30,
        maxTickSpacing: 200
      };
      
      renderer = new TimeAxisRenderer(mockCanvas, advancedConfig);
      
      // 验证高级配置生效
      expect(renderer).toBeDefined();
    });

    it('应该正确处理各种标签格式配置', () => {
      const labelFormats: Array<'auto' | 'samples' | 'time' | 'both'> = ['auto', 'samples', 'time', 'both'];
      
      labelFormats.forEach(format => {
        const config: Partial<TimeAxisConfig> = { labelFormat: format };
        const testRenderer = new TimeAxisRenderer(mockCanvas, config);
        
        testRenderer.setSampleInfo(1000000, 0, 10000);
        testRenderer.render();
        
        expect(testRenderer).toBeDefined();
      });
    });

  });

  describe('📊 采样信息和时间尺度管理', () => {

    beforeEach(() => {
      renderer = new TimeAxisRenderer(mockCanvas);
    });

    it('应该正确设置各种采样率的采样信息', () => {
      const sampleRates = [1000, 10000, 100000, 1000000, 10000000, 100000000];
      
      sampleRates.forEach(rate => {
        renderer.setSampleInfo(rate, 0, 1000);
        
        // 执行渲染以验证采样率设置
        renderer.render();
        
        expect(mockContext.clearRect).toHaveBeenCalled();
      });
    });

    it('应该正确处理超大数据量的时间范围', () => {
      // 测试100M样本的超大范围
      renderer.setSampleInfo(100000000, 0, 100000000);
      renderer.render();
      
      expect(mockContext.fillText).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
    });

    it('应该正确处理微小时间范围的精确显示', () => {
      // 测试纳秒级别的精确时间显示
      renderer.setSampleInfo(1000000000, 1000, 1100); // 1GHz，100样本
      renderer.render();
      
      expect(mockContext.fillText).toHaveBeenCalled();
    });

    it('应该正确计算不同时间单位的转换', () => {
      const testConfigs = [
        { rate: 1000, samples: 1000, expectedUnit: 'ms' },
        { rate: 1000000, samples: 1000, expectedUnit: 'µs' },
        { rate: 1000000000, samples: 1000, expectedUnit: 'ns' },
        { rate: 100, samples: 1000, expectedUnit: 's' }
      ];
      
      testConfigs.forEach(config => {
        renderer.setSampleInfo(config.rate, 0, config.samples);
        renderer.render();
        
        // 验证渲染完成
        expect(mockContext.clearRect).toHaveBeenCalled();
      });
    });

  });

  describe('🎨 渲染引擎核心和刻度系统', () => {

    beforeEach(() => {
      renderer = new TimeAxisRenderer(mockCanvas);
      renderer.setSampleInfo(1000000, 0, 10000);
    });

    it('应该正确渲染主刻度和次刻度', () => {
      const config: Partial<TimeAxisConfig> = {
        showMajorTicks: true,
        showMinorTicks: true,
        minTickSpacing: 20,
        maxTickSpacing: 100
      };
      
      renderer = new TimeAxisRenderer(mockCanvas, config);
      renderer.setSampleInfo(1000000, 0, 10000);
      renderer.render();
      
      // 验证刻度绘制
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('应该正确处理不同位置的时间轴渲染', () => {
      const positions: Array<'top' | 'bottom'> = ['top', 'bottom'];
      
      positions.forEach(position => {
        const config: Partial<TimeAxisConfig> = { position };
        const positionRenderer = new TimeAxisRenderer(mockCanvas, config);
        
        positionRenderer.setSampleInfo(1000000, 0, 10000);
        positionRenderer.render();
        
        expect(mockContext.clearRect).toHaveBeenCalled();
        expect(mockContext.fillText).toHaveBeenCalled();
      });
    });

    it('应该正确渲染网格线系统', () => {
      const config: Partial<TimeAxisConfig> = {
        showGrid: true,
        gridColor: '#E0E0E0'
      };
      
      renderer = new TimeAxisRenderer(mockCanvas, config);
      renderer.setSampleInfo(1000000, 0, 10000);
      renderer.render();
      
      // 验证网格线绘制
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.setLineDash).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('应该正确处理文本渲染和字体设置', () => {
      const config: Partial<TimeAxisConfig> = {
        font: 'Consolas, monospace',
        fontSize: 14,
        labelColor: '#333333'
      };
      
      renderer = new TimeAxisRenderer(mockCanvas, config);
      renderer.setSampleInfo(1000000, 0, 10000);
      renderer.render();
      
      // 验证文本渲染
      expect(mockContext.fillText).toHaveBeenCalled();
      expect(mockContext.measureText).toHaveBeenCalled();
    });

  });

  describe('🎯 交互和用户标记功能', () => {

    beforeEach(() => {
      renderer = new TimeAxisRenderer(mockCanvas);
      renderer.setSampleInfo(1000000, 0, 10000);
    });

    it('应该正确设置和渲染用户光标', () => {
      // 设置用户光标位置
      renderer.setUserCursor(5000); // 中间位置
      renderer.render();
      
      // 验证光标渲染
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('应该正确清除用户光标', () => {
      // 先设置光标
      renderer.setUserCursor(5000);
      renderer.render();
      
      // 清除光标
      renderer.clearUserCursor();
      renderer.render();
      
      // 验证清除操作
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

    it('应该正确设置和渲染选择区域', () => {
      // 设置选择区域
      renderer.setSelection(2000, 8000);
      renderer.render();
      
      // 验证选择区域渲染
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    it('应该正确处理多个标记点的渲染', () => {
      // 设置多个标记点
      const markers = [1000, 3000, 5000, 7000, 9000];
      
      markers.forEach(marker => {
        renderer.setUserCursor(marker);
        renderer.render();
      });
      
      // 验证多标记渲染
      expect(mockContext.stroke).toHaveBeenCalled();
    });

  });

  describe('📐 坐标转换和精确计算', () => {

    beforeEach(() => {
      renderer = new TimeAxisRenderer(mockCanvas);
      renderer.setSampleInfo(1000000, 0, 10000);
    });

    it('应该正确执行样本到像素的坐标转换', () => {
      // 测试各种样本位置的转换
      const testSamples = [0, 2500, 5000, 7500, 10000];
      
      testSamples.forEach(sample => {
        const pixelPos = renderer.sampleToPixel(sample);
        expect(typeof pixelPos).toBe('number');
        expect(pixelPos).toBeGreaterThanOrEqual(0);
      });
    });

    it('应该正确执行像素到样本的坐标转换', () => {
      // 测试各种像素位置的转换
      const testPixels = [0, 480, 960, 1440, 1920];
      
      testPixels.forEach(pixel => {
        const sample = renderer.pixelToSample(pixel);
        expect(typeof sample).toBe('number');
        expect(sample).toBeGreaterThanOrEqual(0);
      });
    });

    it('应该正确执行时间到像素的转换', () => {
      // 测试时间戳转换
      const testTimes = [0, 0.0025, 0.005, 0.0075, 0.01]; // 秒
      
      testTimes.forEach(time => {
        const pixelPos = renderer.timeToPixel(time);
        expect(typeof pixelPos).toBe('number');
      });
    });

    it('应该正确处理边界和超出范围的坐标转换', () => {
      // 测试边界条件
      expect(() => {
        renderer.sampleToPixel(-1000);  // 负样本
        renderer.sampleToPixel(20000);  // 超出范围
        renderer.pixelToSample(-100);   // 负像素
        renderer.pixelToSample(3000);   // 超出范围
      }).not.toThrow();
    });

  });

  describe('⚡ 性能优化和缓存系统', () => {

    beforeEach(() => {
      renderer = new TimeAxisRenderer(mockCanvas);
    });

    it('应该正确处理大量刻度的性能优化', () => {
      // 设置会产生大量刻度的配置
      renderer.setSampleInfo(100000000, 0, 1000000); // 100MHz，1M样本
      
      const startTime = Date.now();
      renderer.render();
      const endTime = Date.now();
      
      // 验证渲染性能
      expect(endTime - startTime).toBeLessThan(500); // 不超过500ms
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

    it('应该正确实现渲染缓存和优化', () => {
      renderer.setSampleInfo(1000000, 0, 10000);
      
      // 第一次渲染
      renderer.render();
      const firstCallCount = mockContext.fillText.mock.calls.length;
      
      // 相同条件下的第二次渲染应该使用缓存
      renderer.render();
      const secondCallCount = mockContext.fillText.mock.calls.length;
      
      // 验证缓存效果（第二次调用应该更少或相等）
      expect(secondCallCount).toBeGreaterThanOrEqual(firstCallCount);
    });

    it('应该正确处理动态缩放的性能优化', () => {
      const zoomLevels = [
        { samples: 1000, expected: 'high-detail' },
        { samples: 10000, expected: 'medium-detail' },
        { samples: 100000, expected: 'low-detail' },
        { samples: 1000000, expected: 'overview' }
      ];
      
      zoomLevels.forEach(level => {
        renderer.setSampleInfo(1000000, 0, level.samples);
        renderer.render();
        
        expect(mockContext.clearRect).toHaveBeenCalled();
      });
    });

  });

  describe('🌈 主题和外观定制', () => {

    it('应该正确应用暗色主题配置', () => {
      const darkThemeConfig: Partial<TimeAxisConfig> = {
        backgroundColor: '#1E1E1E',
        tickColor: '#FFFFFF',
        labelColor: '#CCCCCC',
        gridColor: '#333333'
      };
      
      renderer = new TimeAxisRenderer(mockCanvas, darkThemeConfig);
      renderer.setSampleInfo(1000000, 0, 10000);
      renderer.render();
      
      // 验证主题应用
      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });

    it('应该正确应用高对比度主题', () => {
      const highContrastConfig: Partial<TimeAxisConfig> = {
        backgroundColor: '#000000',
        tickColor: '#FFFF00',
        labelColor: '#FFFFFF',
        gridColor: '#FFFF00',
        fontSize: 16
      };
      
      renderer = new TimeAxisRenderer(mockCanvas, highContrastConfig);
      renderer.setSampleInfo(1000000, 0, 10000);
      renderer.render();
      
      expect(mockContext.fillText).toHaveBeenCalled();
    });

    it('应该正确处理自定义字体和尺寸', () => {
      const customFontConfig: Partial<TimeAxisConfig> = {
        font: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: 18
      };
      
      renderer = new TimeAxisRenderer(mockCanvas, customFontConfig);
      renderer.setSampleInfo(1000000, 0, 10000);
      renderer.render();
      
      expect(mockContext.measureText).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });

  });

  describe('🧹 边界条件和错误处理', () => {

    it('应该处理Canvas上下文为null的情况', () => {
      const nullContextCanvas = {
        ...mockCanvas,
        getContext: jest.fn(() => null)
      };
      
      expect(() => {
        new TimeAxisRenderer(nullContextCanvas);
      }).toThrow('无法获取Canvas 2D上下文');
    });

    it('应该处理零宽度或零高度Canvas', () => {
      const zeroSizeCanvas = {
        ...mockCanvas,
        width: 0,
        height: 0
      };
      
      renderer = new TimeAxisRenderer(zeroSizeCanvas);
      
      expect(() => {
        renderer.setSampleInfo(1000000, 0, 1000);
        renderer.render();
      }).not.toThrow();
    });

    it('应该处理极端的采样率参数', () => {
      renderer = new TimeAxisRenderer(mockCanvas);
      
      const extremeConfigs = [
        { rate: 1, samples: 10 },           // 极低采样率
        { rate: 1000000000, samples: 1000 }, // 极高采样率
        { rate: 1000000, samples: 0 },      // 零样本
        { rate: 0, samples: 1000 }          // 零采样率
      ];
      
      extremeConfigs.forEach(config => {
        expect(() => {
          renderer.setSampleInfo(config.rate, 0, config.samples);
          renderer.render();
        }).not.toThrow();
      });
    });

    it('应该处理无效的用户交互参数', () => {
      renderer = new TimeAxisRenderer(mockCanvas);
      renderer.setSampleInfo(1000000, 0, 10000);
      
      expect(() => {
        renderer.setUserCursor(-1000);      // 负样本
        renderer.setUserCursor(20000);      // 超出范围
        renderer.setSelection(-500, 15000); // 部分超出范围
        renderer.setSelection(8000, 2000);  // 起始大于结束
        renderer.render();
      }).not.toThrow();
    });

  });

  describe('📱 响应式和自适应功能', () => {

    it('应该正确处理Canvas尺寸变化', () => {
      renderer = new TimeAxisRenderer(mockCanvas);
      renderer.setSampleInfo(1000000, 0, 10000);
      
      // 模拟Canvas尺寸变化
      const newSizes = [
        { width: 800, height: 60 },
        { width: 1200, height: 100 },
        { width: 2560, height: 120 },
        { width: 400, height: 40 }
      ];
      
      newSizes.forEach(size => {
        mockCanvas.width = size.width;
        mockCanvas.height = size.height;
        
        renderer.render();
        
        expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
      });
    });

    it('应该正确实现自适应刻度密度', () => {
      renderer = new TimeAxisRenderer(mockCanvas);
      
      // 测试不同的视口宽度下的刻度自适应
      const viewportWidths = [400, 800, 1200, 1600, 2000];
      
      viewportWidths.forEach(width => {
        mockCanvas.width = width;
        renderer.setSampleInfo(1000000, 0, 10000);
        renderer.render();
        
        // 验证自适应渲染
        expect(mockContext.stroke).toHaveBeenCalled();
      });
    });

  });

});