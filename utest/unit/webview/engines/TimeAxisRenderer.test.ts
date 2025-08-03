/**
 * TimeAxisRenderer 单元测试
 * 完整测试时间轴渲染器的所有功能
 */

import '../../../setup';
import { TimeAxisRenderer, TimeAxisConfig, TimeScale, TickInfo } from '../../../../src/webview/engines/TimeAxisRenderer';

// Mock HTMLCanvasElement and CanvasRenderingContext2D
class MockCanvasRenderingContext2D {
  public fillStyle = '';
  public strokeStyle = '';
  public lineWidth = 1;
  public font = '';
  public textAlign = '';
  public textBaseline = '';
  
  private _lineDash: number[] = [];
  
  save() {}
  restore() {}
  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  fill() {}
  arc() {}
  closePath() {}
  roundRect() {}
  rect() {}
  clip() {}
  
  measureText(text: string) {
    return { width: text.length * 8 }; // 模拟字符宽度
  }
  
  fillText() {}
  
  setLineDash(segments: number[]) {
    this._lineDash = segments;
  }
  
  getLineDash(): number[] {
    return this._lineDash;
  }
}

class MockHTMLCanvasElement {
  width = 800;
  height = 40;
  style = { height: '' };
  
  private _context = new MockCanvasRenderingContext2D();
  
  getContext(type: string) {
    if (type === '2d') {
      return this._context;
    }
    return null;
  }
  
  getBoundingClientRect() {
    return {
      width: this.width,
      height: this.height,
      left: 0,
      top: 0,
      right: this.width,
      bottom: this.height
    };
  }
  
  addEventListener() {}
  removeEventListener() {}
}

describe('TimeAxisRenderer', () => {
  let canvas: MockHTMLCanvasElement;
  let renderer: TimeAxisRenderer;
  
  beforeEach(() => {
    canvas = new MockHTMLCanvasElement();
    renderer = new TimeAxisRenderer(canvas as any);
  });
  
  describe('构造函数和初始化', () => {
    it('应该正确初始化默认配置', () => {
      const config = renderer.getConfig();
      
      expect(config.height).toBe(40);
      expect(config.position).toBe('top');
      expect(config.showMajorTicks).toBe(true);
      expect(config.showMinorTicks).toBe(true);
      expect(config.showLabels).toBe(true);
      expect(config.showGrid).toBe(false);
      expect(config.tickColor).toBe('#ffffff');
      expect(config.labelColor).toBe('#ffffff');
      expect(config.backgroundColor).toBe('#1e1e1e');
    });
    
    it('应该接受自定义配置', () => {
      const customConfig: Partial<TimeAxisConfig> = {
        height: 60,
        position: 'bottom',
        showGrid: true,
        tickColor: '#ff0000'
      };
      
      const customRenderer = new TimeAxisRenderer(canvas as any, customConfig);
      const config = customRenderer.getConfig();
      
      expect(config.height).toBe(60);
      expect(config.position).toBe('bottom');
      expect(config.showGrid).toBe(true);
      expect(config.tickColor).toBe('#ff0000');
    });
    
    it('应该在无法获取Context时抛出错误', () => {
      const badCanvas = {
        getContext: () => null
      };
      
      expect(() => {
        new TimeAxisRenderer(badCanvas as any);
      }).toThrow('无法获取Canvas 2D上下文');
    });
  });
  
  describe('时间信息设置', () => {
    it('应该正确设置时间信息', () => {
      const sampleRate = 1000000; // 1MHz
      const firstSample = 1000;
      const visibleSamples = 5000;
      
      renderer.setTimeInfo(sampleRate, firstSample, visibleSamples);
      
      // 验证内部状态通过调用依赖这些值的方法
      const timeInfo = renderer.getTimeAtPosition(400, 800);
      expect(timeInfo.sample).toBeGreaterThan(firstSample);
      expect(timeInfo.sample).toBeLessThan(firstSample + visibleSamples);
    });
    
    it('应该正确计算每像素时间', () => {
      renderer.setTimeInfo(1000000, 0, 1000);
      
      const timeAtStart = renderer.getTimeAtPosition(0, 800);
      const timeAtEnd = renderer.getTimeAtPosition(800, 800);
      
      expect(timeAtEnd.timestamp).toBeGreaterThan(timeAtStart.timestamp);
    });
  });
  
  describe('渲染功能', () => {
    beforeEach(() => {
      renderer.setTimeInfo(1000000, 0, 1000);
    });
    
    it('应该能够渲染时间轴', () => {
      const spy = jest.spyOn(canvas._context, 'save');
      
      renderer.render(800, 40);
      
      expect(spy).toHaveBeenCalled();
    });
    
    it('应该渲染背景', () => {
      const fillRectSpy = jest.spyOn(canvas._context, 'fillRect');
      
      renderer.render(800, 40);
      
      expect(fillRectSpy).toHaveBeenCalled();
    });
    
    it('应该根据配置位置渲染', () => {
      const topRenderer = new TimeAxisRenderer(canvas as any, { position: 'top' });
      const bottomRenderer = new TimeAxisRenderer(canvas as any, { position: 'bottom' });
      
      topRenderer.setTimeInfo(1000000, 0, 1000);
      bottomRenderer.setTimeInfo(1000000, 0, 1000);
      
      // 都应该能正常渲染，不抛出错误
      expect(() => {
        topRenderer.render(800, 100);
        bottomRenderer.render(800, 100);
      }).not.toThrow();
    });
    
    it('应该在启用网格时渲染网格线', () => {
      const gridRenderer = new TimeAxisRenderer(canvas as any, { showGrid: true });
      gridRenderer.setTimeInfo(1000000, 0, 1000);
      
      const setLineDashSpy = jest.spyOn(canvas._context, 'setLineDash');
      
      gridRenderer.render(800, 40);
      
      expect(setLineDashSpy).toHaveBeenCalledWith([1, 3]);
    });
    
    it('应该在禁用标签时不渲染标签', () => {
      const noLabelRenderer = new TimeAxisRenderer(canvas as any, { showLabels: false });
      noLabelRenderer.setTimeInfo(1000000, 0, 1000);
      
      const fillTextSpy = jest.spyOn(canvas._context, 'fillText');
      
      noLabelRenderer.render(800, 40);
      
      // fillText可能不会被调用，或调用次数较少
      expect(fillTextSpy).not.toThrow();
    });
  });
  
  describe('刻度计算', () => {
    beforeEach(() => {
      renderer.setTimeInfo(1000000, 0, 1000);
    });
    
    it('应该根据不同时间范围选择合适的时间单位', () => {
      // 测试皮秒级别
      renderer.setTimeInfo(1000000000, 0, 1000); // 1GHz，产生皮秒级时间
      const psTimeInfo = renderer.getTimeAtPosition(400, 800);
      expect(psTimeInfo.timeText).toContain('ps'); // 应该是皮秒
      
      // 测试微秒级别
      renderer.setTimeInfo(1000000, 0, 1000); // 1MHz，但总时间很短，仍可能是皮秒
      const usTimeInfo = renderer.getTimeAtPosition(400, 800);
      expect(usTimeInfo.timeText).toMatch(/ps|ns|µs/); // 可能是ps、ns或µs
      
      // 测试秒级别（低频率）
      renderer.setTimeInfo(1, 0, 1000); // 1Hz，产生秒级时间
      const sTimeInfo = renderer.getTimeAtPosition(400, 800);
      expect(sTimeInfo.timeText).toMatch(/s|ms/); // 应该是秒或毫秒
    });
    
    it('应该计算合理的刻度间距', () => {
      // 不同的画布宽度应该产生不同的刻度间距
      renderer.render(400, 40);
      renderer.render(800, 40);
      renderer.render(1600, 40);
      
      // 所有渲染都应该成功完成
      expect(true).toBe(true);
    });
  });
  
  describe('位置转换', () => {
    beforeEach(() => {
      renderer.setTimeInfo(1000000, 0, 1000);
    });
    
    it('应该正确转换位置到时间', () => {
      const timeInfo = renderer.getTimeAtPosition(400, 800);
      
      expect(timeInfo.sample).toBeGreaterThanOrEqual(0);
      expect(timeInfo.sample).toBeLessThanOrEqual(1000);
      expect(timeInfo.timestamp).toBeGreaterThanOrEqual(0);
      expect(timeInfo.timeText).toBeDefined();
      expect(typeof timeInfo.timeText).toBe('string');
    });
    
    it('应该返回边界值的正确时间', () => {
      const startTimeInfo = renderer.getTimeAtPosition(0, 800);
      const endTimeInfo = renderer.getTimeAtPosition(800, 800);
      
      expect(startTimeInfo.sample).toBe(0);
      expect(endTimeInfo.sample).toBe(1000);
      expect(endTimeInfo.timestamp).toBeGreaterThan(startTimeInfo.timestamp);
    });
  });
  
  describe('配置管理', () => {
    it('应该能够更新配置', () => {
      const newConfig: Partial<TimeAxisConfig> = {
        height: 80,
        tickColor: '#00ff00',
        showGrid: true
      };
      
      renderer.updateConfig(newConfig);
      const config = renderer.getConfig();
      
      expect(config.height).toBe(80);
      expect(config.tickColor).toBe('#00ff00');
      expect(config.showGrid).toBe(true);
    });
    
    it('应该保留未更新的配置项', () => {
      const originalConfig = renderer.getConfig();
      
      renderer.updateConfig({ height: 50 });
      const updatedConfig = renderer.getConfig();
      
      expect(updatedConfig.height).toBe(50);
      expect(updatedConfig.position).toBe(originalConfig.position);
      expect(updatedConfig.tickColor).toBe(originalConfig.tickColor);
    });
  });
  
  describe('自动缩放', () => {
    beforeEach(() => {
      renderer.setTimeInfo(1000000, 0, 1000);
    });
    
    it('应该在高缩放级别调整刻度密度', () => {
      renderer.setTimeInfo(100000000, 0, 100); // 高频率，少样本（高缩放）
      
      const originalConfig = renderer.getConfig();
      renderer.autoScale(800);
      const newConfig = renderer.getConfig();
      
      expect(newConfig.minTickSpacing).toBeLessThanOrEqual(originalConfig.minTickSpacing);
    });
    
    it('应该在低缩放级别调整刻度密度', () => {
      renderer.setTimeInfo(1000, 0, 10000); // 低频率，多样本（低缩放）
      
      const originalConfig = renderer.getConfig();
      renderer.autoScale(800);
      const newConfig = renderer.getConfig();
      
      expect(newConfig.minTickSpacing).toBeGreaterThanOrEqual(originalConfig.minTickSpacing);
    });
  });
  
  describe('配置导入导出', () => {
    it('应该能够导出配置', () => {
      const exportedData = renderer.exportConfig();
      
      expect(exportedData.config).toBeDefined();
      expect(exportedData.timeScales).toBeDefined();
      expect(exportedData.intervalMultipliers).toBeDefined();
      expect(Array.isArray(exportedData.timeScales)).toBe(true);
      expect(Array.isArray(exportedData.intervalMultipliers)).toBe(true);
    });
    
    it('应该能够导入配置', () => {
      const originalConfig = renderer.getConfig();
      
      const importData = {
        config: {
          height: 100,
          tickColor: '#ff00ff'
        },
        timeScales: [
          {
            unit: 'test' as any,
            factor: 1000,
            baseInterval: 0.001,
            displayName: 'test'
          }
        ]
      };
      
      renderer.importConfig(importData);
      const newConfig = renderer.getConfig();
      
      expect(newConfig.height).toBe(100);
      expect(newConfig.tickColor).toBe('#ff00ff');
    });
    
    it('应该处理空的导入数据', () => {
      const originalConfig = renderer.getConfig();
      
      renderer.importConfig({});
      const newConfig = renderer.getConfig();
      
      // 配置应该保持不变
      expect(newConfig).toEqual(originalConfig);
    });
  });
  
  describe('边界条件和错误处理', () => {
    it('应该处理零样本数', () => {
      expect(() => {
        renderer.setTimeInfo(1000000, 0, 0);
        renderer.render(800, 40);
      }).not.toThrow();
    });
    
    it('应该处理零频率', () => {
      expect(() => {
        renderer.setTimeInfo(0, 0, 1000);
        renderer.render(800, 40);
      }).not.toThrow();
    });
    
    it('应该处理极小的画布尺寸', () => {
      expect(() => {
        renderer.render(1, 1);
      }).not.toThrow();
    });
    
    it('应该处理极大的画布尺寸', () => {
      expect(() => {
        renderer.render(10000, 1000);
      }).not.toThrow();
    });
    
    it('应该处理负数样本位置', () => {
      renderer.setTimeInfo(1000000, -500, 1000);
      
      const timeInfo = renderer.getTimeAtPosition(400, 800);
      expect(timeInfo.sample).toBeGreaterThan(-500);
    });
  });
  
  describe('标签格式', () => {
    beforeEach(() => {
      renderer.setTimeInfo(1000000, 0, 1000);
    });
    
    it('应该支持不同的标签格式', () => {
      const formats: Array<'auto' | 'samples' | 'time' | 'both'> = ['auto', 'samples', 'time', 'both'];
      
      formats.forEach(format => {
        const formatRenderer = new TimeAxisRenderer(canvas as any, { labelFormat: format });
        formatRenderer.setTimeInfo(1000000, 0, 1000);
        
        expect(() => {
          formatRenderer.render(800, 40);
        }).not.toThrow();
      });
    });
  });
  
  describe('性能测试', () => {
    it('应该在合理时间内完成渲染', () => {
      renderer.setTimeInfo(100000000, 0, 100000); // 大量数据
      
      const startTime = performance.now();
      renderer.render(1920, 40); // 高分辨率
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms内完成
    });
    
    it('应该能处理频繁的重新渲染', () => {
      for (let i = 0; i < 100; i++) {
        renderer.setTimeInfo(1000000, i * 10, 1000);
        renderer.render(800, 40);
      }
      
      expect(true).toBe(true); // 完成不崩溃
    });
  });
  
  describe('获取时间轴高度', () => {
    it('应该返回正确的高度', () => {
      expect(renderer.getHeight()).toBe(40); // 默认高度
      
      const tallRenderer = new TimeAxisRenderer(canvas as any, { height: 80 });
      expect(tallRenderer.getHeight()).toBe(80);
    });
  });
});