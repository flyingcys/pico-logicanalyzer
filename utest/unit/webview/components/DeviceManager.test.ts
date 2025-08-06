/**
 * DeviceManager.vue 组件测试
 * 测试设备管理器的所有功能
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import DeviceManager from '../../../../src/webview/components/DeviceManager.vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// Mock Element Plus 组件
jest.mock('element-plus', () => ({
  ElMessage: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
  },
  ElMessageBox: {
    confirm: jest.fn()
  },
  ElCard: {
    name: 'ElCard',
    template: '<div><slot name="header" /><slot /></div>'
  },
  ElButton: {
    name: 'ElButton',
    props: ['type', 'size', 'disabled', 'loading'],
    template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>',
    emits: ['click']
  },
  ElInput: {
    name: 'ElInput',
    props: ['modelValue', 'placeholder', 'prefixIcon', 'size', 'clearable'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :placeholder="placeholder" />',
    emits: ['update:modelValue']
  },
  ElInputNumber: {
    name: 'ElInputNumber',
    props: ['modelValue', 'min', 'max'],
    template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" :min="min" :max="max" />',
    emits: ['update:modelValue']
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'placeholder'],
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
    emits: ['update:modelValue']
  },
  ElOption: {
    name: 'ElOption',
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>'
  },
  ElTag: {
    name: 'ElTag',
    props: ['type', 'size'],
    template: '<span><slot /></span>'
  },
  ElEmpty: {
    name: 'ElEmpty',
    props: ['imageSize', 'description'],
    template: '<div>{{ description }}<slot /></div>'
  },
  ElDialog: {
    name: 'ElDialog',
    props: ['modelValue', 'title', 'width'],
    template: '<div v-if="modelValue"><h3>{{ title }}</h3><slot /><slot name="footer" /></div>',
    emits: ['update:modelValue']
  },
  ElForm: {
    name: 'ElForm',
    props: ['model', 'labelWidth'],
    template: '<form><slot /></form>'
  },
  ElFormItem: {
    name: 'ElFormItem',
    props: ['label'],
    template: '<div><label>{{ label }}</label><slot /></div>'
  },
  ElDescriptions: {
    name: 'ElDescriptions',
    props: ['column', 'border'],
    template: '<div><slot /></div>'
  },
  ElDescriptionsItem: {
    name: 'ElDescriptionsItem',
    props: ['label'],
    template: '<div><span>{{ label }}:</span><slot /></div>'
  },
  ElIcon: {
    name: 'ElIcon',
    template: '<i><slot /></i>'
  }
}));

// Mock Element Plus Icons
jest.mock('@element-plus/icons-vue', () => ({
  Connection: { name: 'Connection', template: '<span>Connection</span>' },
  Refresh: { name: 'Refresh', template: '<span>Refresh</span>' },
  Plus: { name: 'Plus', template: '<span>Plus</span>' },
  Search: { name: 'Search', template: '<span>Search</span>' },
  DataLine: { name: 'DataLine', template: '<span>DataLine</span>' },
  Timer: { name: 'Timer', template: '<span>Timer</span>' },
  Monitor: { name: 'Monitor', template: '<span>Monitor</span>' }
}));

describe('DeviceManager.vue', () => {
  let wrapper: VueWrapper<any>;

  const createWrapper = () => {
    return mount(DeviceManager, {
      global: {
        stubs: {
          ElCard: true,
          ElButton: true,
          ElInput: true,
          ElInputNumber: true,
          ElSelect: true,
          ElOption: true,
          ElTag: true,
          ElEmpty: true,
          ElDialog: true,
          ElForm: true,
          ElFormItem: true,
          ElDescriptions: true,
          ElDescriptionsItem: true,
          ElIcon: true
        }
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    jest.useRealTimers();
  });

  describe('基础功能', () => {
    it('应该正确渲染组件', () => {
      wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.device-manager').exists()).toBe(true);
    });

    it('应该在挂载时自动扫描设备', async () => {
      wrapper = createWrapper();
      expect(wrapper.vm.isScanning).toBe(true);
      
      // 等待扫描完成
      jest.advanceTimersByTime(2000);
      await nextTick();
      
      expect(wrapper.vm.isScanning).toBe(false);
      expect(wrapper.vm.availableDevices.length).toBeGreaterThan(0);
    });
  });

  describe('设备扫描', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确执行设备扫描', async () => {
      wrapper.vm.scanDevices();
      expect(wrapper.vm.isScanning).toBe(true);

      jest.advanceTimersByTime(2000);
      await nextTick();

      expect(wrapper.vm.isScanning).toBe(false);
      expect(wrapper.vm.availableDevices).toHaveLength(2);
      expect(ElMessage.success).toHaveBeenCalledWith('发现 2 个设备');
    });

    it('应该包含预期的设备信息', async () => {
      await wrapper.vm.scanDevices();
      jest.advanceTimersByTime(2000);
      await nextTick();

      const devices = wrapper.vm.availableDevices;
      expect(devices[0]).toMatchObject({
        id: 'pico-001',
        name: 'Pico Logic Analyzer',
        channels: 24,
        maxFrequency: 120000000,
        available: true,
        isNetwork: false
      });

      expect(devices[1]).toMatchObject({
        id: 'network-001',
        name: 'Network Logic Analyzer',
        channels: 16,
        isNetwork: true,
        networkAddress: '192.168.1.100:8080'
      });
    });

    it('应该处理扫描错误', async () => {
      // Mock 扫描失败
      const originalImplementation = wrapper.vm.scanDevices;
      wrapper.vm.scanDevices = jest.fn().mockRejectedValue(new Error('Scan failed'));

      try {
        await wrapper.vm.scanDevices();
      } catch (error) {
        expect(ElMessage.error).toHaveBeenCalledWith('设备扫描失败');
      }
    });
  });

  describe('设备选择和连接', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.scanDevices();
      jest.advanceTimersByTime(2000);
      await nextTick();
    });

    it('应该正确选择设备', () => {
      const device = wrapper.vm.availableDevices[0];
      wrapper.vm.selectDevice(device);
      
      expect(wrapper.vm.selectedDeviceId).toBe(device.id);
    });

    it('应该正确连接到设备', async () => {
      const device = wrapper.vm.availableDevices[0];
      
      wrapper.vm.connectToDevice(device);
      expect(wrapper.vm.connectingDeviceId).toBe(device.id);
      
      jest.advanceTimersByTime(1500);
      await nextTick();
      
      expect(wrapper.vm.connectingDeviceId).toBeNull();
      expect(wrapper.vm.currentDevice).toEqual(device);
      expect(ElMessage.success).toHaveBeenCalledWith(`已连接到设备: ${device.name}`);
    });

    it('应该处理连接失败', async () => {
      const device = wrapper.vm.availableDevices[0];
      
      // Mock 连接失败
      const originalImplementation = wrapper.vm.connectToDevice;
      wrapper.vm.connectToDevice = jest.fn().mockRejectedValue(new Error('Connection failed'));

      try {
        await wrapper.vm.connectToDevice(device);
      } catch (error) {
        expect(ElMessage.error).toHaveBeenCalledWith('设备连接失败');
      }
    });

    it('应该正确断开设备连接', async () => {
      // 先连接一个设备
      const device = wrapper.vm.availableDevices[0];
      wrapper.vm.currentDevice = device;
      
      // Mock 确认对话框
      (ElMessageBox.confirm as any).mockResolvedValue('confirm');
      
      wrapper.vm.disconnectDevice();
      expect(wrapper.vm.isDisconnecting).toBe(true);
      
      jest.advanceTimersByTime(1000);
      await nextTick();
      
      expect(wrapper.vm.isDisconnecting).toBe(false);
      expect(wrapper.vm.currentDevice).toBeNull();
      expect(ElMessage.success).toHaveBeenCalledWith(`已断开与设备 "${device.name}" 的连接`);
    });

    it('应该处理取消断开连接', async () => {
      const device = wrapper.vm.availableDevices[0];
      wrapper.vm.currentDevice = device;
      
      // Mock 取消确认对话框
      (ElMessageBox.confirm as any).mockRejectedValue('cancel');
      
      await wrapper.vm.disconnectDevice();
      
      // 设备应该仍然连接
      expect(wrapper.vm.currentDevice).toBe(device);
      expect(wrapper.vm.isDisconnecting).toBe(false);
    });
  });

  describe('设备搜索', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.scanDevices();
      jest.advanceTimersByTime(2000);
      await nextTick();
    });

    it('应该正确过滤设备列表', async () => {
      // 测试名称搜索
      wrapper.vm.searchQuery = 'Pico';
      await nextTick();
      
      expect(wrapper.vm.filteredDevices).toHaveLength(1);
      expect(wrapper.vm.filteredDevices[0].name).toContain('Pico');
      
      // 测试描述搜索
      wrapper.vm.searchQuery = '网络';
      await nextTick();
      
      expect(wrapper.vm.filteredDevices).toHaveLength(1);
      expect(wrapper.vm.filteredDevices[0].description).toContain('网络');
      
      // 测试ID搜索
      wrapper.vm.searchQuery = 'pico-001';
      await nextTick();
      
      expect(wrapper.vm.filteredDevices).toHaveLength(1);
      expect(wrapper.vm.filteredDevices[0].id).toBe('pico-001');
    });

    it('应该处理无匹配结果', async () => {
      wrapper.vm.searchQuery = 'nonexistent';
      await nextTick();
      
      expect(wrapper.vm.filteredDevices).toHaveLength(0);
    });

    it('应该在空搜索时显示所有设备', async () => {
      wrapper.vm.searchQuery = '';
      await nextTick();
      
      expect(wrapper.vm.filteredDevices).toHaveLength(wrapper.vm.availableDevices.length);
    });

    it('应该忽略大小写进行搜索', async () => {
      wrapper.vm.searchQuery = 'PICO';
      await nextTick();
      
      expect(wrapper.vm.filteredDevices).toHaveLength(1);
      expect(wrapper.vm.filteredDevices[0].name).toContain('Pico');
    });
  });

  describe('设备详情', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.scanDevices();
      jest.advanceTimersByTime(2000);
      await nextTick();
    });

    it('应该正确显示设备详情', () => {
      const device = wrapper.vm.availableDevices[0];
      
      wrapper.vm.showDeviceInfo(device);
      
      expect(wrapper.vm.selectedDeviceForInfo).toBe(device);
      expect(wrapper.vm.showDeviceInfoDialog).toBe(true);
    });

    it('应该正确显示设备能力信息', () => {
      const device = wrapper.vm.availableDevices[0];
      wrapper.vm.selectedDeviceForInfo = device;
      
      expect(device.capabilities).toBeDefined();
      expect(device.capabilities?.maxSampleRate).toBe(120000000);
      expect(device.capabilities?.streamingSupport).toBe(true);
      expect(device.capabilities?.triggerTypes).toContain('edge');
    });
  });

  describe('添加设备', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该显示添加设备对话框', async () => {
      wrapper.vm.showAddDeviceDialog = true;
      await nextTick();
      
      expect(wrapper.vm.showAddDeviceDialog).toBe(true);
    });

    it('应该有正确的默认表单值', () => {
      expect(wrapper.vm.newDeviceForm).toEqual({
        type: '',
        ipAddress: '',
        port: 8080,
        serialPort: '',
        baudRate: 115200
      });
    });

    it('应该处理添加设备操作', async () => {
      wrapper.vm.showAddDeviceDialog = true;
      
      await wrapper.vm.addDevice();
      
      expect(ElMessage.success).toHaveBeenCalledWith('设备添加功能开发中...');
      expect(wrapper.vm.showAddDeviceDialog).toBe(false);
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

    it('应该正确格式化大小', () => {
      expect(wrapper.vm.formatSize(1024 * 1024 * 2)).toBe('2.0 MB');
      expect(wrapper.vm.formatSize(1024 * 5)).toBe('5.0 KB');
      expect(wrapper.vm.formatSize(512)).toBe('512 B');
    });
  });

  describe('状态管理', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确管理扫描状态', async () => {
      expect(wrapper.vm.isScanning).toBe(true);
      
      jest.advanceTimersByTime(2000);
      await nextTick();
      
      expect(wrapper.vm.isScanning).toBe(false);
    });

    it('应该正确管理连接状态', async () => {
      const device = { id: 'test', name: 'Test Device' };
      
      wrapper.vm.connectToDevice(device);
      expect(wrapper.vm.connectingDeviceId).toBe(device.id);
      
      jest.advanceTimersByTime(1500);
      await nextTick();
      
      expect(wrapper.vm.connectingDeviceId).toBeNull();
    });

    it('应该正确管理当前设备状态', () => {
      expect(wrapper.vm.currentDevice).toBeNull();
      
      const device = { id: 'test', name: 'Test Device' };
      wrapper.vm.currentDevice = device;
      
      expect(wrapper.vm.currentDevice).toBe(device);
    });

    it('应该正确管理对话框状态', () => {
      expect(wrapper.vm.showAddDeviceDialog).toBe(false);
      expect(wrapper.vm.showDeviceInfoDialog).toBe(false);
      
      wrapper.vm.showAddDeviceDialog = true;
      wrapper.vm.showDeviceInfoDialog = true;
      
      expect(wrapper.vm.showAddDeviceDialog).toBe(true);
      expect(wrapper.vm.showDeviceInfoDialog).toBe(true);
    });
  });

  describe('设备可用性', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.scanDevices();
      jest.advanceTimersByTime(2000);
      await nextTick();
    });

    it('应该正确显示可用设备', () => {
      const availableDevices = wrapper.vm.availableDevices.filter(d => d.available);
      expect(availableDevices.length).toBeGreaterThan(0);
    });

    it('应该处理不可用设备', () => {
      // 添加一个不可用的设备
      wrapper.vm.availableDevices.push({
        id: 'unavailable-001',
        name: 'Unavailable Device',
        version: 'v1.0.0',
        description: '不可用设备',
        channels: 8,
        maxFrequency: 50000000,
        bufferSize: 8192,
        available: false,
        isNetwork: false
      });

      const unavailableDevices = wrapper.vm.availableDevices.filter(d => !d.available);
      expect(unavailableDevices.length).toBe(1);
    });
  });

  describe('网络设备', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.vm.scanDevices();
      jest.advanceTimersByTime(2000);
      await nextTick();
    });

    it('应该正确识别网络设备', () => {
      const networkDevices = wrapper.vm.availableDevices.filter(d => d.isNetwork);
      expect(networkDevices.length).toBe(1);
      expect(networkDevices[0].networkAddress).toBe('192.168.1.100:8080');
    });

    it('应该正确识别非网络设备', () => {
      const serialDevices = wrapper.vm.availableDevices.filter(d => !d.isNetwork);
      expect(serialDevices.length).toBe(1);
      expect(serialDevices[0].networkAddress).toBeUndefined();
    });
  });

  describe('边界情况', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该处理空设备列表', async () => {
      wrapper.vm.availableDevices = [];
      await nextTick();
      
      expect(wrapper.vm.filteredDevices).toHaveLength(0);
    });

    it('应该处理无当前设备时的断开连接', async () => {
      wrapper.vm.currentDevice = null;
      
      await wrapper.vm.disconnectDevice();
      
      // 应该不执行任何操作
      expect(ElMessageBox.confirm).not.toHaveBeenCalled();
    });

    it('应该处理搜索中的特殊字符', async () => {
      wrapper.vm.searchQuery = '()[]{}.*+?^$|\\';
      await nextTick();
      
      // 不应该抛出错误
      expect(() => wrapper.vm.filteredDevices).not.toThrow();
    });

    it('应该处理设备连接过程中的状态变化', async () => {
      const device = { id: 'test', name: 'Test Device' };
      
      // 开始连接
      const connectPromise = wrapper.vm.connectToDevice(device);
      expect(wrapper.vm.connectingDeviceId).toBe(device.id);
      
      // 时间推进一半
      jest.advanceTimersByTime(750);
      await nextTick();
      expect(wrapper.vm.connectingDeviceId).toBe(device.id);
      
      // 完成连接
      jest.advanceTimersByTime(750);
      await connectPromise;
      
      expect(wrapper.vm.connectingDeviceId).toBeNull();
    });
  });

  describe('响应式数据', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确初始化响应式数据', () => {
      expect(wrapper.vm.isScanning).toBeDefined();
      expect(wrapper.vm.isDisconnecting).toBeDefined();
      expect(wrapper.vm.isCapturing).toBeDefined();
      expect(wrapper.vm.connectingDeviceId).toBeNull();
      expect(wrapper.vm.selectedDeviceId).toBeNull();
      expect(wrapper.vm.searchQuery).toBe('');
      expect(wrapper.vm.currentDevice).toBeNull();
      expect(wrapper.vm.availableDevices).toEqual([]);
    });

    it('应该正确管理搜索查询状态', async () => {
      const testQuery = 'test query';
      wrapper.vm.searchQuery = testQuery;
      await nextTick();
      
      expect(wrapper.vm.searchQuery).toBe(testQuery);
    });
  });
});