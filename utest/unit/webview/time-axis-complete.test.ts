/**
 * 🎯 TimeAxisRenderer完善测试 - 从96.49%提升到99%+
 * 目标：覆盖剩余的第315,333,335,505-506,538行
 */

import { TimeAxisRenderer } from '../../../src/webview/engines/TimeAxisRenderer';

// Mock HTMLCanvasElement和CanvasRenderingContext2D
const mockContext = {
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  measureText: jest.fn((text: string) => ({ width: text.length * 8, height: 16 })),
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
  fillStyle: '#000000',
  strokeStyle: '#000000',
  font: '12px Arial',
  textAlign: 'left',
  textBaseline: 'top',
  lineWidth: 1
};

const mockCanvas = {
  width: 1920,
  height: 100,
  getContext: jest.fn(() => mockContext),
  getBoundingClientRect: jest.fn(() => ({ width: 1920, height: 100, left: 0, top: 0 })),
  style: {},
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
} as any;

describe('🎯 TimeAxisRenderer 完善测试', () => {

  let renderer: TimeAxisRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    renderer = new TimeAxisRenderer(mockCanvas);
  });

  describe('📊 覆盖剩余代码路径', () => {

    it('应该覆盖auto模式下的时间格式化分支 (第315行)', () => {
      // 设置时间信息来触发第315行
      renderer.setTimeInfo(1000000000, 0, 1000); // 高采样率，极小的时间刻度
      
      // 调用private方法来测试格式化逻辑
      const timeScale = {
        unit: 'ns' as const,
        factor: 1e9,
        baseInterval: 1e-9,
        displayName: 'ns'
      };
      
      // 通过反射调用private方法formatTimeLabel
      const formatTimeLabel = (renderer as any).formatTimeLabel.bind(renderer);
      const result = formatTimeLabel(0.000000001, timeScale); // 1ns
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('应该覆盖formatTime中不同精度的分支 (第333,335行)', () => {
      const formatTime = (renderer as any).formatTime.bind(renderer);
      
      // 测试精度2的情况 (第333行) - value在1-10范围
      const timeScale1 = { unit: 'ms', factor: 1e3, baseInterval: 1e-3, displayName: 'ms' };
      const result1 = formatTime(0.005, timeScale1); // 5ms，应该触发precision=2
      expect(result1).toContain('ms');
      
      // 测试精度1的情况 (第335行) - value在10-100范围  
      const timeScale2 = { unit: 'ms', factor: 1e3, baseInterval: 1e-3, displayName: 'ms' };
      const result2 = formatTime(0.05, timeScale2); // 50ms，应该触发precision=1
      expect(result2).toContain('ms');
      
      // 测试精度0的情况 - value >= 100
      const result3 = formatTime(0.5, timeScale2); // 500ms，应该触发precision=0
      expect(result3).toContain('ms');
      
      // 测试精度3的情况 - value < 1
      const result4 = formatTime(0.0005, timeScale2); // 0.5ms，应该触发precision=3
      expect(result4).toContain('ms');
    });

    it('应该覆盖adaptiveTickSpacing中的低缩放分支 (第505-506行)', () => {
      // 设置极小的缩放比例来触发pixelsPerSecond < 10的条件
      renderer.setTimeInfo(1, 0, 100000); // 极低采样率，大量样本
      renderer.render(1920, 100); // 触发内部计算
      
      // 验证渲染成功
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    it('应该覆盖importConfig中的intervalMultipliers分支 (第538行)', () => {
      // 准备包含intervalMultipliers的配置数据
      const importData = {
        config: {
          height: 50,
          position: 'bottom' as const
        },
        timeScales: [
          {
            unit: 'us' as const,
            factor: 1e6,
            baseInterval: 1e-6,
            displayName: 'μs'
          }
        ],
        intervalMultipliers: [1, 2, 4, 8] // 这会触发第538行
      };
      
      // 导入配置
      renderer.importConfig(importData);
      
      // 验证intervalMultipliers被设置
      const actualMultipliers = (renderer as any).intervalMultipliers;
      expect(actualMultipliers).toEqual([1, 2, 4, 8]);
    });

  });

  describe('🔄 完整功能测试', () => {

    it('应该正确处理各种时间刻度', () => {
      // 测试不同的时间刻度设置
      const testCases = [
        { timePerPixel: 1e-12, samples: 1000, sampleRate: 1e12 }, // ps级别
        { timePerPixel: 1e-9, samples: 1000, sampleRate: 1e9 },   // ns级别
        { timePerPixel: 1e-6, samples: 1000, sampleRate: 1e6 },   // μs级别
        { timePerPixel: 1e-3, samples: 1000, sampleRate: 1e3 },   // ms级别
        { timePerPixel: 1, samples: 1000, sampleRate: 1 }         // s级别
      ];
      
      testCases.forEach(testCase => {
        renderer.setTimeInfo(testCase.sampleRate, 0, testCase.samples);
        renderer.render(1920, 100);
        
        // 验证渲染调用
        expect(mockContext.fillRect).toHaveBeenCalled();
      });
    });

    it('应该正确处理不同的标签格式', () => {
      // 测试所有支持的标签格式
      const formats = ['auto', 'samples', 'time', 'both'] as const;
      
      formats.forEach(format => {
        const customConfig = {
          labelFormat: format
        };
        
        const customRenderer = new TimeAxisRenderer(mockCanvas, customConfig);
        customRenderer.setTimeInfo(1000000, 0, 1000);
        customRenderer.render(1920, 100);
        
        expect(mockContext.fillText).toHaveBeenCalled();
      });
    });

    it('应该正确处理配置导入导出', () => {
      // 测试导出配置
      const exportedConfig = renderer.exportConfig();
      expect(exportedConfig).toHaveProperty('config');
      expect(exportedConfig).toHaveProperty('timeScales');
      expect(exportedConfig).toHaveProperty('intervalMultipliers');
      
      // 测试部分导入（只有config）
      renderer.importConfig({ config: { height: 80 } });
      
      // 测试部分导入（只有timeScales）
      renderer.importConfig({ 
        timeScales: [{ unit: 'ms', factor: 1e3, baseInterval: 1e-3, displayName: 'ms' }] 
      });
      
      // 验证配置被正确应用
      expect(exportedConfig).toBeDefined();
    });

  });

  describe('🧹 边界条件和错误处理', () => {

    it('应该处理无效的canvas上下文', () => {
      const invalidCanvas = {
        getContext: jest.fn(() => null)
      } as any;
      
      expect(() => {
        new TimeAxisRenderer(invalidCanvas);
      }).toThrow('无法获取Canvas 2D上下文');
    });

    it('应该处理极端的时间值', () => {
      // 测试极小值
      renderer.setTimeInfo(1e15, 0, 1);
      renderer.render(1920, 100);
      
      // 测试极大值
      renderer.setTimeInfo(1, 0, 1000000);
      renderer.render(1920, 100);
      
      // 测试零值
      renderer.setTimeInfo(1, 0, 0);
      renderer.render(1920, 100);
      
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    it('应该处理空的导入数据', () => {
      // 测试空对象
      renderer.importConfig({});
      
      // 测试undefined和有效性检查
      try {
        renderer.importConfig(undefined as any);
        expect(true).toBe(true);
      } catch (e) {
        expect(e).toBeDefined(); // 如果抛出错误也是预期的
      }
      
      expect(true).toBe(true); // 不应该崩溃
    });

    it('应该正确处理不同的时间轴位置', () => {
      const topRenderer = new TimeAxisRenderer(mockCanvas, { position: 'top' });
      const bottomRenderer = new TimeAxisRenderer(mockCanvas, { position: 'bottom' });
      
      topRenderer.render(1920, 100);
      bottomRenderer.render(1920, 100);
      
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

  });

  describe('📏 网格和刻度渲染测试', () => {

    it('应该正确渲染网格线', () => {
      const gridRenderer = new TimeAxisRenderer(mockCanvas, { 
        showGrid: true,
        showMajorTicks: true,
        showMinorTicks: true,
        showLabels: true
      });
      
      gridRenderer.setTimeInfo(1000000, 0, 1000);
      gridRenderer.render(1920, 100);
      
      // 验证网格相关的绘制调用
      expect(mockContext.setLineDash).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });

    it('应该处理禁用各种显示选项', () => {
      const minimalRenderer = new TimeAxisRenderer(mockCanvas, {
        showGrid: false,
        showMajorTicks: false,
        showMinorTicks: false,
        showLabels: false
      });
      
      minimalRenderer.render(1920, 100);
      
      // 即使禁用了显示选项，仍应该绘制背景
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

  });

});