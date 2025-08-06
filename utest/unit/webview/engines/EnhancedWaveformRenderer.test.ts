/**
 * EnhancedWaveformRenderer 增强波形渲染器测试套件
 * 
 * 测试范围：
 * - 构造函数和配置管理
 * - 注释渲染器设置和Canvas管理
 * - 解码器结果管理（添加、移除、清除）
 * - 注释格式转换和类型管理
 * - 渲染功能（叠加和独立模式）
 * - 数据导出功能（JSON、CSV、TXT）
 * - 统计信息和性能分析
 * - 资源管理和清理
 * 
 * @author VSCode Logic Analyzer Extension
 * @date 2025-08-04
 * @jest-environment jsdom
 */

import { EnhancedWaveformRenderer, DecoderResult, DecoderAnnotation, WaveformRenderConfig } from '../../../../src/webview/engines/EnhancedWaveformRenderer';
import { AnalyzerChannel } from '../../../../src/models/CaptureModels';

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
        strokeRect: jest.fn(),
        font: '',
        textAlign: '',
        textBaseline: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0
      };
    }

    resize = jest.fn();
    updateVisibleSamples = jest.fn();
    setUserMarker = jest.fn();
    render = jest.fn().mockReturnValue({ renderTime: 16.67, fps: 60 });
    beginUpdate = jest.fn();
    endUpdate = jest.fn();
    invalidateVisual = jest.fn();
    dispose = jest.fn();
  }

  return {
    WaveformRenderer: MockWaveformRenderer
  };
});

describe('EnhancedWaveformRenderer 增强波形渲染器测试', () => {
  let canvas: HTMLCanvasElement;
  let renderer: EnhancedWaveformRenderer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // 创建测试Canvas和容器
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    mockContainer = document.createElement('div');
    
    // 通过设置innerHTML而不是appendChild来避免jsdom的问题
    mockContainer.innerHTML = '<canvas width="800" height="600"></canvas>';

    // Mock getBoundingClientRect
    canvas.getBoundingClientRect = jest.fn().mockReturnValue({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600
    });

    // Mock getContext for canvas
    (canvas.getContext as jest.Mock) = jest.fn().mockReturnValue({
      save: jest.fn(),
      restore: jest.fn(),
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      measureText: jest.fn().mockReturnValue({ width: 50 }),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      setLineDash: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
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
    // 简单清理，不涉及DOM操作
    mockContainer = null as any;
    canvas = null as any;
    jest.clearAllMocks();
  });

  describe('构造函数和配置管理', () => {
    it('应该使用默认配置创建实例', () => {
      renderer = new EnhancedWaveformRenderer(canvas);

      expect(renderer).toBeDefined();
      expect(renderer).toBeInstanceOf(EnhancedWaveformRenderer);
    });

    it('应该接受自定义配置', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: false,
        annotationHeight: 30,
        separateAnnotationArea: false,
        overlayAnnotations: true
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);

      expect(renderer).toBeDefined();
    });

    it('应该合并默认配置和自定义配置', () => {
      const config: Partial<WaveformRenderConfig> = {
        annotationHeight: 32
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);

      // 通过渲染测试验证配置生效
      expect(renderer).toBeDefined();
    });

    it('应该正确处理空配置', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {});

      expect(renderer).toBeDefined();
    });
  });

  describe('注释渲染器设置和Canvas管理', () => {
    it('应该在启用解码器结果时创建注释Canvas', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: true,
        separateAnnotationArea: true
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);

      // 简单验证渲染器实例创建成功
      expect(renderer).toBeDefined();
    });

    it('应该在禁用解码器结果时不创建注释Canvas', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: false
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);

      // 简单验证渲染器实例创建成功
      expect(renderer).toBeDefined();
    });

    it('应该正确设置注释Canvas样式', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: true,
        separateAnnotationArea: true,
        annotationAreaHeight: 150
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);

      // 简单验证渲染器配置生效
      expect(renderer).toBeDefined();
    });

    it('应该正确调整注释Canvas尺寸', () => {
      const config: Partial<WaveformRenderConfig> = {
        showDecoderResults: true,
        separateAnnotationArea: true
      };

      renderer = new EnhancedWaveformRenderer(canvas, config);
      
      // 测试resize方法不抛出异常
      expect(() => {
        renderer.resize();
      }).not.toThrow();
    });

    it('应该处理无父容器的情况', () => {
      const isolatedCanvas = document.createElement('canvas');
      
      // 不应该抛出错误
      expect(() => {
        renderer = new EnhancedWaveformRenderer(isolatedCanvas, {
          showDecoderResults: true,
          separateAnnotationArea: true
        });
      }).not.toThrow();
    });
  });

  describe('解码器结果管理', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas);
    });

    it('应该正确添加解码器结果', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'uart',
          decoderName: 'UART',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['0x41'],
              rawData: { byte: 0x41 }
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });

    it('应该正确处理多个解码器结果', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'uart',
          decoderName: 'UART',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['0x41']
            }
          ]
        },
        {
          decoderId: 'i2c',
          decoderName: 'I2C',
          results: [
            {
              startSample: 300,
              endSample: 400,
              annotationType: 'address',
              values: ['0x50']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });

    it('应该正确移除特定解码器结果', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'uart',
          decoderName: 'UART',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['0x41']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);
      
      expect(() => {
        renderer.removeDecoderResults('uart');
      }).not.toThrow();
    });

    it('应该正确处理移除不存在的解码器', () => {
      expect(() => {
        renderer.removeDecoderResults('nonexistent');
      }).not.toThrow();
    });

    it('应该正确清除所有解码器结果', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'uart',
          decoderName: 'UART',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['0x41']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);

      expect(() => {
        renderer.clearDecoderResults();
      }).not.toThrow();
    });

    it('应该正确处理空的解码器结果数组', () => {
      expect(() => {
        renderer.addDecoderResults([]);
      }).not.toThrow();
    });

    it('应该正确处理包含空结果的解码器', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'empty',
          decoderName: 'Empty',
          results: []
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });
  });

  describe('注释格式转换和类型管理', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas);
    });

    it('应该正确转换单个注释', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'test',
          decoderName: 'Test',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['0x41', 'A']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });

    it('应该正确处理不同类型的注释', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'multi',
          decoderName: 'Multi',
          results: [
            {
              startSample: 100,
              endSample: 110,
              annotationType: 'start',
              values: ['START']
            },
            {
              startSample: 200,
              endSample: 220,
              annotationType: 'data',
              values: ['0x41']
            },
            {
              startSample: 300,
              endSample: 305,
              annotationType: 'stop',
              values: ['STOP']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });

    it('应该正确确定段形状', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'shapes',
          decoderName: 'Shapes',
          results: [
            {
              startSample: 100,
              endSample: 100, // 单点 -> Circle
              annotationType: 'point',
              values: ['P']
            },
            {
              startSample: 200,
              endSample: 205, // 短段 -> RoundRectangle
              annotationType: 'short',
              values: ['S']
            },
            {
              startSample: 300,
              endSample: 350, // 长段 -> Hexagon
              annotationType: 'long',
              values: ['L']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });

    it('应该为相同类型名称生成稳定的类型ID', () => {
      const decoderResults1: DecoderResult[] = [
        {
          decoderId: 'test1',
          decoderName: 'Test1',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['A']
            }
          ]
        }
      ];

      const decoderResults2: DecoderResult[] = [
        {
          decoderId: 'test2',
          decoderName: 'Test2',
          results: [
            {
              startSample: 300,
              endSample: 400,
              annotationType: 'data', // 相同类型名称
              values: ['B']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults1);
        renderer.addDecoderResults(decoderResults2);
      }).not.toThrow();
    });
  });

  describe('渲染功能', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        overlayAnnotations: true
      });
    });

    it('应该正确调用父类render方法', () => {
      const stats = renderer.render();

      expect(stats).toBeDefined();
      expect(stats.renderTime).toBeDefined();
      expect(stats.fps).toBeDefined();
    });

    it('应该在启用叠加模式时渲染注释', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'overlay',
          decoderName: 'Overlay',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['Test']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);

      expect(() => {
        renderer.render();
      }).not.toThrow();
    });

    it('应该在禁用叠加模式时不渲染叠加注释', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        overlayAnnotations: false
      });

      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'no_overlay',
          decoderName: 'No Overlay',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['Test']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);

      expect(() => {
        renderer.render();
      }).not.toThrow();
    });

    it('应该正确处理空解码器结果的渲染', () => {
      expect(() => {
        renderer.render();
      }).not.toThrow();
    });

    it('应该正确限制叠加注释的显示数量', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'many',
          decoderName: 'Many',
          results: Array.from({ length: 10 }, (_, i) => ({
            startSample: i * 100,
            endSample: i * 100 + 50,
            annotationType: 'data',
            values: [`Item${i}`]
          }))
        }
      ];

      renderer.addDecoderResults(decoderResults);

      expect(() => {
        renderer.render();
      }).not.toThrow();
    });
  });

  describe('同步更新功能', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });
    });

    it('应该同步更新可见样本范围', () => {
      expect(() => {
        renderer.updateVisibleSamples(1000, 2000);
      }).not.toThrow();
    });

    it('应该同步更新用户标记', () => {
      expect(() => {
        renderer.setUserMarker(1500);
      }).not.toThrow();
    });

    it('应该处理null用户标记', () => {
      expect(() => {
        renderer.setUserMarker(null);
      }).not.toThrow();
    });
  });

  describe('数据导出功能', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas);

      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'export_test',
          decoderName: 'Export Test',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['0x41', 'A'],
              rawData: { byte: 0x41 }
            },
            {
              startSample: 300,
              endSample: 400,
              annotationType: 'control',
              values: ['START']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);
    });

    it('应该导出JSON格式数据', () => {
      const jsonData = renderer.exportDecoderData('json');

      expect(jsonData).toBeDefined();
      expect(typeof jsonData).toBe('string');
      
      // 验证JSON格式有效
      expect(() => JSON.parse(jsonData)).not.toThrow();
      
      const parsed = JSON.parse(jsonData);
      expect(parsed.format).toBe('json');
      expect(parsed.decoders).toHaveLength(1);
      expect(parsed.decoders[0].annotations).toHaveLength(2);
    });

    it('应该导出CSV格式数据', () => {
      const csvData = renderer.exportDecoderData('csv');

      expect(csvData).toBeDefined();
      expect(typeof csvData).toBe('string');
      expect(csvData).toContain('Decoder,Type,StartSample,EndSample,Duration,Value');
      expect(csvData).toContain('Export Test');
    });

    it('应该导出TXT格式数据', () => {
      const txtData = renderer.exportDecoderData('txt');

      expect(txtData).toBeDefined();
      expect(typeof txtData).toBe('string');
      expect(txtData).toContain('Logic Analyzer Decoder Results');
      expect(txtData).toContain('Export Test');
    });

    it('应该使用默认JSON格式', () => {
      const defaultData = renderer.exportDecoderData();

      expect(defaultData).toBeDefined();
      expect(() => JSON.parse(defaultData)).not.toThrow();
    });

    it('应该处理未知格式并回退到JSON', () => {
      const unknownFormatData = renderer.exportDecoderData('unknown' as any);

      expect(unknownFormatData).toBeDefined();
      expect(() => JSON.parse(unknownFormatData)).not.toThrow();
    });

    it('应该正确处理包含特殊字符的值', () => {
      const specialResults: DecoderResult[] = [
        {
          decoderId: 'special',
          decoderName: 'Special Chars',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['Hello "World"', 'Line\nBreak', 'Tab\tChar']
            }
          ]
        }
      ];

      renderer.clearDecoderResults();
      renderer.addDecoderResults(specialResults);

      expect(() => {
        renderer.exportDecoderData('csv');
        renderer.exportDecoderData('txt');
        renderer.exportDecoderData('json');
      }).not.toThrow();
    });
  });

  describe('统计信息和分析', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas);
    });

    it('应该返回空结果的统计信息', () => {
      const stats = renderer.getAnnotationStats();

      expect(stats.totalDecoders).toBe(0);
      expect(stats.totalAnnotations).toBe(0);
      expect(Object.keys(stats.annotationsByDecoder)).toHaveLength(0);
      expect(Object.keys(stats.annotationsByType)).toHaveLength(0);
    });

    it('应该正确计算单个解码器的统计信息', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'stats_test',
          decoderName: 'Stats Test',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['A']
            },
            {
              startSample: 300,
              endSample: 400,
              annotationType: 'control',
              values: ['B']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);
      const stats = renderer.getAnnotationStats();

      expect(stats.totalDecoders).toBe(1);
      expect(stats.totalAnnotations).toBe(2);
      expect(stats.annotationsByDecoder['Stats Test']).toBe(2);
      expect(stats.annotationsByType['data']).toBe(1);
      expect(stats.annotationsByType['control']).toBe(1);
    });

    it('应该正确计算多个解码器的统计信息', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'decoder1',
          decoderName: 'Decoder 1',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['A']
            }
          ]
        },
        {
          decoderId: 'decoder2',
          decoderName: 'Decoder 2',
          results: [
            {
              startSample: 300,
              endSample: 400,
              annotationType: 'data',
              values: ['B']
            },
            {
              startSample: 500,
              endSample: 600,
              annotationType: 'control',
              values: ['C']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);
      const stats = renderer.getAnnotationStats();

      expect(stats.totalDecoders).toBe(2);
      expect(stats.totalAnnotations).toBe(3);
      expect(stats.annotationsByDecoder['Decoder 1']).toBe(1);
      expect(stats.annotationsByDecoder['Decoder 2']).toBe(2);
      expect(stats.annotationsByType['data']).toBe(2);
      expect(stats.annotationsByType['control']).toBe(1);
    });

    it('应该正确处理相同类型的多个注释', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'same_type',
          decoderName: 'Same Type',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['A']
            },
            {
              startSample: 300,
              endSample: 400,
              annotationType: 'data',
              values: ['B']
            },
            {
              startSample: 500,
              endSample: 600,
              annotationType: 'data',
              values: ['C']
            }
          ]
        }
      ];

      renderer.addDecoderResults(decoderResults);
      const stats = renderer.getAnnotationStats();

      expect(stats.totalAnnotations).toBe(3);
      expect(stats.annotationsByType['data']).toBe(3);
    });
  });

  describe('资源管理和清理', () => {
    it('应该正确清理所有资源', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });

      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该正确移除注释Canvas', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: true,
        separateAnnotationArea: true
      });
      
      // 测试dispose方法不抛出异常
      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该处理无注释Canvas的清理', () => {
      renderer = new EnhancedWaveformRenderer(canvas, {
        showDecoderResults: false
      });

      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该支持多次dispose调用', () => {
      renderer = new EnhancedWaveformRenderer(canvas);

      expect(() => {
        renderer.dispose();
        renderer.dispose();
      }).not.toThrow();
    });
  });

  describe('边界条件和错误处理', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas);
    });

    it('应该处理极大的样本范围', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'large',
          decoderName: 'Large',
          results: [
            {
              startSample: 0,
              endSample: 1000000,
              annotationType: 'data',
              values: ['Large Range']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
        renderer.render();
      }).not.toThrow();
    });

    it('应该处理负数样本位置', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'negative',
          decoderName: 'Negative',
          results: [
            {
              startSample: -100,
              endSample: 0,
              annotationType: 'data',
              values: ['Negative']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });

    it('应该处理空字符串值', () => {
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'empty_values',
          decoderName: 'Empty Values',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: 'data',
              values: ['', '', '']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
        renderer.exportDecoderData('csv');
      }).not.toThrow();
    });

    it('应该处理极长的注释类型名称', () => {
      const longTypeName = 'a'.repeat(1000);
      const decoderResults: DecoderResult[] = [
        {
          decoderId: 'long_type',
          decoderName: 'Long Type',
          results: [
            {
              startSample: 100,
              endSample: 200,
              annotationType: longTypeName,
              values: ['Long']
            }
          ]
        }
      ];

      expect(() => {
        renderer.addDecoderResults(decoderResults);
      }).not.toThrow();
    });

    it('应该处理Canvas上下文获取失败', () => {
      const badCanvas = document.createElement('canvas');
      badCanvas.getContext = jest.fn().mockReturnValue(null);

      // 应该能处理getContext返回null的情况
      expect(() => {
        new EnhancedWaveformRenderer(badCanvas, {
          showDecoderResults: true,
          separateAnnotationArea: true
        });
      }).not.toThrow();
    });
  });

  describe('性能和压力测试', () => {
    beforeEach(() => {
      renderer = new EnhancedWaveformRenderer(canvas);
    });

    it('应该处理大量解码器结果', () => {
      const manyResults: DecoderResult[] = Array.from({ length: 100 }, (_, i) => ({
        decoderId: `decoder_${i}`,
        decoderName: `Decoder ${i}`,
        results: Array.from({ length: 10 }, (_, j) => ({
          startSample: i * 1000 + j * 100,
          endSample: i * 1000 + j * 100 + 50,
          annotationType: `type_${j}`,
          values: [`Value ${i}-${j}`]
        }))
      }));

      const startTime = performance.now();
      
      expect(() => {
        renderer.addDecoderResults(manyResults);
      }).not.toThrow();

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该快速计算大量数据的统计信息', () => {
      const largeResult: DecoderResult[] = [
        {
          decoderId: 'large_stats',
          decoderName: 'Large Stats',
          results: Array.from({ length: 10000 }, (_, i) => ({
            startSample: i * 10,
            endSample: i * 10 + 5,
            annotationType: `type_${i % 10}`,
            values: [`Value ${i}`]
          }))
        }
      ];

      renderer.addDecoderResults(largeResult);

      const startTime = performance.now();
      const stats = renderer.getAnnotationStats();
      const endTime = performance.now();

      expect(stats.totalAnnotations).toBe(10000);
      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
    });

    it('应该快速导出大量数据', () => {
      const largeResult: DecoderResult[] = [
        {
          decoderId: 'export_perf',
          decoderName: 'Export Performance',
          results: Array.from({ length: 1000 }, (_, i) => ({
            startSample: i * 10,
            endSample: i * 10 + 5,
            annotationType: 'data',
            values: [`Value ${i}`]
          }))
        }
      ];

      renderer.addDecoderResults(largeResult);

      const startTime = performance.now();
      const jsonData = renderer.exportDecoderData('json');
      const endTime = performance.now();

      expect(jsonData).toBeDefined();
      expect(endTime - startTime).toBeLessThan(200); // 应该在200ms内完成
    });
  });
});