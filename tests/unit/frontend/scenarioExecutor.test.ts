/**
 * @jest-environment jsdom
 */

import {
  executeScenarioActions,
  setupScenarioListener
} from '../../../src/frontend/platform/scenario/scenarioExecutor';

describe('scenarioExecutor (Webview 场景执行器与门控)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('waitForElement 能够在元素追加到 DOM 后成功获取，超时抛错', async () => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'delayed-box';
      div.textContent = 'ready';
      document.body.appendChild(div);
    }, 50);

    const result = await executeScenarioActions([
      { type: 'waitForElement', selector: '.delayed-box', timeoutMs: 1000 }
    ]);

    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(1);

    // 超时失败
    const failResult = await executeScenarioActions([
      { type: 'waitForElement', selector: '.not-exist', timeoutMs: 100 }
    ]);
    expect(failResult.ok).toBe(false);
    expect(failResult.error).toMatch(/waitForElement timed out/);
  });

  it('waitForText 能够轮询等待文本正则匹配，并处理异步上屏', async () => {
    const meta = document.createElement('span');
    meta.className = 'samples-meta';
    meta.textContent = '0 samples';
    document.body.appendChild(meta);

    // 模拟数据异步更新
    setTimeout(() => {
      meta.textContent = '4 samples';
    }, 50);

    const result = await executeScenarioActions([
      { type: 'waitForText', selector: '.samples-meta', matches: '^\\d+ samples$', timeoutMs: 1000 }
    ]);

    expect(result.ok).toBe(true);

    // 匹配失败超时
    const failResult = await executeScenarioActions([
      { type: 'waitForText', selector: '.samples-meta', matches: '^999 samples$', timeoutMs: 100 }
    ]);
    expect(failResult.ok).toBe(false);
    expect(failResult.error).toMatch(/waitForText timed out/);
  });

  it('click 与 input 动作派发真实 DOM 事件', async () => {
    const btn = document.createElement('button');
    btn.className = 'my-btn';
    let clicked = false;
    btn.addEventListener('click', () => {
      clicked = true;
    });
    document.body.appendChild(btn);

    const input = document.createElement('input');
    input.className = 'my-input';
    let inputValue = '';
    input.addEventListener('change', () => {
      inputValue = input.value;
    });
    document.body.appendChild(input);

    const result = await executeScenarioActions([
      { type: 'click', selector: '.my-btn' },
      { type: 'input', selector: '.my-input', value: '1000000' }
    ]);

    expect(result.ok).toBe(true);
    expect(clicked).toBe(true);
    expect(inputValue).toBe('1000000');
  });

  it('readText 严格要求元素存在（Fail-Closed），缺失时抛错', async () => {
    const span = document.createElement('span');
    span.className = 'required-label';
    span.textContent = '   Hello World   ';
    document.body.appendChild(span);

    const successResult = await executeScenarioActions([
      { type: 'readText', selector: '.required-label' }
    ]);
    expect(successResult.ok).toBe(true);
    expect(successResult.texts?.['.required-label']).toBe('Hello World');

    // 元素缺失必须失败
    const failResult = await executeScenarioActions([
      { type: 'readText', selector: '.missing-label' }
    ]);
    expect(failResult.ok).toBe(false);
    expect(failResult.error).toMatch(/readText failed: element not found/);
  });

  it('readTextOptional 元素缺失时返回 null 而不报错', async () => {
    const span = document.createElement('span');
    span.className = 'existing-opt';
    span.textContent = 'Existing';
    document.body.appendChild(span);

    const result = await executeScenarioActions([
      { type: 'readTextOptional', selector: '.existing-opt' },
      { type: 'readTextOptional', selector: '.absent-opt' }
    ]);

    expect(result.ok).toBe(true);
    expect(result.texts?.['.existing-opt']).toBe('Existing');
    expect(result.texts?.['.absent-opt']).toBeNull();
  });

  it('readCanvasStats 计算结构性像素指标：种类数与主导色占比', async () => {
    const canvas = document.createElement('canvas');
    canvas.className = 'waveform-canvas';
    canvas.width = 10;
    canvas.height = 10;

    // 构造 100 像素 RGBA (400 字节)
    // 80 个像素为背景色 (36, 36, 36, 255)
    // 10 个像素为波形色 (255, 115, 51, 255)
    // 5 个像素为网格色 (60, 60, 60, 255)
    // 5 个像素为抗锯齿过渡色 (120, 80, 50, 255)
    const mockData = new Uint8ClampedArray(400);
    for (let i = 0; i < 400; i += 4) {
      const p = i / 4;
      if (p < 80) {
        mockData[i] = 36;
        mockData[i + 1] = 36;
        mockData[i + 2] = 36;
        mockData[i + 3] = 255;
      } else if (p < 90) {
        mockData[i] = 255;
        mockData[i + 1] = 115;
        mockData[i + 2] = 51;
        mockData[i + 3] = 255;
      } else if (p < 95) {
        mockData[i] = 60;
        mockData[i + 1] = 60;
        mockData[i + 2] = 60;
        mockData[i + 3] = 255;
      } else {
        mockData[i] = 120;
        mockData[i + 1] = 80;
        mockData[i + 2] = 50;
        mockData[i + 3] = 255;
      }
    }

    const mockCtx = {
      getImageData: jest.fn().mockReturnValue({ data: mockData })
    };
    canvas.getContext = jest.fn().mockReturnValue(mockCtx);
    document.body.appendChild(canvas);

    const result = await executeScenarioActions([
      { type: 'readCanvasStats', selector: '.waveform-canvas', sampleStep: 1 }
    ]);

    expect(result.ok).toBe(true);
    const stats = result.canvasStats!;
    expect(stats.width).toBe(10);
    expect(stats.height).toBe(10);
    expect(stats.sampledPixels).toBe(100);
    expect(stats.transparentPixels).toBe(0);
    expect(stats.colorVariety).toBe(4); // 4 种颜色
    expect(stats.dominantColorRatio).toBe(0.8); // 80/100
    expect(stats.topColors).toHaveLength(4);
  });

  it('readCanvasStats selector 必填且非空，否则报错', async () => {
    const result = await executeScenarioActions([
      { type: 'readCanvasStats', selector: '' }
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/readCanvasStats requires explicit non-empty selector/);
  });

  it('setupScenarioListener 严格遵循三重门控：__scenarioEnabled 与 nonce 缺一不可', async () => {
    const posted: unknown[] = [];
    const mockVsCode = {
      postMessage: jest.fn(msg => posted.push(msg))
    };

    (window as any).vscode = mockVsCode;
    (window as any).__scenarioEnabled = false; // 门控关

    const teardown = setupScenarioListener();

    // 门控为 false 时应拒绝
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'scenarioRequest',
          requestId: 'req-1',
          nonce: 'nonce-1',
          actions: []
        }
      })
    );

    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual(
      expect.objectContaining({
        type: 'scenarioResult',
        requestId: 'req-1',
        nonce: 'nonce-1',
        ok: false,
        error: 'scenario executor disabled'
      })
    );

    // 开启门控但缺少 nonce 时应拒绝
    posted.length = 0;
    (window as any).__scenarioEnabled = true;
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'scenarioRequest',
          requestId: 'req-2',
          nonce: '',
          actions: []
        }
      })
    );

    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual(
      expect.objectContaining({
        type: 'scenarioResult',
        requestId: 'req-2',
        ok: false,
        error: 'scenario executor disabled'
      })
    );

    // 门控和 nonce 均有效时执行动作
    posted.length = 0;
    const testDiv = document.createElement('div');
    testDiv.className = 'e2e-target';
    testDiv.textContent = 'e2e-ok';
    document.body.appendChild(testDiv);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'scenarioRequest',
          requestId: 'req-3',
          nonce: 'nonce-valid',
          actions: [{ type: 'readText', selector: '.e2e-target' }]
        }
      })
    );

    // 等待微任务完成
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual(
      expect.objectContaining({
        type: 'scenarioResult',
        requestId: 'req-3',
        nonce: 'nonce-valid',
        ok: true,
        texts: { '.e2e-target': 'e2e-ok' }
      })
    );

    teardown?.();
  });
});
