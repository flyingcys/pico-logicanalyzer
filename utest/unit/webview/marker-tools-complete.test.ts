/**
 * 🎯 MarkerTools完善测试 - 渐进式覆盖率提升
 * 目标：从3.17%逐步提升到60%+
 * 策略：一点一点提升，慢慢一步一步到90%
 */

import { MarkerTools, Marker, MarkerPair, MeasurementResult } from '../../../src/webview/engines/MarkerTools';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';

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
  scale: jest.fn(),
  translate: jest.fn(),
  fillStyle: '#000000',
  strokeStyle: '#000000',
  font: '12px Arial',
  textAlign: 'left',
  textBaseline: 'top',
  lineWidth: 1
};

const mockCanvas = {
  width: 1920,
  height: 800,
  getContext: jest.fn(() => mockContext),
  getBoundingClientRect: jest.fn(() => ({ 
    left: 0, 
    top: 0, 
    width: 1920, 
    height: 800 
  })),
  style: {},
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
} as any;

describe('🎯 MarkerTools 渐进式覆盖率提升', () => {

  let markerTools: MarkerTools;
  let mockChannels: AnalyzerChannel[];

  beforeEach(() => {
    jest.clearAllMocks();
    markerTools = new MarkerTools(mockCanvas);
    
    // 创建模拟通道数据
    mockChannels = [
      {
        id: 0,
        name: 'CH0',
        hidden: false,
        minimized: false,
        samples: new Uint8Array([1, 0, 1, 0, 1, 1, 0, 0]),
        color: '#FF0000'
      },
      {
        id: 1,
        name: 'CH1',
        hidden: false,
        minimized: false,
        samples: new Uint8Array([0, 1, 0, 1, 1, 0, 1, 0]),
        color: '#00FF00'
      }
    ];
  });

  describe('📋 基础构造和配置测试', () => {

    it('应该使用默认配置创建MarkerTools', () => {
      const defaultTools = new MarkerTools(mockCanvas);
      
      // 验证构造函数成功执行
      expect(defaultTools).toBeDefined();
      
      // 验证Canvas上下文获取
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('应该使用自定义配置创建MarkerTools', () => {
      const customConfig = {
        showLabels: false,
        showValues: false,
        labelFont: 'Monaco',
        labelSize: 14,
        markerWidth: 3,
        snapToEdge: false,
        snapTolerance: 10,
        enableDragging: false,
        showCrosshair: false
      };
      
      const customTools = new MarkerTools(mockCanvas, customConfig);
      
      // 验证自定义配置生效
      expect(customTools).toBeDefined();
      
      // 通过配置方法验证配置被应用
      const config = (customTools as any).config;
      expect(config.showLabels).toBe(false);
      expect(config.labelFont).toBe('Monaco');
      expect(config.markerWidth).toBe(3);
    });

    it('应该正确初始化内部状态', () => {
      // 验证内部状态初始化
      const markers = (markerTools as any).markers;
      const markerPairs = (markerTools as any).markerPairs;
      const nextMarkerId = (markerTools as any).nextMarkerId;
      
      expect(markers).toBeInstanceOf(Map);
      expect(markers.size).toBe(0);
      expect(markerPairs).toBeInstanceOf(Map);
      expect(markerPairs.size).toBe(0);
      expect(nextMarkerId).toBe(1);
    });

  });

  describe('🎧 事件监听器设置测试', () => {

    it('应该正确初始化事件监听器', () => {
      // 初始化事件监听器
      markerTools.initializeEventListeners();
      
      // 验证所有必要的事件监听器都被添加
      const expectedEvents = [
        'mousedown',
        'mousemove', 
        'mouseup',
        'click',
        'dblclick',
        'contextmenu'
      ];
      
      expectedEvents.forEach(eventType => {
        expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
          eventType,
          expect.any(Function)
        );
      });
    });

    it('应该处理重复初始化事件监听器', () => {
      // 多次初始化不应该出错
      markerTools.initializeEventListeners();
      markerTools.initializeEventListeners();
      
      // 验证没有抛出错误
      expect(true).toBe(true);
    });

  });

  describe('📊 采样信息设置测试', () => {

    it('应该正确设置采样信息', () => {
      const sampleRate = 24000000; // 24MHz
      const firstSample = 1000;
      const visibleSamples = 5000;
      
      markerTools.setSampleInfo(sampleRate, firstSample, visibleSamples, mockChannels);
      
      // 验证采样信息被正确存储
      expect((markerTools as any).sampleRate).toBe(sampleRate);
      expect((markerTools as any).firstSample).toBe(firstSample);
      expect((markerTools as any).visibleSamples).toBe(visibleSamples);
      expect((markerTools as any).channels).toBe(mockChannels);
    });

    it('应该处理空通道数组', () => {
      const emptyChannels: AnalyzerChannel[] = [];
      
      // 不应该抛出错误
      expect(() => {
        markerTools.setSampleInfo(1000000, 0, 1000, emptyChannels);
      }).not.toThrow();
      
      expect((markerTools as any).channels).toEqual(emptyChannels);
    });

  });

  describe('🏷️ 标记管理测试', () => {

    beforeEach(() => {
      // 设置采样信息
      markerTools.setSampleInfo(1000000, 0, 1000, mockChannels);
    });

    it('应该正确添加用户标记', () => {
      const sample = 500;
      const marker = markerTools.addMarker(sample, 'user', '测试标记', '#FF0000');
      
      // 验证标记属性
      expect(marker.id).toMatch(/^marker_\d+$/);
      expect(marker.name).toBe('测试标记');
      expect(marker.sample).toBe(sample);
      expect(marker.timestamp).toBe(sample / 1000000);
      expect(marker.color).toBe('#FF0000');
      expect(marker.type).toBe('user');
      expect(marker.visible).toBe(true);
      expect(marker.locked).toBe(false);
      
      // 验证标记被存储
      const markers = (markerTools as any).markers;
      expect(markers.size).toBe(1);
      expect(markers.has(marker.id)).toBe(true);
    });

    it('应该使用默认参数添加标记', () => {
      const sample = 300;
      const marker = markerTools.addMarker(sample);
      
      // 验证默认值
      expect(marker.type).toBe('user');
      expect(marker.name).toMatch(/^标记 \d+$/);
      expect(marker.color).toBeDefined();
      expect(marker.visible).toBe(true);
    });

    it('应该正确移除标记', () => {
      // 先添加标记
      const marker1 = markerTools.addMarker(100, 'user');
      const marker2 = markerTools.addMarker(200, 'trigger');
      
      const markers = (markerTools as any).markers;
      expect(markers.size).toBe(2);
      
      // 移除第一个标记
      const removed = markerTools.removeMarker(marker1.id);
      expect(removed).toBe(true);
      expect(markers.size).toBe(1);
      expect(markers.has(marker1.id)).toBe(false);
      expect(markers.has(marker2.id)).toBe(true);
    });

    it('应该处理移除不存在的标记', () => {
      const removed = markerTools.removeMarker('non-existent-marker');
      expect(removed).toBe(false);
      
      const markers = (markerTools as any).markers;
      expect(markers.size).toBe(0);
    });

    it('应该正确更新标记位置', () => {
      // 添加标记
      const marker = markerTools.addMarker(100, 'user');
      const originalTimestamp = marker.timestamp;
      
      // 更新位置
      const newSample = 500;
      const updated = markerTools.updateMarker(marker.id, newSample);
      
      expect(updated).toBe(true);
      expect(marker.sample).toBe(newSample);
      expect(marker.timestamp).toBe(newSample / 1000000);
      expect(marker.timestamp).not.toBe(originalTimestamp);
    });

    it('应该拒绝更新锁定的标记', () => {
      // 添加并锁定标记
      const marker = markerTools.addMarker(100, 'user');
      marker.locked = true;
      
      // 尝试更新锁定的标记
      const updated = markerTools.updateMarker(marker.id, 500);
      
      expect(updated).toBe(false);
      expect(marker.sample).toBe(100); // 位置不应该改变
    });

    it('应该处理更新不存在的标记', () => {
      const updated = markerTools.updateMarker('non-existent', 500);
      expect(updated).toBe(false);
    });

  });

  describe('📏 标记对管理测试', () => {

    beforeEach(() => {
      markerTools.setSampleInfo(1000000, 0, 1000, mockChannels);
    });

    it('应该正确创建时间测量标记对', () => {
      const startSample = 100;
      const endSample = 500;
      
      const pair = markerTools.createMarkerPair(startSample, endSample, 'time');
      
      // 验证标记对属性
      expect(pair.id).toMatch(/^pair_\d+$/);
      expect(pair.name).toMatch(/^测量对 \d+$/);
      expect(pair.color).toBe('#409eff');
      expect(pair.measurementType).toBe('time');
      expect(pair.visible).toBe(true);
      
      // 验证起始和结束标记
      expect(pair.startMarker.sample).toBe(startSample);
      expect(pair.startMarker.name).toBe('开始');
      expect(pair.startMarker.color).toBe('#00ff00');
      expect(pair.startMarker.type).toBe('cursor');
      
      expect(pair.endMarker.sample).toBe(endSample);
      expect(pair.endMarker.name).toBe('结束');
      expect(pair.endMarker.color).toBe('#ff0000');
      expect(pair.endMarker.type).toBe('cursor');
      
      // 验证标记对被存储
      const markerPairs = (markerTools as any).markerPairs;
      expect(markerPairs.size).toBe(1);
      expect(markerPairs.has(pair.id)).toBe(true);
      
      // 验证标记也被添加到标记集合中
      const markers = (markerTools as any).markers;
      expect(markers.size).toBe(2);
    });

    it('应该创建不同类型的测量标记对', () => {
      const measurementTypes: Array<'time' | 'frequency' | 'pulse_width' | 'period' | 'custom'> = [
        'time',
        'frequency', 
        'pulse_width',
        'period',
        'custom'
      ];
      
      measurementTypes.forEach((type, index) => {
        const pair = markerTools.createMarkerPair(index * 100, (index + 1) * 100, type);
        expect(pair.measurementType).toBe(type);
      });
      
      const markerPairs = (markerTools as any).markerPairs;
      expect(markerPairs.size).toBe(measurementTypes.length);
    });

  });

  describe('🎯 标记类型和颜色测试', () => {

    it('应该为不同类型的标记提供默认颜色', () => {
      const types: Array<'user' | 'trigger' | 'burst' | 'cursor' | 'measurement'> = [
        'user',
        'trigger',
        'burst', 
        'cursor',
        'measurement'
      ];
      
      types.forEach((type, index) => {
        const marker = markerTools.addMarker(index * 100, type);
        expect(marker.type).toBe(type);
        expect(marker.color).toBeDefined();
        expect(marker.color).toMatch(/^#[0-9a-fA-F]{6}$/); // 验证颜色格式
      });
    });

    it('应该允许自定义标记颜色', () => {
      const customColor = '#ABCDEF';
      const marker = markerTools.addMarker(100, 'user', '自定义', customColor);
      
      expect(marker.color).toBe(customColor);
    });

  });

  describe('🧹 边界条件和错误处理', () => {

    it('应该处理Canvas上下文为null的情况', () => {
      const nullContextCanvas = {
        ...mockCanvas,
        getContext: jest.fn(() => null)
      };
      
      // 代码对null上下文有处理，不会抛出错误
      expect(() => {
        new MarkerTools(nullContextCanvas);
      }).not.toThrow();
    });

    it('应该处理极端采样值', () => {
      markerTools.setSampleInfo(1000000, 0, 1000, mockChannels);
      
      // 测试极小值
      const marker1 = markerTools.addMarker(0);
      expect(marker1.sample).toBe(0);
      expect(marker1.timestamp).toBe(0);
      
      // 测试极大值
      const marker2 = markerTools.addMarker(Number.MAX_SAFE_INTEGER);
      expect(marker2.sample).toBe(Number.MAX_SAFE_INTEGER);
      
      // 测试负值
      const marker3 = markerTools.addMarker(-100);
      expect(marker3.sample).toBe(-100);
    });

    it('应该处理零采样率', () => {
      markerTools.setSampleInfo(0, 0, 1000, mockChannels);
      
      // 添加标记时应该处理除零情况
      const marker = markerTools.addMarker(100);
      expect(marker.timestamp).toBe(Infinity);
    });

    it('应该处理空标记名称', () => {
      const marker = markerTools.addMarker(100, 'user', '');
      // 代码中对空名称会使用默认名称
      expect(marker.name).toMatch(/^标记 \d+$/);
    });

  });

  describe('📱 集成测试场景', () => {

    it('应该正确处理完整的标记工作流', () => {
      // 设置环境
      markerTools.setSampleInfo(24000000, 1000, 5000, mockChannels);
      markerTools.initializeEventListeners();
      
      // 添加多个不同类型的标记
      const userMarker = markerTools.addMarker(1500, 'user', '用户标记');
      const triggerMarker = markerTools.addMarker(2000, 'trigger', '触发标记');
      
      // 创建测量对
      const measurementPair = markerTools.createMarkerPair(2500, 3500, 'time');
      
      // 更新标记位置
      markerTools.updateMarker(userMarker.id, 1600);
      
      // 验证最终状态
      const markers = (markerTools as any).markers;
      const markerPairs = (markerTools as any).markerPairs;
      
      expect(markers.size).toBe(4); // 2个单独标记 + 2个测量对标记
      expect(markerPairs.size).toBe(1);
      
      // 验证更新后的位置
      expect(userMarker.sample).toBe(1600);
      expect(userMarker.timestamp).toBe(1600 / 24000000);
      
      // 移除标记
      const removed = markerTools.removeMarker(triggerMarker.id);
      expect(removed).toBe(true);
      expect(markers.size).toBe(3);
    });

    it('应该处理大量标记的性能', () => {
      markerTools.setSampleInfo(1000000, 0, 10000, mockChannels);
      
      // 添加大量标记
      const markerCount = 100;
      for (let i = 0; i < markerCount; i++) {
        markerTools.addMarker(i * 100, 'user', `标记${i}`);
      }
      
      const markers = (markerTools as any).markers;
      expect(markers.size).toBe(markerCount);
      
      // 验证ID递增正确
      const nextMarkerId = (markerTools as any).nextMarkerId;
      expect(nextMarkerId).toBe(markerCount + 1);
    });

  });

});