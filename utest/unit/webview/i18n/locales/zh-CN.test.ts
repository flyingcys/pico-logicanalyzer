/**
 * zh-CN.ts 语言包测试
 * 测试中文语言包的完整性和结构
 */

import { describe, it, expect } from 'vitest';
import zhCN from '../../../../../src/webview/i18n/locales/zh-CN';

describe('zh-CN.ts', () => {
  describe('语言包结构', () => {
    it('应该导出默认对象', () => {
      expect(zhCN).toBeDefined();
      expect(typeof zhCN).toBe('object');
    });

    it('应该包含所有必需的主要分类', () => {
      const requiredCategories = [
        'common',
        'device',
        'capture',
        'channel',
        'decoder',
        'measurement',
        'status',
        'theme',
        'file',
        'help',
        'waveform',
        'error'
      ];

      requiredCategories.forEach(category => {
        expect(zhCN).toHaveProperty(category);
        expect(typeof zhCN[category]).toBe('object');
      });
    });
  });

  describe('common 通用词汇', () => {
    it('应该包含基本操作词汇', () => {
      const basicActions = [
        'ok', 'cancel', 'close', 'save', 'load', 'export', 'import',
        'reset', 'clear', 'delete', 'add', 'edit', 'search', 'filter'
      ];

      basicActions.forEach(action => {
        expect(zhCN.common).toHaveProperty(action);
        expect(typeof zhCN.common[action]).toBe('string');
        expect(zhCN.common[action].length).toBeGreaterThan(0);
      });
    });

    it('应该使用正确的中文翻译', () => {
      expect(zhCN.common.ok).toBe('确定');
      expect(zhCN.common.cancel).toBe('取消');
      expect(zhCN.common.save).toBe('保存');
      expect(zhCN.common.load).toBe('加载');
      expect(zhCN.common.export).toBe('导出');
      expect(zhCN.common.import).toBe('导入');
    });

    it('应该包含状态词汇', () => {
      const statusWords = [
        'enabled', 'disabled', 'yes', 'no', 'loading', 'saving',
        'processing', 'completed', 'error', 'warning', 'info', 'success'
      ];

      statusWords.forEach(status => {
        expect(zhCN.common).toHaveProperty(status);
        expect(typeof zhCN.common[status]).toBe('string');
      });
    });

    it('应该正确翻译状态词汇', () => {
      expect(zhCN.common.enabled).toBe('启用');
      expect(zhCN.common.disabled).toBe('禁用');
      expect(zhCN.common.yes).toBe('是');
      expect(zhCN.common.no).toBe('否');
      expect(zhCN.common.loading).toBe('加载中...');
      expect(zhCN.common.processing).toBe('处理中...');
    });
  });

  describe('device 设备管理', () => {
    it('应该包含设备连接相关翻译', () => {
      const deviceFields = [
        'title', 'connected', 'disconnected', 'connect', 'connecting',
        'name', 'type', 'version', 'status'
      ];

      deviceFields.forEach(field => {
        expect(zhCN.device).toHaveProperty(field);
        expect(typeof zhCN.device[field]).toBe('string');
        expect(zhCN.device[field].length).toBeGreaterThan(0);
      });
    });

    it('应该使用正确的设备翻译', () => {
      expect(zhCN.device.title).toBe('设备管理');
      expect(zhCN.device.connected).toBe('设备已连接');
      expect(zhCN.device.disconnected).toBe('设备未连接');
      expect(zhCN.device.connect).toBe('连接设备');
      expect(zhCN.device.connecting).toBe('连接中...');
    });
  });

  describe('capture 采集设置', () => {
    it('应该包含基本采集设置', () => {
      const basicFields = [
        'title', 'basic', 'advanced', 'channels', 'triggers',
        'frequency', 'duration', 'samples'
      ];

      basicFields.forEach(field => {
        expect(zhCN.capture).toHaveProperty(field);
        expect(typeof zhCN.capture[field]).toBe('string');
      });
    });

    it('应该使用正确的采集翻译', () => {
      expect(zhCN.capture.title).toBe('采集设置');
      expect(zhCN.capture.basic).toBe('基本设置');
      expect(zhCN.capture.advanced).toBe('高级设置');
      expect(zhCN.capture.channels).toBe('通道选择');
      expect(zhCN.capture.frequency).toBe('采样频率');
    });

    it('应该包含触发相关翻译', () => {
      expect(zhCN.capture.risingEdge).toBe('上升沿');
      expect(zhCN.capture.fallingEdge).toBe('下降沿');
      expect(zhCN.capture.bothEdges).toBe('双边沿');
    });
  });

  describe('文本质量检查', () => {
    it('所有文本应该非空', () => {
      const checkObject = (obj: any, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string') {
            expect(value.length, `${currentPath} should not be empty`).toBeGreaterThan(0);
            expect(value.trim(), `${currentPath} should not be only whitespace`).toBe(value);
          } else if (typeof value === 'object' && value !== null) {
            checkObject(value, currentPath);
          }
        }
      };

      checkObject(zhCN);
    });

    it('应该使用正确的中文标点符号', () => {
      // 检查省略号
      expect(zhCN.common.loading).toMatch(/\.{3}$/);
      expect(zhCN.common.saving).toMatch(/\.{3}$/);
      expect(zhCN.common.processing).toMatch(/\.{3}$/);
    });

    it('应该保持专业术语的一致性', () => {
      // 检查技术术语的一致性
      if (zhCN.decoder?.i2c) expect(zhCN.decoder.i2c).toBe('I2C');
      if (zhCN.decoder?.spi) expect(zhCN.decoder.spi).toBe('SPI');
      if (zhCN.decoder?.uart) expect(zhCN.decoder.uart).toBe('UART');
    });
  });

  describe('中文特定检查', () => {
    it('应该使用简体中文字符', () => {
      // 检查一些常见的繁体简体差异
      const checkSimplified = (obj: any) => {
        for (const value of Object.values(obj)) {
          if (typeof value === 'string') {
            // 检查是否包含常见繁体字，应该使用简体
            expect(value).not.toMatch(/設備/); // 应该是 "设备"
            expect(value).not.toMatch(/連接/); // 应该是 "连接"
            expect(value).not.toMatch(/頻率/); // 应该是 "频率"
            expect(value).not.toMatch(/設置/); // 应该是 "设置"
          } else if (typeof value === 'object' && value !== null) {
            checkSimplified(value);
          }
        }
      };

      checkSimplified(zhCN);
    });

    it('应该使用合适的动词形式', () => {
      // 中文中的动作词汇应该简洁
      expect(zhCN.common.connect).toBe('连接');
      expect(zhCN.common.disconnect).toBe('断开');
      expect(zhCN.common.start).toBe('开始');
      expect(zhCN.common.stop).toBe('停止');
    });

    it('应该避免过长的翻译', () => {
      const checkLength = (obj: any, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string') {
            // 中文翻译通常应该比较简洁，避免过长
            expect(value.length, `${currentPath} should not be too long`).toBeLessThan(50);
          } else if (typeof value === 'object' && value !== null) {
            checkLength(value, currentPath);
          }
        }
      };

      checkLength(zhCN);
    });
  });

  describe('键值对完整性', () => {
    it('应该包含所有必要的通用操作', () => {
      const essentialActions = [
        'ok', 'cancel', 'save', 'load', 'export', 'import',
        'connect', 'disconnect', 'start', 'stop'
      ];

      essentialActions.forEach(action => {
        expect(zhCN.common, `Missing essential action: ${action}`).toHaveProperty(action);
      });
    });

    it('应该包含所有设备管理必需项', () => {
      const essentialDeviceFields = [
        'title', 'connected', 'disconnected', 'connect'
      ];

      essentialDeviceFields.forEach(field => {
        expect(zhCN.device, `Missing essential device field: ${field}`).toHaveProperty(field);
      });
    });

    it('应该包含所有采集设置必需项', () => {
      const essentialCaptureFields = [
        'title', 'frequency', 'channels', 'start', 'stop'
      ];

      essentialCaptureFields.forEach(field => {
        expect(zhCN.capture, `Missing essential capture field: ${field}`).toHaveProperty(field);
      });
    });
  });

  describe('语法正确性', () => {
    it('状态消息应该保持一致的格式', () => {
      // 进行中的状态应该以"中..."结尾
      if (zhCN.common.loading) expect(zhCN.common.loading).toMatch(/中\.{3}$/);
      if (zhCN.common.saving) expect(zhCN.common.saving).toMatch(/中\.{3}$/);
      if (zhCN.common.processing) expect(zhCN.common.processing).toMatch(/中\.{3}$/);
      if (zhCN.device?.connecting) expect(zhCN.device.connecting).toMatch(/中\.{3}$/);
    });

    it('应该使用正确的中文语法结构', () => {
      // 检查标题应该简洁明了
      expect(zhCN.device.title).toBe('设备管理');
      expect(zhCN.capture.title).toBe('采集设置');
      
      // 检查连接相关的翻译
      expect(zhCN.device.connected).toBe('设备已连接');
      expect(zhCN.device.disconnected).toBe('设备未连接');
    });
  });
});