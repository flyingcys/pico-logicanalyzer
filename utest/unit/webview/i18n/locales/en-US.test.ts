/**
 * en-US.ts 语言包测试
 * 测试英文语言包的完整性和结构
 */

import { describe, it, expect } from 'vitest';
import enUS from '../../../../../src/webview/i18n/locales/en-US';

describe('en-US.ts', () => {
  describe('语言包结构', () => {
    it('应该导出默认对象', () => {
      expect(enUS).toBeDefined();
      expect(typeof enUS).toBe('object');
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
        expect(enUS).toHaveProperty(category);
        expect(typeof enUS[category]).toBe('object');
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
        expect(enUS.common).toHaveProperty(action);
        expect(typeof enUS.common[action]).toBe('string');
        expect(enUS.common[action].length).toBeGreaterThan(0);
      });
    });

    it('应该包含状态词汇', () => {
      const statusWords = [
        'enabled', 'disabled', 'yes', 'no', 'loading', 'saving',
        'processing', 'completed', 'error', 'warning', 'info', 'success'
      ];

      statusWords.forEach(status => {
        expect(enUS.common).toHaveProperty(status);
        expect(typeof enUS.common[status]).toBe('string');
      });
    });

    it('应该包含连接相关词汇', () => {
      expect(enUS.common).toHaveProperty('connect');
      expect(enUS.common).toHaveProperty('disconnect');
      expect(enUS.common.connect).toBe('Connect');
      expect(enUS.common.disconnect).toBe('Disconnect');
    });
  });

  describe('device 设备管理', () => {
    it('应该包含设备连接相关翻译', () => {
      const deviceFields = [
        'title', 'connected', 'disconnected', 'connect', 'connecting',
        'name', 'type', 'version', 'serialNumber', 'status'
      ];

      deviceFields.forEach(field => {
        expect(enUS.device).toHaveProperty(field);
        expect(typeof enUS.device[field]).toBe('string');
        expect(enUS.device[field].length).toBeGreaterThan(0);
      });
    });

    it('应该包含设备能力相关翻译', () => {
      const capabilityFields = [
        'capabilities', 'channels', 'maxSampleRate', 'bufferSize', 'triggerTypes'
      ];

      capabilityFields.forEach(field => {
        expect(enUS.device).toHaveProperty(field);
        expect(typeof enUS.device[field]).toBe('string');
      });
    });

    it('应该包含连接设置翻译', () => {
      const connectionFields = [
        'connectionSettings', 'port', 'baudRate', 'timeout', 'retryCount'
      ];

      connectionFields.forEach(field => {
        expect(enUS.device).toHaveProperty(field);
        expect(typeof enUS.device[field]).toBe('string');
      });
    });
  });

  describe('capture 采集设置', () => {
    it('应该包含基本采集设置', () => {
      const basicFields = [
        'title', 'basic', 'advanced', 'channels', 'triggers',
        'frequency', 'duration', 'samples', 'preTrigger', 'postTrigger'
      ];

      basicFields.forEach(field => {
        expect(enUS.capture).toHaveProperty(field);
        expect(typeof enUS.capture[field]).toBe('string');
      });
    });

    it('应该包含触发类型', () => {
      const triggerTypes = [
        'triggerType', 'triggerChannel', 'triggerValue', 'triggerPattern',
        'edgeTrigger', 'levelTrigger', 'patternTrigger'
      ];

      triggerTypes.forEach(type => {
        expect(enUS.capture).toHaveProperty(type);
        expect(typeof enUS.capture[type]).toBe('string');
      });
    });

    it('应该包含触发边沿选项', () => {
      expect(enUS.capture.risingEdge).toBe('Rising Edge');
      expect(enUS.capture.fallingEdge).toBe('Falling Edge');
      expect(enUS.capture.bothEdges).toBe('Both Edges');
      expect(enUS.capture.highLevel).toBe('High Level');
      expect(enUS.capture.lowLevel).toBe('Low Level');
    });

    it('应该包含验证消息', () => {
      expect(enUS.capture).toHaveProperty('validation');
      expect(typeof enUS.capture.validation).toBe('object');

      const validationFields = [
        'frequencyRequired', 'durationRequired', 'channelRequired',
        'triggerChannelRequired', 'invalidFrequency', 'invalidDuration'
      ];

      validationFields.forEach(field => {
        expect(enUS.capture.validation).toHaveProperty(field);
        expect(typeof enUS.capture.validation[field]).toBe('string');
      });
    });
  });

  describe('channel 通道控制', () => {
    it('应该包含通道基本属性', () => {
      const channelProps = [
        'title', 'name', 'visible', 'hidden', 'enabled', 'disabled',
        'color', 'position', 'height', 'offset'
      ];

      channelProps.forEach(prop => {
        expect(enUS.channel).toHaveProperty(prop);
        expect(typeof enUS.channel[prop]).toBe('string');
      });
    });

    it('应该包含统计信息字段', () => {
      const statsFields = [
        'statistics', 'totalSamples', 'highSamples', 'lowSamples',
        'transitions', 'frequency', 'dutyCycle', 'pulseCount'
      ];

      statsFields.forEach(field => {
        expect(enUS.channel).toHaveProperty(field);
        expect(typeof enUS.channel[field]).toBe('string');
      });
    });

    it('应该包含操作按钮', () => {
      const operations = [
        'showAll', 'hideAll', 'selectAll', 'selectNone',
        'invertSelection', 'resetColors', 'autoArrange'
      ];

      operations.forEach(op => {
        expect(enUS.channel).toHaveProperty(op);
        expect(typeof enUS.channel[op]).toBe('string');
      });
    });
  });

  describe('decoder 协议解码器', () => {
    it('应该包含解码器基本功能', () => {
      const decoderFields = [
        'title', 'protocol', 'channels', 'settings', 'results',
        'activeDecoders', 'add', 'remove', 'configure', 'enable', 'disable'
      ];

      decoderFields.forEach(field => {
        expect(enUS.decoder).toHaveProperty(field);
        expect(typeof enUS.decoder[field]).toBe('string');
      });
    });

    it('应该包含协议类型', () => {
      const protocols = ['i2c', 'spi', 'uart', 'can', 'rs232', 'manchester', 'custom'];

      protocols.forEach(protocol => {
        expect(enUS.decoder).toHaveProperty(protocol);
        expect(typeof enUS.decoder[protocol]).toBe('string');
      });
    });

    it('应该包含协议参数', () => {
      const parameters = [
        'clockChannel', 'dataChannel', 'baudRate', 'dataBits',
        'stopBits', 'parity', 'bitOrder', 'msbFirst', 'lsbFirst'
      ];

      parameters.forEach(param => {
        expect(enUS.decoder).toHaveProperty(param);
        expect(typeof enUS.decoder[param]).toBe('string');
      });
    });

    it('应该包含显示选项', () => {
      const displayOptions = ['showHex', 'showAscii', 'showBinary', 'annotations'];

      displayOptions.forEach(option => {
        expect(enUS.decoder).toHaveProperty(option);
        expect(typeof enUS.decoder[option]).toBe('string');
      });
    });
  });

  describe('measurement 测量工具', () => {
    it('应该包含测量类型', () => {
      const measurementTypes = [
        'title', 'pulse', 'frequency', 'timing', 'statistics',
        'comparison', 'jitter'
      ];

      measurementTypes.forEach(type => {
        expect(enUS.measurement).toHaveProperty(type);
        expect(typeof enUS.measurement[type]).toBe('string');
      });
    });

    it('应该包含时间参数', () => {
      const timeParams = [
        'timeRange', 'startTime', 'endTime', 'duration', 'period',
        'riseTime', 'fallTime'
      ];

      timeParams.forEach(param => {
        expect(enUS.measurement).toHaveProperty(param);
        expect(typeof enUS.measurement[param]).toBe('string');
      });
    });

    it('应该包含统计参数', () => {
      const statsParams = [
        'minimum', 'maximum', 'average', 'standardDeviation',
        'variance', 'rms'
      ];

      statsParams.forEach(param => {
        expect(enUS.measurement).toHaveProperty(param);
        expect(typeof enUS.measurement[param]).toBe('string');
      });
    });
  });

  describe('status 状态栏', () => {
    it('应该包含状态文本', () => {
      const statusTexts = [
        'ready', 'preparing', 'capturing', 'processing', 'completed', 'error'
      ];

      statusTexts.forEach(status => {
        expect(enUS.status).toHaveProperty(status);
        expect(typeof enUS.status[status]).toBe('string');
      });
    });

    it('应该包含信息显示', () => {
      const infoFields = [
        'samples', 'frequency', 'duration', 'channels', 'decoders',
        'hasData', 'performance', 'cpu', 'memory', 'file', 'modified', 'zoom', 'time'
      ];

      infoFields.forEach(field => {
        expect(enUS.status).toHaveProperty(field);
        expect(typeof enUS.status[field]).toBe('string');
      });
    });

    it('应该包含通知消息', () => {
      expect(enUS.status).toHaveProperty('notification');
      expect(typeof enUS.status.notification).toBe('object');

      const notifications = [
        'dismissed', 'captureStarted', 'captureCompleted', 'captureFailed',
        'deviceConnected', 'deviceDisconnected', 'fileLoaded', 'fileSaved',
        'settingsApplied'
      ];

      notifications.forEach(notification => {
        expect(enUS.status.notification).toHaveProperty(notification);
        expect(typeof enUS.status.notification[notification]).toBe('string');
      });
    });
  });

  describe('theme 主题管理', () => {
    it('应该包含主题模式', () => {
      const themeModes = ['title', 'mode', 'light', 'dark', 'auto'];

      themeModes.forEach(mode => {
        expect(enUS.theme).toHaveProperty(mode);
        expect(typeof enUS.theme[mode]).toBe('string');
      });
    });

    it('应该包含外观设置', () => {
      const appearanceSettings = [
        'primaryColor', 'fontSize', 'current', 'preview',
        'density', 'compact', 'default', 'comfortable'
      ];

      appearanceSettings.forEach(setting => {
        expect(enUS.theme).toHaveProperty(setting);
        expect(typeof enUS.theme[setting]).toBe('string');
      });
    });

    it('应该包含断点定义', () => {
      expect(enUS.theme).toHaveProperty('breakpoints');
      expect(typeof enUS.theme.breakpoints).toBe('object');

      const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl'];
      breakpoints.forEach(bp => {
        expect(enUS.theme.breakpoints).toHaveProperty(bp);
        expect(typeof enUS.theme.breakpoints[bp]).toBe('string');
      });
    });
  });

  describe('file 文件操作', () => {
    it('应该包含文件操作', () => {
      const fileOps = [
        'title', 'new', 'open', 'save', 'saveAs', 'close', 'recent'
      ];

      fileOps.forEach(op => {
        expect(enUS.file).toHaveProperty(op);
        expect(typeof enUS.file[op]).toBe('string');
      });
    });

    it('应该包含文件格式', () => {
      const formats = [
        'format', 'lacFormat', 'csvFormat', 'jsonFormat', 'vcdFormat'
      ];

      formats.forEach(format => {
        expect(enUS.file).toHaveProperty(format);
        expect(typeof enUS.file[format]).toBe('string');
      });
    });

    it('应该包含文件状态消息', () => {
      const messages = [
        'fileNotFound', 'fileCorrupted', 'unsavedChanges',
        'saveChanges', 'discardChanges', 'overwriteFile', 'untitled'
      ];

      messages.forEach(msg => {
        expect(enUS.file).toHaveProperty(msg);
        expect(typeof enUS.file[msg]).toBe('string');
      });
    });
  });

  describe('help 帮助信息', () => {
    it('应该包含帮助选项', () => {
      const helpOptions = [
        'title', 'userGuide', 'shortcuts', 'about', 'version',
        'documentation', 'support', 'feedback', 'updates',
        'license', 'thirdParty', 'contact'
      ];

      helpOptions.forEach(option => {
        expect(enUS.help).toHaveProperty(option);
        expect(typeof enUS.help[option]).toBe('string');
      });
    });
  });

  describe('waveform 波形显示', () => {
    it('应该包含波形控制', () => {
      const waveformControls = [
        'title', 'zoomIn', 'zoomOut', 'fitWindow', 'noData'
      ];

      waveformControls.forEach(control => {
        expect(enUS.waveform).toHaveProperty(control);
        expect(typeof enUS.waveform[control]).toBe('string');
      });
    });

    it('应该包含无数据提示', () => {
      expect(enUS.waveform.noData).toBe('No data available, please start data capture first');
    });
  });

  describe('error 错误消息', () => {
    it('应该包含常见错误类型', () => {
      const errorTypes = [
        'unknown', 'network', 'timeout', 'permission', 'notSupported',
        'invalidInput', 'deviceNotFound', 'connectionLost', 'bufferOverflow',
        'memoryError', 'fileError', 'protocolError', 'configError'
      ];

      errorTypes.forEach(error => {
        expect(enUS.error).toHaveProperty(error);
        expect(typeof enUS.error[error]).toBe('string');
      });
    });

    it('应该包含错误处理选项', () => {
      const errorActions = ['retry', 'ignore', 'reportBug'];

      errorActions.forEach(action => {
        expect(enUS.error).toHaveProperty(action);
        expect(typeof enUS.error[action]).toBe('string');
      });
    });

    it('应该包含API错误', () => {
      expect(enUS.error).toHaveProperty('apiNotAvailable');
      expect(enUS.error.apiNotAvailable).toBe('VSCode API not available');
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

      checkObject(enUS);
    });

    it('应该使用正确的英文语法', () => {
      // 检查一些关键的大写和标点
      expect(enUS.common.ok).toBe('OK');
      expect(enUS.device.title).toBe('Device Manager');
      expect(enUS.capture.title).toBe('Capture Settings');
      
      // 检查状态消息应该以动名词结尾
      expect(enUS.common.loading).toMatch(/\.{3}$/);
      expect(enUS.common.saving).toMatch(/\.{3}$/);
      expect(enUS.common.processing).toMatch(/\.{3}$/);
    });

    it('协议名称应该使用正确的大写', () => {
      expect(enUS.decoder.i2c).toBe('I2C');
      expect(enUS.decoder.spi).toBe('SPI');
      expect(enUS.decoder.uart).toBe('UART');
      expect(enUS.decoder.can).toBe('CAN');
      expect(enUS.decoder.rs232).toBe('RS232');
    });

    it('单位和技术术语应该正确', () => {
      expect(enUS.measurement.rms).toBe('RMS');
      expect(enUS.decoder.msbFirst).toBe('MSB First');
      expect(enUS.decoder.lsbFirst).toBe('LSB First');
    });
  });

  describe('一致性检查', () => {
    it('相同概念应该使用一致的翻译', () => {
      // 检查"频率"的一致性
      expect(enUS.capture.frequency).toBe('Sample Frequency');
      expect(enUS.channel.frequency).toBe('Frequency');
      expect(enUS.measurement.frequency).toBe('Frequency Measurement');
      
      // 检查"通道"的一致性
      expect(enUS.device.channels).toBe('Channels');
      expect(enUS.capture.channels).toBe('Channel Selection');
      expect(enUS.decoder.channels).toBe('Channel Assignment');
    });

    it('动作词汇应该保持一致', () => {
      expect(enUS.common.connect).toBe('Connect');
      expect(enUS.device.connect).toBe('Connect Device');
      
      expect(enUS.common.export).toBe('Export');
      expect(enUS.file.exportAs).toBe('Export As');
      expect(enUS.decoder.export).toBe('Export Results');
    });
  });
});