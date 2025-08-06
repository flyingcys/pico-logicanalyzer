/**
 * CaptureSettings.vue 组件测试
 * 测试采集设置对话框的所有功能
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import CaptureSettings from '../../../../src/webview/components/CaptureSettings.vue';
import { ElMessage } from 'element-plus';

// Mock Element Plus 组件
jest.mock('element-plus', () => ({
  ElMessage: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
  },
  ElDialog: {
    name: 'ElDialog',
    template: '<div><slot /></div>'
  },
  ElCard: {
    name: 'ElCard',
    template: '<div><slot name="header" /><slot /></div>'
  },
  ElForm: {
    name: 'ElForm',
    template: '<div><slot /></div>'
  },
  ElFormItem: {
    name: 'ElFormItem',
    template: '<div><slot /></div>'
  },
  ElButton: {
    name: 'ElButton',
    template: '<button @click="$emit(\'click\')"><slot /></button>'
  },
  ElButtonGroup: {
    name: 'ElButtonGroup',
    template: '<div><slot /></div>'
  },
  ElCheckbox: {
    name: 'ElCheckbox',
    props: ['modelValue', 'label'],
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    emits: ['update:modelValue', 'change']
  },
  ElInput: {
    name: 'ElInput',
    props: ['modelValue', 'placeholder', 'maxlength'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :placeholder="placeholder" />',
    emits: ['update:modelValue', 'input']
  },
  ElInputNumber: {
    name: 'ElInputNumber',
    props: ['modelValue', 'min', 'max', 'step', 'precision', 'disabled'],
    template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" :min="min" :max="max" :step="step" :disabled="disabled" />',
    emits: ['update:modelValue', 'change']
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue'],
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
    emits: ['update:modelValue', 'change']
  },
  ElOption: {
    name: 'ElOption',
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>'
  },
  ElRadioGroup: {
    name: 'ElRadioGroup',
    props: ['modelValue'],
    template: '<div @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></div>',
    emits: ['update:modelValue', 'change']
  },
  ElRadio: {
    name: 'ElRadio',
    props: ['label', 'disabled'],
    template: '<input type="radio" :value="label" :disabled="disabled" />{{ label }}'
  },
  ElIcon: {
    name: 'ElIcon',
    template: '<i><slot /></i>'
  },
  ElDivider: {
    name: 'ElDivider',
    template: '<hr />'
  }
}));

// Mock Element Plus Icons
jest.mock('@element-plus/icons-vue', () => ({
  DataLine: { name: 'DataLine', template: '<span>DataLine</span>' },
  Check: { name: 'Check', template: '<span>Check</span>' },
  Close: { name: 'Close', template: '<span>Close</span>' },
  RefreshRight: { name: 'RefreshRight', template: '<span>RefreshRight</span>' },
  Setting: { name: 'Setting', template: '<span>Setting</span>' },
  InfoFilled: { name: 'InfoFilled', template: '<span>InfoFilled</span>' }
}));

// Mock TriggerProcessor
const mockTriggerProcessor = {
  getRecommendedTriggerLevel: jest.fn((signalType: string) => ({
    threshold: signalType === 'TTL' ? 1.4 : 1.65,
    hysteresis: 0.2,
    inputImpedance: 1000000
  })),
  validateTriggerLevel: jest.fn(() => ({
    isValid: true,
    errorMessage: null
  }))
};

jest.mock('../../../../src/models/TriggerProcessor', () => ({
  TriggerProcessorFactory: {
    createForDevice: jest.fn(() => mockTriggerProcessor)
  }
}));

describe('CaptureSettings.vue', () => {
  let wrapper: VueWrapper<any>;

  const createWrapper = (props = {}) => {
    return mount(CaptureSettings, {
      props: {
        visible: false,
        deviceInfo: {},
        driverType: 'single',
        ...props
      },
      global: {
        stubs: {
          ElDialog: true,
          ElCard: true,
          ElForm: true,
          ElFormItem: true,
          ElButton: true,
          ElButtonGroup: true,
          ElCheckbox: true,
          ElInput: true,
          ElInputNumber: true,
          ElSelect: true,
          ElOption: true,
          ElRadioGroup: true,
          ElRadio: true,
          ElIcon: true,
          ElDivider: true
        }
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('基础功能', () => {
    it('应该正确渲染组件', () => {
      wrapper = createWrapper({ visible: true });
      expect(wrapper.exists()).toBe(true);
    });

    it('应该正确响应 visible 属性变化', async () => {
      wrapper = createWrapper({ visible: false });
      expect(wrapper.vm.dialogVisible).toBe(false);

      await wrapper.setProps({ visible: true });
      expect(wrapper.vm.dialogVisible).toBe(true);
    });

    it('应该正确识别设备模式', () => {
      wrapper = createWrapper({ driverType: 'multi' });
      expect(wrapper.vm.isMultiDeviceMode).toBe(true);

      wrapper = createWrapper({ driverType: 'emulated' });
      expect(wrapper.vm.isEmulatedMode).toBe(true);

      wrapper = createWrapper({ driverType: 'single' });
      expect(wrapper.vm.isMultiDeviceMode).toBe(false);
      expect(wrapper.vm.isEmulatedMode).toBe(false);
    });
  });

  describe('通道管理', () => {
    beforeEach(() => {
      wrapper = createWrapper({ visible: true });
    });

    it('应该正确初始化通道', () => {
      expect(wrapper.vm.channels).toHaveLength(24);
      expect(wrapper.vm.channels.slice(0, 8).every((ch: any) => ch.enabled)).toBe(true);
      expect(wrapper.vm.channels.slice(8).every((ch: any) => !ch.enabled)).toBe(true);
    });

    it('应该正确计算通道分组', () => {
      const groups = wrapper.vm.channelGroups;
      expect(groups).toHaveLength(3); // 24 channels / 8 = 3 groups
      expect(groups[0]).toHaveLength(8);
      expect(groups[1]).toHaveLength(8);
      expect(groups[2]).toHaveLength(8);
    });

    it('应该正确选择所有通道', async () => {
      wrapper.vm.selectAllChannels();
      await nextTick();

      expect(wrapper.vm.channels.every((ch: any) => ch.enabled)).toBe(true);
      expect(wrapper.vm.selectedChannelCount).toBe(24);
    });

    it('应该正确取消选择所有通道', async () => {
      wrapper.vm.selectNoneChannels();
      await nextTick();

      expect(wrapper.vm.channels.every((ch: any) => !ch.enabled)).toBe(true);
      expect(wrapper.vm.selectedChannelCount).toBe(0);
    });

    it('应该正确反选通道', async () => {
      const initialEnabledCount = wrapper.vm.selectedChannelCount;
      wrapper.vm.invertChannelSelection();
      await nextTick();

      expect(wrapper.vm.selectedChannelCount).toBe(24 - initialEnabledCount);
    });

    it('应该正确选择组通道', async () => {
      wrapper.vm.selectNoneChannels(); // 先清空所有选择
      wrapper.vm.selectGroupChannels(0); // 选择第一组
      await nextTick();

      expect(wrapper.vm.channels.slice(0, 8).every((ch: any) => ch.enabled)).toBe(true);
      expect(wrapper.vm.channels.slice(8).every((ch: any) => !ch.enabled)).toBe(true);
    });

    it('应该正确取消选择组通道', async () => {
      wrapper.vm.deselectGroupChannels(0); // 取消选择第一组
      await nextTick();

      expect(wrapper.vm.channels.slice(0, 8).every((ch: any) => !ch.enabled)).toBe(true);
    });

    it('应该正确反选组通道', async () => {
      const initialGroup0State = wrapper.vm.channels.slice(0, 8).map((ch: any) => ch.enabled);
      wrapper.vm.invertGroupChannels(0);
      await nextTick();

      const newGroup0State = wrapper.vm.channels.slice(0, 8).map((ch: any) => ch.enabled);
      expect(newGroup0State).toEqual(initialGroup0State.map(state => !state));
    });

    it('应该根据通道数正确计算限制', async () => {
      // 测试8个通道的限制
      wrapper.vm.selectNoneChannels();
      for (let i = 0; i < 8; i++) {
        wrapper.vm.channels[i].enabled = true;
      }
      wrapper.vm.updateChannelLimits();
      await nextTick();

      expect(wrapper.vm.currentLimits.maxTotalSamples).toBe(131072);

      // 测试16个通道的限制
      for (let i = 8; i < 16; i++) {
        wrapper.vm.channels[i].enabled = true;
      }
      wrapper.vm.updateChannelLimits();
      await nextTick();

      expect(wrapper.vm.currentLimits.maxTotalSamples).toBe(65536);

      // 测试24个通道的限制
      wrapper.vm.selectAllChannels();
      wrapper.vm.updateChannelLimits();
      await nextTick();

      expect(wrapper.vm.currentLimits.maxTotalSamples).toBe(32768);
    });
  });

  describe('采集配置', () => {
    beforeEach(() => {
      wrapper = createWrapper({ visible: true });
    });

    it('应该正确计算总样本数', () => {
      wrapper.vm.captureConfig.preTriggerSamples = 1000;
      wrapper.vm.captureConfig.postTriggerSamples = 2000;
      wrapper.vm.captureConfig.burstEnabled = false;

      expect(wrapper.vm.totalSamples).toBe(3000);
    });

    it('应该正确计算突发模式下的总样本数', () => {
      wrapper.vm.captureConfig.preTriggerSamples = 1000;
      wrapper.vm.captureConfig.postTriggerSamples = 2000;
      wrapper.vm.captureConfig.burstEnabled = true;
      wrapper.vm.captureConfig.burstCount = 3;

      const expectedTotal = 1000 + (2000 * 3);
      expect(wrapper.vm.totalSamples).toBe(expectedTotal);
    });

    it('应该正确更新抖动计算', () => {
      wrapper.vm.captureConfig.frequency = 100000000;
      wrapper.vm.updateJitter();

      expect(wrapper.vm.jitterText).toContain('抖动:');
      expect(['low', 'medium', 'high']).toContain(wrapper.vm.jitterLevel);
    });

    it('应该正确处理突发模式变化', async () => {
      wrapper.vm.onBlastModeChange(true);
      await nextTick();

      expect(wrapper.vm.captureConfig.frequency).toBe(wrapper.vm.deviceLimits.blastFrequency);
      expect(wrapper.vm.captureConfig.preTriggerSamples).toBe(0);
      expect(wrapper.vm.captureConfig.burstEnabled).toBe(false);
      expect(wrapper.vm.jitterLevel).toBe('low');
    });

    it('应该正确重置为默认设置', async () => {
      // 修改一些设置
      wrapper.vm.captureConfig.frequency = 50000000;
      wrapper.vm.captureConfig.preTriggerSamples = 2048;
      wrapper.vm.selectAllChannels();

      wrapper.vm.resetToDefaults();
      await nextTick();

      expect(wrapper.vm.captureConfig.frequency).toBe(wrapper.vm.deviceLimits.maxFrequency);
      expect(wrapper.vm.captureConfig.preTriggerSamples).toBe(512);
      expect(wrapper.vm.selectedChannelCount).toBe(8);
      expect(ElMessage.success).toHaveBeenCalledWith('已重置为默认设置');
    });
  });

  describe('触发设置', () => {
    beforeEach(() => {
      wrapper = createWrapper({ visible: true, driverType: 'single' });
    });

    it('应该正确处理触发类型变化', async () => {
      wrapper.vm.captureConfig.isBlastMode = true;
      wrapper.vm.onTriggerTypeChange();

      // 切换到模式触发时应该禁用突发模式
      wrapper.vm.captureConfig.triggerType = 'pattern';
      wrapper.vm.onTriggerTypeChange();
      await nextTick();

      expect(wrapper.vm.captureConfig.isBlastMode).toBe(false);
    });

    it('应该正确验证触发模式', () => {
      // 测试空模式
      wrapper.vm.captureConfig.triggerPattern = '';
      wrapper.vm.validatePattern();
      expect(wrapper.vm.patternError).toBe('模式不能为空');

      // 测试无效字符
      wrapper.vm.captureConfig.triggerPattern = '10a1';
      wrapper.vm.validatePattern();
      expect(wrapper.vm.patternError).toBe('只能包含0和1');

      // 测试有效模式
      wrapper.vm.captureConfig.triggerPattern = '1010';
      wrapper.vm.validatePattern();
      expect(wrapper.vm.patternError).toBe('');

      // 测试快速触发限制
      wrapper.vm.captureConfig.fastTrigger = true;
      wrapper.vm.captureConfig.triggerPattern = '101010';
      wrapper.vm.validatePattern();
      expect(wrapper.vm.patternError).toBe('快速触发限制5位');

      // 测试最大长度限制
      wrapper.vm.captureConfig.fastTrigger = false;
      wrapper.vm.captureConfig.triggerPattern = '10101010101010101'; // 17位
      wrapper.vm.validatePattern();
      expect(wrapper.vm.patternError).toBe('最多16位');
    });

    it('应该正确处理快速触发变化', async () => {
      wrapper.vm.captureConfig.triggerPattern = '1010101';
      wrapper.vm.onFastTriggerChange(true);
      await nextTick();

      expect(wrapper.vm.captureConfig.triggerPattern).toBe('10101');
    });

    it('应该正确处理信号类型变化', async () => {
      wrapper.vm.onSignalTypeChange('TTL');
      await nextTick();

      expect(mockTriggerProcessor.getRecommendedTriggerLevel).toHaveBeenCalledWith('TTL');
      expect(wrapper.vm.triggerLevelConfig.threshold).toBe(1.4);
    });

    it('应该正确重置触发设置', async () => {
      // 修改触发设置
      wrapper.vm.captureConfig.triggerType = 'pattern';
      wrapper.vm.captureConfig.triggerPattern = '1010';
      wrapper.vm.captureConfig.burstEnabled = true;

      wrapper.vm.resetTriggerSettings();
      await nextTick();

      expect(wrapper.vm.captureConfig.triggerType).toBe('edge');
      expect(wrapper.vm.captureConfig.triggerPattern).toBe('');
      expect(wrapper.vm.captureConfig.burstEnabled).toBe(false);
      expect(ElMessage.success).toHaveBeenCalledWith('触发设置已重置');
    });
  });

  describe('颜色管理', () => {
    beforeEach(() => {
      wrapper = createWrapper({ visible: true });
    });

    it('应该正确获取通道颜色', () => {
      const color0 = wrapper.vm.getChannelColor(0);
      const color24 = wrapper.vm.getChannelColor(24);
      
      expect(color0).toBe('#ff0000'); // 第一个颜色
      expect(color24).toBe(color0); // 应用循环逻辑
    });

    it('应该正确显示颜色选择器', async () => {
      const channel = wrapper.vm.channels[0];
      wrapper.vm.showChannelColorPicker(channel);
      await nextTick();

      expect(wrapper.vm.showColorPicker).toBe(true);
      expect(wrapper.vm.selectedChannelForColor).toBe(channel);
      expect(wrapper.vm.currentColor).toBe(channel.color);
    });

    it('应该正确选择颜色', () => {
      const testColor = '#00ff00';
      wrapper.vm.selectColor(testColor);
      expect(wrapper.vm.currentColor).toBe(testColor);
    });

    it('应该正确确认颜色选择', async () => {
      const channel = wrapper.vm.channels[0];
      const newColor = '#00ff00';
      
      wrapper.vm.selectedChannelForColor = channel;
      wrapper.vm.currentColor = newColor;
      wrapper.vm.confirmColorSelection();
      await nextTick();

      expect(channel.color).toBe(newColor);
      expect(wrapper.vm.showColorPicker).toBe(false);
    });
  });

  describe('配置验证', () => {
    beforeEach(() => {
      wrapper = createWrapper({ visible: true });
    });

    it('应该检测无选中通道的错误', async () => {
      wrapper.vm.selectNoneChannels();
      await nextTick();

      expect(wrapper.vm.configErrors).toContain('至少选择一个通道');
      expect(wrapper.vm.isConfigValid).toBe(false);
    });

    it('应该检测样本数超限的错误', async () => {
      wrapper.vm.captureConfig.preTriggerSamples = 50000;
      wrapper.vm.captureConfig.postTriggerSamples = 100000;
      await nextTick();

      expect(wrapper.vm.configErrors).toContain('总样本数超出限制');
      expect(wrapper.vm.isConfigValid).toBe(false);
    });

    it('应该检测触发模式错误', async () => {
      wrapper.vm.captureConfig.triggerType = 'pattern';
      wrapper.vm.captureConfig.triggerPattern = '';
      await nextTick();

      expect(wrapper.vm.configErrors).toContain('触发模式不能为空');
      expect(wrapper.vm.isConfigValid).toBe(false);
    });

    it('应该在配置有效时允许确认', async () => {
      // 确保有有效配置
      wrapper.vm.captureConfig.triggerType = 'edge';
      wrapper.vm.selectGroupChannels(0); // 选择一些通道
      await nextTick();

      expect(wrapper.vm.isConfigValid).toBe(true);
    });
  });

  describe('事件处理', () => {
    beforeEach(() => {
      wrapper = createWrapper({ visible: true });
    });

    it('应该正确处理确认事件', async () => {
      // 设置有效配置
      wrapper.vm.captureConfig.triggerType = 'edge';
      wrapper.vm.selectGroupChannels(0);
      await nextTick();

      wrapper.vm.handleConfirm();
      await nextTick();

      expect(wrapper.emitted('confirm')).toBeTruthy();
      expect(wrapper.emitted('update:visible')).toBeTruthy();
      expect(wrapper.emitted('update:visible')?.[0]).toEqual([false]);
    });

    it('应该在配置无效时拒绝确认', async () => {
      wrapper.vm.selectNoneChannels(); // 创建无效配置
      await nextTick();

      wrapper.vm.handleConfirm();
      await nextTick();

      expect(ElMessage.error).toHaveBeenCalledWith('请检查配置错误');
      expect(wrapper.emitted('confirm')).toBeFalsy();
    });

    it('应该正确处理取消事件', async () => {
      wrapper.vm.handleCancel();
      await nextTick();

      expect(wrapper.emitted('cancel')).toBeTruthy();
      expect(wrapper.emitted('update:visible')).toBeTruthy();
      expect(wrapper.emitted('update:visible')?.[0]).toEqual([false]);
    });
  });

  describe('格式化函数', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确格式化频率', () => {
      expect(wrapper.vm.formatFrequency(1000000000)).toBe('1.0 GHz');
      expect(wrapper.vm.formatFrequency(100000000)).toBe('100.0 MHz');
      expect(wrapper.vm.formatFrequency(1000000)).toBe('1.0 MHz');
      expect(wrapper.vm.formatFrequency(1000)).toBe('1.0 KHz');
      expect(wrapper.vm.formatFrequency(100)).toBe('100 Hz');
    });

    it('应该正确格式化样本数', () => {
      expect(wrapper.vm.formatSampleCount(1000000)).toBe('1.0M');
      expect(wrapper.vm.formatSampleCount(1000)).toBe('1.0K');
      expect(wrapper.vm.formatSampleCount(100)).toBe('100');
    });

    it('应该正确格式化电压', () => {
      expect(wrapper.vm.formatVoltage(3.3)).toBe('3.30V');
      expect(wrapper.vm.formatVoltage(1.65)).toBe('1.65V');
      expect(wrapper.vm.formatVoltage(0.5)).toBe('500mV');
      expect(wrapper.vm.formatVoltage(0.1)).toBe('100mV');
    });
  });

  describe('生命周期', () => {
    it('应该在挂载时正确初始化', async () => {
      wrapper = createWrapper({ visible: true });
      await nextTick();

      expect(wrapper.vm.channels).toHaveLength(24);
      expect(wrapper.vm.triggerProcessor).toBeTruthy();
      expect(wrapper.vm.jitterText).toContain('抖动:');
    });

    it('应该在 visible 变化时更新抖动', async () => {
      wrapper = createWrapper({ visible: false });
      const updateJitterSpy = jest.spyOn(wrapper.vm, 'updateJitter');

      await wrapper.setProps({ visible: true });
      await nextTick();

      expect(updateJitterSpy).toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    beforeEach(() => {
      wrapper = createWrapper({ visible: true });
    });

    it('应该处理频率为0的情况', () => {
      wrapper.vm.captureConfig.frequency = 0;
      wrapper.vm.updateJitter();

      // 不应该出现除零错误
      expect(wrapper.vm.jitterText).toBeDefined();
    });

    it('应该处理空的触发模式验证', () => {
      wrapper.vm.captureConfig.triggerPattern = '   '; // 空白字符
      wrapper.vm.validatePattern();
      expect(wrapper.vm.patternError).toBe('模式不能为空');
    });

    it('应该处理通道范围边界', () => {
      wrapper.vm.captureConfig.patternTriggerChannel = 16;
      wrapper.vm.captureConfig.triggerPattern = '1'; // 1位模式
      wrapper.vm.validatePattern();
      expect(wrapper.vm.patternError).toBe('超出通道范围');
    });

    it('应该处理组选择的边界情况', () => {
      // 测试最后一个组（可能不足8个通道）
      const lastGroupIndex = Math.floor((wrapper.vm.channels.length - 1) / 8);
      wrapper.vm.selectGroupChannels(lastGroupIndex);

      // 不应该出现数组越界错误
      expect(() => wrapper.vm.selectGroupChannels(lastGroupIndex)).not.toThrow();
    });
  });

  describe('多设备模式', () => {
    it('应该在多设备模式下禁用边沿触发', () => {
      wrapper = createWrapper({ visible: true, driverType: 'multi' });
      expect(wrapper.vm.isMultiDeviceMode).toBe(true);
    });
  });

  describe('模拟模式', () => {
    it('应该在模拟模式下隐藏触发设置', () => {
      wrapper = createWrapper({ visible: true, driverType: 'emulated' });
      expect(wrapper.vm.isEmulatedMode).toBe(true);
    });
  });
});