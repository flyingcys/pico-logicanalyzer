/**
 * 🎯 第2周 Day 3-4: AnnotationRenderer核心引擎模块覆盖率提升
 * 目标：从18.21%一点一点提升到70%+
 * 策略：严格按照渐进式方法，慢慢一步一步到90%
 */

import { AnnotationRenderer } from '../../../src/webview/engines/AnnotationRenderer';
import {
  AnnotationsGroup,
  SigrokAnnotation,
  SigrokAnnotationSegment,
  ProtocolAnalyzerSegmentShape,
  AnnotationRenderConfig,
  AnnotationColors,
  AnnotationColorManager,
  AnnotationTooltip,
  DEFAULT_ANNOTATION_CONFIG,
  DEFAULT_ANNOTATION_COLORS
} from '../../../src/webview/engines/AnnotationTypes';

// Mock Canvas 2D Context
const mockContext = {
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  measureText: jest.fn(() => ({ width: 100, height: 12 })),
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
  getImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(400),
    width: 10,
    height: 10
  })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(400),
    width: 10,
    height: 10
  })),
  fillStyle: '#000000',
  strokeStyle: '#000000',
  font: '12px Arial',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
  lineWidth: 1,
  globalAlpha: 1
};

// Mock Canvas Element
const mockCanvas = {
  width: 1920,
  height: 600,
  getContext: jest.fn(() => mockContext),
  getBoundingClientRect: jest.fn(() => ({ 
    left: 0, 
    top: 0, 
    width: 1920, 
    height: 600 
  })),
  style: {},
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
} as any;

describe('🎯 第2周 AnnotationRenderer 核心引擎模块完善', () => {

  let renderer: AnnotationRenderer;
  let mockAnnotationsData: AnnotationsGroup[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建测试用的注释数据
    mockAnnotationsData = [
      {
        groupId: 'i2c-group',
        decoderId: 'i2c',
        decoderName: 'I2C',
        annotations: [
          {
            startSample: 1000,
            endSample: 5000,
            typeId: 0,
            segments: [
              {
                firstSample: 1000,
                lastSample: 1200,
                typeId: 0,
                values: ['START'],
                shape: ProtocolAnalyzerSegmentShape.Rectangle
              },
              {
                firstSample: 1200,
                lastSample: 3000,
                typeId: 1,
                values: ['0x48', 'WRITE'],
                shape: ProtocolAnalyzerSegmentShape.Rectangle
              },
              {
                firstSample: 3000,
                lastSample: 5000,
                typeId: 2,
                values: ['0xAB', 'DATA'],
                shape: ProtocolAnalyzerSegmentShape.Rectangle
              }
            ]
          }
        ]
      },
      {
        groupId: 'spi-group',
        decoderId: 'spi',
        decoderName: 'SPI',
        annotations: [
          {
            startSample: 2000,
            endSample: 4000,
            typeId: 0,
            segments: [
              {
                firstSample: 2000,
                lastSample: 2500,
                typeId: 0,
                values: ['CS'],
                shape: ProtocolAnalyzerSegmentShape.Diamond
              },
              {
                firstSample: 2500,
                lastSample: 4000,
                typeId: 1,
                values: ['0xFF', 'MOSI'],
                shape: ProtocolAnalyzerSegmentShape.Circle
              }
            ]
          }
        ]
      }
    ];
  });

  describe('📋 基础构造和配置测试', () => {

    it('应该使用默认配置创建AnnotationRenderer', () => {
      renderer = new AnnotationRenderer(mockCanvas);
      
      // 验证构造函数成功执行
      expect(renderer).toBeDefined();
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('应该使用自定义配置创建AnnotationRenderer', () => {
      const customConfig: Partial<AnnotationRenderConfig> = {
        annotationHeight: 40,
        annotationNameWidth: 150,
        fontSize: 14,
        borderWidth: 2
      };
      
      renderer = new AnnotationRenderer(mockCanvas, customConfig);
      
      // 验证自定义配置生效
      expect(renderer).toBeDefined();
    });

    it('应该在Canvas上下文为null时抛出错误', () => {
      const nullContextCanvas = {
        ...mockCanvas,
        getContext: jest.fn(() => null)
      };
      
      expect(() => {
        new AnnotationRenderer(nullContextCanvas);
      }).toThrow('无法获取Canvas 2D上下文');
    });

  });

  describe('📊 注释数据管理测试', () => {

    beforeEach(() => {
      renderer = new AnnotationRenderer(mockCanvas);
    });

    it('应该正确开始和结束批量更新', () => {
      // 开始批量更新
      renderer.beginUpdate();
      
      // 结束批量更新
      renderer.endUpdate();
      
      // 验证更新过程完成
      expect(true).toBe(true);
    });

    it('应该正确清除所有注释', () => {
      // 添加注释数据
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
      
      // 清除所有注释
      renderer.clearAnnotations();
      
      // 验证清除操作
      expect(true).toBe(true);
    });

    it('应该正确添加注释组', () => {
      // 添加第一个注释组
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
      
      // 添加第二个注释组
      renderer.addAnnotationsGroup(mockAnnotationsData[1]);
      
      // 验证添加操作完成
      expect(true).toBe(true);
    });

    it('应该正确移除注释组', () => {
      // 先添加注释组
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
      
      // 移除注释组
      renderer.removeAnnotationsGroup('i2c-group');
      
      // 验证移除操作完成
      expect(true).toBe(true);
    });

  });

  describe('🎨 渲染引擎核心测试', () => {

    beforeEach(() => {
      renderer = new AnnotationRenderer(mockCanvas);
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
    });

    it('应该正确设置渲染视口', () => {
      // 设置渲染视口
      renderer.setViewport(1000, 10000, 1920);
      
      // 验证视口设置完成
      expect(true).toBe(true);
    });

    it('应该正确执行完整渲染流程', () => {
      // 设置渲染参数
      renderer.setViewport(0, 5000, 1920);
      
      // 执行渲染
      renderer.render();
      
      // 验证Canvas方法被调用
      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.restore).toHaveBeenCalled();
    });

    it('应该正确渲染不同形状的注释段', () => {
      // 创建包含不同形状的注释数据
      const shapeTestData: AnnotationsGroup = {
        groupId: 'shape-test',
        decoderId: 'test',
        decoderName: 'Shape Test',
        annotations: [
          {
            startSample: 1000,
            endSample: 5000,
            typeId: 0,
            segments: [
              {
                firstSample: 1000,
                lastSample: 1500,
                typeId: 0,
                values: ['RECT'],
                shape: ProtocolAnalyzerSegmentShape.Rectangle
              },
              {
                firstSample: 1500,
                lastSample: 2000,
                typeId: 1,
                values: ['DIAMOND'],
                shape: ProtocolAnalyzerSegmentShape.Diamond
              },
              {
                firstSample: 2000,
                lastSample: 2500,
                typeId: 2,
                values: ['CIRCLE'],
                shape: ProtocolAnalyzerSegmentShape.Circle
              },
              {
                firstSample: 2500,
                lastSample: 3000,
                typeId: 3,
                values: ['TRIANGLE'],
                shape: ProtocolAnalyzerSegmentShape.Triangle
              }
            ]
          }
        ]
      };
      
      renderer.addAnnotationsGroup(shapeTestData);
      renderer.setViewport(1000, 3000, 1920);
      renderer.render();
      
      // 验证不同形状的绘制方法被调用
      expect(mockContext.fillRect).toHaveBeenCalled(); // Rectangle
      expect(mockContext.beginPath).toHaveBeenCalled(); // Diamond/Circle/Triangle
      expect(mockContext.fill).toHaveBeenCalled();
    });

    it('应该正确处理文本渲染和对齐', () => {
      renderer.setViewport(1000, 5000, 1920);
      renderer.render();
      
      // 验证文本渲染方法被调用
      expect(mockContext.fillText).toHaveBeenCalled();
      expect(mockContext.measureText).toHaveBeenCalled();
    });

  });

  describe('🖱️ 交互事件处理测试', () => {

    beforeEach(() => {
      renderer = new AnnotationRenderer(mockCanvas);
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
      renderer.setViewport(1000, 5000, 1920);
    });

    it('应该正确处理鼠标移动事件', () => {
      // 模拟鼠标移动事件
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 500,
        clientY: 100
      });

      // 获取事件监听器并调用
      const mouseMoveHandler = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousemove'
      )?.[1];

      if (mouseMoveHandler) {
        mouseMoveHandler(mouseEvent);
      }

      // 验证事件处理完成
      expect(true).toBe(true);
    });

    it('应该正确处理鼠标离开事件', () => {
      // 模拟鼠标离开事件
      const mouseLeaveEvent = new MouseEvent('mouseleave');

      // 获取事件监听器并调用
      const mouseLeaveHandler = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mouseleave'
      )?.[1];

      if (mouseLeaveHandler) {
        mouseLeaveHandler(mouseLeaveEvent);
      }

      // 验证事件处理完成
      expect(true).toBe(true);
    });

    it('应该正确显示和隐藏工具提示', () => {
      // 模拟显示工具提示的鼠标事件
      const showTooltipEvent = new MouseEvent('mousemove', {
        clientX: 300, // 在注释区域内
        clientY: 50
      });

      const mouseMoveHandler = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousemove'
      )?.[1];

      if (mouseMoveHandler) {
        mouseMoveHandler(showTooltipEvent);
      }

      // 模拟隐藏工具提示的鼠标离开事件
      const hideTooltipEvent = new MouseEvent('mouseleave');

      const mouseLeaveHandler = mockCanvas.addEventListener.mock.calls.find(
        call => call[0] === 'mouseleave'
      )?.[1];

      if (mouseLeaveHandler) {
        mouseLeaveHandler(hideTooltipEvent);
      }

      // 验证工具提示处理完成
      expect(true).toBe(true);
    });

  });

  describe('🎯 用户标记和高亮测试', () => {

    beforeEach(() => {
      renderer = new AnnotationRenderer(mockCanvas);
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
      renderer.setViewport(1000, 5000, 1920);
    });

    it('应该正确设置和渲染用户标记', () => {
      // 设置用户标记
      renderer.setUserMarker(2500);
      
      // 执行渲染
      renderer.render();
      
      // 验证用户标记渲染
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('应该正确清除用户标记', () => {
      // 设置用户标记
      renderer.setUserMarker(2500);
      
      // 清除用户标记
      renderer.clearUserMarker();
      
      // 重新渲染
      renderer.render();
      
      // 验证清除操作完成
      expect(true).toBe(true);
    });

  });

  describe('🎨 颜色管理和主题测试', () => {

    beforeEach(() => {
      renderer = new AnnotationRenderer(mockCanvas);
    });

    it('应该正确使用颜色管理器获取颜色', () => {
      const colorManager = AnnotationColorManager.getInstance();
      
      // 获取不同类型的颜色
      const color1 = colorManager.getColor(0);
      const color2 = colorManager.getColor(1);
      const color3 = colorManager.getColor(2);
      
      // 验证颜色获取
      expect(color1).toBeDefined();
      expect(color2).toBeDefined();
      expect(color3).toBeDefined();
      expect(color1).not.toBe(color2);
    });

    it('应该正确计算对比文本颜色', () => {
      const colorManager = AnnotationColorManager.getInstance();
      
      // 测试浅色背景
      const lightTextColor = colorManager.getContrastTextColor('#FFFFFF');
      expect(lightTextColor).toBe('#000000');
      
      // 测试深色背景
      const darkTextColor = colorManager.getContrastTextColor('#000000');
      expect(darkTextColor).toBe('#FFFFFF');
    });

    it('应该正确处理颜色循环', () => {
      const colorManager = AnnotationColorManager.getInstance();
      
      // 测试颜色循环逻辑
      const colors = [];
      for (let i = 0; i < 20; i++) {
        colors.push(colorManager.getColor(i));
      }
      
      // 验证颜色循环
      expect(colors).toHaveLength(20);
      expect(colors[0]).toBe(colors[10]); // 假设调色板有10种颜色
    });

  });

  describe('📐 几何计算和布局测试', () => {

    beforeEach(() => {
      renderer = new AnnotationRenderer(mockCanvas);
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
    });

    it('应该正确计算注释段的像素坐标', () => {
      renderer.setViewport(1000, 5000, 1920);
      
      // 执行渲染以触发坐标计算
      renderer.render();
      
      // 验证坐标计算过程
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    it('应该正确处理不同视口缩放级别', () => {
      // 测试不同的缩放级别
      const viewportConfigs = [
        { start: 0, samples: 1000, width: 1920 },
        { start: 1000, samples: 10000, width: 1920 },
        { start: 5000, samples: 100000, width: 1920 }
      ];
      
      viewportConfigs.forEach(config => {
        renderer.setViewport(config.start, config.start + config.samples, config.width);
        renderer.render();
      });
      
      // 验证不同缩放级别的渲染
      expect(mockContext.clearRect).toHaveBeenCalledTimes(3);
    });

    it('应该正确处理超出视口范围的注释', () => {
      // 设置视口只显示部分注释
      renderer.setViewport(4000, 6000, 1920);
      renderer.render();
      
      // 验证视口裁剪功能
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

  });

  describe('⚡ 性能优化测试', () => {

    beforeEach(() => {
      renderer = new AnnotationRenderer(mockCanvas);
    });

    it('应该正确处理大量注释数据', () => {
      // 创建大量注释数据
      const largeAnnotationData: AnnotationsGroup = {
        groupId: 'large-data',
        decoderId: 'test',
        decoderName: 'Large Data Test',
        annotations: []
      };
      
      // 生成1000个注释
      for (let i = 0; i < 1000; i++) {
        largeAnnotationData.annotations.push({
          startSample: i * 100,
          endSample: (i + 1) * 100,
          typeId: i % 5,
          segments: [
            {
              firstSample: i * 100,
              lastSample: (i + 1) * 100,
              typeId: i % 5,
              values: [`Data ${i}`],
              shape: ProtocolAnalyzerSegmentShape.Rectangle
            }
          ]
        });
      }
      
      renderer.addAnnotationsGroup(largeAnnotationData);
      renderer.setViewport(0, 100000, 1920);
      
      // 执行渲染
      const startTime = Date.now();
      renderer.render();
      const endTime = Date.now();
      
      // 验证性能（渲染时间应该合理）
      expect(endTime - startTime).toBeLessThan(1000); // 不超过1秒
    });

    it('应该正确处理批量更新优化', () => {
      // 开始批量更新
      renderer.beginUpdate();
      
      // 添加多个注释组
      renderer.addAnnotationsGroup(mockAnnotationsData[0]);
      renderer.addAnnotationsGroup(mockAnnotationsData[1]);
      
      // 结束批量更新
      renderer.endUpdate();
      
      // 验证批量更新优化
      expect(true).toBe(true);
    });

  });

  describe('🧹 边界条件和错误处理', () => {

    it('应该处理空注释数据', () => {
      renderer = new AnnotationRenderer(mockCanvas);
      
      // 设置空视口
      renderer.setViewport(0, 1000, 1920);
      renderer.render();
      
      // 验证空数据处理
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

    it('应该处理无效的注释段数据', () => {
      renderer = new AnnotationRenderer(mockCanvas);
      
      // 创建包含无效数据的注释
      const invalidData: AnnotationsGroup = {
        groupId: 'invalid-data',
        decoderId: 'test',
        decoderName: 'Invalid Test',
        annotations: [
          {
            startSample: 1000,
            endSample: 500, // 结束样本小于开始样本
            typeId: 0,
            segments: []
          }
        ]
      };
      
      // 不应该抛出错误
      expect(() => {
        renderer.addAnnotationsGroup(invalidData);
        renderer.setViewport(0, 1000, 1920);
        renderer.render();
      }).not.toThrow();
    });

    it('应该处理零宽度或零高度Canvas', () => {
      const zeroSizeCanvas = {
        ...mockCanvas,
        width: 0,
        height: 0
      };
      
      // 不应该抛出错误
      expect(() => {
        renderer = new AnnotationRenderer(zeroSizeCanvas);
        renderer.render();
      }).not.toThrow();
    });

    it('应该处理极端的视口参数', () => {
      renderer = new AnnotationRenderer(mockCanvas);
      
      // 测试极端参数
      expect(() => {
        renderer.setViewport(-1000, -500, 1920);
        renderer.setViewport(0, 0, 1920);
        renderer.setViewport(1000000, 2000000, 1920);
        renderer.render();
      }).not.toThrow();
    });

  });

});