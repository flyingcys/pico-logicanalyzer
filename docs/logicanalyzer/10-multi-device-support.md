# Pico Logic Analyzer 多设备支持系统分析

## 📋 概述

Pico Logic Analyzer 软件支持多设备并联采集功能，能够将 2-5 台逻辑分析器设备组合成一个大容量的逻辑分析仪，通过主从同步机制实现协调采集。本文档深度分析多设备支持的架构设计、同步机制、通道映射和用户界面实现。

## 🏗️ 多设备架构设计

### 核心组件关系图

```
多设备支持架构
├── MultiAnalyzerDriver (核心驱动类)
│   ├── LogicAnalyzerDriver[] (设备数组 2-5台)
│   ├── deviceCapture[] (临时采集存储)
│   └── 同步协调机制
├── MultiConnectDialog (设备连接对话框)
├── MultiComposeDialog (设备识别配置对话框)
└── 主从同步协议
```

### MultiAnalyzerDriver 核心类分析

**文件位置**: `SharedDriver/MultiAnalyzerDriver.cs`

```csharp
public class MultiAnalyzerDriver : AnalyzerDriverBase
{
    // 设备约束: 2-5台设备
    LogicAnalyzerDriver[] connectedDevices; // 连接的设备数组
    deviceCapture[]? tempCapture;           // 临时采集数据存储
    CaptureSession? sourceSession;          // 源采集会话
    object locker = new object();           // 同步锁

    // 构造函数: 强制版本一致性检查
    public MultiAnalyzerDriver(string[] ConnectionStrings)
    {
        if (ConnectionStrings.Length < 2 || ConnectionStrings.Length > 5)
            throw new ArgumentOutOfRangeException();
        
        // 创建设备驱动实例
        for (pos = 0; pos < ConnectionStrings.Length; pos++)
            connectedDevices[pos] = new LogicAnalyzerDriver(ConnectionStrings[pos]);
        
        // 版本兼容性验证
        foreach (var device in connectedDevices)
        {
            var devVer = VersionValidator.GetVersion(device.DeviceVersion);
            if (masterVersion.Major != devVer.Major || masterVersion.Minor != devVer.Minor)
                throw new DeviceConnectionException();
        }
    }
}
```

**关键设计特点**:
- ✅ **设备数量限制**: 严格限制 2-5 台设备
- ✅ **版本一致性**: 强制要求所有设备版本主次号一致
- ✅ **第一台为主设备**: ConnectionStrings[0] 必须是主设备
- ✅ **统一错误处理**: 任一设备故障会终止整个系统

## 🔄 多设备同步机制

### 主从同步协议

```csharp
// 主从同步采集流程
public override CaptureError StartCapture(CaptureSession Session, 
    Action<CaptureEventArgs>? CaptureCompletedHandler = null)
{
    // 1. 启动从设备 (1-4台)
    for (int buc = 1; buc < channelsPerDevice.Length; buc++)
    {
        var devSes = Session.Clone();
        devSes.TriggerChannel = 24;        // 从设备使用特殊触发通道
        devSes.TriggerType = TriggerType.Edge; // 从设备使用边沿触发
        devSes.PreTriggerSamples = Session.PreTriggerSamples + offset;
        devSes.PostTriggerSamples = Session.PostTriggerSamples - offset;
        
        connectedDevices[buc].StartCapture(devSes);
    }
    
    // 2. 最后启动主设备 (触发整个采集)
    connectedDevices[0].StartCapture(masterSes);
}
```

**同步机制原理**:
1. **时序偏移补偿**: 从设备增加 PreTrigger 采样，减少 PostTrigger 采样
2. **触发信号传递**: 主设备触发后通过硬件信号触发所有从设备
3. **数据时间对齐**: 通过 `offset` 计算补偿不同设备间的触发延迟

### 触发延迟计算

```csharp
// 触发延迟补偿算法
double samplePeriod = 1000000000.0 / Session.Frequency;  // 纳秒
double delay = Session.TriggerType == TriggerType.Fast ? 
    TriggerDelays.FastTriggerDelay : TriggerDelays.ComplexTriggerDelay;
int offset = (int)(Math.Round((delay / samplePeriod) + 0.3, 0));
```

**关键技术要点**:
- 延迟以纳秒为单位计算
- 快速触发和复杂触发有不同的延迟常数
- 四舍五入 +0.3 的偏移确保同步精度

## 📊 通道映射与数据整合

### 通道分配算法

```csharp
// 通道按设备分配算法
private int[][] SplitChannelsPerDevice(int[] Channels)
{
    var maxChanPerDev = connectedDevices.Min(c => c.ChannelCount); // 最小通道数
    
    for (int buc = 0; buc < connectedDevices.Length; buc++)
    {
        int firstChan = buc * maxChanPerDev;      // 设备起始通道
        int lastChan = (buc + 1) * maxChanPerDev; // 设备结束通道
        
        // 提取该设备负责的通道并重新映射
        int[] devChan = Channels.Where(c => c >= firstChan && c < lastChan)
                               .Select(c => c - firstChan).ToArray();
        channelsPerDevice.Add(devChan);
    }
}
```

**通道映射示例** (3台24通道设备):
```
虚拟通道 → 物理设备映射
通道 0-23  → 设备1 通道 0-23
通道 24-47 → 设备2 通道 0-23  
通道 48-71 → 设备3 通道 0-23
总通道数: 72通道 (3 × 24)
```

### 数据整合机制

```csharp
// 多设备采集完成回调
private void Dev_CaptureCompleted(object? sender, CaptureEventArgs e)
{
    lock (locker) // 线程安全保护
    {
        int idx = (int)((sender as LogicAnalyzerDriver).Tag);
        tempCapture[idx].Session = e.Session;
        tempCapture[idx].Completed = true;
        
        // 等待所有设备完成采集
        if (tempCapture.All(c => c.Completed))
        {
            // 数据重新组装到源会话
            foreach(var chan in tempCapture[buc].Session.CaptureChannels)
            {
                var destChan = sourceSession.CaptureChannels
                    .First(c => c.ChannelNumber == chan.ChannelNumber + buc * maxChanPerDev);
                destChan.Samples = chan.Samples; // 数据复制
            }
        }
    }
}
```

## 🎛️ 多设备用户界面

### MultiConnectDialog 连接对话框

**文件位置**: `Dialogs/MultiConnectDialog.axaml`

```xml
<!-- 主设备选择 -->
<StackPanel Orientation="Horizontal">
    <TextBlock>Master:</TextBlock>
    <ComboBox Name="ddMaster"></ComboBox>
    <TextBlock Name="tbMaster"></TextBlock>
</StackPanel>

<!-- 4个从设备配置 -->
<StackPanel Orientation="Horizontal">
    <CheckBox Name="ckSlave1">Slave 1:</CheckBox>
    <ComboBox Name="ddSlave1" IsEnabled="False"></ComboBox>
    <TextBlock Name="tbSlave1"></TextBlock>
</StackPanel>
<!-- ... Slave 2-4 类似结构 ... -->
```

**界面功能特点**:
- ✅ **主设备必选**: 主设备下拉框始终启用
- ✅ **从设备可选**: 通过 CheckBox 控制是否启用从设备
- ✅ **串口/网络支持**: 每个设备可选择串口或网络连接
- ✅ **连接状态显示**: TextBlock 显示设备连接信息

### MultiComposeDialog 设备识别对话框

```csharp
public partial class MultiComposeDialog : Window
{
    public DetectedDevice[]? Devices { get; set; }      // 检测到的设备列表
    public string[] Roles { get; set; }                 // 设备角色 (Master, Slave 1-4)
    public KnownDevice? ComposedDevice { get; set; }    // 组合设备配置
    
    // 设备角色分配
    private void UpdateRoles()
    {
        var roles = new List<string>();
        for(int buc = 0; buc < Devices.Length; buc++)
        {
            roles.Add(buc == 0 ? "Master" : $"Slave {buc}");
        }
        Roles = roles.ToArray();
    }
    
    // 设备闪烁识别
    private async void LstDevices_SelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (lstDevices.SelectedItem is DetectedDevice device)
        {
            driver = new LogicAnalyzerDriver(device.PortName);
            driver.Blink(); // 设备闪烁帮助用户识别
        }
    }
}
```

**交互设计特点**:
- 🔍 **设备闪烁识别**: 选中设备会闪烁LED帮助用户识别
- 📝 **角色手动分配**: 用户可为每台设备分配主从角色
- ✅ **配置验证**: 确保所有角色都有设备分配
- 💾 **配置保存**: 保存设备序列号和角色映射关系

## 🔧 设备能力聚合

### 多设备能力计算

```csharp
// 聚合设备属性 - 采用最保守策略
public override int ChannelCount { 
    get { return connectedDevices.Min(d => d.ChannelCount) * connectedDevices.Length; } 
}
public override int MaxFrequency { 
    get { return connectedDevices.Min(d => d.MaxFrequency); } 
}
public override int MinFrequency { 
    get { return connectedDevices.Max(d => d.MinFrequency); } 
}
public override int BufferSize { 
    get { return connectedDevices.Min(d => d.BufferSize); } 
}
```

**聚合策略说明**:
- **通道数**: 最小通道数 × 设备数量 (确保兼容性)
- **最大频率**: 所有设备的最小值 (确保同步能力)
- **最小频率**: 所有设备的最大值 (确保兼容性)
- **缓冲区大小**: 所有设备的最小值 (确保内存安全)

### 采集限制计算

```csharp
public override CaptureLimits GetLimits(int[] Channels)
{
    var split = SplitChannelsPerDevice(Channels);
    var limits = connectedDevices.Select((dev, idx) => dev.GetLimits(split[idx])).ToArray();
    
    // 采用最严格的限制
    return new CaptureLimits
    {
        MinPreSamples = limits.Max(l => l.MinPreSamples),   // 最大最小值
        MaxPreSamples = limits.Min(l => l.MaxPreSamples),   // 最小最大值
        MinPostSamples = limits.Max(l => l.MinPostSamples), // 确保兼容性
        MaxPostSamples = limits.Min(l => l.MaxPostSamples),
    };
}
```

## ⚡ 性能优化策略

### 1. 并发采集优化
```csharp
// 从设备并发启动，主设备最后启动
for (int buc = 1; buc < channelsPerDevice.Length; buc++)
{
    // 并发启动从设备，无需等待
    connectedDevices[buc].StartCapture(devSes);
}
// 主设备启动触发整个采集过程
connectedDevices[0].StartCapture(masterSes);
```

### 2. 内存使用优化
```csharp
class deviceCapture  // 轻量级临时存储
{
    public bool Completed { get; set; }
    public CaptureSession? Session { get; set; }
}
```

### 3. 线程安全保护
```csharp
private void Dev_CaptureCompleted(object? sender, CaptureEventArgs e)
{
    lock (locker) // 全局锁保护数据整合过程
    {
        // 多线程安全的数据整合
    }
}
```

## 🚨 错误处理与恢复

### 连接错误处理
```csharp
try
{
    for (pos = 0; pos < ConnectionStrings.Length; pos++)
    {
        connectedDevices[pos] = new LogicAnalyzerDriver(ConnectionStrings[pos]);
    }
}
catch (Exception ex)
{
    // 连接失败时清理所有已连接设备
    for (int buc = 0; buc < connectedDevices.Length; buc++)
    {
        if (connectedDevices[buc] != null)
            connectedDevices[buc].Dispose();
    }
    throw new DeviceConnectionException($"Error connecting to device {ConnectionStrings[pos]}.", ex);
}
```

### 采集错误处理
```csharp
private void Dev_CaptureCompleted(object? sender, CaptureEventArgs e)
{
    if(!e.Success)
    {
        StopCapture(); // 任一设备失败立即停止所有设备
        
        // 清理临时数据
        tempCapture = null;
        
        // 通知上层采集失败
        if (currentCaptureHandler != null)
            currentCaptureHandler(new CaptureEventArgs { Success = false });
    }
}
```

## 🔄 VSCode插件实现指南

### TypeScript多设备驱动设计

```typescript
// 多设备抽象接口
interface IMultiAnalyzerDriver extends ILogicAnalyzer {
    readonly deviceCount: number;
    readonly devices: ILogicAnalyzer[];
    readonly aggregatedCapabilities: HardwareCapabilities;
    
    // 多设备特有方法
    addDevice(connectionString: string): Promise<boolean>;
    removeDevice(deviceIndex: number): Promise<boolean>;
    synchronizeDevices(): Promise<boolean>;
}

// 多设备驱动实现
class MultiAnalyzerDriver implements IMultiAnalyzerDriver {
    private connectedDevices: LogicAnalyzerDriver[] = [];
    private tempCapture: DeviceCapture[] = [];
    private syncLock = new AsyncLock();
    
    constructor(private connectionStrings: string[]) {
        if (connectionStrings.length < 2 || connectionStrings.length > 5) {
            throw new Error('多设备数量必须在2-5台之间');
        }
    }
    
    // 聚合设备能力
    get aggregatedCapabilities(): HardwareCapabilities {
        return {
            channels: {
                digital: Math.min(...this.devices.map(d => d.channels.digital)) * this.devices.length,
                maxVoltage: Math.min(...this.devices.map(d => d.channels.maxVoltage))
            },
            sampling: {
                maxRate: Math.min(...this.devices.map(d => d.sampling.maxRate)),
                supportedRates: this.calculateCommonRates(),
                bufferSize: Math.min(...this.devices.map(d => d.sampling.bufferSize))
            }
        };
    }
    
    // 同步采集实现
    async startCapture(config: CaptureConfiguration): Promise<CaptureResult> {
        return this.syncLock.acquire(async () => {
            try {
                // 1. 分配通道到各设备
                const channelAssignments = this.splitChannelsPerDevice(config.channels);
                
                // 2. 启动从设备
                const slavePromises = this.connectedDevices.slice(1).map((device, index) => {
                    const slaveConfig = this.createSlaveConfig(config, channelAssignments[index + 1]);
                    return device.startCapture(slaveConfig);
                });
                
                // 3. 等待从设备准备就绪
                await Promise.all(slavePromises);
                
                // 4. 启动主设备触发采集
                const masterConfig = this.createMasterConfig(config, channelAssignments[0]);
                const masterResult = await this.connectedDevices[0].startCapture(masterConfig);
                
                // 5. 数据整合
                return this.aggregateResults(masterResult);
                
            } catch (error) {
                // 错误恢复: 停止所有设备
                await this.stopAllDevices();
                throw error;
            }
        });
    }
    
    // 数据整合算法
    private aggregateResults(results: CaptureResult[]): CaptureResult {
        const maxChannelsPerDevice = Math.min(...this.devices.map(d => d.channels.digital));
        const aggregatedData: UnifiedCaptureData = {
            metadata: {
                deviceInfo: { name: 'Multi-Device Setup', version: 'MULTI_ANALYZER' },
                sampleRate: results[0].data.metadata.sampleRate,
                totalSamples: results[0].data.metadata.totalSamples,
                triggerPosition: results[0].data.metadata.triggerPosition
            },
            channels: [],
            samples: { digital: { data: [], encoding: 'binary' } },
            quality: { lostSamples: 0, errorRate: 0 }
        };
        
        // 重新映射通道数据
        results.forEach((result, deviceIndex) => {
            result.data.channels.forEach(channel => {
                const virtualChannelNumber = channel.channelNumber + deviceIndex * maxChannelsPerDevice;
                aggregatedData.channels.push({
                    ...channel,
                    channelNumber: virtualChannelNumber
                });
            });
        });
        
        return { success: true, data: aggregatedData };
    }
}
```

### Vue3多设备管理组件

```vue
<template>
  <div class="multi-device-manager">
    <el-card class="device-connection-card">
      <template #header>
        <span>多设备连接设置</span>
      </template>
      
      <!-- 主设备配置 -->
      <div class="device-config-row">
        <el-text type="primary">主设备:</el-text>
        <el-select v-model="masterDevice" placeholder="选择主设备">
          <el-option
            v-for="device in availableDevices"
            :key="device.id"
            :label="device.name"
            :value="device.connectionString"
          />
        </el-select>
        <el-tag v-if="masterDevice" type="success">已连接</el-tag>
      </div>
      
      <!-- 从设备配置 -->
      <div 
        v-for="(slave, index) in slaveDevices" 
        :key="`slave-${index}`"
        class="device-config-row"
      >
        <el-checkbox v-model="slave.enabled" @change="onSlaveToggle(index)">
          从设备 {{ index + 1 }}:
        </el-checkbox>
        <el-select 
          v-model="slave.connectionString" 
          :disabled="!slave.enabled"
          placeholder="选择从设备"
        >
          <el-option
            v-for="device in availableDevices"
            :key="device.id"
            :label="device.name"
            :value="device.connectionString"
          />
        </el-select>
        <el-tag v-if="slave.enabled && slave.connectionString" type="success">
          已连接
        </el-tag>
      </div>
      
      <!-- 连接控制 -->
      <div class="connection-controls">
        <el-button type="primary" @click="connectMultiDevice" :loading="connecting">
          连接多设备
        </el-button>
        <el-button @click="disconnectMultiDevice" :disabled="!isConnected">
          断开连接
        </el-button>
      </div>
    </el-card>
    
    <!-- 设备状态显示 -->
    <el-card class="device-status-card" v-if="multiDriver">
      <template #header>
        <span>多设备状态</span>
      </template>
      
      <div class="status-grid">
        <div class="status-item">
          <el-statistic title="总通道数" :value="aggregatedCapabilities.channels.digital" />
        </div>
        <div class="status-item">
          <el-statistic title="最大采样率" :value="aggregatedCapabilities.sampling.maxRate" suffix="Hz" />
        </div>
        <div class="status-item">
          <el-statistic title="设备数量" :value="connectedDeviceCount" />
        </div>
        <div class="status-item">
          <el-statistic title="缓冲区大小" :value="aggregatedCapabilities.sampling.bufferSize" suffix="samples" />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { MultiAnalyzerDriver } from '@/drivers/MultiAnalyzerDriver';
import type { ILogicAnalyzer, HardwareCapabilities } from '@/drivers/base/ILogicAnalyzer';

// 响应式数据
const masterDevice = ref<string>('');
const slaveDevices = ref(Array.from({ length: 4 }, () => ({
  enabled: false,
  connectionString: ''
})));
const multiDriver = ref<MultiAnalyzerDriver | null>(null);
const connecting = ref(false);
const availableDevices = ref<Array<{ id: string, name: string, connectionString: string }>>([]);

// 计算属性
const isConnected = computed(() => multiDriver.value !== null);
const connectedDeviceCount = computed(() => {
  if (!multiDriver.value) return 0;
  return 1 + slaveDevices.value.filter(slave => slave.enabled && slave.connectionString).length;
});
const aggregatedCapabilities = computed<HardwareCapabilities>(() => {
  return multiDriver.value?.aggregatedCapabilities || {
    channels: { digital: 0, maxVoltage: 0 },
    sampling: { maxRate: 0, supportedRates: [], bufferSize: 0 },
    triggers: { types: [], maxChannels: 0 }
  };
});

// 方法实现
const connectMultiDevice = async () => {
  if (!masterDevice.value) {
    ElMessage.error('请选择主设备');
    return;
  }
  
  const connectionStrings = [masterDevice.value];
  slaveDevices.value.forEach(slave => {
    if (slave.enabled && slave.connectionString) {
      connectionStrings.push(slave.connectionString);
    }
  });
  
  if (connectionStrings.length < 2) {
    ElMessage.error('至少需要连接一个从设备');
    return;
  }
  
  connecting.value = true;
  try {
    multiDriver.value = new MultiAnalyzerDriver(connectionStrings);
    await multiDriver.value.connect();
    ElMessage.success(`成功连接 ${connectionStrings.length} 台设备`);
  } catch (error) {
    ElMessage.error(`多设备连接失败: ${error.message}`);
    multiDriver.value = null;
  } finally {
    connecting.value = false;
  }
};

const disconnectMultiDevice = async () => {
  if (multiDriver.value) {
    await multiDriver.value.disconnect();
    multiDriver.value = null;
    ElMessage.success('多设备已断开连接');
  }
};

const onSlaveToggle = (index: number) => {
  if (!slaveDevices.value[index].enabled) {
    slaveDevices.value[index].connectionString = '';
  }
};

// 生命周期
onMounted(async () => {
  // 加载可用设备列表
  try {
    const devices = await deviceManager.getAvailableDevices();
    availableDevices.value = devices.map(device => ({
      id: device.id,
      name: `${device.name} (${device.portName})`,
      connectionString: device.connectionString
    }));
  } catch (error) {
    ElMessage.error('加载设备列表失败');
  }
});
</script>

<style scoped>
.multi-device-manager {
  padding: 20px;
}

.device-config-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.connection-controls {
  margin-top: 20px;
  text-align: right;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.status-item {
  text-align: center;
}
</style>
```

## 📋 技术要点总结

### 关键实现特点
1. **主从架构**: 第一台设备为主设备，负责触发整个采集过程
2. **版本一致性**: 强制要求所有设备主次版本号一致
3. **通道映射**: 将逻辑通道映射到物理设备通道
4. **同步协议**: 通过硬件触发信号实现设备间同步
5. **数据整合**: 采集完成后将多设备数据整合到统一格式

### 性能优化策略
1. **并发启动**: 从设备并发启动，减少总启动时间
2. **内存优化**: 使用轻量级临时存储结构
3. **线程安全**: 全局锁保护数据整合过程
4. **错误恢复**: 任一设备失败立即停止所有设备

### VSCode插件适配建议
1. **异步架构**: 使用 Promise/async-await 处理多设备协调
2. **Vue3组件**: 实现直观的多设备配置界面
3. **TypeScript类型**: 严格的类型定义确保代码安全
4. **错误处理**: 完善的错误处理和用户提示机制
5. **配置持久化**: 保存多设备配置供下次使用

通过深入分析Pico Logic Analyzer的多设备支持系统，为VSCode插件项目提供了完整的多设备架构设计参考和实现指南。