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

  describe('readValue / readValueOptional / countElements 动作集', () => {
    it('readValue 在元素不存在时抛错（fail-closed）', async () => {
      const result = await executeScenarioActions([
        { type: 'readValue', selector: '.absent-input' }
      ]);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/readValue failed: element not found/);
    });

    it('readValue 在非表单元素上抛错', async () => {
      const div = document.createElement('div');
      div.className = 'not-a-form-element';
      div.textContent = 'I have no value';
      document.body.appendChild(div);

      const result = await executeScenarioActions([
        { type: 'readValue', selector: '.not-a-form-element' }
      ]);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/readValue failed: element has no value property/);
    });

    it('readValue 正确读到 input.value', async () => {
      const input = document.createElement('input');
      input.className = 'test-input-field';
      input.value = 'SPI_SCK';
      document.body.appendChild(input);

      const result = await executeScenarioActions([
        { type: 'readValue', selector: '.test-input-field' }
      ]);
      expect(result.ok).toBe(true);
      expect(result.values?.['.test-input-field']).toBe('SPI_SCK');
    });

    it('readValueOptional 在元素不存在时返回 null（不抛）', async () => {
      const input = document.createElement('input');
      input.className = 'existing-val-input';
      input.value = 'val-123';
      document.body.appendChild(input);

      const result = await executeScenarioActions([
        { type: 'readValueOptional', selector: '.existing-val-input' },
        { type: 'readValueOptional', selector: '.not-existing-val-input' }
      ]);

      expect(result.ok).toBe(true);
      expect(result.values?.['.existing-val-input']).toBe('val-123');
      expect(result.values?.['.not-existing-val-input']).toBeNull();
    });

    it('countElements 返回精确数量（0 和多个都要测）', async () => {
      for (let i = 0; i < 5; i++) {
        const item = document.createElement('div');
        item.className = 'counted-item';
        document.body.appendChild(item);
      }

      const result = await executeScenarioActions([
        { type: 'countElements', selector: '.counted-item' },
        { type: 'countElements', selector: '.zero-items' }
      ]);

      expect(result.ok).toBe(true);
      expect(result.counts?.['.counted-item']).toBe(5);
      expect(result.counts?.['.zero-items']).toBe(0);
    });
  });

  describe('formItem 语义定位器与 readAllTexts', () => {
    function setupFormDom() {
      document.body.innerHTML = `
        <div class="capture-form">
          <div class="el-form-item">
            <label class="el-form-item__label">Pattern</label>
            <div class="el-form-item__content">
              <input class="el-input__inner" value="123" />
            </div>
          </div>
          <div class="el-form-item">
            <label class="el-form-item__label">Pre Samples</label>
            <div class="el-form-item__content">
              <input class="el-input__inner" value="456" />
            </div>
          </div>
          <div class="el-form-item">
            <label class="el-form-item__label">触发反相</label>
            <div class="el-form-item__content">
              <div class="el-switch is-checked"><input type="checkbox" /></div>
            </div>
          </div>
        </div>
      `;
    }

    it('formItem:"Pattern" input 能定位到 label 为 Pattern 的表单项内的 input', async () => {
      setupFormDom();
      const result = await executeScenarioActions([
        { type: 'readValue', selector: 'formItem:"Pattern" input' }
      ]);
      expect(result.ok).toBe(true);
      expect(result.values?.['formItem:"Pattern" input']).toBe('123');
    });

    it('formItem:"Pre Samples" input 能正确处理含空格的 label', async () => {
      setupFormDom();
      const result = await executeScenarioActions([
        { type: 'readValue', selector: 'formItem:"Pre Samples" input' }
      ]);
      expect(result.ok).toBe(true);
      expect(result.values?.['formItem:"Pre Samples" input']).toBe('456');
    });

    it('formItem:"不存在的标签" 返回 null（不抛错）', async () => {
      setupFormDom();
      const result = await executeScenarioActions([
        { type: 'readValueOptional', selector: 'formItem:"不存在的标签" input' }
      ]);
      expect(result.ok).toBe(true);
      expect(result.values?.['formItem:"不存在的标签" input']).toBeNull();
    });

    it('formItem:Pattern（无引号）应抛错（fail-closed）', async () => {
      setupFormDom();
      const result = await executeScenarioActions([
        { type: 'readValue', selector: 'formItem:Pattern input' }
      ]);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/formItem: selector requires quoted label/);
    });

    it('countElements 支持 formItem: 前缀（走 queryAll 而非原生）', async () => {
      setupFormDom();
      const result = await executeScenarioActions([
        { type: 'countElements', selector: 'formItem:"Pattern" input' },
        { type: 'countElements', selector: 'formItem:"不存在的标签" input' },
        { type: 'countElements', selector: 'formItem:"触发反相" .el-switch.is-checked' }
      ]);
      expect(result.ok).toBe(true);
      expect(result.counts?.['formItem:"Pattern" input']).toBe(1);
      expect(result.counts?.['formItem:"不存在的标签" input']).toBe(0);
      expect(result.counts?.['formItem:"触发反相" .el-switch.is-checked']).toBe(1);
    });

    it('waitForElement 支持 formItem: 前缀', async () => {
      document.body.innerHTML = '';
      setTimeout(() => {
        setupFormDom();
      }, 50);

      const result = await executeScenarioActions([
        { type: 'waitForElement', selector: 'formItem:"Pre Samples" input', timeoutMs: 1000 }
      ]);
      expect(result.ok).toBe(true);
    });

    it('formItem:"Pattern"（无子选择器）返回 form-item 容器本身', async () => {
      setupFormDom();
      const result = await executeScenarioActions([
        { type: 'countElements', selector: 'formItem:"Pattern"' }
      ]);
      expect(result.ok).toBe(true);
      expect(result.counts?.['formItem:"Pattern"']).toBe(1);
    });

    it('readAllTexts 返回所有匹配元素的文本列表', async () => {
      setupFormDom();
      const result = await executeScenarioActions([
        { type: 'readAllTexts', selector: '.el-form-item__label' }
      ]);
      expect(result.ok).toBe(true);
      expect(result.allTexts?.['.el-form-item__label']).toEqual([
        'Pattern',
        'Pre Samples',
        '触发反相'
      ]);
    });
  });
});
