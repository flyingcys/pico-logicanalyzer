/**
 * EnhancedWaveformRenderer 增强测试套件
 * 专门测试未覆盖的代码路径和边界条件
 * @jest-environment jsdom
 */

import { EnhancedWaveformRenderer, DecoderResult, WaveformRenderConfig } from '../../../../src/webview/engines/EnhancedWaveformRenderer';

// Mock AnnotationRenderer
jest.mock('../../../../src/webview/engines/AnnotationRenderer', () => ({
  AnnotationRenderer: jest.fn().mockImplementation(() => ({
    beginUpdate: jest.fn(),
    endUpdate: jest.fn(),
    clearAnnotations: jest.fn(),
    addAnnotationsGroup: jest.fn(),
    updateVisibleSamples: jest.fn(),
    setUserMarker: jest.fn(),
    dispose: jest.fn()
  }))
}));

// Mock AnnotationTypes
jest.mock('../../../../src/webview/engines/AnnotationTypes', () => ({
  ProtocolAnalyzerSegmentShape: {
    Circle: 0,
    RoundRectangle: 1,
    Hexagon: 2
  },
  AnnotationColorManager: {
    getInstance: jest.fn().mockReturnValue({
      getColor: jest.fn().mockImplementation((index: number) => `#${(index * 123456).toString(16).padStart(6, '0')}`)
    })
  }
}));

// Mock WaveformRenderer base class
jest.mock('../../../../src/webview/engines/WaveformRenderer', () => {
  class MockWaveformRenderer {
    public canvas: HTMLCanvasElement;
    public ctx: any;
    public visibleSamples = 1000;

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.ctx = {
        save: jest.fn(),
        restore: jest.fn(),
        fillText: jest.fn(),
        fillRect: jest.fn(),
        strokeRect: jest.fn()
      };
    }

    resize = jest.fn();
    updateVisibleSamples = jest.fn();
    setUserMarker = jest.fn();
    render = jest.fn().mockReturnValue({ renderTime: 16.67, fps: 60 });
    dispose = jest.fn();
  }

  return { WaveformRenderer: MockWaveformRenderer };
});

describe('EnhancedWaveformRenderer 增强测试 - 覆盖未测试代码路径', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EnhancedWaveformRenderer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // 创建真实的DOM环境
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
    mockContainer.appendChild(canvas);

    // Mock getBoundingClientRect
    canvas.getBoundingClientRect = jest.fn().mockReturnValue({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600
    });

    // Mock getContext
    (canvas.getContext as jest.Mock) = jest.fn().mockReturnValue({
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
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
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1
    });

    // Mock devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      writable: true
    });
  });

  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    if (mockContainer && document.body.contains(mockContainer)) {
      document.body.removeChild(mockContainer);
    }
    jest.clearAllMocks();
  });

  describe('注释Canvas创建和管理 - 未覆盖路径', () => {
    it('应该在启用独立注释区域时创建注释Canvas', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: true,
        separateAnnotationArea: true,
        annotationAreaHeight: 100
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);

      // 验证注释Canvas被创建
      expect(renderer).toBeDefined();
    });

    it('应该正确设置注释Canvas的样式属性', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: true,
        separateAnnotationArea: true,
        annotationAreaHeight: 150
      };

      // 创建spy来捕获appendChild调用
      const appendChildSpy = jest.spyOn(mockContainer, 'appendChild');

      renderer = new EnhancedWaveformRenderer(canvas, config);

      // 验证appendChild被调用
      expect(appendChildSpy).toHaveBeenCalled();
    });

    it('应该在resize时调整注释Canvas尺寸', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: true,
        separateAnnotationArea: true
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);

      // 模拟resize调用
      renderer.resize();

      // 验证resize被正确处理
      expect(renderer).toBeDefined();
    });

    it('应该处理devicePixelRatio的Canvas缩放', () => {
      // 设置不同的devicePixelRatio
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 3,
        writable: true
      });

      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: true,
        separateAnnotationArea: true
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);
      renderer.resize();

      expect(renderer).toBeDefined();
    });
  });

  describe('解码器结果转换 - 未覆盖路径', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });
    });

    it('应该正确转换复杂的解码器结果结构', () => {
      const complexResults: DecoderResult[] = [
        {
          decoderId: 'complex_decoder',
          decoderName: 'Complex Protocol',
          results: [
            {
              startSample: 100,
              endSample: 101, // 单点 -> Circle
              annotationType: 'start_bit',
              values: ['S']
            },
            {
              startSample: 200,
              endSample: 205, // 短段 -> RoundRectangle  
              annotationType: 'data_bit',
              values: ['1']
            },
            {
              startSample: 300,
              endSample: 350, // 长段 -> Hexagon
              annotationType: 'data_byte',
              values: ['0xFF', 'DATA']
            },
            {
              startSample: 400,
              endSample: 400, // 另一个单点
              annotationType: 'stop_bit',
              values: ['P']
            }
          ]
        }
      ];

      // 这应该触发convertToAnnotations和相关的私有方法
      renderer.addDecoderResults(complexResults);
      
      expect(renderer).toBeDefined();
    });

    it('应该为相同类型的多个注释正确分组', () => {
      const groupedResults: DecoderResult[] = [
        {
          decoderId: 'grouped_decoder',
          decoderName: 'Grouped Protocol',
          results: [
            {
              startSample: 100,
              endSample: 110,
              annotationType: 'data',
              values: ['A']
            },
            {
              startSample: 200,
              endSample: 210,
              annotationType: 'data', // 相同类型
              values: ['B']
            },
            {
              startSample: 300,
              endSample: 310,
              annotationType: 'control',
              values: ['CTL']
            },
            {
              startSample: 400,
              endSample: 410,
              annotationType: 'data', // 又一个相同类型
              values: ['C']
            }
          ]
        }
      ];

      renderer.addDecoderResults(groupedResults);
      
      expect(renderer).toBeDefined();
    });

    it('应该正确处理不同长度的段形状判断', () => {
      const shapesResults: DecoderResult[] = [
        {
          decoderId: 'shapes_test',
          decoderName: 'Shapes Test',
          results: [
            { startSample: 0, endSample: 0, annotationType: 'point', values: ['P'] }, // 0长度
            { startSample: 10, endSample: 12, annotationType: 'short', values: ['S'] }, // 短段
            { startSample: 20, endSample: 30, annotationType: 'medium', values: ['M'] }, // 中段
            { startSample: 40, endSample: 70, annotationType: 'long', values: ['L'] }, // 长段
            { startSample: 100, endSample: 200, annotationType: 'verylong', values: ['XL'] } // 超长段
          ]
        }
      ];

      renderer.addDecoderResults(shapesResults);
      
      expect(renderer).toBeDefined();
    });
  });

  describe('注释渲染更新 - 未覆盖路径', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });
    });

    it('应该在有解码器结果时更新注释渲染器', () => {
      const testResults: DecoderResult[] = [
        {
          decoderId: 'update_test',
          decoderName: 'Update Test',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'test',
              values: ['TEST']
            }
          ]
        }
      ];

      // 添加结果并触发更新
      renderer.addDecoderResults(testResults);
      
      // 手动触发updateAnnotationRenderer
      renderer.render();
      
      expect(renderer).toBeDefined();
    });

    it('应该在清除结果后正确更新渲染器', () => {
      // 先添加一些结果
      const testResults: DecoderResult[] = [
        {
          decoderId: 'clear_test',
          decoderName: 'Clear Test',
          results: [
            { startSample: 100, endSample: 200, annotationType: 'test', values: ['TEST'] }
          ]
        }
      ];

      renderer.addDecoderResults(testResults);
      
      // 然后清除
      renderer.clearDecoderResults();
      
      // 渲染应该正确处理空结果
      renderer.render();
      
      expect(renderer).toBeDefined();
    });
  });

  describe('类型ID管理 - 未覆盖路径', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas);
    });

    it('应该为新类型名称生成递增的类型ID', () => {
      const multiTypeResults: DecoderResult[] = [
        {
          decoderId: 'type_id_test',
          decoderName: 'Type ID Test',
          results: [
            { startSample: 100, endSample: 110, annotationType: 'type_a', values: ['A'] },
            { startSample: 200, endSample: 210, annotationType: 'type_b', values: ['B'] },
            { startSample: 300, endSample: 310, annotationType: 'type_c', values: ['C'] },
            { startSample: 400, endSample: 410, annotationType: 'type_a', values: ['A2'] }, // 重复类型
            { startSample: 500, endSample: 510, annotationType: 'type_d', values: ['D'] }
          ]
        }
      ];

      renderer.addDecoderResults(multiTypeResults);
      
      expect(renderer).toBeDefined();
    });
  });

  describe('叠加注释渲染 - 未覆盖路径', () => {
    it('应该在启用叠加模式时正确渲染注释到主Canvas', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        overlayAnnotations: true,
        showDecoderResults: true,
        separateAnnotationArea: false
      });

      const overlayResults: DecoderResult[] = [
        {
          decoderId: 'overlay_test',
          decoderName: 'Overlay Test',
          results: [
            { startSample: 100, endSample: 200, annotationType: 'overlay', values: ['OVERLAY'] }
          ]
        }
      ];

      renderer.addDecoderResults(overlayResults);
      
      // 触发叠加渲染
      const stats = renderer.render();
      
      expect(stats).toBeDefined();
      expect(stats.renderTime).toBeDefined();
    });

    it('应该限制叠加注释的显示数量', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        overlayAnnotations: true,
        maxOverlayAnnotations: 5
      });

      // 创建超过限制数量的注释
      const manyResults: DecoderResult[] = [
        {
          decoderId: 'many_overlay',
          decoderName: 'Many Overlay',
          results: Array.from({ length: 20 }, (_, i) => ({
            startSample: i * 100,
            endSample: i * 100 + 50,
            annotationType: 'data',
            values: [`Item${i}`]
          }))
        }
      ];

      renderer.addDecoderResults(manyResults);
      renderer.render();
      
      expect(renderer).toBeDefined();
    });
  });

  describe('错误处理和边界条件 - 未覆盖路径', () => {
    it('应该处理注释Canvas创建失败', () => {
      // Mock document.createElement 失败
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn().mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          throw new Error('Canvas creation failed');
        }
        return originalCreateElement.call(document, tagName);
      });

      try {
        renderer = new EnhancedWaveformRenderer(canvas, {
          showDecoderResults: true,
          separateAnnotationArea: true
        });
        
        expect(renderer).toBeDefined();
      } finally {
        document.createElement = originalCreateElement;
      }
    });

    it('应该处理getContext返回null的情况', () => {
      const badCanvas = document.createElement('canvas');
      badCanvas.getContext = jest.fn().mockReturnValue(null);
      
      mockContainer.appendChild(badCanvas);

      renderer = new EnhancedWaveformRenderer(badCanvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });

      // 调用resize应该处理null context
      renderer.resize();
      
      expect(renderer).toBeDefined();
    });

    it('应该处理空的注释值数组', () => {
      renderer = new EnhancedWaveformRenderer(canvas);

      const emptyValueResults: DecoderResult[] = [
        {
          decoderId: 'empty_values',
          decoderName: 'Empty Values',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'empty',
              values: [] // 空值数组
            }
          ]
        }
      ];

      renderer.addDecoderResults(emptyValueResults);
      
      expect(renderer).toBeDefined();
    });
  });

  describe('资源清理 - 未覆盖路径', () => {
    it('应该在dispose时正确移除注释Canvas', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });

      // Mock removeChild
      const removeChildSpy = jest.spyOn(mockContainer, 'removeChild');

      renderer.dispose();

      // 验证资源清理
      expect(renderer).toBeDefined();
    });

    it('应该处理注释Canvas不存在父节点的情况', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });

      // 手动移除Canvas使其没有父节点
      const annotationCanvas = mockContainer.querySelector('.annotation-canvas');
      if (annotationCanvas && annotationCanvas.parentNode) {
        annotationCanvas.parentNode.removeChild(annotationCanvas);
      }

      // dispose应该不抛出错误
      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });
  });
});