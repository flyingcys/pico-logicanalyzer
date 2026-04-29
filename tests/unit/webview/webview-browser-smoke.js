const { pathToFileURL } = require('url');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const htmlPath = path.resolve(__dirname, '../../../out/webview/html/index.html');
const htmlUrl = pathToFileURL(htmlPath).toString();
const i2cFixturePath = path.resolve(__dirname, '../../fixtures/lac/i2c-ui-smoke.lac.json');

function documentData(fileName, content) {
  return {
    uri: `memory://logic-analyzer/${fileName}`,
    fileName,
    content
  };
}

function bootstrap(document) {
  return {
    host: 'html',
    document,
    capabilities: {
      canSave: false,
      canExport: true,
      canStartCapture: false,
      canConnectDevice: false
    }
  };
}

function fixtureDocument(fileName, fixturePath) {
  return documentData(fileName, fs.readFileSync(fixturePath, 'utf8'));
}

const sampleDocument = documentData(
  'samples.lac',
  JSON.stringify({
    Settings: {
      Frequency: 1000000,
      PreTriggerSamples: 1,
      PostTriggerSamples: 3,
      CaptureChannels: [
        { ChannelNumber: 0, ChannelName: 'D0' },
        { ChannelNumber: 1, ChannelName: 'D1' }
      ]
    },
    Samples: ['0', '1', '2', '3']
  })
);

const scenarios = [
  {
    name: 'empty',
    document: documentData('empty.lac', ''),
    expectedText: '未加载捕获文件'
  },
  {
    name: 'settings-only',
    document: documentData(
      'settings-only.lac',
      JSON.stringify({
        Settings: {
          Frequency: 1000000,
          CaptureChannels: [{ ChannelNumber: 0, ChannelName: 'D0' }]
        }
      })
    ),
    expectedText: '当前文件只有采集设置'
  },
  {
    name: 'invalid',
    document: documentData('invalid.lac', '{bad json'),
    expectedText: '文件内容无效'
  },
  {
    name: 'samples',
    document: sampleDocument
  },
  {
    name: 'i2c-fixture',
    document: fixtureDocument('i2c-ui-smoke.lac', i2cFixturePath),
    decoderSmoke: true
  }
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs, message) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await predicate();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }

  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ''}`);
}

async function waitForDevToolsPort(userDataDir) {
  const activePortFile = path.join(userDataDir, 'DevToolsActivePort');
  return waitFor(() => {
    if (!fs.existsSync(activePortFile)) {
      return null;
    }
    const [port] = fs.readFileSync(activePortFile, 'utf8').trim().split('\n');
    return port ? Number(port) : null;
  }, 10000, 'Chrome DevTools port was not created');
}

async function terminateChrome(chrome) {
  if (chrome.exitCode !== null || chrome.signalCode !== null) {
    return;
  }

  const exited = new Promise(resolve => chrome.once('exit', resolve));
  chrome.kill('SIGTERM');
  await Promise.race([exited, delay(3000)]);
  if (chrome.exitCode === null && chrome.signalCode === null) {
    chrome.kill('SIGKILL');
    await Promise.race([exited, delay(3000)]);
  }
}

class CDPPage {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.loadEvents = 0;

    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
        return;
      }

      if (message.method === 'Page.loadEventFired') {
        this.loadEvents++;
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
    }
    return result.result?.value;
  }

  async waitForExpression(expression, message, timeoutMs = 10000) {
    return waitFor(() => this.evaluate(expression), timeoutMs, message);
  }

  async close() {
    this.socket.close();
  }
}

async function createPage(browserPort, scenario) {
  const targetResponse = await fetch(`http://127.0.0.1:${browserPort}/json/new?about:blank`, {
    method: 'PUT'
  });
  if (!targetResponse.ok) {
    throw new Error(`failed to create Chrome target: ${targetResponse.status}`);
  }

  const target = await targetResponse.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const page = new CDPPage(socket);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__FRONTEND_BOOTSTRAP__ = ${JSON.stringify(bootstrap(scenario.document))};`
  });
  const currentLoadEvents = page.loadEvents;
  await page.send('Page.navigate', { url: htmlUrl });
  await waitFor(() => page.loadEvents > currentLoadEvents, 10000, 'page did not finish loading');
  await page.waitForExpression(
    'Boolean(document.querySelector(".app-header"))',
    'app header was not rendered'
  );
  return page;
}

async function verifyI2CDecoderSmoke(page) {
  await page.waitForExpression(
    'Array.from(document.querySelectorAll("button")).some(button => /运行 I2C 解码/.test(button.textContent || ""))',
    'run I2C decoder button was not rendered'
  );
  await page.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find(item => /运行 I2C 解码/.test(item.textContent || ''));
    button.click();
    return true;
  })()`);
  await page.waitForExpression('document.body.innerText.includes("START")', 'START result was not rendered');
  await page.waitForExpression('document.body.innerText.includes("ACK")', 'ACK result was not rendered');
  await page.waitForExpression('document.body.innerText.includes("STOP")', 'STOP result was not rendered');
  await page.evaluate(`(() => {
    const select = document.querySelector('[data-testid="decoder-protocol-select"]');
    select.value = 'uart';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await page.waitForExpression(
    'Array.from(document.querySelectorAll("button")).some(button => /运行 UART 解码/.test(button.textContent || ""))',
    'run UART decoder button was not rendered'
  );
  await page.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find(item => /运行 UART 解码/.test(item.textContent || ''));
    button.click();
    return true;
  })()`);
  await page.waitForExpression('document.body.innerText.includes("55")', 'UART RX result was not rendered');
  await page.waitForExpression('document.body.innerText.includes("33")', 'UART TX result was not rendered');
  await page.evaluate(`(() => {
    const select = document.querySelector('[data-testid="decoder-protocol-select"]');
    select.value = 'can';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await page.waitForExpression(
    'Array.from(document.querySelectorAll("button")).some(button => /运行 CAN 解码/.test(button.textContent || ""))',
    'run CAN decoder button was not rendered'
  );
  await page.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find(item => /运行 CAN 解码/.test(item.textContent || ''));
    button.click();
    return true;
  })()`);
  await page.waitForExpression('document.body.innerText.includes("ID: 123")', 'CAN ID result was not rendered');
  await page.waitForExpression('document.body.innerText.includes("Data[0]: 11")', 'CAN data result was not rendered');
  await page.evaluate(`(() => {
    const select = document.querySelector('[data-testid="decoder-protocol-select"]');
    select.value = 'spi';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await page.waitForExpression(
    'Array.from(document.querySelectorAll("button")).some(button => /运行 SPI 解码/.test(button.textContent || ""))',
    'run SPI decoder button was not rendered'
  );
  await page.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find(item => /运行 SPI 解码/.test(item.textContent || ''));
    button.click();
    return true;
  })()`);
  await page.waitForExpression('document.body.innerText.includes("MISO: A5")', 'SPI MISO result was not rendered');
  await page.waitForExpression('document.body.innerText.includes("MOSI: 3C")', 'SPI MOSI result was not rendered');
  await page.waitForExpression('document.body.innerText.includes("CS asserted")', 'SPI CS result was not rendered');
  return 'i2c-ui: decoder-button/results; uart-ui: decoder-button/results; can-ui: decoder-button/results; spi-ui: decoder-button/results';
}

(async () => {
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Webview HTML build output does not exist: ${htmlPath}. Run npm run build:frontend:html first.`);
  }

  const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logic-analyzer-webview-smoke-'));
  const chrome = spawn(executablePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    'about:blank'
  ], {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  const stderrChunks = [];
  chrome.stderr.on('data', chunk => stderrChunks.push(chunk));
  chrome.on('exit', code => {
    if (code !== null && code !== 0) {
      process.stderr.write(Buffer.concat(stderrChunks).toString());
    }
  });
  const browserPort = await waitForDevToolsPort(userDataDir);
  const results = [];

  try {
    for (const scenario of scenarios) {
      const page = await createPage(browserPort, scenario);
      if (scenario.expectedText) {
        await page.waitForExpression(
          `Boolean(document.querySelector('[data-testid="waveform-state"]')) && document.body.innerText.includes(${JSON.stringify(scenario.expectedText)})`,
          `${scenario.name} state text was not rendered`
        );
        results.push(`${scenario.name}: ${scenario.expectedText}`);
      } else {
        await page.waitForExpression(
          'Boolean(document.querySelector("canvas.waveform-stage__canvas"))',
          `${scenario.name} waveform canvas was not rendered`
        );
        const stateCount = await page.evaluate(
          'document.querySelectorAll("[data-testid=\\"waveform-state\\"]").length'
        );
        if (stateCount !== 0) {
          throw new Error('samples scenario should not show waveform-state overlay');
        }

        await page.waitForExpression(
          'Boolean(document.querySelector("[data-testid=\\"webview-export-button\\"]"))',
          `${scenario.name} export button was not rendered`
        );
        const exportButtonEnabled = await page.evaluate(
          '!document.querySelector("[data-testid=\\"webview-export-button\\"]").disabled'
        );
        if (!exportButtonEnabled) {
          throw new Error('export button should be enabled for samples document');
        }
        await page.evaluate('document.querySelector("[data-testid=\\"webview-export-button\\"]").click()');

        await page.waitForExpression(
          'Boolean(document.querySelector("[data-testid=\\"webview-start-capture-button\\"]"))',
          `${scenario.name} start capture button was not rendered`
        );
        const startButtonDisabled = await page.evaluate(
          'document.querySelector("[data-testid=\\"webview-start-capture-button\\"]").disabled'
        );
        if (!startButtonDisabled) {
          throw new Error('start capture button should be disabled without a connected device');
        }
        if (scenario.decoderSmoke) {
          const decoderResult = await verifyI2CDecoderSmoke(page);
          results.push(`${scenario.name}: canvas/export/start-disabled/${decoderResult}`);
        } else {
          results.push('samples: canvas/export/start-disabled');
        }
      }
      await page.close();
    }
  } finally {
    await terminateChrome(chrome);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  console.log(results.join('\n'));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
