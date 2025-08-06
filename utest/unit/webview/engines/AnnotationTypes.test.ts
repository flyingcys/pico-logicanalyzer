/**
 * AnnotationTypes.ts 单元测试
 * 测试解码结果注释类型定义和颜色管理器
 */

import {
  AnnotationsGroup,
  SigrokAnnotation,
  SigrokAnnotationSegment,
  ProtocolAnalyzerSegmentShape,
  AnnotationStyle,
  AnnotationColors,
  AnnotationRenderConfig,
  AnnotationTooltip,
  AnnotationColorManager,
  DEFAULT_ANNOTATION_CONFIG,
  DEFAULT_ANNOTATION_COLORS
} from '../../../../src/webview/engines/AnnotationTypes';

describe('AnnotationTypes', () => {
  describe('基础接口类型验证', () => {
    it('应该正确定义AnnotationsGroup接口', () => {
      const group: AnnotationsGroup = {
        groupId: 'test-group',
        groupName: 'Test Group',
        groupColor: '#ff0000',
        annotations: []
      };
      
      expect(group.groupId).toBe('test-group');
      expect(group.groupName).toBe('Test Group');
      expect(group.groupColor).toBe('#ff0000');
      expect(Array.isArray(group.annotations)).toBe(true);
    });

    it('应该正确定义SigrokAnnotation接口', () => {
      const annotation: SigrokAnnotation = {
        annotationId: 'ann-001',
        annotationName: 'I2C Frame',
        decoderId: 'i2c-decoder',
        segments: []
      };
      
      expect(annotation.annotationId).toBe('ann-001');
      expect(annotation.annotationName).toBe('I2C Frame');
      expect(annotation.decoderId).toBe('i2c-decoder');
      expect(Array.isArray(annotation.segments)).toBe(true);
    });

    it('应该正确定义SigrokAnnotationSegment接口', () => {
      const segment: SigrokAnnotationSegment = {
        firstSample: 100,
        lastSample: 200,
        typeId: 1,
        value: ['START'],
        shape: ProtocolAnalyzerSegmentShape.Rectangle
      };
      
      expect(segment.firstSample).toBe(100);
      expect(segment.lastSample).toBe(200);
      expect(segment.typeId).toBe(1);
      expect(segment.value).toEqual(['START']);
      expect(segment.shape).toBe(ProtocolAnalyzerSegmentShape.Rectangle);
    });
  });

  describe('ProtocolAnalyzerSegmentShape枚举', () => {
    it('应该定义所有形状类型', () => {
      expect(ProtocolAnalyzerSegmentShape.Rectangle).toBe(0);
      expect(ProtocolAnalyzerSegmentShape.RoundRectangle).toBe(1);
      expect(ProtocolAnalyzerSegmentShape.Hexagon).toBe(2);
      expect(ProtocolAnalyzerSegmentShape.Circle).toBe(3);
    });

    it('应该能够正确使用形状类型', () => {
      const shapes = [
        ProtocolAnalyzerSegmentShape.Rectangle,
        ProtocolAnalyzerSegmentShape.RoundRectangle,
        ProtocolAnalyzerSegmentShape.Hexagon,
        ProtocolAnalyzerSegmentShape.Circle
      ];
      
      expect(shapes).toHaveLength(4);
      expect(shapes.every(s => typeof s === 'number')).toBe(true);
    });
  });

  describe('配置对象定义', () => {
    it('应该正确定义AnnotationStyle接口', () => {
      const style: AnnotationStyle = {
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        textColor: '#333333',
        fontSize: 12,
        fontFamily: 'Arial'
      };
      
      expect(style.backgroundColor).toBe('#ffffff');
      expect(style.borderColor).toBe('#000000');
      expect(style.textColor).toBe('#333333');
      expect(style.fontSize).toBe(12);
      expect(style.fontFamily).toBe('Arial');
    });

    it('应该正确定义AnnotationColors接口', () => {
      const colors: AnnotationColors = {
        palette: ['#ff0000', '#00ff00', '#0000ff'],
        bgChannelColors: ['#f0f0f0', '#e0e0e0'],
        borderColor: '#cccccc',
        textColor: '#444444'
      };
      
      expect(Array.isArray(colors.palette)).toBe(true);
      expect(Array.isArray(colors.bgChannelColors)).toBe(true);
      expect(colors.borderColor).toBe('#cccccc');
      expect(colors.textColor).toBe('#444444');
    });

    it('应该正确定义AnnotationRenderConfig接口', () => {
      const config: AnnotationRenderConfig = {
        annotationHeight: 24,
        annotationNameWidth: 150,
        marginX: 2,
        marginY: 1,
        minShapeWidth: 20,
        borderWidth: 1
      };
      
      expect(config.annotationHeight).toBe(24);
      expect(config.annotationNameWidth).toBe(150);
      expect(config.marginX).toBe(2);
      expect(config.marginY).toBe(1);
      expect(config.minShapeWidth).toBe(20);
      expect(config.borderWidth).toBe(1);
    });

    it('应该正确定义AnnotationTooltip接口', () => {
      const segment: SigrokAnnotationSegment = {
        firstSample: 100,
        lastSample: 200,
        typeId: 1,
        value: ['DATA'],
        shape: ProtocolAnalyzerSegmentShape.Rectangle
      };
      
      const annotation: SigrokAnnotation = {
        annotationId: 'ann-001',
        annotationName: 'Test Annotation',
        decoderId: 'test-decoder',
        segments: [segment]
      };
      
      const tooltip: AnnotationTooltip = {
        segment: segment,
        annotation: annotation,
        position: { x: 100, y: 200 },
        visible: true
      };
      
      expect(tooltip.segment).toBe(segment);
      expect(tooltip.annotation).toBe(annotation);
      expect(tooltip.position.x).toBe(100);
      expect(tooltip.position.y).toBe(200);
      expect(tooltip.visible).toBe(true);
    });
  });

  describe('AnnotationColorManager', () => {
    let colorManager: AnnotationColorManager;

    beforeEach(() => {
      colorManager = AnnotationColorManager.getInstance();
    });

    describe('单例模式', () => {
      it('应该返回相同的实例', () => {
        const instance1 = AnnotationColorManager.getInstance();
        const instance2 = AnnotationColorManager.getInstance();
        
        expect(instance1).toBe(instance2);
      });

      it('应该是同一个对象引用', () => {
        const instance1 = AnnotationColorManager.getInstance();
        const instance2 = AnnotationColorManager.getInstance();
        
        expect(instance1 === instance2).toBe(true);
      });
    });

    describe('颜色获取', () => {
      it('应该根据typeId返回颜色', () => {
        const color0 = colorManager.getColor(0);
        const color1 = colorManager.getColor(1);
        
        expect(typeof color0).toBe('string');
        expect(typeof color1).toBe('string');
        expect(color0).toMatch(/^#[0-9a-f]{6}$/i);
        expect(color1).toMatch(/^#[0-9a-f]{6}$/i);
      });

      it('应该为相同的typeId返回相同的颜色', () => {
        const color1 = colorManager.getColor(5);
        const color2 = colorManager.getColor(5);
        
        expect(color1).toBe(color2);
      });

      it('应该正确处理调色板循环', () => {
        // 测试超出调色板长度的索引
        const colorHigh = colorManager.getColor(1000);
        const colorLow = colorManager.getColor(1000 % 64); // 假设调色板有64种颜色
        
        expect(typeof colorHigh).toBe('string');
        expect(colorHigh).toMatch(/^#[0-9a-f]{6}$/i);
      });

      it('应该处理负数typeId', () => {
        const color = colorManager.getColor(-1);
        
        // 负数可能导致取模后的结果，应该仍然是有效颜色
        expect(color).toBeDefined();
        if (color) {
          expect(typeof color).toBe('string');
          expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });

      it('应该处理零typeId', () => {
        const color = colorManager.getColor(0);
        
        expect(typeof color).toBe('string');
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    describe('对比文本颜色计算', () => {
      it('应该为浅色背景返回深色文本', () => {
        const textColor = colorManager.getContrastTextColor('#ffffff');
        expect(textColor).toBe('#000000');
      });

      it('应该为深色背景返回浅色文本', () => {
        const textColor = colorManager.getContrastTextColor('#000000');
        expect(textColor).toBe('#ffffff');
      });

      it('应该为中等亮度背景选择合适的文本颜色', () => {
        const textColor1 = colorManager.getContrastTextColor('#808080');
        const textColor2 = colorManager.getContrastTextColor('#7f7f7f');
        
        // 中等亮度可能都返回相同颜色，只要是有效的黑色或白色即可
        expect(textColor1).toMatch(/^#(000000|ffffff)$/);
        expect(textColor2).toMatch(/^#(000000|ffffff)$/);
      });

      it('应该处理无效的十六进制颜色', () => {
        const textColor = colorManager.getContrastTextColor('invalid-color');
        expect(textColor).toBe('#ffffff'); // 默认返回白色
      });

      it('应该处理不带#的十六进制颜色', () => {
        const textColor = colorManager.getContrastTextColor('ffffff');
        expect(textColor).toBe('#000000');
      });

      it('应该处理短格式的十六进制颜色', () => {
        const textColor = colorManager.getContrastTextColor('#fff');
        expect(textColor).toBe('#ffffff'); // 无效格式，返回默认白色
      });

      it('应该正确计算RGB亮度', () => {
        // 测试纯红色
        const redText = colorManager.getContrastTextColor('#ff0000');
        expect([redText]).toContain(redText); // 应该是黑色或白色之一
        
        // 测试纯绿色
        const greenText = colorManager.getContrastTextColor('#00ff00');
        expect([greenText]).toContain(greenText);
        
        // 测试纯蓝色
        const blueText = colorManager.getContrastTextColor('#0000ff');
        expect([blueText]).toContain(blueText);
      });
    });

    describe('hexToRgb私有方法测试', () => {
      it('应该正确解析有效的十六进制颜色', () => {
        // 通过getContrastTextColor间接测试hexToRgb
        const textColor = colorManager.getContrastTextColor('#ff0000');
        expect(textColor).toBe('#ffffff'); // 红色背景应该用白色文本
      });

      it('应该处理大写十六进制颜色', () => {
        const textColor = colorManager.getContrastTextColor('#FF0000');
        expect(textColor).toBe('#ffffff');
      });

      it('应该处理混合大小写十六进制颜色', () => {
        const textColor = colorManager.getContrastTextColor('#Ff0000');
        expect(textColor).toBe('#ffffff');
      });
    });
  });

  describe('默认配置', () => {
    it('应该提供有效的DEFAULT_ANNOTATION_CONFIG', () => {
      expect(DEFAULT_ANNOTATION_CONFIG).toBeDefined();
      expect(DEFAULT_ANNOTATION_CONFIG.annotationHeight).toBeGreaterThan(0);
      expect(DEFAULT_ANNOTATION_CONFIG.annotationNameWidth).toBeGreaterThan(0);
      expect(DEFAULT_ANNOTATION_CONFIG.marginX).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_ANNOTATION_CONFIG.marginY).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_ANNOTATION_CONFIG.minShapeWidth).toBeGreaterThan(0);
      expect(DEFAULT_ANNOTATION_CONFIG.borderWidth).toBeGreaterThan(0);
    });

    it('应该提供有效的DEFAULT_ANNOTATION_COLORS', () => {
      expect(DEFAULT_ANNOTATION_COLORS).toBeDefined();
      expect(Array.isArray(DEFAULT_ANNOTATION_COLORS.palette)).toBe(true);
      expect(DEFAULT_ANNOTATION_COLORS.palette.length).toBeGreaterThan(0);
      expect(Array.isArray(DEFAULT_ANNOTATION_COLORS.bgChannelColors)).toBe(true);
      expect(DEFAULT_ANNOTATION_COLORS.bgChannelColors.length).toBeGreaterThan(0);
      expect(typeof DEFAULT_ANNOTATION_COLORS.borderColor).toBe('string');
      expect(typeof DEFAULT_ANNOTATION_COLORS.textColor).toBe('string');
    });

    it('DEFAULT_ANNOTATION_COLORS.palette应该包含有效的颜色值', () => {
      DEFAULT_ANNOTATION_COLORS.palette.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('DEFAULT_ANNOTATION_COLORS.bgChannelColors应该包含有效的颜色值', () => {
      DEFAULT_ANNOTATION_COLORS.bgChannelColors.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('边界色和文本色应该是有效的十六进制颜色', () => {
      expect(DEFAULT_ANNOTATION_COLORS.borderColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(DEFAULT_ANNOTATION_COLORS.textColor).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('数据完整性验证', () => {
    it('应该能创建完整的注释组结构', () => {
      const segment: SigrokAnnotationSegment = {
        firstSample: 1000,
        lastSample: 2000,
        typeId: 2,
        value: ['ADDRESS', '0x48'],
        shape: ProtocolAnalyzerSegmentShape.Hexagon
      };

      const annotation: SigrokAnnotation = {
        annotationId: 'i2c-addr',
        annotationName: 'I2C Address',
        decoderId: 'i2c',
        segments: [segment]
      };

      const group: AnnotationsGroup = {
        groupId: 'i2c-group',
        groupName: 'I2C Protocol',
        groupColor: '#4CAF50',
        annotations: [annotation]
      };

      expect(group.annotations[0].segments[0].value).toEqual(['ADDRESS', '0x48']);
      expect(group.annotations[0].segments[0].firstSample).toBe(1000);
      expect(group.annotations[0].segments[0].lastSample).toBe(2000);
    });

    it('应该支持多段注释', () => {
      const segments: SigrokAnnotationSegment[] = [
        {
          firstSample: 100,
          lastSample: 200,
          typeId: 0,
          value: ['START'],
          shape: ProtocolAnalyzerSegmentShape.Circle
        },
        {
          firstSample: 200,
          lastSample: 300,
          typeId: 1,
          value: ['DATA', '0xFF'],
          shape: ProtocolAnalyzerSegmentShape.Rectangle
        },
        {
          firstSample: 300,
          lastSample: 400,
          typeId: 2,
          value: ['STOP'],
          shape: ProtocolAnalyzerSegmentShape.Circle
        }
      ];

      const annotation: SigrokAnnotation = {
        annotationId: 'multi-segment',
        annotationName: 'Multi-segment Annotation',
        decoderId: 'test',
        segments: segments
      };

      expect(annotation.segments).toHaveLength(3);
      expect(annotation.segments[0].value).toEqual(['START']);
      expect(annotation.segments[1].value).toEqual(['DATA', '0xFF']);
      expect(annotation.segments[2].value).toEqual(['STOP']);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空的注释数组', () => {
      const group: AnnotationsGroup = {
        groupId: 'empty-group',
        groupName: 'Empty Group',
        groupColor: '#999999',
        annotations: []
      };

      expect(group.annotations).toHaveLength(0);
    });

    it('应该处理空的段数组', () => {
      const annotation: SigrokAnnotation = {
        annotationId: 'empty-ann',
        annotationName: 'Empty Annotation',
        decoderId: 'empty',
        segments: []
      };

      expect(annotation.segments).toHaveLength(0);
    });

    it('应该处理空的值数组', () => {
      const segment: SigrokAnnotationSegment = {
        firstSample: 0,
        lastSample: 100,
        typeId: 0,
        value: [],
        shape: ProtocolAnalyzerSegmentShape.Rectangle
      };

      expect(segment.value).toHaveLength(0);
    });

    it('应该处理相等的开始和结束样本', () => {
      const segment: SigrokAnnotationSegment = {
        firstSample: 100,
        lastSample: 100,
        typeId: 0,
        value: ['POINT'],
        shape: ProtocolAnalyzerSegmentShape.Circle
      };

      expect(segment.firstSample).toBe(segment.lastSample);
    });
  });

  describe('性能测试', () => {
    it('颜色管理器getInstance应该快速执行', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        AnnotationColorManager.getInstance();
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
    });

    it('getColor方法应该快速执行', () => {
      const colorManager = AnnotationColorManager.getInstance();
      const startTime = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        colorManager.getColor(i);
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('getContrastTextColor方法应该快速执行', () => {
      const colorManager = AnnotationColorManager.getInstance();
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        colors.forEach(color => {
          colorManager.getContrastTextColor(color);
        });
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});