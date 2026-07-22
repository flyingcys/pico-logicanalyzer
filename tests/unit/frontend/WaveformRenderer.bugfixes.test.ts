/**
 * WaveformRenderer bugfix 回归测试
 * 覆盖 4 个已修复的 bug：
 *  1. renderNormal 空区间 (firstSample >= lastSample) 抛 TypeError
 *  2. renderOptimized 残留 console.log 持续刷日志
 *  3. onMouseMove 不可达的 idx===-1 死代码
 *  4. renderBorders 用 DPR 物理像素画边框致双重缩放错位
 */
import { WaveformRenderer } from '../../../src/frontend/core/engines/WaveformRenderer';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';

interface MockCtx {
  clearRect: jest.Mock;
  fillRect: jest.Mock;
  strokeRect: jest.Mock;
  beginPath: jest.Mock;
  moveTo: jest.Mock;
  lineTo: jest.Mock;
  stroke: jest.Mock;
  fillText: jest.Mock;
  measureText: jest.Mock;
  save: jest.Mock;
  restore: jest.Mock;
  scale: jest.Mock;
  translate: jest.Mock;
  setLineDash: jest.Mock;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  font: string;
  imageSmoothingEnabled: boolean;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
}

interface MockCanvas {
  width: number;
  height: number;
  style: Record<string, string>;
  parentElement: unknown;
  getContext: jest.Mock;
  getBoundingClientRect: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
}

function createMockCanvas(rect = { width: 800, height: 400 }): { canvas: MockCanvas; ctx: MockCtx } {
  const ctx: MockCtx = {
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 10 }) as TextMetrics),
    save: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    setLineDash: jest.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    imageSmoothingEnabled: false,
    lineCap: 'square',
    lineJoin: 'miter'
  };
  const canvas: MockCanvas = {
    width: rect.width,
    height: rect.height,
    style: { minHeight: '', width: '', height: '' },
    parentElement: null,
    getContext: jest.fn(() => ctx),
    getBoundingClientRect: jest.fn(() => ({
      width: rect.width,
      height: rect.height,
      left: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  return { canvas, ctx };
}

function makeChannel(num: number, samples: number[], name?: string): AnalyzerChannel {
  const ch = new AnalyzerChannel(num, name ?? `CH${num}`);
  ch.samples = new Uint8Array(samples);
  ch.hidden = false;
  return ch;
}

describe('WaveformRenderer bugfixes', () => {
  describe('bug1: renderNormal 空区间不抛 TypeError', () => {
    it('firstSample >= lastSample 时 render 正常返回', () => {
      const { canvas } = createMockCanvas();
      const renderer = new WaveformRenderer(canvas as unknown as HTMLCanvasElement);
      const ch = makeChannel(0, [0, 1, 0]);
      renderer.beginUpdate();
      renderer.setChannels([ch], 1000);
      // totalSamples=3 → lastSample=min(15,3)=3, firstSample(10) >= lastSample(3) 触发空区间
      renderer.updateVisibleSamples(10, 5);
      renderer.endUpdate();

      // 修复前: renderNormal 主循环不执行, renders 元素为 undefined,
      // 末尾 renderChannelSegment(renders[0], ...) 访问 render.firstSample 抛 TypeError
      expect(() => renderer.render()).not.toThrow();
    });
  });

  describe('bug2: renderOptimized 移除残留 console.log', () => {
    it('优化渲染路径不再输出 console.log', () => {
      const { canvas } = createMockCanvas();
      const renderer = new WaveformRenderer(canvas as unknown as HTMLCanvasElement);
      const samples: number[] = new Array(70000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = i % 2;
      }
      const ch = makeChannel(0, samples);
      renderer.beginUpdate();
      renderer.setChannels([ch], 1000);
      // visibleSamples > 50000 触发优化渲染路径
      renderer.updateVisibleSamples(0, 60000);
      renderer.endUpdate();

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      renderer.render();
      // 修复前: renderOptimized 每帧 console.log('优化渲染: 步长=...')
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('bug3: onMouseMove 删除不可达的 idx===-1 死代码', () => {
    // setup.ts 的 document mock 未提供 getElementById, onMouseMove 末尾的
    // showTooltip/hideTooltip 依赖它, 此处补 stub (仅测试隔离, 不改 setup.ts)
    beforeEach(() => {
      (document as unknown as { getElementById?: (id: string) => Element | null }).getElementById =
        (document as unknown as { getElementById?: (id: string) => Element | null }).getElementById ||
        jest.fn(() => null);
    });

    it('合法鼠标位置正常执行不抛错', () => {
      const { canvas } = createMockCanvas();
      const renderer = new WaveformRenderer(canvas as unknown as HTMLCanvasElement);
      const ch0 = makeChannel(0, [0, 1, 0, 1], 'CH0');
      const ch1 = makeChannel(1, [1, 0, 1, 0], 'CH1');
      renderer.beginUpdate();
      renderer.setChannels([ch0, ch1], 1000);
      renderer.updateVisibleSamples(0, 4);
      renderer.endUpdate();

      // rect 800x400, visibleChannels=2, channelHeight=200
      // x=400 → curSample=floor(400/(800/4))=2; y=100 → curChan=floor(100/200)=0
      // chan=channels[0], idx 在 this.channels 中必命中 (visibleChannels 为其 filter 子集)
      const event = new MouseEvent('mousemove', { clientX: 400, clientY: 100 });
      // 删除死代码后路径正常; 若误删导致 idx=-1 访问 intervals[-1] 会抛错
      expect(() => (renderer as unknown as { onMouseMove: (e: MouseEvent) => void }).onMouseMove(event)).not.toThrow();
    });
  });

  describe('bug4: renderBorders 使用逻辑坐标避免 DPR 双重缩放', () => {
    const originalDpr = (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;

    afterEach(() => {
      (window as unknown as { devicePixelRatio?: number }).devicePixelRatio = originalDpr;
    });

    it('dpr=2 时外边框用逻辑坐标 (800x400) 而非物理像素 (1600x800)', () => {
      (window as unknown as { devicePixelRatio?: number }).devicePixelRatio = 2;
      const { canvas, ctx } = createMockCanvas({ width: 800, height: 400 });
      // 构造时 setupCanvasSettings: canvas.width=800*2=1600, canvas.height=400*2=800, ctx.scale(2,2)
      const renderer = new WaveformRenderer(canvas as unknown as HTMLCanvasElement);
      const ch = makeChannel(0, [0, 1, 0]);
      renderer.beginUpdate();
      renderer.setChannels([ch], 1000);
      renderer.updateVisibleSamples(0, 3);
      renderer.endUpdate();

      renderer.render();

      // renderBorders 外边框:
      // 修复前 strokeRect(0, 0, this.canvas.width=1600, this.canvas.height=800) — 双重缩放
      // 修复后 strokeRect(0, 0, canvasWidth=800, canvasHeight=400) — 逻辑坐标
      const borderCall = ctx.strokeRect.mock.calls.find(
        c => c[2] === 800 || c[2] === 1600
      );
      expect(borderCall).toBeDefined();
      expect(borderCall![0]).toBe(0);
      expect(borderCall![1]).toBe(0);
      expect(borderCall![2]).toBe(800);
      expect(borderCall![3]).toBe(400);
    });
  });
});
