/**
 * MarkerTools 单元测试
 * 测试可拖拽标记系统的完整功能
 */

import { MarkerTools, Marker, MarkerPair, MeasurementResult, MarkerConfig } from '../../../../src/webview/engines/MarkerTools';
import { AnalyzerChannel } from '../../../../src/models/CaptureModels';

// DOM事件模拟
class MockMouseEvent extends Event {
  clientX: number;
  clientY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: jest.Mock;

  constructor(type: string, eventInitDict?: {
    clientX?: number;
    clientY?: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
  }) {
    super(type);
    this.clientX = eventInitDict?.clientX || 0;
    this.clientY = eventInitDict?.clientY || 0;
    this.ctrlKey = eventInitDict?.ctrlKey || false;
    this.metaKey = eventInitDict?.metaKey || false;
    this.preventDefault = jest.fn();
  }
}

// 全局设置MouseEvent
(global as any).MouseEvent = MockMouseEvent;

// Canvas Mock
interface MockCanvasContext2D {
  clearRect: jest.Mock;
  fillRect: jest.Mock;
  strokeRect: jest.Mock;
  beginPath: jest.Mock;
  moveTo: jest.Mock;
  lineTo: jest.Mock;
  stroke: jest.Mock;
  fill: jest.Mock;
  fillText: jest.Mock;
  measureText: jest.Mock;
  save: jest.Mock;
  restore: jest.Mock;
  setLineDash: jest.Mock;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

interface MockCanvas extends Partial<HTMLCanvasElement> {
  getContext: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  getBoundingClientRect: jest.Mock;
  width: number;
  height: number;
  style: { cursor: string };
}

// 创建模拟Canvas
function createMockCanvas(): MockCanvas {
  const mockContext: MockCanvasContext2D = {
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 50 }),
    save: jest.fn(),
    restore: jest.fn(),
    setLineDash: jest.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  };

  const mockCanvas: MockCanvas = {
    getContext: jest.fn().mockReturnValue(mockContext),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getBoundingClientRect: jest.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 400,
      right: 800,
      bottom: 400
    }),
    width: 800,
    height: 400,
    style: { cursor: 'default' }
  };

  return mockCanvas;
}

// 模拟AnalyzerChannel
function createMockChannel(index: number): AnalyzerChannel {
  return {
    channelIndex: index,
    name: `Channel ${index}`,
    color: '#409eff',
    visible: true
  } as AnalyzerChannel;
}

describe('MarkerTools', () => {
  let markerTools: MarkerTools;
  let mockCanvas: MockCanvas;
  let mockContext: MockCanvasContext2D;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
    mockContext = mockCanvas.getContext('2d') as MockCanvasContext2D;
    markerTools = new MarkerTools(mockCanvas as HTMLCanvasElement);
    
    // 设置采样信息
    const channels = [createMockChannel(0), createMockChannel(1)];
    markerTools.setSampleInfo(1000000, 0, 1000, channels);
  });

  afterEach(() => {
    markerTools.dispose();
    jest.clearAllMocks();
  });

  describe('构造函数和初始化', () => {
    it('应该使用默认配置正确初始化', () => {
      const newMarkerTools = new MarkerTools(mockCanvas as HTMLCanvasElement);
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      newMarkerTools.dispose();
    });

    it('应该接受自定义配置', () => {
      const customConfig: Partial<MarkerConfig> = {
        showLabels: false,
        markerWidth: 3,
        snapToEdge: false
      };
      
      const newMarkerTools = new MarkerTools(mockCanvas as HTMLCanvasElement, customConfig);
      expect(newMarkerTools).toBeDefined();
      newMarkerTools.dispose();
    });

    it('应该正确初始化事件监听器', () => {
      markerTools.initializeEventListeners();
      
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('dblclick', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });
  });

  describe('标记管理', () => {
    it('应该能够添加标记', () => {
      const marker = markerTools.addMarker(500, 'user', '测试标记', '#ff0000');

      expect(marker).toBeDefined();
      expect(marker.sample).toBe(500);
      expect(marker.type).toBe('user');
      expect(marker.name).toBe('测试标记');
      expect(marker.color).toBe('#ff0000');
      expect(marker.visible).toBe(true);
      expect(marker.locked).toBe(false);
      expect(marker.timestamp).toBe(0.0005); // 500/1000000
    });

    it('应该为不同类型标记使用默认颜色', () => {
      const userMarker = markerTools.addMarker(100, 'user');
      const triggerMarker = markerTools.addMarker(200, 'trigger');
      const burstMarker = markerTools.addMarker(300, 'burst');
      const cursorMarker = markerTools.addMarker(400, 'cursor');
      const measurementMarker = markerTools.addMarker(500, 'measurement');

      expect(userMarker.color).toBe('#409eff');
      expect(triggerMarker.color).toBe('#f56c6c');
      expect(burstMarker.color).toBe('#e6a23c');
      expect(cursorMarker.color).toBe('#67c23a');
      expect(measurementMarker.color).toBe('#909399');
    });

    it('应该能够移除标记', () => {
      const marker = markerTools.addMarker(500, 'user');
      const removed = markerTools.removeMarker(marker.id);

      expect(removed).toBe(true);
    });

    it('移除不存在的标记应该返回false', () => {
      const removed = markerTools.removeMarker('non-existent');
      expect(removed).toBe(false);
    });

    it('应该能够更新标记位置', () => {
      const marker = markerTools.addMarker(500, 'user');
      const updated = markerTools.updateMarker(marker.id, 750);

      expect(updated).toBe(true);
      expect(marker.sample).toBe(750);
      expect(marker.timestamp).toBe(0.00075); // 750/1000000
    });

    it('不应该更新锁定的标记', () => {
      const marker = markerTools.addMarker(500, 'user');
      marker.locked = true;
      
      const updated = markerTools.updateMarker(marker.id, 750);
      expect(updated).toBe(false);
      expect(marker.sample).toBe(500); // 位置不变
    });

    it('更新不存在的标记应该返回false', () => {
      const updated = markerTools.updateMarker('non-existent', 750);
      expect(updated).toBe(false);
    });
  });

  describe('标记对管理', () => {
    it('应该能够创建标记对', () => {
      const pair = markerTools.createMarkerPair(100, 500, 'time');

      expect(pair).toBeDefined();
      expect(pair.startMarker.sample).toBe(100);
      expect(pair.endMarker.sample).toBe(500);
      expect(pair.measurementType).toBe('time');
      expect(pair.visible).toBe(true);
    });

    it('创建标记对时应该自动添加开始和结束标记', () => {
      markerTools.createMarkerPair(100, 500);

      // 验证渲染被调用（说明标记被添加了）
      expect(mockContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('测量功能', () => {
    it('应该正确测量时间', () => {
      const pair = markerTools.createMarkerPair(100, 600, 'time');
      const measurement = markerTools.measureMarkerPair(pair.id);

      expect(measurement).toBeDefined();
      expect(measurement!.type).toBe('time');
      expect(measurement!.value).toBe(0.0005); // (600-100)/1000000
      expect(measurement!.unit).toBe('μs');
      expect(measurement!.startSample).toBe(100);
      expect(measurement!.endSample).toBe(600);
    });

    it('应该正确测量频率', () => {
      const pair = markerTools.createMarkerPair(0, 1000, 'frequency');
      const measurement = markerTools.measureMarkerPair(pair.id);

      expect(measurement).toBeDefined();
      expect(measurement!.type).toBe('frequency');
      expect(measurement!.value).toBe(1000); // 1/(1000/1000000) = 1000 Hz
      expect(measurement!.unit).toBe('Hz');
    });

    it('应该正确测量样本数', () => {
      const pair = markerTools.createMarkerPair(100, 600, 'samples');
      const measurement = markerTools.measureMarkerPair(pair.id);

      expect(measurement).toBeDefined();
      expect(measurement!.type).toBe('samples');
      expect(measurement!.value).toBe(500); // 600-100
      expect(measurement!.unit).toBe('samples');
    });

    it('测量不存在的标记对应该返回null', () => {
      const measurement = markerTools.measureMarkerPair('non-existent');
      expect(measurement).toBeNull();
    });

    it('应该正确处理反向标记对（结束样本小于开始样本）', () => {
      const pair = markerTools.createMarkerPair(600, 100, 'time');
      const measurement = markerTools.measureMarkerPair(pair.id);

      expect(measurement).toBeDefined();
      expect(measurement!.startSample).toBe(100); // 应该是较小的值
      expect(measurement!.endSample).toBe(600);   // 应该是较大的值
    });
  });

  describe('采样信息管理', () => {
    it('应该正确设置采样信息', () => {
      const channels = [createMockChannel(0), createMockChannel(1), createMockChannel(2)];
      markerTools.setSampleInfo(2000000, 1000, 2000, channels);

      // 添加标记验证采样率计算
      const marker = markerTools.addMarker(1500, 'user');
      expect(marker.timestamp).toBe(0.00075); // 1500/2000000
    });
  });

  describe('渲染功能', () => {
    it('应该调用render方法', () => {
      markerTools.render();
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 400);
    });

    it('添加标记时应该自动渲染', () => {
      markerTools.addMarker(500, 'user');
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

    it('移除标记时应该自动渲染', () => {
      const marker = markerTools.addMarker(500, 'user');
      jest.clearAllMocks(); // 清除之前的调用记录
      
      markerTools.removeMarker(marker.id);
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

    it('更新标记时应该自动渲染', () => {
      const marker = markerTools.addMarker(500, 'user');
      jest.clearAllMocks();
      
      markerTools.updateMarker(marker.id, 750);
      expect(mockContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('工具方法', () => {
    it('应该正确格式化时间', () => {
      // 测试私有方法的效果通过公共API验证
      const pair = markerTools.createMarkerPair(0, 1000, 'time'); // 1ms
      const measurement = markerTools.measureMarkerPair(pair.id);
      
      expect(measurement!.displayText).toContain('ms');
    });

    it('应该正确格式化频率', () => {
      const pair = markerTools.createMarkerPair(0, 1000000, 'frequency'); // 1Hz
      const measurement = markerTools.measureMarkerPair(pair.id);
      
      expect(measurement!.displayText).toContain('Hz');
    });

    it('应该正确处理不同时间单位', () => {
      // 在1MHz采样率下：
      // 1个样本 = 1μs
      // 1000个样本 = 1ms  
      // 1000000个样本 = 1s

      // 微秒级（1个样本 = 1μs）
      const usPair = markerTools.createMarkerPair(0, 1, 'time');
      const usMeasurement = markerTools.measureMarkerPair(usPair.id);
      expect(usMeasurement!.unit).toBe('μs');

      // 毫秒级（1000个样本 = 1ms）
      const msPair = markerTools.createMarkerPair(0, 1000, 'time');
      const msMeasurement = markerTools.measureMarkerPair(msPair.id);
      expect(msMeasurement!.unit).toBe('ms');

      // 秒级（1000000个样本 = 1s）
      const sPair = markerTools.createMarkerPair(0, 1000000, 'time');
      const sMeasurement = markerTools.measureMarkerPair(sPair.id);
      expect(sMeasurement!.unit).toBe('s');

      // 纳秒级需要更高的采样率才能测试
      // 设置10GHz采样率来测试纳秒级
      markerTools.setSampleInfo(10000000000, 0, 1000, []);
      const nsPair = markerTools.createMarkerPair(0, 1, 'time');
      const nsMeasurement = markerTools.measureMarkerPair(nsPair.id);
      expect(nsMeasurement!.unit).toBe('ns');
    });
  });

  describe('事件系统', () => {
    it('应该能够注册和触发事件监听器', () => {
      const listener = jest.fn();
      markerTools.on('marker-added', listener);

      markerTools.addMarker(500, 'user');
      expect(listener).toHaveBeenCalled();
    });

    it('应该能够移除事件监听器', () => {
      const listener = jest.fn();
      markerTools.on('marker-added', listener);
      markerTools.off('marker-added', listener);

      markerTools.addMarker(500, 'user');
      expect(listener).not.toHaveBeenCalled();
    });

    it('应该支持多个事件监听器', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      markerTools.on('marker-added', listener1);
      markerTools.on('marker-added', listener2);

      markerTools.addMarker(500, 'user');
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('应该触发标记移除事件', () => {
      const listener = jest.fn();
      markerTools.on('marker-removed', listener);

      const marker = markerTools.addMarker(500, 'user');
      jest.clearAllMocks();
      
      markerTools.removeMarker(marker.id);
      expect(listener).toHaveBeenCalledWith(marker);
    });

    it('应该触发标记更新事件', () => {
      const listener = jest.fn();
      markerTools.on('marker-updated', listener);

      const marker = markerTools.addMarker(500, 'user');
      jest.clearAllMocks();
      
      markerTools.updateMarker(marker.id, 750);
      expect(listener).toHaveBeenCalledWith(marker);
    });

    it('应该触发标记对创建事件', () => {
      const listener = jest.fn();
      markerTools.on('marker-pair-created', listener);

      markerTools.createMarkerPair(100, 500);
      expect(listener).toHaveBeenCalled();
    });

    it('应该触发测量完成事件', () => {
      const listener = jest.fn();
      markerTools.on('measurement-completed', listener);

      const pair = markerTools.createMarkerPair(100, 500);
      markerTools.measureMarkerPair(pair.id);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('导入导出功能', () => {
    it('应该能够导出标记数据', () => {
      markerTools.addMarker(100, 'user', '标记1');
      markerTools.addMarker(200, 'trigger', '标记2');
      markerTools.createMarkerPair(300, 400);

      const exported = markerTools.exportMarkers();

      expect(exported).toBeDefined();
      expect(exported.markers).toHaveLength(4); // 2个单独标记 + 2个来自标记对
      expect(exported.markerPairs).toHaveLength(1);
      expect(exported.timestamp).toBeDefined();
    });

    it('应该能够导入标记数据', () => {
      const testData = {
        markers: [
          {
            id: 'test1',
            name: '导入标记1',
            sample: 100,
            timestamp: 0.0001,
            color: '#ff0000',
            type: 'user',
            visible: true,
            locked: false
          },
          {
            id: 'test2',
            name: '导入标记2',
            sample: 200,
            timestamp: 0.0002,
            color: '#00ff00',
            type: 'trigger',
            visible: true,
            locked: false
          }
        ],
        markerPairs: [
          {
            id: 'pair1',
            name: '导入标记对',
            startMarker: {} as Marker,
            endMarker: {} as Marker,
            color: '#0000ff',
            measurementType: 'time',
            visible: true
          }
        ]
      };

      markerTools.importMarkers(testData);

      const exported = markerTools.exportMarkers();
      expect(exported.markers).toHaveLength(2);
      expect(exported.markerPairs).toHaveLength(1);
    });

    it('导入时应该清除现有数据', () => {
      // 先添加一些数据
      markerTools.addMarker(100, 'user');
      markerTools.createMarkerPair(200, 300);

      // 导入新数据
      markerTools.importMarkers({
        markers: [],
        markerPairs: []
      });

      const exported = markerTools.exportMarkers();
      expect(exported.markers).toHaveLength(0);
      expect(exported.markerPairs).toHaveLength(0);
    });

    it('导入空数据应该正常工作', () => {
      markerTools.importMarkers({});
      
      const exported = markerTools.exportMarkers();
      expect(exported.markers).toHaveLength(0);
      expect(exported.markerPairs).toHaveLength(0);
    });
  });

  describe('鼠标事件处理', () => {
    beforeEach(() => {
      markerTools.initializeEventListeners();
    });

    it('应该注册所有必要的鼠标事件监听器', () => {
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('dblclick', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });

    it('Ctrl+点击应该创建新标记', () => {
      const clickEvent = new MouseEvent('click', {
        clientX: 400,
        clientY: 200,
        ctrlKey: true
      });

      // 模拟点击事件处理
      const listeners = mockCanvas.addEventListener.mock.calls;
      const clickListener = listeners.find(call => call[0] === 'click')[1];
      
      clickListener(clickEvent);
      
      // 验证清除画布被调用（说明有渲染发生，即标记被添加）
      expect(mockContext.clearRect).toHaveBeenCalled();
    });

    it('右键菜单应该被阻止默认行为', () => {
      const contextEvent = new MouseEvent('contextmenu', {
        clientX: 400,
        clientY: 200
      });
      contextEvent.preventDefault = jest.fn();

      const listeners = mockCanvas.addEventListener.mock.calls;
      const contextListener = listeners.find(call => call[0] === 'contextmenu')[1];
      
      contextListener(contextEvent);
      
      expect(contextEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理零采样率', () => {
      markerTools.setSampleInfo(0, 0, 1000, []);
      
      const marker = markerTools.addMarker(100, 'user');
      expect(marker.timestamp).toBe(Infinity); // 100/0
    });

    it('应该处理负采样值', () => {
      const marker = markerTools.addMarker(-100, 'user');
      expect(marker.sample).toBe(-100);
      expect(marker.timestamp).toBe(-0.0001); // -100/1000000
    });

    it('应该处理空通道数组', () => {
      markerTools.setSampleInfo(1000000, 0, 1000, []);
      
      const marker = markerTools.addMarker(500, 'user');
      expect(marker).toBeDefined();
    });

    it('频率测量中零周期应该返回0频率', () => {
      const pair = markerTools.createMarkerPair(100, 100, 'frequency'); // 零时间差
      const measurement = markerTools.measureMarkerPair(pair.id);
      
      expect(measurement!.value).toBe(0);
    });

    it('应该处理超大时间值的格式化', () => {
      markerTools.setSampleInfo(1, 0, 1000, []); // 很低的采样率
      const pair = markerTools.createMarkerPair(0, 3600, 'time'); // 3600秒
      const measurement = markerTools.measureMarkerPair(pair.id);
      
      expect(measurement!.unit).toBe('s');
      expect(measurement!.displayText).toContain('s');
    });
  });

  describe('性能和内存管理', () => {
    it('dispose应该清理所有资源', () => {
      markerTools.addMarker(100, 'user');
      markerTools.createMarkerPair(200, 300);
      markerTools.on('test-event', () => {});

      const exported = markerTools.exportMarkers();
      expect(exported.markers.length).toBeGreaterThan(0);

      markerTools.dispose();

      expect(mockCanvas.removeEventListener).toHaveBeenCalledTimes(6);
    });

    it('应该处理大量标记', () => {
      // 添加100个标记
      for (let i = 0; i < 100; i++) {
        markerTools.addMarker(i * 10, 'user', `标记${i}`);
      }

      const exported = markerTools.exportMarkers();
      expect(exported.markers).toHaveLength(100);
    });

    it('应该处理大量标记对', () => {
      // 添加50个标记对
      for (let i = 0; i < 50; i++) {
        markerTools.createMarkerPair(i * 20, i * 20 + 10);
      }

      const exported = markerTools.exportMarkers();
      expect(exported.markerPairs).toHaveLength(50);
      expect(exported.markers).toHaveLength(100); // 每个标记对包含2个标记
    });
  });

  describe('精度和准确性', () => {
    it('应该正确计算测量精度', () => {
      const pair1 = markerTools.createMarkerPair(0, 10, 'time');
      const measurement1 = markerTools.measureMarkerPair(pair1.id);
      
      const pair2 = markerTools.createMarkerPair(0, 1000, 'time');
      const measurement2 = markerTools.measureMarkerPair(pair2.id);

      // 更多样本应该有更高的精度
      expect(measurement2!.accuracy).toBeGreaterThan(measurement1!.accuracy);
    });

    it('精度应该有合理的边界', () => {
      const pair = markerTools.createMarkerPair(0, 2000, 'time');
      const measurement = markerTools.measureMarkerPair(pair.id);
      
      expect(measurement!.accuracy).toBeGreaterThanOrEqual(0.1);
      expect(measurement!.accuracy).toBeLessThanOrEqual(0.95);
    });
  });

  describe('配置管理', () => {
    it('应该使用自定义配置创建MarkerTools', () => {
      const customConfig: Partial<MarkerConfig> = {
        showLabels: false,
        showValues: false,
        markerWidth: 5,
        snapToEdge: false,
        enableDragging: false
      };

      const customMarkerTools = new MarkerTools(mockCanvas as HTMLCanvasElement, customConfig);
      expect(customMarkerTools).toBeDefined();
      
      customMarkerTools.dispose();
    });

    it('部分配置应该与默认配置合并', () => {
      const partialConfig: Partial<MarkerConfig> = {
        markerWidth: 10
      };

      const customMarkerTools = new MarkerTools(mockCanvas as HTMLCanvasElement, partialConfig);
      expect(customMarkerTools).toBeDefined();
      
      customMarkerTools.dispose();
    });
  });
});