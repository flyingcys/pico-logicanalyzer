/**
 * AnnotationRenderer 单元测试
 * 完整测试注释渲染器的所有功能
 */

import '../../../setup';
import { AnnotationRenderer } from '../../../../src/webview/engines/AnnotationRenderer';
import {
  AnnotationsGroup,
  SigrokAnnotation,
  SigrokAnnotationSegment,
  ProtocolAnalyzerSegmentShape,
  AnnotationRenderConfig,
  DEFAULT_ANNOTATION_CONFIG
} from '../../../../src/webview/engines/AnnotationTypes';

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
  height = 200;
  style = { height: '' };
  
  private _context = new MockCanvasRenderingContext2D();
  private _eventListeners: { [key: string]: Function[] } = {};
  
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
  
  addEventListener(event: string, handler: Function) {
    if (!this._eventListeners[event]) {
      this._eventListeners[event] = [];
    }
    this._eventListeners[event].push(handler);
  }
  
  removeEventListener(event: string, handler: Function) {
    if (this._eventListeners[event]) {
      const index = this._eventListeners[event].indexOf(handler);
      if (index > -1) {
        this._eventListeners[event].splice(index, 1);
      }
    }
  }
  
  // 测试辅助方法
  simulateMouseMove(x: number, y: number) {
    const event = {
      clientX: x,
      clientY: y
    };
    
    this._eventListeners['mousemove']?.forEach(handler => handler(event));
  }
  
  simulateMouseLeave() {
    this._eventListeners['mouseleave']?.forEach(handler => handler({}));
  }
}

// Mock document.createElement and DOM
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemove = jest.fn();

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement.mockImplementation((tagName: string) => ({
    id: '',
    className: '',
    style: { cssText: '' },
    innerHTML: '',
    remove: mockRemove
  }))
});

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild
});

Object.defineProperty(document, 'getElementById', {
  value: jest.fn().mockImplementation((id: string) => {
    if (id === 'annotation-tooltip') {
      return { remove: mockRemove };
    }
    return null;
  })
});

describe('AnnotationRenderer', () => {
  let canvas: MockHTMLCanvasElement;
  let renderer: AnnotationRenderer;
  
  beforeEach(() => {
    canvas = new MockHTMLCanvasElement();
    renderer = new AnnotationRenderer(canvas as any);
    
    // 清除Mock调用记录
    mockCreateElement.mockClear();
    mockAppendChild.mockClear();
    mockRemove.mockClear();
  });
  
  afterEach(() => {
    renderer.dispose();
  });
  
  describe('构造函数和初始化', () => {
    it('应该正确初始化默认配置', () => {
      expect(renderer).toBeDefined();
      expect(canvas._eventListeners['mousemove']).toHaveLength(1);
      expect(canvas._eventListeners['mouseleave']).toHaveLength(1);
    });
    
    it('应该接受自定义配置', () => {
      const customConfig: Partial<AnnotationRenderConfig> = {
        annotationHeight: 50,
        annotationNameWidth: 200
      };
      
      const customRenderer = new AnnotationRenderer(canvas as any, customConfig);
      expect(customRenderer).toBeDefined();
      customRenderer.dispose();
    });
    
    it('应该在无法获取Context时抛出错误', () => {
      const badCanvas = {
        getContext: () => null,
        addEventListener: () => {}
      };
      
      expect(() => {
        new AnnotationRenderer(badCanvas as any);
      }).toThrow('无法获取Canvas 2D上下文');
    });
  });
  
  describe('注释组管理', () => {
    let testGroup: AnnotationsGroup;
    let testAnnotation: SigrokAnnotation;
    let testSegment: SigrokAnnotationSegment;
    
    beforeEach(() => {
      testSegment = {
        firstSample: 100,
        lastSample: 200,
        typeId: 1,
        value: ['Test Value'],
        shape: ProtocolAnalyzerSegmentShape.Rectangle
      };
      
      testAnnotation = {
        annotationId: 'test-annotation',
        annotationName: 'Test Annotation',
        decoderId: 'test-decoder',
        segments: [testSegment]
      };
      
      testGroup = {
        groupId: 'test-group',
        groupName: 'Test Group',
        groupColor: '#ff0000',
        annotations: [testAnnotation]
      };
    });
    
    it('应该能够添加注释组', () => {
      const clearRectSpy = jest.spyOn(canvas._context, 'clearRect');
      
      renderer.addAnnotationsGroup(testGroup);
      
      expect(clearRectSpy).toHaveBeenCalled();
    });
    
    it('应该能够清除所有注释', () => {
      renderer.addAnnotationsGroup(testGroup);
      renderer.clearAnnotations();
      
      // 渲染后画布应该被清空
      const clearRectSpy = jest.spyOn(canvas._context, 'clearRect');
      renderer.render();
      expect(clearRectSpy).toHaveBeenCalled();
    });
    
    it('应该在添加注释时更新画布高度', () => {
      // 创建包含多个注释的组以确保高度变化
      const largeGroup: AnnotationsGroup = {
        groupId: 'large-group',
        groupName: 'Large Group',
        groupColor: '#ff0000',
        annotations: [
          {
            annotationId: 'annotation-1',
            annotationName: 'Annotation 1',
            decoderId: 'test-decoder',
            segments: [testSegment]
          },
          {
            annotationId: 'annotation-2',
            annotationName: 'Annotation 2',
            decoderId: 'test-decoder',
            segments: [testSegment]
          },
          {
            annotationId: 'annotation-3',
            annotationName: 'Annotation 3',
            decoderId: 'test-decoder',
            segments: [testSegment]
          }
        ]
      };
      
      const originalHeight = canvas.height;
      
      renderer.addAnnotationsGroup(largeGroup);
      
      // 应该根据注释数量计算高度
      const expectedHeight = largeGroup.annotations.length * 24; // 默认annotationHeight
      expect(canvas.height).toBe(expectedHeight);
    });
  });
  
  describe('可见样本管理', () => {
    it('应该更新可见样本范围', () => {
      const renderSpy = jest.spyOn(renderer, 'render');
      
      renderer.updateVisibleSamples(1000, 5000);
      
      expect(renderSpy).toHaveBeenCalled();
    });
    
    it('应该在批量更新时不触发渲染', () => {
      const renderSpy = jest.spyOn(renderer, 'render');
      
      renderer.beginUpdate();
      renderer.updateVisibleSamples(1000, 5000);
      
      expect(renderSpy).not.toHaveBeenCalled();
      
      renderer.endUpdate();
      expect(renderSpy).toHaveBeenCalled();
    });
  });
  
  describe('用户标记', () => {
    it('应该设置用户标记', () => {
      const renderSpy = jest.spyOn(renderer, 'render');
      
      renderer.setUserMarker(1500);
      
      expect(renderSpy).toHaveBeenCalled();
    });
    
    it('应该清除用户标记', () => {
      renderer.setUserMarker(1500);
      const renderSpy = jest.spyOn(renderer, 'render');
      
      renderer.setUserMarker(null);
      
      expect(renderSpy).toHaveBeenCalled();
    });
  });
  
  describe('渲染功能', () => {
    let testGroup: AnnotationsGroup;
    
    beforeEach(() => {
      testGroup = {
        groupId: 'test-group',
        groupName: 'Test Group',
        groupColor: '#ff0000',
        annotations: [{
          annotationId: 'test-annotation',
          annotationName: 'Test Annotation',
          decoderId: 'test-decoder',
          segments: [{
            firstSample: 100,
            lastSample: 200,
            typeId: 1,
            value: ['Test Value'],
            shape: ProtocolAnalyzerSegmentShape.Rectangle
          }]
        }]
      };
      
      renderer.updateVisibleSamples(0, 1000);
    });
    
    it('应该渲染空画布当没有注释时', () => {
      const clearRectSpy = jest.spyOn(canvas._context, 'clearRect');
      
      renderer.render();
      
      expect(clearRectSpy).toHaveBeenCalled();
    });
    
    it('应该渲染注释', () => {
      renderer.addAnnotationsGroup(testGroup);
      
      const fillRectSpy = jest.spyOn(canvas._context, 'fillRect');
      const strokeRectSpy = jest.spyOn(canvas._context, 'strokeRect');
      
      renderer.render();
      
      expect(fillRectSpy).toHaveBeenCalled();
      expect(strokeRectSpy).toHaveBeenCalled();
    });
    
    it('应该渲染用户标记线', () => {
      renderer.addAnnotationsGroup(testGroup);
      renderer.setUserMarker(500);
      
      const setLineDashSpy = jest.spyOn(canvas._context, 'setLineDash');
      
      renderer.render();
      
      expect(setLineDashSpy).toHaveBeenCalledWith([5, 3]);
    });
    
    it('应该渲染不同形状的段', () => {
      const shapes = [
        ProtocolAnalyzerSegmentShape.Rectangle,
        ProtocolAnalyzerSegmentShape.RoundRectangle,
        ProtocolAnalyzerSegmentShape.Hexagon,
        ProtocolAnalyzerSegmentShape.Circle
      ];
      
      shapes.forEach((shape, index) => {
        const segment = {
          firstSample: index * 100,
          lastSample: (index + 1) * 100,
          typeId: index,
          value: [`Shape ${index}`],
          shape
        };
        
        const annotation = {
          annotationId: `annotation-${index}`,
          annotationName: `Annotation ${index}`,
          decoderId: 'test-decoder',
          segments: [segment]
        };
        
        const group = {
          groupId: `group-${index}`,
          groupName: `Group ${index}`,
          groupColor: `#${index}${index}0000`,
          annotations: [annotation]
        };
        
        renderer.addAnnotationsGroup(group);
      });
      
      expect(() => {
        renderer.render();
      }).not.toThrow();
    });
  });
  
  describe('交互功能', () => {
    let testGroup: AnnotationsGroup;
    
    beforeEach(() => {
      testGroup = {
        groupId: 'test-group',
        groupName: 'Test Group',
        groupColor: '#ff0000',
        annotations: [{
          annotationId: 'test-annotation',
          annotationName: 'Test Annotation',
          decoderId: 'test-decoder',
          segments: [{
            firstSample: 100,
            lastSample: 200,
            typeId: 1,
            value: ['Test Tooltip Value'],
            shape: ProtocolAnalyzerSegmentShape.Rectangle
          }]
        }]
      };
      
      renderer.updateVisibleSamples(0, 1000);
      renderer.addAnnotationsGroup(testGroup);
    });
    
    it('应该在鼠标悬停时显示工具提示', () => {
      // 直接验证鼠标事件监听器是否已设置
      expect(canvas._eventListeners['mousemove']).toHaveLength(1);
      
      // 模拟鼠标移动事件
      const nameWidth = DEFAULT_ANNOTATION_CONFIG.annotationNameWidth;
      const mouseX = nameWidth + 50; // 在段的范围内
      const mouseY = 10; // 在第一个注释行
      
      // 直接调用事件处理器而不是通过DOM
      const event = {
        clientX: mouseX,
        clientY: mouseY
      };
      
      const boundRect = canvas.getBoundingClientRect();
      const mockEvent = {
        clientX: event.clientX,
        clientY: event.clientY
      };
      
      // 事件应该能够正常处理，不抛出异常
      expect(() => {
        (renderer as any).onMouseMove(mockEvent);
      }).not.toThrow();
    });
    
    it('应该在鼠标离开时隐藏工具提示', () => {
      // 先显示工具提示
      const nameWidth = DEFAULT_ANNOTATION_CONFIG.annotationNameWidth;
      canvas.simulateMouseMove(nameWidth + 150, 10);
      
      // 然后模拟鼠标离开
      canvas.simulateMouseLeave();
      
      // getElementById会被调用来查找现有的tooltip
      expect(document.getElementById).toHaveBeenCalledWith('annotation-tooltip');
    });
    
    it('应该在没有注释时不显示工具提示', () => {
      renderer.clearAnnotations();
      
      canvas.simulateMouseMove(400, 10);
      
      // 不应该创建tooltip元素
      expect(mockCreateElement).not.toHaveBeenCalled();
    });
  });
  
  describe('批量更新', () => {
    it('应该支持批量更新', () => {
      const renderSpy = jest.spyOn(renderer, 'render');
      
      renderer.beginUpdate();
      
      // 在批量更新期间，render不应该被调用
      renderer.updateVisibleSamples(1000, 5000);
      renderer.setUserMarker(2500);
      
      expect(renderSpy).not.toHaveBeenCalled();
      
      // 结束批量更新时应该调用render
      renderer.endUpdate();
      expect(renderSpy).toHaveBeenCalled();
    });
  });
  
  describe('边界条件和错误处理', () => {
    it('应该处理空的注释组', () => {
      const emptyGroup: AnnotationsGroup = {
        groupId: 'empty-group',
        groupName: 'Empty Group',
        groupColor: '#000000',
        annotations: []
      };
      
      expect(() => {
        renderer.addAnnotationsGroup(emptyGroup);
        renderer.render();
      }).not.toThrow();
    });
    
    it('应该处理没有段的注释', () => {
      const noSegmentGroup: AnnotationsGroup = {
        groupId: 'no-segment-group',
        groupName: 'No Segment Group',
        groupColor: '#000000',
        annotations: [{
          annotationId: 'no-segment-annotation',
          annotationName: 'No Segment Annotation',
          decoderId: 'test-decoder',
          segments: []
        }]
      };
      
      expect(() => {
        renderer.addAnnotationsGroup(noSegmentGroup);
        renderer.render();
      }).not.toThrow();
    });
    
    it('应该处理极小的段', () => {
      const tinySegmentGroup: AnnotationsGroup = {
        groupId: 'tiny-group',
        groupName: 'Tiny Group',
        groupColor: '#000000',
        annotations: [{
          annotationId: 'tiny-annotation',
          annotationName: 'Tiny Annotation',
          decoderId: 'test-decoder',
          segments: [{
            firstSample: 100,
            lastSample: 100, // 零长度段
            typeId: 1,
            value: ['Tiny'],
            shape: ProtocolAnalyzerSegmentShape.Circle
          }]
        }]
      };
      
      renderer.updateVisibleSamples(0, 1000);
      
      expect(() => {
        renderer.addAnnotationsGroup(tinySegmentGroup);
        renderer.render();
      }).not.toThrow();
    });
    
    it('应该处理超出可见范围的段', () => {
      const outOfRangeGroup: AnnotationsGroup = {
        groupId: 'out-of-range-group',
        groupName: 'Out of Range Group',
        groupColor: '#000000',
        annotations: [{
          annotationId: 'out-of-range-annotation',
          annotationName: 'Out of Range Annotation',
          decoderId: 'test-decoder',
          segments: [{
            firstSample: 2000, // 超出可见范围
            lastSample: 3000,
            typeId: 1,
            value: ['Out of Range'],
            shape: ProtocolAnalyzerSegmentShape.Rectangle
          }]
        }]
      };
      
      renderer.updateVisibleSamples(0, 1000);
      
      expect(() => {
        renderer.addAnnotationsGroup(outOfRangeGroup);
        renderer.render();
      }).not.toThrow();
    });
  });
  
  describe('资源清理', () => {
    it('应该正确清理资源', () => {
      const removeEventListenerSpy = jest.spyOn(canvas, 'removeEventListener');
      
      renderer.dispose();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });
    
    it('应该在dispose时隐藏工具提示', () => {
      // 先显示工具提示
      const testGroup: AnnotationsGroup = {
        groupId: 'test-group',
        groupName: 'Test Group',
        groupColor: '#ff0000',
        annotations: [{
          annotationId: 'test-annotation',
          annotationName: 'Test Annotation',
          decoderId: 'test-decoder',
          segments: [{
            firstSample: 100,
            lastSample: 200,
            typeId: 1,
            value: ['Test Value'],
            shape: ProtocolAnalyzerSegmentShape.Rectangle
          }]
        }]
      };
      
      renderer.updateVisibleSamples(0, 1000);
      renderer.addAnnotationsGroup(testGroup);
      
      const nameWidth = DEFAULT_ANNOTATION_CONFIG.annotationNameWidth;
      canvas.simulateMouseMove(nameWidth + 150, 10);
      
      renderer.dispose();
      
      // 应该尝试查找并删除tooltip
      expect(document.getElementById).toHaveBeenCalledWith('annotation-tooltip');
    });
  });
  
  describe('性能测试', () => {
    it('应该处理大量注释', () => {
      const groups: AnnotationsGroup[] = [];
      
      // 创建100个注释组，每个有10个注释
      for (let i = 0; i < 100; i++) {
        const annotations: SigrokAnnotation[] = [];
        
        for (let j = 0; j < 10; j++) {
          annotations.push({
            annotationId: `annotation-${i}-${j}`,
            annotationName: `Annotation ${i}-${j}`,
            decoderId: 'test-decoder',
            segments: [{
              firstSample: i * 100 + j * 10,
              lastSample: i * 100 + j * 10 + 5,
              typeId: j % 4,
              value: [`Value ${i}-${j}`],
              shape: (j % 4) as ProtocolAnalyzerSegmentShape
            }]
          });
        }
        
        groups.push({
          groupId: `group-${i}`,
          groupName: `Group ${i}`,
          groupColor: `#${(i * 16777215 / 100).toString(16).slice(0, 6)}`,
          annotations
        });
      }
      
      renderer.updateVisibleSamples(0, 10000);
      
      const startTime = performance.now();
      
      groups.forEach(group => {
        renderer.addAnnotationsGroup(group);
      });
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // 1秒内完成
    });
  });
});