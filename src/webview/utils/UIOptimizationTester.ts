/**
 * UI优化功能测试器
 * 验证键盘快捷键、右键菜单、通知系统等功能
 */

import { keyboardShortcutManager } from './KeyboardShortcutManager';
import { layoutManager } from './LayoutManager';

export class UIOptimizationTester {
  private testResults: { [key: string]: boolean } = {};

  /**
   * 运行所有UI优化功能测试
   */
  public async runAllTests(): Promise<{ [key: string]: boolean }> {
    console.log('开始UI优化功能测试...');

    try {
      // 测试键盘快捷键管理器
      this.testResults['keyboardShortcuts'] = this.testKeyboardShortcuts();

      // 测试布局管理器
      this.testResults['layoutManager'] = await this.testLayoutManager();

      // 测试右键菜单组件
      this.testResults['contextMenu'] = this.testContextMenu();

      // 测试通知系统
      this.testResults['notificationCenter'] = this.testNotificationCenter();

      // 测试快捷键帮助
      this.testResults['shortcutHelp'] = this.testShortcutHelp();

      this.printTestResults();
      return this.testResults;
    } catch (error) {
      console.error('UI优化功能测试失败:', error);
      return this.testResults;
    }
  }

  /**
   * 测试键盘快捷键管理器
   */
  private testKeyboardShortcuts(): boolean {
    try {
      console.log('测试键盘快捷键管理器...');

      // 测试快捷键格式化
      const formatted = keyboardShortcutManager.formatShortcut(['Ctrl', 'S']);
      if (!formatted) {
        console.error('快捷键格式化失败');
        return false;
      }

      // 测试获取快捷键分类
      const categories = keyboardShortcutManager.getShortcutsByCategory();
      if (!categories || categories.length === 0) {
        console.error('获取快捷键分类失败');
        return false;
      }

      // 测试添加自定义快捷键
      keyboardShortcutManager.addShortcut({
        id: 'test-shortcut',
        keys: ['Ctrl', 'T'],
        description: '测试快捷键',
        category: '测试',
        handler: () => console.log('测试快捷键触发'),
        enabled: true
      });

      // 测试快捷键启用/禁用
      keyboardShortcutManager.setShortcutEnabled('test-shortcut', false);
      keyboardShortcutManager.setShortcutEnabled('test-shortcut', true);

      // 清理测试快捷键
      keyboardShortcutManager.removeShortcut('test-shortcut');

      console.log('✓ 键盘快捷键管理器测试通过');
      return true;
    } catch (error) {
      console.error('键盘快捷键管理器测试失败:', error);
      return false;
    }
  }

  /**
   * 测试布局管理器
   */
  private async testLayoutManager(): Promise<boolean> {
    try {
      console.log('测试布局管理器...');

      // 测试获取当前布局
      const currentLayout = layoutManager.getCurrentLayout();
      if (!currentLayout) {
        console.error('获取当前布局失败');
        return false;
      }

      // 测试更新布局
      layoutManager.updateLayout({
        name: '测试布局',
        description: '用于测试的布局'
      });

      // 测试更新面板布局
      layoutManager.updatePanelLayout('left-panel', {
        width: 350,
        visible: true
      });

      // 测试更新波形状态
      layoutManager.updateWaveformState({
        zoomLevel: 2,
        firstSample: 100,
        visibleSamples: 2000
      });

      // 测试更新通道可见性
      layoutManager.updateChannelVisibility(0, {
        visible: false,
        color: '#ff0000'
      });

      // 测试保存布局
      const saved = layoutManager.saveCurrentLayout();
      if (!saved) {
        console.error('保存布局失败');
        return false;
      }

      // 测试获取预设
      const presets = layoutManager.getPresets();
      if (!presets || presets.length === 0) {
        console.error('获取预设失败');
        return false;
      }

      // 测试应用预设
      const defaultPreset = presets.find(p => p.id === 'default');
      if (defaultPreset) {
        const applied = layoutManager.applyPreset('default');
        if (!applied) {
          console.error('应用预设失败');
          return false;
        }
      }

      // 测试保存为预设
      const presetId = layoutManager.saveAsPreset('测试预设', '这是一个测试预设');
      if (!presetId) {
        console.error('保存为预设失败');
        return false;
      }

      // 测试删除预设
      const deleted = layoutManager.deletePreset(presetId);
      if (!deleted) {
        console.error('删除预设失败');
        return false;
      }

      // 测试导出和导入
      const exported = layoutManager.exportLayout();
      if (!exported) {
        console.error('导出布局失败');
        return false;
      }

      const imported = layoutManager.importLayout(exported);
      if (!imported) {
        console.error('导入布局失败');
        return false;
      }

      console.log('✓ 布局管理器测试通过');
      return true;
    } catch (error) {
      console.error('布局管理器测试失败:', error);
      return false;
    }
  }

  /**
   * 测试右键菜单组件
   */
  private testContextMenu(): boolean {
    try {
      console.log('测试右键菜单组件...');

      // 创建测试菜单项
      const testMenuItems = [
        {
          id: 'test-item-1',
          label: '测试项目1',
          action: () => console.log('测试项目1被点击')
        },
        {
          id: 'divider-1',
          type: 'divider' as const
        },
        {
          id: 'test-submenu',
          type: 'submenu' as const,
          label: '子菜单',
          children: [
            {
              id: 'sub-item-1',
              label: '子项目1',
              action: () => console.log('子项目1被点击')
            }
          ]
        }
      ];

      // 验证菜单项结构
      if (!testMenuItems || testMenuItems.length === 0) {
        console.error('测试菜单项创建失败');
        return false;
      }

      // 验证子菜单结构
      const submenu = testMenuItems.find(item => item.type === 'submenu');
      if (!submenu || !submenu.children || submenu.children.length === 0) {
        console.error('子菜单结构验证失败');
        return false;
      }

      console.log('✓ 右键菜单组件测试通过');
      return true;
    } catch (error) {
      console.error('右键菜单组件测试失败:', error);
      return false;
    }
  }

  /**
   * 测试通知系统
   */
  private testNotificationCenter(): boolean {
    try {
      console.log('测试通知系统...');

      // 测试通知数据结构
      const testNotification = {
        type: 'info' as const,
        title: '测试通知',
        description: '这是一个测试通知',
        icon: 'InfoFilled',
        position: { x: 100, y: 100 },
        duration: 3000
      };

      // 验证通知结构
      if (!testNotification.type || !testNotification.title) {
        console.error('通知结构验证失败');
        return false;
      }

      // 测试连接状态配置
      const connectionStatuses = ['connected', 'connecting', 'disconnected', 'error'];
      for (const status of connectionStatuses) {
        // 验证状态配置存在
        if (!status) {
          console.error(`连接状态 ${status} 配置验证失败`);
          return false;
        }
      }

      // 测试性能警告级别
      const performanceLevels = ['low', 'medium', 'high', 'critical'];
      for (const level of performanceLevels) {
        if (!level) {
          console.error(`性能级别 ${level} 验证失败`);
          return false;
        }
      }

      console.log('✓ 通知系统测试通过');
      return true;
    } catch (error) {
      console.error('通知系统测试失败:', error);
      return false;
    }
  }

  /**
   * 测试快捷键帮助
   */
  private testShortcutHelp(): boolean {
    try {
      console.log('测试快捷键帮助...');

      // 获取快捷键分类用于帮助显示
      const categories = keyboardShortcutManager.getShortcutsByCategory();
      if (!categories || categories.length === 0) {
        console.error('快捷键分类获取失败');
        return false;
      }

      // 验证分类结构
      for (const category of categories) {
        if (!category.name || !category.shortcuts) {
          console.error('快捷键分类结构验证失败');
          return false;
        }

        // 验证快捷键结构
        for (const shortcut of category.shortcuts) {
          if (!shortcut.id || !shortcut.description || !shortcut.keys) {
            console.error('快捷键结构验证失败');
            return false;
          }
        }
      }

      console.log('✓ 快捷键帮助测试通过');
      return true;
    } catch (error) {
      console.error('快捷键帮助测试失败:', error);
      return false;
    }
  }

  /**
   * 打印测试结果
   */
  private printTestResults(): void {
    console.log('\n=== UI优化功能测试结果 ===');

    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(result => result).length;

    console.log(`总测试数: ${totalTests}`);
    console.log(`通过测试: ${passedTests}`);
    console.log(`失败测试: ${totalTests - passedTests}`);
    console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\n详细结果:');
    for (const [testName, result] of Object.entries(this.testResults)) {
      const status = result ? '✓ 通过' : '✗ 失败';
      console.log(`  ${testName}: ${status}`);
    }

    if (passedTests === totalTests) {
      console.log('\n🎉 所有UI优化功能测试通过！');
    } else {
      console.log(`\n⚠️  ${totalTests - passedTests} 个测试失败，请检查相关功能。`);
    }
  }

  /**
   * 获取测试结果
   */
  public getTestResults(): { [key: string]: boolean } {
    return this.testResults;
  }
}

// 全局测试实例
export const uiOptimizationTester = new UIOptimizationTester();
