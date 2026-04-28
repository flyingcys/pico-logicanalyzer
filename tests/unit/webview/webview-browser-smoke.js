const { pathToFileURL } = require('url');
const path = require('path');
const { chromium } = require('playwright');

const htmlUrl = pathToFileURL(path.resolve(__dirname, '../../../out/webview/html/index.html')).toString();

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
  }
];

async function openScenario(browser, scenario) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(data => {
    window.__FRONTEND_BOOTSTRAP__ = data;
  }, bootstrap(scenario.document));
  await page.goto(htmlUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.app-header', { timeout: 10000 });
  return page;
}

(async () => {
  const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const results = [];

  try {
    for (const scenario of scenarios) {
      const page = await openScenario(browser, scenario);
      if (scenario.expectedText) {
        await page.waitForSelector(`[data-testid="waveform-state"]:has-text("${scenario.expectedText}")`);
        results.push(`${scenario.name}: ${scenario.expectedText}`);
      } else {
        await page.waitForSelector('canvas.waveform-stage__canvas');
        const stateCount = await page.locator('[data-testid="waveform-state"]').count();
        if (stateCount !== 0) {
          throw new Error('samples scenario should not show waveform-state overlay');
        }

        const exportButton = page.locator('[data-testid="webview-export-button"]');
        await exportButton.waitFor();
        if (!(await exportButton.isEnabled())) {
          throw new Error('export button should be enabled for samples document');
        }
        await exportButton.click();

        const deviceError = await page.evaluate(async () => {
          const context = window.__LOGIC_ANALYZER_FRONTEND__;
          return context.host.sendCommand('startCapture', { config: { frequency: 1000000 } });
        });
        if (deviceError.success || !String(deviceError.error || '').includes('请先连接')) {
          throw new Error(`unexpected device error result: ${JSON.stringify(deviceError)}`);
        }
        results.push(`samples: canvas/export/device-error:${deviceError.error}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(results.join('\n'));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
