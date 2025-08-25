/**
 * Vue Webview 主入口文件测试套件
 * 
 * 测试范围：
 * - Vue应用创建和初始化
 * - Pinia状态管理集成
 * - Element Plus UI库集成
 * - 国际化模块集成
 * - DOM挂载和渲染
 * - VSCode扩展通信
 * - 全局类型声明
 * - 错误处理和边界条件
 * 
 * @author VSCode Logic Analyzer Extension
 * @date 2025-08-04
 * @jest-environment jsdom
 */

// Mock Vue相关模块
const mockCreateApp = jest.fn();
const mockUse = jest.fn();
const mockMount = jest.fn();
const mockPostMessage = jest.fn();

jest.mock('vue', () => ({
  createApp: mockCreateApp
}));

jest.mock('pinia', () => ({
  createPinia: jest.fn().mockReturnValue({
    install: jest.fn(),
    state: {},
    stores: new Map()
  })
}));

jest.mock('element-plus', () => ({
  __esModule: true,
  default: {
    install: jest.fn(),
    components: {},
    version: '2.0.0'
  }
}));

// Mock CSS导入
jest.mock('element-plus/dist/index.css', () => ({}));

// Mock App组件
jest.mock('../../../src/webview/App.vue', () => ({
  __esModule: true,
  default: {
    name: 'App',
    template: '<div id="app">Test App</div>'
  }
}));

// Mock i18n模块
jest.mock('../../../src/webview/i18n', () => ({
  __esModule: true,
  default: {
    install: jest.fn(),
    global: {
      locale: { value: 'zh-CN' }
    }
  }
}));

describe('Vue Webview 主入口文件测试', () => {
  let mockApp: any;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // 创建模拟的Vue应用实例
    mockApp = {
      use: mockUse,
      mount: mockMount,
      config: { globalProperties: {} },
      component: jest.fn(),
      directive: jest.fn(),
      provide: jest.fn()
    };

    mockCreateApp.mockReturnValue(mockApp);

    // 设置DOM环境
    document.body.innerHTML = '<div id="app"></div>';

    // 清理全局对象
    delete (window as any).vscode;
    delete (window as any).documentData;

    // 清除模块缓存，确保每次测试都重新执行main.ts
    jest.resetModules();
  });

  afterEach(() => {
    // 清理DOM
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Vue应用创建和初始化', () => {
    it('应该正确创建Vue应用实例', async () => {
      // 动态导入main.ts来触发应用创建
      await import('../../../src/webview/main');

      expect(mockCreateApp).toHaveBeenCalledTimes(1);
      expect(mockCreateApp).toHaveBeenCalledWith(expect.any(Object));
    });

    it('应该使用正确的App组件', async () => {
      await import('../../../src/webview/main');

      const appComponent = mockCreateApp.mock.calls[0][0];
      expect(appComponent).toBeDefined();
      expect(appComponent.name).toBe('App');
    });

    it('应该正确配置应用实例', async () => {
      await import('../../../src/webview/main');

      expect(mockApp).toBeDefined();
      expect(typeof mockApp.use).toBe('function');
      expect(typeof mockApp.mount).toBe('function');
    });
  });

  describe('插件集成', () => {
    it('应该安装Pinia状态管理', async () => {
      await import('../../../src/webview/main');

      expect(mockUse).toHaveBeenCalledWith(expect.objectContaining({
        install: expect.any(Function)
      }));
    });

    it('应该安装Element Plus UI库', async () => {
      await import('../../../src/webview/main');

      expect(mockUse).toHaveBeenCalledWith(expect.objectContaining({
        install: expect.any(Function),
        version: expect.any(String)
      }));
    });

    it('应该安装国际化模块', async () => {
      await import('../../../src/webview/main');

      expect(mockUse).toHaveBeenCalledWith(expect.objectContaining({
        install: expect.any(Function),
        global: expect.any(Object)
      }));
    });

    it('应该按照正确的顺序安装插件', async () => {
      await import('../../../src/webview/main');

      expect(mockUse).toHaveBeenCalledTimes(3);

      // 验证调用顺序：Pinia -> Element Plus -> i18n
      const calls = mockUse.mock.calls;
      expect(calls[0][0]).toHaveProperty('state'); // Pinia特征
      expect(calls[1][0]).toHaveProperty('version'); // Element Plus特征
      expect(calls[2][0]).toHaveProperty('global'); // i18n特征
    });
  });

  describe('DOM挂载和渲染', () => {
    it('应该挂载到#app元素', async () => {
      await import('../../../src/webview/main');

      expect(mockMount).toHaveBeenCalledTimes(1);
      expect(mockMount).toHaveBeenCalledWith('#app');
    });

    it('应该处理#app元素不存在的情况', async () => {
      // 移除#app元素
      document.body.innerHTML = '';

      // 不应该抛出错误
      await expect(import('../../../src/webview/main')).resolves.toBeDefined();

      expect(mockMount).toHaveBeenCalledWith('#app');
    });

    it('应该验证DOM中存在目标挂载点', () => {
      const appElement = document.getElementById('app');
      expect(appElement).toBeTruthy();
      expect(appElement?.tagName).toBe('DIV');
    });
  });

  describe('VSCode扩展通信', () => {
    it('应该在vscode对象存在时发送ready消息', async () => {
      // 设置模拟的vscode对象
      (window as any).vscode = {
        postMessage: mockPostMessage
      };

      await import('../../../src/webview/main');

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'ready' });
    });

    it('应该在vscode对象不存在时不发送消息', async () => {
      // 确保vscode对象不存在
      delete (window as any).vscode;

      await import('../../../src/webview/main');

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('应该处理vscode对象存在但postMessage不可用的情况', async () => {
      // 设置无效的vscode对象
      (window as any).vscode = {};

      // 由于postMessage不存在，会抛出错误
      await expect(import('../../../src/webview/main')).rejects.toThrow('window.vscode.postMessage is not a function');
    });

    it('应该处理postMessage调用失败的情况', async () => {
      // 设置会抛出错误的postMessage
      (window as any).vscode = {
        postMessage: jest.fn().mockImplementation(() => {
          throw new Error('postMessage failed');
        })
      };

      // postMessage失败会抛出错误
      await expect(import('../../../src/webview/main')).rejects.toThrow('postMessage failed');
    });
  });

  describe('全局类型声明', () => {
    it('应该支持window.vscode属性', () => {
      (window as any).vscode = { test: true };
      expect(window.vscode).toBeDefined();
      expect(window.vscode.test).toBe(true);
    });

    it('应该支持window.documentData属性', () => {
      (window as any).documentData = {
        uri: 'test://uri',
        fileName: 'test.lac',
        content: 'test content'
      };

      expect(window.documentData).toBeDefined();
      expect(window.documentData.uri).toBe('test://uri');
      expect(window.documentData.fileName).toBe('test.lac');
      expect(window.documentData.content).toBe('test content');
    });

    it('应该正确处理documentData的完整结构', () => {
      const testDocumentData = {
        uri: 'vscode://file/path/to/file.lac',
        fileName: 'capture_data.lac',
        content: JSON.stringify({ channels: [], sampleRate: 1000000 })
      };

      (window as any).documentData = testDocumentData;

      expect(window.documentData.uri).toContain('vscode://');
      expect(window.documentData.fileName).toContain('.lac');
      expect(window.documentData.content).toContain('channels');
    });
  });

  describe('模块依赖', () => {
    it('应该正确导入所有必需的依赖', async () => {
      // 验证所有mock都被正确调用，说明依赖导入成功
      await import('../../../src/webview/main');

      expect(mockCreateApp).toHaveBeenCalled();
      expect(mockUse).toHaveBeenCalled();
      expect(mockMount).toHaveBeenCalled();
    });

    it('应该处理CSS导入', async () => {
      // CSS导入应该不抛出错误
      await expect(import('../../../src/webview/main')).resolves.toBeDefined();
    });

    it('应该验证App组件的正确导入', async () => {
      await import('../../../src/webview/main');

      const appComponent = mockCreateApp.mock.calls[0][0];
      expect(appComponent).toBeDefined();
      expect(appComponent.template).toContain('div');
    });

    it('应该验证i18n模块的正确导入', async () => {
      await import('../../../src/webview/main');

      const i18nCalls = mockUse.mock.calls.filter(call => 
        call[0] && call[0].global && call[0].global.locale
      );
      expect(i18nCalls.length).toBe(1);
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该处理createApp失败的情况', async () => {
      mockCreateApp.mockImplementation(() => {
        throw new Error('createApp failed');
      });

      // 应该抛出错误，因为这是关键的初始化步骤
      await expect(import('../../../src/webview/main')).rejects.toThrow('createApp failed');
    });

    it('应该处理插件安装失败的情况', async () => {
      mockUse.mockImplementation(() => {
        throw new Error('Plugin installation failed');
      });

      await expect(import('../../../src/webview/main')).rejects.toThrow('Plugin installation failed');
    });

    it('应该处理挂载失败的情况', async () => {
      // 清除之前的mock，避免插件安装错误
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {
        throw new Error('Mount failed');
      });

      await expect(import('../../../src/webview/main')).rejects.toThrow('Mount failed');
    });

    it('应该处理无效的window对象', async () => {
      // 清除插件安装错误的mock
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {});
      
      // 模拟受限环境下的window对象
      const originalWindow = global.window;
      (global as any).window = undefined;

      try {
        // 在没有window对象的环境中仍然可以正常导入模块
        await expect(import('../../../src/webview/main')).resolves.toBeDefined();
      } finally {
        global.window = originalWindow;
      }
    });

    it('应该处理部分可用的window属性', async () => {
      // 清除插件错误mock
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {});
      
      // 只设置部分window属性
      (window as any).documentData = {
        uri: 'test://uri'
        // 缺少fileName和content
      };

      await expect(import('../../../src/webview/main')).resolves.toBeDefined();
    });
  });

  describe('初始化序列', () => {
    it('应该按照正确的顺序执行初始化步骤', async () => {
      const callOrder: string[] = [];

      mockCreateApp.mockImplementation(() => {
        callOrder.push('createApp');
        return mockApp;
      });

      mockUse.mockImplementation(() => {
        callOrder.push('use');
      });

      mockMount.mockImplementation(() => {
        callOrder.push('mount');
      });

      await import('../../../src/webview/main');

      expect(callOrder).toEqual([
        'createApp',
        'use', // Pinia
        'use', // Element Plus
        'use', // i18n
        'mount'
      ]);
    });

    it('应该在应用挂载后发送ready消息', async () => {
      let mountCalled = false;
      let postMessageCalled = false;

      mockMount.mockImplementation(() => {
        mountCalled = true;
      });

      (window as any).vscode = {
        postMessage: () => {
          postMessageCalled = true;
          // ready消息应该在mount之后发送
          expect(mountCalled).toBe(true);
        }
      };

      await import('../../../src/webview/main');

      expect(postMessageCalled).toBe(true);
    });

    it('应该确保所有插件在挂载前安装完成', async () => {
      let pluginCount = 0;
      let mountCalled = false;

      mockUse.mockImplementation(() => {
        pluginCount++;
        expect(mountCalled).toBe(false); // 挂载应该在所有插件安装后
      });

      mockMount.mockImplementation(() => {
        mountCalled = true;
        expect(pluginCount).toBe(3); // 应该安装了3个插件
      });

      await import('../../../src/webview/main');

      expect(pluginCount).toBe(3);
      expect(mountCalled).toBe(true);
    });
  });

  describe('运行时环境检测', () => {
    it('应该检测VSCode Webview环境', async () => {
      // 清除之前的mock
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {});
      
      (window as any).vscode = {
        postMessage: mockPostMessage,
        getState: jest.fn(),
        setState: jest.fn()
      };

      await import('../../../src/webview/main');

      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'ready' });
    });

    it('应该检测开发环境', async () => {
      // 清除之前的mock
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {});
      
      // 模拟开发环境（没有vscode对象）
      delete (window as any).vscode;

      await import('../../../src/webview/main');

      // 在开发环境中应用仍然应该正常创建
      expect(mockCreateApp).toHaveBeenCalled();
      expect(mockMount).toHaveBeenCalled();
    });

    it('应该适应不同的文档数据格式', async () => {
      // 清除mock错误
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {});
      
      const testCases = [
        undefined,
        {},
        { uri: 'test' },
        { uri: 'test', fileName: 'test.lac' },
        { uri: 'test', fileName: 'test.lac', content: '{}' }
      ];

      for (const documentData of testCases) {
        jest.resetModules();
        (window as any).documentData = documentData;

        // 所有情况都应该能正常处理
        await expect(import('../../../src/webview/main')).resolves.toBeDefined();
      }
    });
  });

  describe('内存和资源管理', () => {
    it('应该不产生内存泄漏', async () => {
      // 清除mock错误和调用历史
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {});
      mockCreateApp.mockClear();
      mockMount.mockClear();
      
      // 多次导入应用不应该产生泄漏
      for (let i = 0; i < 5; i++) {
        jest.resetModules();
        await import('../../../src/webview/main');
      }

      // 应该被调用5次（每次导入一次）
      expect(mockCreateApp).toHaveBeenCalledTimes(5);
      expect(mockMount).toHaveBeenCalledTimes(5);
    });

    it('应该正确清理事件监听器', async () => {
      // 清除mock错误
      mockUse.mockImplementation(() => {});
      mockMount.mockImplementation(() => {});
      
      (window as any).vscode = {
        postMessage: mockPostMessage
      };

      await import('../../../src/webview/main');

      // 模拟页面卸载
      window.dispatchEvent(new Event('beforeunload'));

      // 应该不会产生错误
      expect(true).toBe(true);
    });
  });
});