const assert = require('node:assert/strict');
const vscode = require('vscode');

const extensionId = 'logic-analyzer-team.vscode-logic-analyzer';
const requiredCommands = [
  'logicAnalyzer.openAnalyzer',
  'logicAnalyzer.connectDevice',
  'logicAnalyzer.startCapture',
  'logicAnalyzer.scanNetworkDevices',
  'logicAnalyzer.networkDiagnostics',
  'logicAnalyzer.configureWiFi'
];

async function runExtensionHostSmoke() {
  const extension = vscode.extensions.getExtension(extensionId);

  assert.ok(extension, `未找到扩展: ${extensionId}`);

  if (!extension.isActive) {
    await extension.activate();
  }

  assert.equal(extension.isActive, true, '扩展激活失败');

  const commands = await vscode.commands.getCommands(true);
  for (const command of requiredCommands) {
    assert.ok(commands.includes(command), `缺少命令注册: ${command}`);
  }
}

module.exports = {
  runExtensionHostSmoke
};
