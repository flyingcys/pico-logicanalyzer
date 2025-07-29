# Pico Logic Analyzer 软件架构总览

## 1. 技术栈架构

### 1.1 总体技术架构
```
┌─────────────────────────────────────────────────────────────┐
│                    用户界面层                                │
│              Avalonia UI + SkiaSharp                       │
├─────────────────────────────────────────────────────────────┤
│                   业务逻辑层                                 │
│        MainWindow + Controls + Dialogs                     │
├─────────────────────────────────────────────────────────────┤
│                  硬件抽象层                                  │
│    AnalyzerDriverBase + LogicAnalyzerDriver                │
├─────────────────────────────────────────────────────────────┤
│                  通信协议层                                  │
│        OutputPacket + CaptureRequest                       │
├─────────────────────────────────────────────────────────────┤
│                   硬件接口层                                 │
│         Serial Port + TCP Client                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心技术选型

| 技术组件 | 具体实现 | 版本 | 作用 |
|---------|---------|------|------|
| **应用框架** | .NET | 8.0+ | 跨平台应用运行时 |
| **UI框架** | Avalonia UI | 11.x | 跨平台桌面UI框架 |
| **图形渲染** | SkiaSharp | 2.88+ | 高性能2D图形渲染 |
| **协议解码** | Python.NET | 3.0+ | Python解码器桥接 |
| **编译器** | Microsoft.CodeAnalysis | Roslyn | 动态代码生成 |
| **串口通信** | System.IO.Ports | .NET内置 | 硬件设备通信 |
| **JSON序列化** | Newtonsoft.Json | 13.x | 配置和数据存储 |

## 2. 项目模块结构

### 2.1 解决方案组成

```
LogicAnalyzer.sln
├── LogicAnalyzer/               # 主程序项目
│   ├── App.axaml                # 应用程序入口
│   ├── MainWindow.axaml         # 主窗口定义
│   ├── Controls/                # UI控件库
│   ├── Dialogs/                 # 对话框组件
│   ├── Classes/                 # 业务逻辑类
│   ├── SigrokDecoderBridge/     # 解码器桥接
│   └── Styles/                  # UI样式定义
├── SharedDriver/                # 硬件驱动库
│   ├── AnalyzerDriverBase.cs    # 驱动基类
│   ├── LogicAnalyzerDriver.cs   # 主驱动实现
│   ├── MultiAnalyzerDriver.cs   # 多设备驱动
│   └── CaptureSession.cs        # 采集会话
├── SignalDescriptionLanguage/   # 信号描述语言
├── TerminalCapture/             # 命令行工具
└── CLCapture/                   # 数据处理工具
```

### 2.2 模块职责分工

#### 主程序模块 (LogicAnalyzer)
- **功能**: 用户界面、业务逻辑协调、用户交互
- **核心类**: MainWindow, Controls, Dialogs
- **依赖**: SharedDriver, SigrokDecoderBridge

#### 共享驱动模块 (SharedDriver)
- **功能**: 硬件抽象、设备通信、数据采集
- **核心类**: AnalyzerDriverBase, LogicAnalyzerDriver, CaptureSession
- **特点**: 独立库，可被其他项目引用

#### 协议解码桥接 (SigrokDecoderBridge)
- **功能**: Python解码器集成、动态代码生成
- **核心类**: SigrokProvider, SigrokPythonEngine
- **特点**: 运行时动态编译和执行

#### 命令行工具 (TerminalCapture/CLCapture)
- **功能**: 无界面数据采集、批处理
- **特点**: 独立可执行文件，适合自动化场景

## 3. 架构设计模式

### 3.1 分层架构 (Layered Architecture)

#### 表示层 (Presentation Layer)
- **组成**: Avalonia UI控件、XAML布局、用户交互处理
- **职责**: 数据展示、用户输入处理、界面状态管理
- **关键文件**: `*.axaml`, `*.axaml.cs`

#### 业务逻辑层 (Business Logic Layer)
- **组成**: MainWindow控制器、业务服务类、数据处理逻辑
- **职责**: 业务规则实现、数据验证、流程控制
- **关键文件**: `MainWindow.axaml.cs`, `Classes/*.cs`

#### 数据访问层 (Data Access Layer)
- **组成**: 硬件驱动、文件操作、配置管理
- **职责**: 硬件通信、数据持久化、设备抽象
- **关键文件**: `SharedDriver/*.cs`

### 3.2 抽象工厂模式 (Abstract Factory)

#### 驱动工厂 (Driver Factory)
```csharp
public static class DriverFactory
{
    public static AnalyzerDriverBase CreateDriver(string deviceType)
    {
        return deviceType switch
        {
            "serial" => new LogicAnalyzerDriver(),
            "network" => new LogicAnalyzerDriver(isNetwork: true),
            "multi" => new MultiAnalyzerDriver(),
            "emulated" => new EmulatedAnalyzerDriver(),
            _ => throw new NotSupportedException()
        };
    }
}
```

### 3.3 观察者模式 (Observer Pattern)

#### 事件驱动架构
- **数据采集事件**: `CaptureCompleted`, `CaptureProgress`
- **设备状态事件**: `DeviceConnected`, `DeviceDisconnected`
- **UI更新事件**: `SampleDataChanged`, `RegionSelected`

```csharp
// 事件定义示例
public event EventHandler<CaptureCompletedEventArgs>? CaptureCompleted;
public event EventHandler<ProgressEventArgs>? CaptureProgress;
```

## 4. 数据流架构

### 4.1 数据流向图
```
硬件设备 → Serial/TCP → AnalyzerDriver → CaptureSession → MainWindow → UI Controls
    ↑                                                           ↓
配置指令 ←───────────────────────────────────────────────────── 用户操作
```

### 4.2 关键数据结构

#### CaptureSession 数据模型
```csharp
public class CaptureSession : INotifyPropertyChanged
{
    // 采集配置
    public int Frequency { get; set; }
    public int PreTriggerSamples { get; set; }
    public int PostTriggerSamples { get; set; }
    public TriggerType TriggerType { get; set; }
    
    // 通道配置
    public AnalyzerChannel[] CaptureChannels { get; set; }
    
    // 计算属性
    public int TotalSamples => PreTriggerSamples + PostTriggerSamples;
}
```

#### AnalyzerChannel 通道模型
```csharp
public class AnalyzerChannel : INotifyPropertyChanged
{
    public int ChannelNumber { get; set; }
    public string ChannelName { get; set; }
    public bool Hidden { get; set; }
    public uint? ChannelColor { get; set; }
    public byte[]? Samples { get; set; }      // 原始采样数据
}
```

## 5. 并发和异步架构

### 5.1 异步操作模式

#### 数据采集异步处理
```csharp
public async Task<CaptureError> StartCaptureAsync(CaptureSession session)
{
    return await Task.Run(() =>
    {
        // 1. 发送采集命令
        // 2. 等待设备响应
        // 3. 读取数据流
        // 4. 数据后处理
        return CaptureError.None;
    });
}
```

#### UI更新调度
```csharp
// 跨线程UI更新
Dispatcher.UIThread.InvokeAsync(() =>
{
    // 更新UI控件状态
    UpdateSampleDisplay();
});
```

### 5.2 线程安全策略

#### 数据访问同步
- **读写锁**: 保护共享数据结构
- **原子操作**: 状态标志更新
- **线程安全集合**: 使用ConcurrentCollection类型

#### 内存管理
- **对象池**: 重用频繁创建的对象
- **及时释放**: IDisposable模式实现
- **弱引用**: 避免循环引用导致的内存泄漏

## 6. 扩展性架构

### 6.1 插件化设计

#### 解码器插件系统
```csharp
public interface IProtocolDecoder
{
    string Name { get; }
    string[] SupportedProtocols { get; }
    DecoderResult Decode(byte[] data, DecoderOptions options);
}
```

#### 驱动插件接口
```csharp
public abstract class AnalyzerDriverBase : IDisposable
{
    // 设备能力查询
    public abstract DeviceCapabilities GetCapabilities();
    
    // 核心操作接口
    public abstract Task<CaptureError> StartCaptureAsync(CaptureSession session);
    public abstract Task<bool> StopCaptureAsync();
}
```

### 6.2 配置管理系统

#### 应用设置管理
```csharp
public class AppSettingsManager
{
    private static readonly string SettingsPath = "AppConfig.json";
    
    public static T GetSetting<T>(string key, T defaultValue);
    public static void SetSetting<T>(string key, T value);
    public static void SaveSettings();
}
```

#### 设备配置持久化
- **已知设备列表**: 自动记录连接过的设备
- **用户偏好设置**: 主题、语言、快捷键配置
- **会话模板**: 预设的采集配置模板

## 7. 性能架构特点

### 7.1 渲染性能优化

#### 虚拟化显示
- **视口裁剪**: 只渲染可见区域
- **LOD显示**: 根据缩放级别调整数据密度
- **增量更新**: 只重绘变化的区域

#### 数据预处理
- **间隔计算**: 预计算状态变化点
- **缓存机制**: 缓存计算结果避免重复计算
- **分块加载**: 大文件分块处理

### 7.2 内存使用优化

#### 数据压缩
- **RLE压缩**: 对重复数据进行游程编码
- **增量存储**: 只存储状态变化
- **按需分配**: 根据实际需要分配内存

#### 垃圾回收优化
- **对象复用**: 避免频繁的对象创建销毁
- **大对象池**: 预分配大内存块
- **及时释放**: 主动触发内存回收

## 8. 错误处理架构

### 8.1 异常处理策略

#### 分层异常处理
```csharp
try
{
    // 业务逻辑
}
catch (DeviceConnectionException ex)
{
    // 设备连接异常处理
    LogError($"设备连接失败: {ex.Message}");
    ShowUserError("设备连接失败，请检查连接");
}
catch (Exception ex)
{
    // 未预期异常处理
    LogError($"未知错误: {ex}");
    ShowUserError("操作失败，请重试");
}
```

#### 错误日志系统
- **分级日志**: Debug, Info, Warning, Error
- **结构化日志**: 包含上下文信息的日志记录
- **日志轮转**: 自动管理日志文件大小和数量

### 8.2 容错机制

#### 设备通信容错
- **超时重试**: 通信失败时自动重试
- **连接恢复**: 连接断开时自动重连
- **数据校验**: 关键数据传输的完整性验证

#### 用户界面容错
- **优雅降级**: 功能不可用时提供替代方案
- **状态恢复**: 异常后自动恢复到稳定状态
- **用户反馈**: 清晰的错误提示和解决建议

## 9. 架构演进历史

### 9.1 版本迁移路径
- **V1.0**: 基础功能实现，单设备支持
- **V2.0**: 多设备支持，协议解码器集成
- **V3.0**: 跨平台支持，性能优化
- **V4.0**: 云端功能，高级分析工具

### 9.2 向后兼容策略
- **数据格式兼容**: 支持旧版本.lac文件
- **API向下兼容**: 保持核心接口稳定
- **配置迁移**: 自动升级旧版本配置

## 10. 对VSCode插件项目的架构启示

### 10.1 可借鉴的设计模式
1. **分层架构**: 清晰的职责分离
2. **硬件抽象**: 统一的驱动接口设计
3. **异步处理**: 非阻塞的数据采集和处理
4. **插件化**: 可扩展的解码器系统
5. **配置管理**: 完善的设置持久化

### 10.2 需要改进的方面
1. **技术栈简化**: 避免Python依赖
2. **内存优化**: 更高效的大数据处理
3. **启动速度**: 减少初始化时间
4. **跨平台兼容**: 更好的平台一致性

### 10.3 VSCode插件特有优势
1. **VS Code集成**: 无缝融入开发工作流
2. **TypeScript生态**: 统一的技术栈
3. **Web技术**: 现代化的UI框架
4. **扩展生态**: 丰富的插件市场

---

## 总结

Pico Logic Analyzer软件展现了成熟的桌面应用架构设计，其分层架构、硬件抽象、异步处理和插件化设计为我们的VSCode插件项目提供了宝贵的架构参考。关键是要在保持架构优势的同时，结合VSCode插件生态的特点，实现技术栈的优化和用户体验的提升。