const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, 'suite/index.js');

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [extensionDevelopmentPath, '--disable-extensions']
  });
}

main().catch((error) => {
  console.error('扩展宿主测试启动失败');
  console.error(error);
  process.exit(1);
});
