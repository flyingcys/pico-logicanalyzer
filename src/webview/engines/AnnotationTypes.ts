/**
 * 解码结果注释类型定义
 * 基于原版 AnnotationViewer.axaml.cs 的完整移植
 */

export interface AnnotationsGroup {
  groupId: string;
  groupName: string;
  groupColor: string;
  annotations: SigrokAnnotation[];
}

export interface SigrokAnnotation {
  annotationId: string;
  annotationName: string;
  decoderId: string;
  segments: SigrokAnnotationSegment[];
}

export interface SigrokAnnotationSegment {
  firstSample: number;
  lastSample: number;
  typeId: number;
  value: string[];
  shape: ProtocolAnalyzerSegmentShape;
}

export enum ProtocolAnalyzerSegmentShape {
  Rectangle = 0,
  RoundRectangle = 1,
  Hexagon = 2,
  Circle = 3
}

// 基于原版的颜色和样式配置
export interface AnnotationStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
}

export interface AnnotationColors {
  palette: string[];
  bgChannelColors: string[];
  borderColor: string;
  textColor: string;
}

// 渲染配置
export interface AnnotationRenderConfig {
  annotationHeight: number;
  annotationNameWidth: number;
  marginX: number;
  marginY: number;
  minShapeWidth: number;
  borderWidth: number;
}

// 工具提示信息
export interface AnnotationTooltip {
  segment: SigrokAnnotationSegment;
  annotation: SigrokAnnotation;
  position: { x: number; y: number };
  visible: boolean;
}

export class AnnotationColorManager {
  private static instance: AnnotationColorManager;

  // 基于原版的64色调色板
  private readonly colorPalette = [
    '#ff7333', '#33ff57', '#3357ff', '#ff33a1', '#ffbd33', '#33fff6',
    '#bd33ff', '#57ff33', '#5733ff', '#33ffbd', '#ff33bd', '#ff5733',
    '#33ff33', '#3333ff', '#ff3333', '#ffff33', '#ff33ff', '#33ffff',
    '#996633', '#669933', '#336699', '#993366', '#669966', '#663399',
    '#cc6633', '#66cc33', '#3366cc', '#cc3366', '#66cc66', '#6633cc',
    '#ff9933', '#99ff33', '#3399ff', '#ff3399', '#99ff99', '#9933ff',
    '#ffcc33', '#ccff33', '#33ccff', '#ff33cc', '#ccffcc', '#cc33ff',
    '#ff6666', '#66ff66', '#6666ff', '#ffff66', '#ff66ff', '#66ffff',
    '#cc9999', '#99cc99', '#9999cc', '#cccc99', '#cc99cc', '#99cccc',
    '#ffcccc', '#ccffcc', '#ccccff', '#ffffcc', '#ffccff', '#ccffff',
    '#ff0066', '#66ff00', '#0066ff', '#ff6600', '#66ff66', '#6600ff',
    '#ff3300', '#33ff00', '#0033ff', '#ff0033', '#33ff33', '#3300ff'
  ];

  private constructor() {}

  static getInstance(): AnnotationColorManager {
    if (!AnnotationColorManager.instance) {
      AnnotationColorManager.instance = new AnnotationColorManager();
    }
    return AnnotationColorManager.instance;
  }

  /**
   * 根据类型ID获取颜色
   */
  getColor(typeId: number): string {
    return this.colorPalette[typeId % this.colorPalette.length];
  }

  /**
   * 根据背景颜色计算最佳对比文本颜色
   */
  getContrastTextColor(backgroundColor: string): string {
    // 简单的对比度计算
    const rgb = this.hexToRgb(backgroundColor);
    if (!rgb) return '#ffffff';

    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  /**
   * 十六进制颜色转RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
}

// 默认配置
export const DEFAULT_ANNOTATION_CONFIG: AnnotationRenderConfig = {
  annotationHeight: 24,
  annotationNameWidth: 150,
  marginX: 2,
  marginY: 1,
  minShapeWidth: 20,
  borderWidth: 1
};

export const DEFAULT_ANNOTATION_COLORS: AnnotationColors = {
  palette: AnnotationColorManager.getInstance()['colorPalette'],
  bgChannelColors: ['#242424', '#1c1c1c'],
  borderColor: '#000000',
  textColor: '#ffffff'
};
