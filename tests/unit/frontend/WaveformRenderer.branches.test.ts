/**
 * WaveformRenderer 分支覆盖单元测试
 *
 * 目标：补充 src/frontend/core/engines/WaveformRenderer.ts 的分支覆盖
 * 约束：仅新增本测试文件，不修改任何源码
 */

import { WaveformRenderer, SampleRegion } from '../../../src/frontend/core/engines/WaveformRenderer';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';
import type { WaveformMarker, WaveformSelection } from '../../../src/frontend/core/stores/waveformStore';

// ---- 辅助：构造完整的 canvas / ctx mock ----
function createMockCanvas() {
  // 样式属性用 setter 记录历史，便于断言"是否被设置过某值"
  const history: { strokeStyle: any[]; fillStyle: any[]; lineWidth: any[] } = {
    strokeStyle: [],
    fillStyle: [],
    lineWidth: []
  };
  const ctx: any = {
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    strokeRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    setLineDash: jest.fn(),
    measureText: jest.fn((text: string) => ({ width: text.length * 6 })),
    font: '12px monospace',
    imageSmoothingEnabled: true,
    lineCap: 'butt',
    lineJoin: 'miter'
  };
  let ssVal = '#000000';
  Object.defineProperty(ctx, 'strokeStyle', {
    get: () => ssVal,
    set: (v: any) => {
      ssVal = v;
      history.strokeStyle.push(v);
    },
    configurable: true,
    enumerable: true
  });
  let fsVal = '#000000';
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => fsVal,
    set: (v: any) => {
      fsVal = v;
      history.fillStyle.push(v);
    },
    configurable: true,
    enumerable: true
  });
  let lwVal = 1;
  Object.defineProperty(ctx, 'lineWidth', {
    get: () => lwVal,
    set: (v: any) => {
      lwVal = v;
      history.lineWidth.push(v);
    },
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(ctx, '__history', {
    value: history,
    configurable: true,
    enumerable: false
  });
  const canvas: any = {
    width: 800,
    height: 400,
    getContext: jest.fn(() => ctx),
    getBoundingClientRect: jest.fn(() => ({ width: 800, height: 400, left: 0, top: 0 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    style: { width: '', height: '', minHeight: '' },
    parentElement: { style: { minHeight: '' } }
  };
  return { canvas, ctx };
}

// 清除 ctx 上所有 jest.fn 的调用记录与样式历史，便于精确断言
function resetCtx(ctx: any) {
  for (const key of Object.keys(ctx)) {
    if (jest.isMockFunction(ctx[key])) {
      ctx[key].mockClear();
    }
  }
  if (ctx.__history) {
    ctx.__history.strokeStyle = [];
    ctx.__history.fillStyle = [];
    ctx.__history.lineWidth = [];
  }
}

function makeRegion(first: number, last: number, color = '#ffffff'): SampleRegion {
  return {
    firstSample: first,
    lastSample: last,
    sampleCount: Math.abs(last - first),
    regionName: 'R',
    regionColor: color
  };
}

function makeMarker(sample: number, type: WaveformMarker['type'], visible = true): WaveformMarker {
  return {
    id: `m-${sample}`,
    name: 'M',
    sample,
    type,
    color: '#ffffff',
    visible,
    locked: false
  };
}

describe('WaveformRenderer 分支覆盖测试', () => {
  let renderer: WaveformRenderer;
  let canvas: any;
  let ctx: any;

  beforeEach(() => {
    // window.devicePixelRatio 在 setup.ts 未提供，这里补齐
    (global as any).window.devicePixelRatio = 1;
    // requestAnimationFrame 改为同步执行，便于精确控制 render 触发时机
    (global as any).requestAnimationFrame = jest.fn((cb: Function) => {
      cb();
      return 0;
    });
    // document.getElementById 在 setup.ts 未提供，showTooltip/hideTooltip 依赖它
    (global.document as any).getElementById = jest.fn(() => null);

    const mock = createMockCanvas();
    canvas = mock.canvas;
    ctx = mock.ctx;
    renderer = new WaveformRenderer(canvas);
  });

  // -------------------- 构造与初始化 --------------------
  describe('构造与初始化', () => {
    it('应获取 2D 上下文并保存', () => {
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
      expect((renderer as any).ctx).toBe(ctx);
    });

    it('getContext 返回 null 时抛出错误', () => {
      const badCanvas: any = {
        getContext: jest.fn(() => null),
        getBoundingClientRect: jest.fn(() => ({ width: 800, height: 400, left: 0, top: 0 })),
        addEventListener: jest.fn(),
        style: {}
      };
      expect(() => new WaveformRenderer(badCanvas)).toThrow('无法获取Canvas 2D上下文');
    });

    it('构造时设置高 DPI 与基本渲染参数', () => {
      // dpr=1 -> width/height = rect 值
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(400);
      expect(ctx.scale).toHaveBeenCalledWith(1, 1);
      expect(ctx.imageSmoothingEnabled).toBe(false);
      expect(ctx.lineCap).toBe('square');
      expect(ctx.lineJoin).toBe('miter');
    });

    it('构造时注册鼠标事件监听', () => {
      expect(canvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('onMouseEnter 为空实现且不抛错', () => {
      expect(() => (renderer as any).onMouseEnter({})).not.toThrow();
    });
  });

  // -------------------- computeIntervals --------------------
  describe('computeIntervals - 间隔计算', () => {
    it('channels 为 null 时 intervals 为空数组', () => {
      renderer.setChannels(null);
      expect((renderer as any).intervals).toEqual([]);
    });

    it('空通道数组时 intervals 为空数组', () => {
      renderer.setChannels([], 1000);
      expect((renderer as any).intervals).toEqual([]);
    });

    it('单通道 samples 为 undefined 时该通道 intervals 为空', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      renderer.setChannels([ch], 1000);
      expect((renderer as any).intervals).toEqual([[]]);
    });

    it('单通道 samples 长度为 0 时该通道 intervals 为空', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(0);
      renderer.setChannels([ch], 1000);
      expect((renderer as any).intervals).toEqual([[]]);
    });

    it('多通道有跳变时正确计算间隔', () => {
      const ch0 = new AnalyzerChannel(0, 'CH0');
      ch0.samples = new Uint8Array([0, 0, 1, 1, 0]);
      const ch1 = new AnalyzerChannel(1, 'CH1');
      ch1.samples = new Uint8Array([1, 0]);
      renderer.setChannels([ch0, ch1], 1000);

      const intervals = (renderer as any).intervals as any[][];
      // ch0: [0,0,1,1,0] -> 3 段
      expect(intervals[0]).toHaveLength(3);
      expect(intervals[0][0]).toMatchObject({ value: false, start: 0, end: 2, duration: 0.002 });
      expect(intervals[0][1]).toMatchObject({ value: true, start: 2, end: 4, duration: 0.002 });
      expect(intervals[0][2]).toMatchObject({ value: false, start: 4, end: 5, duration: 0.001 });
      // ch1: [1,0] -> 2 段
      expect(intervals[1]).toHaveLength(2);
      expect(intervals[1][0]).toMatchObject({ value: true, start: 0, end: 1 });
      expect(intervals[1][1]).toMatchObject({ value: false, start: 1, end: 2 });
    });

    it('全相同样本（无跳变）时只有单个间隔', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([1, 1, 1, 1]);
      renderer.setChannels([ch], 1000);
      const intervals = (renderer as any).intervals as any[][];
      expect(intervals[0]).toHaveLength(1);
      expect(intervals[0][0]).toMatchObject({ value: true, start: 0, end: 4 });
    });

    it('sampleFrequency 为 0 时 duration 为 Infinity（除零）', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([0, 1]);
      renderer.setChannels([ch], 0);
      const intervals = (renderer as any).intervals as any[][];
      expect(intervals[0][0].duration).toBe(Infinity);
    });
  });

  // -------------------- formatTime --------------------
  describe('formatTime - 时间格式化', () => {
    const fmt = (s: number) => (renderer as any).formatTime(s);

    it('小于 1e-6 秒显示为 ns', () => {
      expect(fmt(1e-7)).toBe('100.00 ns');
    });

    it('值为 0 时显示为 ns', () => {
      expect(fmt(0)).toBe('0.00 ns');
    });

    it('1e-6 边界（不小于）显示为 µs', () => {
      expect(fmt(1e-6)).toBe('1.00 µs');
    });

    it('小于 1e-3 秒显示为 µs', () => {
      expect(fmt(1e-4)).toBe('100.00 µs');
    });

    it('1e-3 边界（不小于）显示为 ms', () => {
      expect(fmt(1e-3)).toBe('1.00 ms');
    });

    it('小于 1 秒显示为 ms', () => {
      expect(fmt(0.5)).toBe('500.00 ms');
    });

    it('1 秒边界（不小于）显示为 s', () => {
      expect(fmt(1)).toBe('1.00 s');
    });

    it('大于 1 秒显示为 s', () => {
      expect(fmt(2.5)).toBe('2.50 s');
    });
  });

  // -------------------- getChannelColor --------------------
  describe('getChannelColor - 通道颜色', () => {
    const colorOf = (ch: AnalyzerChannel) => (renderer as any).getChannelColor(ch);

    it('channelColor 有值时转换为 rgb', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.channelColor = 0xff0000;
      expect(colorOf(ch)).toBe('rgb(255, 0, 0)');
    });

    it('channelColor 为 0 时仍视为有效颜色（!== null && !== undefined）', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.channelColor = 0;
      expect(colorOf(ch)).toBe('rgb(0, 0, 0)');
    });

    it('channelColor 为 undefined 时使用调色板', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      expect(colorOf(ch)).toBe('#ff7333'); // palette[0]
    });

    it('channelColor 为 null 时使用调色板', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      (ch as any).channelColor = null;
      expect(colorOf(ch)).toBe('#ff7333');
    });

    it('channelNumber 超过 palette 长度时取模', () => {
      const ch12 = new AnalyzerChannel(12, 'CH12'); // 12 % 12 = 0
      expect(colorOf(ch12)).toBe('#ff7333');
      const ch13 = new AnalyzerChannel(13, 'CH13'); // 13 % 12 = 1
      expect(colorOf(ch13)).toBe('#33ff57');
    });
  });

  // -------------------- regions CRUD --------------------
  describe('regions CRUD', () => {
    it('addRegion 添加单个区域', () => {
      const r = makeRegion(0, 10);
      renderer.addRegion(r);
      expect(renderer.regions).toHaveLength(1);
      expect(renderer.regions[0]).toBe(r);
    });

    it('addRegions 批量添加', () => {
      renderer.addRegions([makeRegion(0, 5), makeRegion(6, 10)]);
      expect(renderer.regions).toHaveLength(2);
    });

    it('removeRegion 命中时返回 true 并移除', () => {
      const r = makeRegion(0, 10);
      renderer.addRegion(r);
      expect(renderer.removeRegion(r)).toBe(true);
      expect(renderer.regions).toHaveLength(0);
    });

    it('removeRegion 未命中时返回 false', () => {
      expect(renderer.removeRegion(makeRegion(0, 10))).toBe(false);
    });

    it('clearRegions 清空所有区域', () => {
      renderer.addRegion(makeRegion(0, 10));
      renderer.addRegion(makeRegion(11, 20));
      renderer.clearRegions();
      expect(renderer.regions).toHaveLength(0);
    });
  });

  // -------------------- beginUpdate / endUpdate / invalidateVisual --------------------
  describe('beginUpdate / endUpdate / invalidateVisual', () => {
    it('updating 时 invalidateVisual 不触发 render', () => {
      const spy = jest.spyOn(renderer as any, 'render');
      renderer.beginUpdate();
      renderer.invalidateVisual();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('非 updating 时 invalidateVisual 触发 render', () => {
      const spy = jest.spyOn(renderer as any, 'render');
      renderer.invalidateVisual();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('endUpdate 结束更新并触发 render', () => {
      const spy = jest.spyOn(renderer as any, 'render');
      renderer.beginUpdate();
      renderer.endUpdate();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // -------------------- setUserMarker / setMarkers / setSelection --------------------
  describe('setUserMarker / setMarkers / setSelection', () => {
    it('setUserMarker 赋值', () => {
      renderer.setUserMarker(5);
      expect(renderer.userMarker).toBe(5);
    });

    it('setUserMarker 设为 null', () => {
      renderer.setUserMarker(5);
      renderer.setUserMarker(null);
      expect(renderer.userMarker).toBeNull();
    });

    it('setUserMarker 在 updating 时不触发渲染', () => {
      renderer.beginUpdate();
      const spy = jest.spyOn(renderer as any, 'render');
      renderer.setUserMarker(5);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('setMarkers 深拷贝赋值', () => {
      const markers = [makeMarker(2, 'user')];
      renderer.setMarkers(markers);
      expect(renderer.markers).toHaveLength(1);
      expect(renderer.markers[0]).not.toBe(markers[0]);
      expect(renderer.markers[0].sample).toBe(2);
    });

    it('setSelection 赋值与清空', () => {
      const sel: WaveformSelection = { startSample: 1, endSample: 5 };
      renderer.setSelection(sel);
      expect(renderer.selection).toEqual({ startSample: 1, endSample: 5 });
      expect(renderer.selection).not.toBe(sel); // 拷贝
      renderer.setSelection(null);
      expect(renderer.selection).toBeNull();
    });

    it('setSelection 在 updating 时不触发渲染', () => {
      renderer.beginUpdate();
      const spy = jest.spyOn(renderer as any, 'render');
      renderer.setSelection({ startSample: 1, endSample: 5 });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // -------------------- updateVisibleSamples --------------------
  describe('updateVisibleSamples', () => {
    it('更新 firstSample 与 visibleSamples', () => {
      renderer.updateVisibleSamples(10, 100);
      expect(renderer.firstSample).toBe(10);
      expect(renderer.visibleSamples).toBe(100);
    });

    it('updating 时不触发渲染但仍更新值', () => {
      renderer.beginUpdate();
      const spy = jest.spyOn(renderer as any, 'render');
      renderer.updateVisibleSamples(5, 50);
      expect(renderer.firstSample).toBe(5);
      expect(renderer.visibleSamples).toBe(50);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // -------------------- render 主入口分支 --------------------
  describe('render - 主渲染入口分支', () => {
    it('channels 为 null 时提前返回（不清除画布）', () => {
      renderer.setChannels(null);
      resetCtx(ctx);
      const stats = renderer.render();
      expect(ctx.clearRect).not.toHaveBeenCalled();
      expect(stats).toBeDefined();
    });

    it('channels 为空数组时提前返回', () => {
      renderer.setChannels([], 1000);
      renderer.updateVisibleSamples(0, 10);
      resetCtx(ctx);
      renderer.render();
      expect(ctx.clearRect).not.toHaveBeenCalled();
    });

    it('全部 hidden 时 channelCount=0 提前返回', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([0, 1, 0]);
      ch.hidden = true;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 3);
      resetCtx(ctx);
      renderer.render();
      expect(ctx.clearRect).not.toHaveBeenCalled();
    });

    it('全部空 samples 时 channelCount=0 提前返回', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 3);
      resetCtx(ctx);
      renderer.render();
      expect(ctx.clearRect).not.toHaveBeenCalled();
    });

    it('visibleSamples=0 时提前返回', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([0, 1, 0]);
      renderer.setChannels([ch], 1000);
      renderer.visibleSamples = 0; // 不走 updateVisibleSamples 以避免触发渲染
      resetCtx(ctx);
      renderer.render();
      expect(ctx.clearRect).not.toHaveBeenCalled();
    });

    it('updating=true 时提前返回', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([0, 1, 0]);
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 3);
      renderer.beginUpdate();
      resetCtx(ctx);
      renderer.render();
      expect(ctx.clearRect).not.toHaveBeenCalled();
    });

    it('正常渲染走 renderNormal 并返回统计副本', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([0, 1, 0, 1]);
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 4);
      resetCtx(ctx);
      const stats = renderer.render();
      expect(ctx.clearRect).toHaveBeenCalled();
      expect(stats).toHaveProperty('renderTime');
      expect(stats).toHaveProperty('samplesRendered');
    });
  });

  // -------------------- renderNormal --------------------
  describe('renderNormal', () => {
    it('visibleSamples < 101 时画采样线与虚线', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(50);
      ch.samples[10] = 1;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 50);
      resetCtx(ctx);
      (renderer as any).renderNormal([ch], 400, 80, 800 / 50, 800, 400);
      // sampleLineColor 与 sampleDashColor 都被设置
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('101 <= visibleSamples < 201 时只画采样线（不画虚线）', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(150);
      ch.samples[10] = 1;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 150);
      resetCtx(ctx);
      (renderer as any).renderNormal([ch], 400, 80, 800 / 150, 800, 400);
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('visibleSamples >= 201 时不画采样线', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(300);
      ch.samples[10] = 1;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 300);
      resetCtx(ctx);
      (renderer as any).renderNormal([ch], 400, 80, 800 / 300, 800, 400);
      expect(ctx.stroke).toHaveBeenCalled(); // 通道段仍绘制
    });

    it('preSamples 在可见范围时画触发线', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(20);
      ch.samples[5] = 1;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 20);
      renderer.setPreSamples(3);
      resetCtx(ctx);
      (renderer as any).renderNormal([ch], 400, 80, 800 / 20, 800, 400);
      // triggerLineColor = #ffffff 被设置过
      expect(ctx.__history.strokeStyle).toContain('#ffffff');
    });

    it('bursts 命中可见样本时画突发线（虚线）', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(20);
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 20);
      renderer.setBursts([7]);
      resetCtx(ctx);
      (renderer as any).renderNormal([ch], 400, 80, 800 / 20, 800, 400);
      expect(ctx.setLineDash).toHaveBeenCalledWith([5, 3]);
    });

    it('userMarker 命中可见样本（循环内）时画用户标记线', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(20);
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 20);
      renderer.setUserMarker(4);
      resetCtx(ctx);
      (renderer as any).renderNormal([ch], 400, 80, 800 / 20, 800, 400);
      // userLineColor = #00ffff
      expect(ctx.__history.strokeStyle).toContain('#00ffff');
    });

    it('userMarker 等于 lastSample 时画末尾用户标记线', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array(10);
      ch.samples[3] = 1;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 10); // lastSample = 10
      renderer.setUserMarker(10); // === lastSample
      resetCtx(ctx);
      expect(() => (renderer as any).renderNormal([ch], 400, 80, 80, 800, 400)).not.toThrow();
      expect(ctx.__history.strokeStyle).toContain('#00ffff');
    });

    it('多通道状态变化时渲染段', () => {
      const ch0 = new AnalyzerChannel(0, 'CH0');
      ch0.samples = new Uint8Array([0, 0, 1, 1, 0]);
      const ch1 = new AnalyzerChannel(1, 'CH1');
      ch1.samples = new Uint8Array([1, 1, 0, 0, 1]);
      renderer.setChannels([ch0, ch1], 1000);
      renderer.updateVisibleSamples(0, 5);
      resetCtx(ctx);
      expect(() =>
        (renderer as any).renderNormal([ch0, ch1], 200, 40, 800 / 5, 800, 400)
      ).not.toThrow();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  // -------------------- renderOptimized --------------------
  describe('renderOptimized', () => {
    it('value 跳变时画转换线', () => {
      const data = new Uint8Array(60000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 1000 < 500 ? 0 : 1;
      }
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = data;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 60000);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      resetCtx(ctx);
      (renderer as any).renderOptimized([ch], 400, 80, 800 / 60000, 800, 400);
      logSpy.mockRestore();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('hidden 通道被跳过', () => {
      const ch0 = new AnalyzerChannel(0, 'CH0');
      ch0.samples = new Uint8Array(60000);
      const ch1 = new AnalyzerChannel(1, 'CH1');
      ch1.samples = new Uint8Array(60000);
      ch1.hidden = true; // 直接调用 renderOptimized 传入 hidden 通道覆盖 continue 分支
      renderer.updateVisibleSamples(0, 60000);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      expect(() =>
        (renderer as any).renderOptimized([ch0, ch1], 200, 40, 0.01, 800, 400)
      ).not.toThrow();
      logSpy.mockRestore();
    });

    it('通过 render 入口走优化分支（visibleSamples > 阈值）', () => {
      const data = new Uint8Array(60000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 500 < 250 ? 0 : 1;
      }
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = data;
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 60000);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      resetCtx(ctx);
      renderer.render();
      // renderOptimized 内部 console.log "优化渲染"
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  // -------------------- renderRegions --------------------
  describe('renderRegions', () => {
    it('region 完全在可见范围之外时跳过', () => {
      renderer.firstSample = 100;
      renderer.visibleSamples = 10; // 可见 [100, 109]
      renderer.addRegion(makeRegion(0, 5));
      resetCtx(ctx);
      (renderer as any).renderRegions(1, 400);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('region 部分可见时绘制', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.addRegion(makeRegion(10, 50));
      resetCtx(ctx);
      (renderer as any).renderRegions(1, 400);
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('firstSample > lastSample 时自动交换并绘制', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.addRegion(makeRegion(50, 10)); // 反序
      resetCtx(ctx);
      (renderer as any).renderRegions(1, 400);
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  // -------------------- renderSelection --------------------
  describe('renderSelection', () => {
    it('selection 为 null 时直接返回', () => {
      renderer.setSelection(null);
      resetCtx(ctx);
      (renderer as any).renderSelection(1, 400);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('selection 不可见时返回', () => {
      renderer.firstSample = 100;
      renderer.visibleSamples = 10;
      renderer.setSelection({ startSample: 0, endSample: 5 });
      resetCtx(ctx);
      (renderer as any).renderSelection(1, 400);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('selection 可见时绘制填充与边框', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.setSelection({ startSample: 10, endSample: 50 });
      resetCtx(ctx);
      (renderer as any).renderSelection(1, 400);
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.strokeRect).toHaveBeenCalled();
      expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3]);
    });

    it('selection startSample > endSample 时交换', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.setSelection({ startSample: 50, endSample: 10 });
      resetCtx(ctx);
      (renderer as any).renderSelection(1, 400);
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  // -------------------- renderInteractionMarkers --------------------
  describe('renderInteractionMarkers', () => {
    it('marker.visible=false 时跳过', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.setMarkers([makeMarker(5, 'user', false)]);
      resetCtx(ctx);
      (renderer as any).renderInteractionMarkers(400, 1);
      expect(ctx.stroke).not.toHaveBeenCalled();
    });

    it('marker 超出可视范围（左侧）时跳过', () => {
      renderer.firstSample = 10;
      renderer.visibleSamples = 100; // [10, 109]
      renderer.setMarkers([makeMarker(5, 'user', true)]);
      resetCtx(ctx);
      (renderer as any).renderInteractionMarkers(400, 1);
      expect(ctx.stroke).not.toHaveBeenCalled();
    });

    it('marker 超出可视范围（右侧）时跳过', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100; // [0, 99]
      renderer.setMarkers([makeMarker(200, 'user', true)]);
      resetCtx(ctx);
      (renderer as any).renderInteractionMarkers(400, 1);
      expect(ctx.stroke).not.toHaveBeenCalled();
    });

    it('user 类型 marker 使用 [5,3] 虚线与 1.5 线宽', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.setMarkers([makeMarker(50, 'user', true)]);
      resetCtx(ctx);
      (renderer as any).renderInteractionMarkers(400, 1);
      expect(ctx.lineWidth).toBe(1.5);
      expect(ctx.setLineDash).toHaveBeenCalledWith([5, 3]);
      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('trigger 类型 marker 使用实线与 2 线宽', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.setMarkers([makeMarker(50, 'trigger', true)]);
      resetCtx(ctx);
      (renderer as any).renderInteractionMarkers(400, 1);
      expect(ctx.lineWidth).toBe(2);
      expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    });

    it('burst 类型 marker 使用 [2,4] 短虚线', () => {
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      renderer.setMarkers([makeMarker(50, 'burst', true)]);
      resetCtx(ctx);
      (renderer as any).renderInteractionMarkers(400, 1);
      expect(ctx.setLineDash).toHaveBeenCalledWith([2, 4]);
    });
  });

  // -------------------- renderTimeAxis --------------------
  describe('renderTimeAxis', () => {
    it('sampleFrequency=0 时提前返回', () => {
      renderer.setSampleFrequency(0);
      renderer.visibleSamples = 100;
      resetCtx(ctx);
      (renderer as any).renderTimeAxis(800, 400, 200);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('visibleSamples=0 时提前返回', () => {
      renderer.setSampleFrequency(1000);
      renderer.visibleSamples = 0;
      resetCtx(ctx);
      (renderer as any).renderTimeAxis(800, 400, 200);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('正常绘制时间刻度与标签', () => {
      renderer.setSampleFrequency(1000);
      renderer.firstSample = 0;
      renderer.visibleSamples = 100;
      resetCtx(ctx);
      (renderer as any).renderTimeAxis(800, 400, 200);
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.measureText).toHaveBeenCalled();
    });
  });

  // -------------------- renderBorders --------------------
  describe('renderBorders', () => {
    it('ctx 为 null 时直接返回（防御性分支）', () => {
      const origCtx = (renderer as any).ctx;
      (renderer as any).ctx = null;
      expect(() => (renderer as any).renderBorders(1, 400)).not.toThrow();
      (renderer as any).ctx = origCtx;
    });

    it('channelCount=1 时只画外边框', () => {
      resetCtx(ctx);
      (renderer as any).renderBorders(1, 400);
      expect(ctx.strokeRect).toHaveBeenCalled();
    });

    it('channelCount>1 时画外边框与通道分隔线', () => {
      resetCtx(ctx);
      (renderer as any).renderBorders(3, 400);
      // 外边框 1 次 + 分隔线 (channelCount-1) 次
      expect(ctx.strokeRect.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // -------------------- 其他公共方法 --------------------
  describe('其他公共方法', () => {
    it('setIntervals 设置间隔数据', () => {
      const intervals = [[{ value: false, start: 0, end: 2, duration: 0.002 }]];
      renderer.setIntervals(intervals as any);
      expect((renderer as any).intervals).toBe(intervals);
    });

    it('setSampleFrequency 更新频率并重算间隔', () => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([0, 1]);
      renderer.setChannels([ch], 0);
      renderer.setSampleFrequency(1000);
      expect(renderer.getSampleFrequency()).toBe(1000);
      expect((renderer as any).intervals[0][0].duration).toBe(0.001);
    });

    it('getChannelCount 反映通道数量', () => {
      expect(renderer.getChannelCount()).toBe(0);
      renderer.setChannels([new AnalyzerChannel(0, 'CH0'), new AnalyzerChannel(1, 'CH1')], 1000);
      expect(renderer.getChannelCount()).toBe(2);
    });

    it('updateColors 合并更新颜色配置', () => {
      renderer.updateColors({ textColor: '#abcdef', errorColor: '#123456' });
      const colors = (renderer as any).colors;
      expect(colors.textColor).toBe('#abcdef');
      expect(colors.errorColor).toBe('#123456');
      // 未传入的保持不变
      expect(colors.gridLineColor).toBe('#333333');
    });

    it('setBursts 设置突发数据', () => {
      renderer.setBursts([1, 2, 3]);
      expect(renderer.bursts).toEqual([1, 2, 3]);
    });

    it('setBursts 设为 null', () => {
      renderer.setBursts([1]);
      renderer.setBursts(null);
      expect(renderer.bursts).toBeNull();
    });

    it('setPreSamples 设置触发前样本数', () => {
      renderer.setPreSamples(100);
      expect(renderer.preSamples).toBe(100);
    });

    it('getRenderStats 返回统计副本', () => {
      const s1 = renderer.getRenderStats();
      const s2 = renderer.getRenderStats();
      expect(s1).not.toBe(s2);
      expect(s1).toEqual(s2);
      expect(s1).toHaveProperty('renderTime');
      expect(s1).toHaveProperty('fps');
    });

    it('resize 重新设置 canvas 并触发渲染', () => {
      const before = ctx.scale.mock.calls.length;
      renderer.resize();
      expect(ctx.scale.mock.calls.length).toBeGreaterThan(before);
    });

    it('dispose 移除事件监听并清空数据', () => {
      renderer.setChannels([new AnalyzerChannel(0, 'CH0')], 1000);
      renderer.addRegion(makeRegion(0, 10));
      renderer.setMarkers([makeMarker(1, 'user')]);
      renderer.setSelection({ startSample: 0, endSample: 5 });
      renderer.dispose();
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      expect((renderer as any).channels).toBeNull();
      expect((renderer as any).intervals).toEqual([]);
      expect(renderer.regions).toEqual([]);
      expect(renderer.markers).toEqual([]);
      expect(renderer.selection).toBeNull();
    });
  });

  // -------------------- onMouseMove --------------------
  describe('onMouseMove', () => {
    beforeEach(() => {
      const ch = new AnalyzerChannel(0, 'CH0');
      ch.samples = new Uint8Array([0, 0, 1, 1, 0, 0, 1, 1, 0, 0]);
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 10);
      (global.document as any).getElementById = jest.fn(() => null);
      // 显式提供 createElement mock（返回完整可写对象），避免依赖全局 spy
      (global.document as any).createElement = jest.fn(() => ({
        style: {},
        id: '',
        textContent: '',
        setAttribute: jest.fn()
      }));
    });

    it('intervals 为空时提前返回', () => {
      renderer.setChannels(null);
      (renderer as any).onMouseMove({ clientX: 100, clientY: 10 });
      expect((global.document as any).createElement).not.toHaveBeenCalled();
    });

    it('curChan 越界时返回（不显示 tooltip）', () => {
      // rect height=400, visibleChannels.length=1 -> curChan=floor(450/400)=1 >= 1
      (renderer as any).onMouseMove({ clientX: 100, clientY: 450 });
      expect((global.document as any).createElement).not.toHaveBeenCalled();
    });

    it('命中 interval 时显示 tooltip', () => {
      // sampleWidth=800/10=80, curSample=floor(100/80)=1 -> interval{0,2} 命中
      (renderer as any).onMouseMove({ clientX: 100, clientY: 10 });
      expect((global.document as any).createElement).toHaveBeenCalledWith('div');
    });

    it('未命中 interval 时隐藏 tooltip', () => {
      // curSample=floor(800/80)=10, 无 interval.end>10 -> hideTooltip
      const getElementByIdMock = jest.fn(() => null);
      (global.document as any).getElementById = getElementByIdMock;
      (renderer as any).onMouseMove({ clientX: 800, clientY: 10 });
      expect(getElementByIdMock).toHaveBeenCalledWith('waveform-tooltip');
    });
  });

  // -------------------- onMouseLeave --------------------
  describe('onMouseLeave', () => {
    it('调用 hideTooltip', () => {
      const getElementByIdMock = jest.fn(() => null);
      (global.document as any).getElementById = getElementByIdMock;
      (renderer as any).onMouseLeave({});
      expect(getElementByIdMock).toHaveBeenCalledWith('waveform-tooltip');
    });
  });

  // -------------------- showTooltip / hideTooltip --------------------
  describe('showTooltip / hideTooltip', () => {
    beforeEach(() => {
      // 显式提供 createElement 与 body.appendChild mock，避免依赖全局 spy
      (global.document as any).createElement = jest.fn(() => ({
        style: {},
        id: '',
        textContent: '',
        setAttribute: jest.fn()
      }));
      (global.document as any).body.appendChild = jest.fn();
    });

    it('document.body 存在时追加 tooltip', () => {
      (global.document as any).getElementById = jest.fn(() => null);
      (renderer as any).showTooltip('State: High', 10, 20);
      expect((global.document as any).body.appendChild).toHaveBeenCalled();
    });

    it('document.body 不存在时不抛错（走守卫分支）', () => {
      (global.document as any).getElementById = jest.fn(() => null);
      const origBody = (global.document as any).body;
      (global.document as any).body = null;
      expect(() => (renderer as any).showTooltip('test', 10, 20)).not.toThrow();
      (global.document as any).body = origBody;
    });

    it('已存在 tooltip 时先移除旧 tooltip', () => {
      const mockRemove = jest.fn();
      (global.document as any).getElementById = jest.fn(() => ({ remove: mockRemove }));
      (renderer as any).showTooltip('test', 10, 20);
      expect(mockRemove).toHaveBeenCalled();
    });

    it('hideTooltip 移除已存在的 tooltip', () => {
      const mockRemove = jest.fn();
      (global.document as any).getElementById = jest.fn(() => ({ remove: mockRemove }));
      (renderer as any).hideTooltip();
      expect(mockRemove).toHaveBeenCalled();
    });

    it('hideTooltip 无 tooltip 时不抛错', () => {
      (global.document as any).getElementById = jest.fn(() => null);
      expect(() => (renderer as any).hideTooltip()).not.toThrow();
    });
  });

  // -------------------- updateFPS --------------------
  describe('updateFPS - 帧率统计', () => {
    it('首次调用（lastFrameTime=0）不计算 fps', () => {
      (renderer as any).lastFrameTime = 0;
      (renderer as any).updateFPS();
      expect((renderer as any).renderStats.fps).toBe(0);
      expect((renderer as any).lastFrameTime).toBeGreaterThan(0);
    });

    it('第二次调用计算 fps', () => {
      (renderer as any).updateFPS();
      (renderer as any).updateFPS();
      expect((renderer as any).renderStats.fps).toBeGreaterThan(0);
    });
  });
});
