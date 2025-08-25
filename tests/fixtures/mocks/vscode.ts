/**
 * VSCode API Mock - 简化版本
 * 为测试提供最基本的VSCode API模拟
 */

export const window = {
  showSaveDialog: jest.fn(),
  showOpenDialog: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn()
};

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  getConfiguration: jest.fn(() => ({
    get: jest.fn(() => []),
    update: jest.fn()
  }))
};

export const Uri = {
  file: jest.fn(path => ({ fsPath: path }))
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3
};

// 导出默认对象
export default {
  window,
  workspace,
  Uri,
  ConfigurationTarget
};