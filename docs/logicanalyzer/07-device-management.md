# 设备管理功能系统 - 详细技术分析

## 📋 概述

本文档深入分析 Pico Logic Analyzer 软件的设备管理功能实现，包括设备发现机制、连接管理、状态监控、网络配置和驱动更新等核心功能的技术细节。

## 🏗️ 设备管理架构

### 核心架构层次
```
用户界面层 (MainWindow + NetworkDialog)
         ↓
设备管理层 (DeviceManager + ConnectionManager)
         ↓
设备检测层 (DeviceDetector + PlatformSpecific)
         ↓
硬件抽象层 (AnalyzerDriverBase + LogicAnalyzerDriver)
         ↓
通信协议层 (Serial/Network + OutputPacket)
```

## 🔍 设备发现和检测系统

### 1. DeviceDetector 核心实现

**跨平台设备检测引擎** (`DeviceDetector.cs`):
```csharp
/// <summary>
/// 跨平台逻辑分析器设备检测器
/// 支持Windows、Linux、macOS三大平台的统一设备发现
/// </summary>
public static class DeviceDetector
{
    // 设备标识常量
    private const string TARGET_VID = "1209";           // Vendor ID (十六进制)
    private const string TARGET_PID = "3020";           // Product ID (十六进制)
    private const string DEVICE_NAME = "Pico Logic Analyzer";
    
    /// <summary>
    /// 主要设备检测入口点
    /// 根据运行平台自动选择检测策略
    /// </summary>
    public static List<DeviceInfo> DetectDevices()
    {
        try
        {
            return Environment.OSVersion.Platform switch
            {
                PlatformID.Win32NT => DetectWindowsDevices(),
                PlatformID.Unix => DetectLinuxDevices(),
                PlatformID.MacOSX => DetectMacOSDevices(),
                _ => new List<DeviceInfo>()
            };
        }
        catch (Exception ex)
        {
            LogError($"设备检测失败: {ex.Message}");
            return new List<DeviceInfo>();
        }
    }
    
    /// <summary>
    /// Windows平台设备检测
    /// 通过注册表查询USB串口设备
    /// </summary>
    private static List<DeviceInfo> DetectWindowsDevices()
    {
        var devices = new List<DeviceInfo>();
        
        try
        {
            // 查询USB串口服务注册表项
            using var rkUsbSer = Registry.LocalMachine.OpenSubKey(
                @"SYSTEM\CurrentControlSet\Services\usbser\Enum", false);
                
            if (rkUsbSer?.GetValue("Count") is int deviceCount && deviceCount > 0)
            {
                for (int i = 0; i < deviceCount; i++)
                {
                    var devicePath = rkUsbSer.GetValue(i.ToString()) as string;
                    if (string.IsNullOrEmpty(devicePath)) continue;
                    
                    var deviceInfo = ParseWindowsDevicePath(devicePath);
                    if (deviceInfo != null && IsTargetDevice(deviceInfo))
                    {
                        deviceInfo.SerialPort = GetSerialPortForDevice(devicePath);
                        devices.Add(deviceInfo);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            LogWarning($"Windows设备检测异常: {ex.Message}");
        }
        
        return devices;
    }
    
    /// <summary>
    /// Linux平台设备检测  
    /// 扫描 /sys/bus/usb/devices 目录结构
    /// </summary>
    private static List<DeviceInfo> DetectLinuxDevices()
    {
        var devices = new List<DeviceInfo>();
        
        try
        {
            const string usbDevicesPath = "/sys/bus/usb/devices";
            if (!Directory.Exists(usbDevicesPath)) return devices;
            
            foreach (var deviceDir in Directory.GetDirectories(usbDevicesPath))
            {
                var deviceInfo = ParseLinuxDeviceDirectory(deviceDir);
                if (deviceInfo != null && IsTargetDevice(deviceInfo))
                {
                    deviceInfo.SerialPort = FindLinuxSerialPort(deviceDir);
                    devices.Add(deviceInfo);
                }
            }
        }
        catch (Exception ex)
        {
            LogWarning($"Linux设备检测异常: {ex.Message}");
        }
        
        return devices;
    }
    
    /// <summary>
    /// 解析Windows设备路径获取VID/PID
    /// 设备路径格式: USB\VID_1209&PID_3020\[SerialNumber]
    /// </summary>
    private static DeviceInfo? ParseWindowsDevicePath(string devicePath)
    {
        try
        {
            var match = Regex.Match(devicePath, 
                @"USB\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})\\(.+)",
                RegexOptions.IgnoreCase);
                
            if (!match.Success) return null;
            
            return new DeviceInfo
            {
                VendorId = match.Groups[1].Value,
                ProductId = match.Groups[2].Value,
                SerialNumber = match.Groups[3].Value,
                DevicePath = devicePath,
                Platform = DevicePlatform.Windows
            };
        }
        catch
        {
            return null;
        }
    }
    
    /// <summary>
    /// 解析Linux设备目录获取设备信息
    /// </summary>
    private static DeviceInfo? ParseLinuxDeviceDirectory(string deviceDir)
    {
        try
        {
            var idVendorPath = Path.Combine(deviceDir, "idVendor");
            var idProductPath = Path.Combine(deviceDir, "idProduct");
            var serialPath = Path.Combine(deviceDir, "serial");
            
            if (!File.Exists(idVendorPath) || !File.Exists(idProductPath))
                return null;
            
            var vendorId = File.ReadAllText(idVendorPath).Trim();
            var productId = File.ReadAllText(idProductPath).Trim();
            var serialNumber = File.Exists(serialPath) ? 
                File.ReadAllText(serialPath).Trim() : "Unknown";
            
            return new DeviceInfo
            {
                VendorId = vendorId,
                ProductId = productId,
                SerialNumber = serialNumber,
                DevicePath = deviceDir,
                Platform = DevicePlatform.Linux
            };
        }
        catch
        {
            return null;
        }
    }
    
    /// <summary>
    /// 检查是否为目标设备 (VID: 1209, PID: 3020)
    /// </summary>
    private static bool IsTargetDevice(DeviceInfo deviceInfo)
    {
        return string.Equals(deviceInfo.VendorId, TARGET_VID, StringComparison.OrdinalIgnoreCase) &&
               string.Equals(deviceInfo.ProductId, TARGET_PID, StringComparison.OrdinalIgnoreCase);
    }
}

/// <summary>
/// 设备信息数据模型
/// </summary>
public class DeviceInfo
{
    public string VendorId { get; set; } = string.Empty;        // 厂商ID
    public string ProductId { get; set; } = string.Empty;       // 产品ID
    public string SerialNumber { get; set; } = string.Empty;    // 序列号
    public string DevicePath { get; set; } = string.Empty;      // 设备路径
    public string? SerialPort { get; set; }                     // 串口名称
    public DevicePlatform Platform { get; set; }                // 运行平台
    public DateTime DetectedAt { get; set; } = DateTime.Now;    // 检测时间
    
    /// <summary>
    /// 生成设备显示名称
    /// </summary>
    public string DisplayName => $"{DEVICE_NAME} ({SerialNumber})";
    
    /// <summary>
    /// 生成连接字符串
    /// </summary>
    public string ConnectionString => SerialPort ?? $"USB:{VendorId}:{ProductId}";
}

public enum DevicePlatform
{
    Windows,
    Linux,
    MacOS,
    Unknown
}
```

### 2. 智能设备监控系统

**实时设备状态监控** (`DeviceMonitor.cs`):
```csharp
/// <summary>
/// 设备状态实时监控器
/// 检测设备连接、断开、状态变化等事件
/// </summary>
public class DeviceMonitor : IDisposable
{
    private readonly Timer monitorTimer;
    private readonly ConcurrentDictionary<string, DeviceInfo> knownDevices = new();
    private readonly SemaphoreSlim monitorLock = new(1, 1);
    
    // 事件定义
    public event EventHandler<DeviceEventArgs>? DeviceConnected;
    public event EventHandler<DeviceEventArgs>? DeviceDisconnected;
    public event EventHandler<DeviceEventArgs>? DeviceStatusChanged;
    
    public DeviceMonitor(TimeSpan monitorInterval = default)
    {
        var interval = monitorInterval == default ? TimeSpan.FromSeconds(2) : monitorInterval;
        monitorTimer = new Timer(MonitorDevices, null, TimeSpan.Zero, interval);
    }
    
    /// <summary>
    /// 定时设备监控任务
    /// </summary>
    private async void MonitorDevices(object? state)
    {
        if (!await monitorLock.WaitAsync(100)) return; // 避免重叠执行
        
        try
        {
            var currentDevices = DeviceDetector.DetectDevices();
            var currentDeviceMap = currentDevices.ToDictionary(d => d.SerialNumber);
            
            // 检测新连接的设备
            foreach (var device in currentDevices)
            {
                if (!knownDevices.ContainsKey(device.SerialNumber))
                {
                    knownDevices[device.SerialNumber] = device;
                    DeviceConnected?.Invoke(this, new DeviceEventArgs(device, DeviceEventType.Connected));
                    LogInfo($"检测到新设备: {device.DisplayName}");
                }
                else
                {
                    // 检测设备状态变化
                    var knownDevice = knownDevices[device.SerialNumber];
                    if (HasDeviceChanged(knownDevice, device))
                    {
                        knownDevices[device.SerialNumber] = device;
                        DeviceStatusChanged?.Invoke(this, new DeviceEventArgs(device, DeviceEventType.StatusChanged));
                        LogInfo($"设备状态变化: {device.DisplayName}");
                    }
                }
            }
            
            // 检测断开的设备
            var disconnectedDevices = knownDevices.Keys
                .Where(serial => !currentDeviceMap.ContainsKey(serial))
                .ToList();
                
            foreach (var serial in disconnectedDevices)
            {
                var device = knownDevices[serial];
                knownDevices.TryRemove(serial, out _);
                DeviceDisconnected?.Invoke(this, new DeviceEventArgs(device, DeviceEventType.Disconnected));
                LogInfo($"设备已断开: {device.DisplayName}");
            }
        }
        catch (Exception ex)
        {
            LogError($"设备监控异常: {ex.Message}");
        }
        finally
        {
            monitorLock.Release();
        }
    }
    
    /// <summary>
    /// 检测设备是否发生变化
    /// </summary>
    private static bool HasDeviceChanged(DeviceInfo old, DeviceInfo current)
    {
        return old.SerialPort != current.SerialPort ||
               old.DevicePath != current.DevicePath;
    }
    
    /// <summary>
    /// 获取当前所有已知设备
    /// </summary>
    public List<DeviceInfo> GetKnownDevices()
    {
        return knownDevices.Values.ToList();
    }
    
    public void Dispose()
    {
        monitorTimer?.Dispose();
        monitorLock?.Dispose();
    }
}

/// <summary>
/// 设备事件参数
/// </summary>
public class DeviceEventArgs : EventArgs
{
    public DeviceInfo Device { get; }
    public DeviceEventType EventType { get; }
    public DateTime Timestamp { get; }
    
    public DeviceEventArgs(DeviceInfo device, DeviceEventType eventType)
    {
        Device = device;
        EventType = eventType;
        Timestamp = DateTime.Now;
    }
}

public enum DeviceEventType
{
    Connected,
    Disconnected,
    StatusChanged
}
```

## 🔗 设备连接管理系统

### 1. ConnectionManager 连接控制器

**统一连接管理接口**:
```csharp
/// <summary>
/// 设备连接管理器
/// 提供统一的设备连接、断开和状态管理接口
/// </summary>
public class ConnectionManager : IDisposable
{
    private readonly Dictionary<string, AnalyzerDriverBase> activeConnections = new();
    private readonly object connectionLock = new object();
    
    // 连接事件
    public event EventHandler<ConnectionEventArgs>? ConnectionEstablished;
    public event EventHandler<ConnectionEventArgs>? ConnectionLost;
    public event EventHandler<ConnectionEventArgs>? ConnectionError;
    
    /// <summary>
    /// 连接到指定设备
    /// </summary>
    public async Task<ConnectionResult> ConnectToDeviceAsync(DeviceInfo deviceInfo, ConnectionOptions? options = null)
    {
        try
        {
            lock (connectionLock)
            {
                if (activeConnections.ContainsKey(deviceInfo.SerialNumber))
                {
                    return new ConnectionResult
                    {
                        Success = false,
                        ErrorMessage = "设备已连接",
                        Driver = activeConnections[deviceInfo.SerialNumber]
                    };
                }
            }
            
            // 根据连接类型创建驱动
            var driver = await CreateDriverAsync(deviceInfo, options);
            if (driver == null)
            {
                return new ConnectionResult
                {
                    Success = false,
                    ErrorMessage = "无法创建设备驱动"
                };
            }
            
            // 尝试连接设备
            var connectResult = await AttemptConnectionAsync(driver, deviceInfo, options);
            if (!connectResult.Success)
            {
                driver.Dispose();
                return connectResult;
            }
            
            // 注册连接
            lock (connectionLock)
            {
                activeConnections[deviceInfo.SerialNumber] = driver;
            }
            
            // 设置事件处理
            SetupDriverEvents(driver, deviceInfo);
            
            // 触发连接成功事件
            ConnectionEstablished?.Invoke(this, new ConnectionEventArgs(deviceInfo, driver));
            
            LogInfo($"成功连接到设备: {deviceInfo.DisplayName}");
            
            return new ConnectionResult
            {
                Success = true,
                Driver = driver,
                DeviceInfo = deviceInfo
            };
        }
        catch (Exception ex)
        {
            LogError($"连接设备失败: {ex.Message}");
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
    
    /// <summary>
    /// 根据设备信息创建合适的驱动程序
    /// </summary>
    private async Task<AnalyzerDriverBase?> CreateDriverAsync(DeviceInfo deviceInfo, ConnectionOptions? options)
    {
        try
        {
            // 串口连接
            if (!string.IsNullOrEmpty(deviceInfo.SerialPort))
            {
                var baudRate = options?.BaudRate ?? 921600;
                return new LogicAnalyzerDriver(deviceInfo.SerialPort, baudRate);
            }
            
            // 网络连接
            if (options?.NetworkAddress != null)
            {
                return new LogicAnalyzerDriver(options.NetworkAddress);
            }
            
            // USB直连 (暂未实现)
            throw new NotSupportedException("USB直连暂未实现");
        }
        catch (Exception ex)
        {
            LogError($"创建驱动失败: {ex.Message}");
            return null;
        }
    }
    
    /// <summary>
    /// 尝试建立设备连接
    /// </summary>
    private async Task<ConnectionResult> AttemptConnectionAsync(
        AnalyzerDriverBase driver, 
        DeviceInfo deviceInfo, 
        ConnectionOptions? options)
    {
        const int maxRetries = 3;
        const int retryDelayMs = 1000;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                // 检查设备连接
                if (await TestDeviceConnectionAsync(driver))
                {
                    return new ConnectionResult { Success = true, Driver = driver };
                }
                
                if (attempt < maxRetries)
                {
                    LogWarning($"连接尝试 {attempt} 失败，{retryDelayMs}ms后重试...");
                    await Task.Delay(retryDelayMs);
                }
            }
            catch (Exception ex)
            {
                LogWarning($"连接尝试 {attempt} 异常: {ex.Message}");
                if (attempt == maxRetries)
                {
                    return new ConnectionResult
                    {
                        Success = false,
                        ErrorMessage = $"连接失败 (尝试{maxRetries}次): {ex.Message}"
                    };
                }
                await Task.Delay(retryDelayMs);
            }
        }
        
        return new ConnectionResult
        {
            Success = false,
            ErrorMessage = $"连接超时 (尝试{maxRetries}次后放弃)"
        };
    }
    
    /// <summary>
    /// 测试设备连接状态
    /// </summary>
    private async Task<bool> TestDeviceConnectionAsync(AnalyzerDriverBase driver)
    {
        try
        {
            // 检查设备版本 (这会触发实际的通信)
            var version = driver.DeviceVersion;
            if (string.IsNullOrEmpty(version))
            {
                return false;
            }
            
            // 验证设备能力
            var channelCount = driver.ChannelCount;
            var maxFrequency = driver.MaxFrequency;
            
            return channelCount > 0 && maxFrequency > 0;
        }
        catch
        {
            return false;
        }
    }
    
    /// <summary>
    /// 断开设备连接
    /// </summary>
    public bool DisconnectDevice(string serialNumber)
    {
        try
        {
            lock (connectionLock)
            {
                if (activeConnections.TryGetValue(serialNumber, out var driver))
                {
                    driver.Dispose();
                    activeConnections.Remove(serialNumber);
                    
                    LogInfo($"设备已断开: {serialNumber}");
                    return true;
                }
            }
            
            return false;
        }
        catch (Exception ex)
        {
            LogError($"断开设备失败: {ex.Message}");
            return false;
        }
    }
    
    /// <summary>
    /// 获取设备连接状态
    /// </summary>
    public ConnectionStatus GetConnectionStatus(string serialNumber)
    {
        lock (connectionLock)
        {
            if (activeConnections.TryGetValue(serialNumber, out var driver))
            {
                return new ConnectionStatus
                {
                    IsConnected = true,
                    Driver = driver,
                    ConnectedAt = GetConnectionTime(serialNumber),
                    LastActivity = DateTime.Now
                };
            }
        }
        
        return new ConnectionStatus { IsConnected = false };
    }
    
    /// <summary>
    /// 获取所有活动连接
    /// </summary>
    public Dictionary<string, AnalyzerDriverBase> GetActiveConnections()
    {
        lock (connectionLock)
        {
            return new Dictionary<string, AnalyzerDriverBase>(activeConnections);
        }
    }
}

/// <summary>
/// 连接选项配置
/// </summary>
public class ConnectionOptions
{
    public int BaudRate { get; set; } = 921600;             // 串口波特率
    public string? NetworkAddress { get; set; }             // 网络地址
    public int NetworkPort { get; set; } = 80;              // 网络端口
    public TimeSpan ConnectionTimeout { get; set; } = TimeSpan.FromSeconds(10);
    public bool AutoReconnect { get; set; } = false;        // 自动重连
    public int MaxRetries { get; set; } = 3;                // 最大重试次数
}

/// <summary>
/// 连接结果
/// </summary>
public class ConnectionResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public AnalyzerDriverBase? Driver { get; set; }
    public DeviceInfo? DeviceInfo { get; set; }
}

/// <summary>
/// 连接状态信息
/// </summary>
public class ConnectionStatus
{
    public bool IsConnected { get; set; }
    public AnalyzerDriverBase? Driver { get; set; }
    public DateTime? ConnectedAt { get; set; }
    public DateTime? LastActivity { get; set; }
    
    public TimeSpan? ConnectionDuration => 
        ConnectedAt.HasValue ? DateTime.Now - ConnectedAt.Value : null;
}
```

### 2. 网络设备配置系统

**WiFi网络配置管理** (`NetworkConfigManager.cs`):
```csharp
/// <summary>
/// 网络设备配置管理器
/// 处理WiFi设置、IP配置和网络连接管理
/// </summary>
public class NetworkConfigManager
{
    /// <summary>
    /// 网络配置数据结构 (对应C#的NetConfig结构体)
    /// </summary>
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct NetConfig
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 33)]
        public string AccessPointName;          // WiFi SSID (33字节固定长度)
        
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string Password;                 // WiFi密码 (64字节固定长度)
        
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 16)]
        public string IpAddress;               // IP地址 (16字节固定长度)
        
        public ushort Port;                    // 端口号
        
        /// <summary>
        /// 验证网络配置有效性
        /// </summary>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(AccessPointName) &&
                   !string.IsNullOrWhiteSpace(IpAddress) &&
                   Port > 0 && Port < 65536 &&
                   IsValidIpAddress(IpAddress);
        }
        
        /// <summary>
        /// IP地址格式验证
        /// </summary>
        private static bool IsValidIpAddress(string ipAddress)
        {
            return IPAddress.TryParse(ipAddress, out _);
        }
    }
    
    /// <summary>
    /// 配置设备网络设置
    /// </summary>
    public async Task<bool> ConfigureNetworkAsync(AnalyzerDriverBase driver, NetworkConfig config)
    {
        try
        {
            // 验证配置参数
            if (!ValidateNetworkConfig(config))
            {
                LogError("网络配置参数无效");
                return false;
            }
            
            // 构建网络配置结构
            var netConfig = new NetConfig
            {
                AccessPointName = config.SSID.PadRight(32, '\0').Substring(0, 32),
                Password = config.Password.PadRight(63, '\0').Substring(0, 63),
                IpAddress = config.IPAddress.PadRight(15, '\0').Substring(0, 15),
                Port = (ushort)config.Port
            };
            
            // 发送网络配置到设备
            var success = await driver.SendNetworkConfigAsync(
                netConfig.AccessPointName.TrimEnd('\0'),
                netConfig.Password.TrimEnd('\0'),
                netConfig.IpAddress.TrimEnd('\0'),
                netConfig.Port
            );
            
            if (success)
            {
                LogInfo($"网络配置成功: {config.SSID} -> {config.IPAddress}:{config.Port}");
                
                // 保存配置到本地
                await SaveNetworkConfigAsync(config);
            }
            else
            {
                LogError("网络配置发送失败");
            }
            
            return success;
        }
        catch (Exception ex)
        {
            LogError($"网络配置异常: {ex.Message}");
            return false;
        }
    }
    
    /// <summary>
    /// 网络配置参数类
    /// </summary>
    public class NetworkConfig
    {
        public string SSID { get; set; } = string.Empty;        // WiFi名称
        public string Password { get; set; } = string.Empty;    // WiFi密码
        public string IPAddress { get; set; } = string.Empty;   // 静态IP地址
        public int Port { get; set; } = 80;                     // 端口号
        public bool UseDHCP { get; set; } = true;               // 是否使用DHCP
        public string? Gateway { get; set; }                    // 网关地址
        public string? SubnetMask { get; set; }                 // 子网掩码
        public string? DNS1 { get; set; }                       // 主DNS
        public string? DNS2 { get; set; }                       // 备用DNS
        
        /// <summary>
        /// 配置验证
        /// </summary>
        public bool IsValid => 
            !string.IsNullOrWhiteSpace(SSID) &&
            SSID.Length <= 32 &&
            Password.Length <= 63 &&
            IPAddress.Length <= 15 &&
            Port > 0 && Port < 65536;
    }
    
    /// <summary>
    /// 验证网络配置
    /// </summary>
    private bool ValidateNetworkConfig(NetworkConfig config)
    {
        if (!config.IsValid)
        {
            LogError("基本配置参数验证失败");
            return false;
        }
        
        // 验证IP地址格式
        if (!IPAddress.TryParse(config.IPAddress, out var ipAddr))
        {
            LogError($"无效的IP地址: {config.IPAddress}");
            return false;
        }
        
        // 验证网关地址 (如果提供)
        if (!string.IsNullOrEmpty(config.Gateway) && 
            !IPAddress.TryParse(config.Gateway, out _))
        {
            LogError($"无效的网关地址: {config.Gateway}");
            return false;
        }
        
        // 验证DNS地址 (如果提供)
        if (!string.IsNullOrEmpty(config.DNS1) && 
            !IPAddress.TryParse(config.DNS1, out _))
        {
            LogError($"无效的DNS地址: {config.DNS1}");
            return false;
        }
        
        return true;
    }
    
    /// <summary>
    /// 扫描可用WiFi网络
    /// </summary>
    public async Task<List<WiFiNetwork>> ScanWiFiNetworksAsync()
    {
        try
        {
            var networks = new List<WiFiNetwork>();
            
            // 在Windows上使用netsh命令
            if (Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                networks = await ScanWiFiWindowsAsync();
            }
            // 在Linux上使用nmcli或iwlist
            else if (Environment.OSVersion.Platform == PlatformID.Unix)
            {
                networks = await ScanWiFiLinuxAsync();
            }
            
            return networks.OrderByDescending(n => n.SignalStrength).ToList();
        }
        catch (Exception ex)
        {
            LogError($"WiFi扫描失败: {ex.Message}");
            return new List<WiFiNetwork>();
        }
    }
    
    /// <summary>
    /// Windows WiFi扫描
    /// </summary>
    private async Task<List<WiFiNetwork>> ScanWiFiWindowsAsync()
    {
        var networks = new List<WiFiNetwork>();
        
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = "wlan show profiles",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            };
            
            using var process = Process.Start(startInfo);
            if (process != null)
            {
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                // 解析netsh输出
                networks = ParseNetshOutput(output);
            }
        }
        catch (Exception ex)
        {
            LogWarning($"Windows WiFi扫描异常: {ex.Message}");
        }
        
        return networks;
    }
    
    /// <summary>
    /// 保存网络配置到本地文件
    /// </summary>
    private async Task SaveNetworkConfigAsync(NetworkConfig config)
    {
        try
        {
            var configPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "PicoLogicAnalyzer",
                "network_configs.json"
            );
            
            Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);
            
            var configs = await LoadSavedNetworkConfigsAsync();
            
            // 更新或添加配置
            var existingIndex = configs.FindIndex(c => c.SSID == config.SSID);
            if (existingIndex >= 0)
            {
                configs[existingIndex] = config;
            }
            else
            {
                configs.Add(config);
            }
            
            var json = JsonSerializer.Serialize(configs, new JsonSerializerOptions
            {
                WriteIndented = true
            });
            
            await File.WriteAllTextAsync(configPath, json);
        }
        catch (Exception ex)
        {
            LogWarning($"保存网络配置失败: {ex.Message}");
        }
    }
}

/// <summary>
/// WiFi网络信息
/// </summary>
public class WiFiNetwork
{
    public string SSID { get; set; } = string.Empty;           // 网络名称
    public int SignalStrength { get; set; }                    // 信号强度 (dBm)
    public string SecurityType { get; set; } = string.Empty;   // 加密类型
    public string Channel { get; set; } = string.Empty;        // 频道
    public bool IsSecured { get; set; }                        // 是否加密
    
    /// <summary>
    /// 信号强度百分比
    /// </summary>
    public int SignalPercentage => Math.Max(0, Math.Min(100, (SignalStrength + 100) * 2));
}
```

## 📊 设备状态监控系统

### 1. 设备健康监控

**实时状态监控器** (`DeviceHealthMonitor.cs`):
```csharp
/// <summary>
/// 设备健康状态监控器
/// 监控设备温度、电压、通信质量等关键指标
/// </summary>
public class DeviceHealthMonitor : IDisposable
{
    private readonly AnalyzerDriverBase driver;
    private readonly Timer healthCheckTimer;
    private readonly Queue<HealthMetric> healthHistory = new();
    private const int MaxHistorySize = 100;
    
    public event EventHandler<HealthStatusEventArgs>? HealthStatusChanged;
    public event EventHandler<HealthAlertEventArgs>? HealthAlert;
    
    public DeviceHealthMonitor(AnalyzerDriverBase driver, TimeSpan checkInterval = default)
    {
        this.driver = driver;
        var interval = checkInterval == default ? TimeSpan.FromSeconds(5) : checkInterval;
        healthCheckTimer = new Timer(CheckDeviceHealth, null, TimeSpan.Zero, interval);
    }
    
    /// <summary>
    /// 定期健康检查
    /// </summary>
    private async void CheckDeviceHealth(object? state)
    {
        try
        {
            var metrics = await CollectHealthMetricsAsync();
            
            // 更新历史记录
            lock (healthHistory)
            {
                healthHistory.Enqueue(metrics);
                while (healthHistory.Count > MaxHistorySize)
                {
                    healthHistory.Dequeue();
                }
            }
            
            // 分析健康状态
            var status = AnalyzeHealthStatus(metrics);
            
            // 检查警告条件
            CheckHealthAlerts(metrics, status);
            
            // 触发状态变化事件
            HealthStatusChanged?.Invoke(this, new HealthStatusEventArgs(status, metrics));
        }
        catch (Exception ex)
        {
            LogError($"设备健康检查异常: {ex.Message}");
        }
    }
    
    /// <summary>
    /// 收集设备健康指标
    /// </summary>
    private async Task<HealthMetric> CollectHealthMetricsAsync()
    {
        var metrics = new HealthMetric
        {
            Timestamp = DateTime.Now,
            IsConnected = driver != null
        };
        
        if (driver == null) return metrics;
        
        try
        {
            // 电压状态检查
            var voltageStatus = await driver.GetVoltageStatusAsync();
            if (!string.IsNullOrEmpty(voltageStatus))
            {
                metrics.VoltageStatus = voltageStatus;
                metrics.BatteryVoltage = ParseVoltageFromStatus(voltageStatus);
            }
            
            // 通信延迟测试
            var pingStart = DateTime.UtcNow;
            var deviceInfo = driver.GetDeviceInfo();
            var pingEnd = DateTime.UtcNow;
            metrics.CommunicationLatency = pingEnd - pingStart;
            
            // 设备温度 (如果支持)
            metrics.DeviceTemperature = await GetDeviceTemperatureAsync();
            
            // 缓冲区使用率
            metrics.BufferUsage = CalculateBufferUsage();
            
            // 错误率统计
            metrics.ErrorRate = CalculateErrorRate();
            
            metrics.IsHealthy = true;
        }
        catch (Exception ex)
        {
            metrics.IsHealthy = false;
            metrics.LastError = ex.Message;
            LogWarning($"健康指标收集失败: {ex.Message}");
        }
        
        return metrics;
    }
    
    /// <summary>
    /// 分析设备健康状态
    /// </summary>
    private HealthStatus AnalyzeHealthStatus(HealthMetric current)
    {
        if (!current.IsConnected)
            return HealthStatus.Disconnected;
            
        if (!current.IsHealthy)
            return HealthStatus.Error;
        
        var score = 100;
        
        // 电压状态评分
        if (current.BatteryVoltage.HasValue)
        {
            if (current.BatteryVoltage < 3.0) score -= 30;      // 低电压
            else if (current.BatteryVoltage < 3.3) score -= 15; // 电压偏低
        }
        
        // 通信延迟评分
        if (current.CommunicationLatency.TotalMilliseconds > 1000)
            score -= 25;    // 高延迟
        else if (current.CommunicationLatency.TotalMilliseconds > 500)
            score -= 10;    // 延迟偏高
        
        // 错误率评分
        if (current.ErrorRate > 0.05) score -= 20;     // 高错误率
        else if (current.ErrorRate > 0.01) score -= 5; // 错误率偏高
        
        // 缓冲区使用率评分
        if (current.BufferUsage > 0.9) score -= 15;    // 缓冲区几乎满
        else if (current.BufferUsage > 0.75) score -= 5; // 缓冲区使用率高
        
        return score switch
        {
            >= 90 => HealthStatus.Excellent,
            >= 75 => HealthStatus.Good,
            >= 60 => HealthStatus.Fair,
            >= 40 => HealthStatus.Poor,
            _ => HealthStatus.Critical
        };
    }
    
    /// <summary>
    /// 检查健康警告条件
    /// </summary>
    private void CheckHealthAlerts(HealthMetric metrics, HealthStatus status)
    {
        var alerts = new List<HealthAlert>();
        
        // 低电压警告
        if (metrics.BatteryVoltage.HasValue && metrics.BatteryVoltage < 3.2)
        {
            alerts.Add(new HealthAlert
            {
                Type = HealthAlertType.LowVoltage,
                Severity = metrics.BatteryVoltage < 3.0 ? AlertSeverity.Critical : AlertSeverity.Warning,
                Message = $"设备电压偏低: {metrics.BatteryVoltage:F2}V",
                Recommendation = "请检查电源供应或更换电池"
            });
        }
        
        // 高延迟警告
        if (metrics.CommunicationLatency.TotalMilliseconds > 1000)
        {
            alerts.Add(new HealthAlert
            {
                Type = HealthAlertType.HighLatency,
                Severity = AlertSeverity.Warning,
                Message = $"通信延迟过高: {metrics.CommunicationLatency.TotalMilliseconds:F0}ms",
                Recommendation = "检查连接线缆或网络状态"
            });
        }
        
        // 高错误率警告
        if (metrics.ErrorRate > 0.05)
        {
            alerts.Add(new HealthAlert
            {
                Type = HealthAlertType.HighErrorRate,
                Severity = AlertSeverity.Warning,
                Message = $"数据错误率过高: {metrics.ErrorRate:P2}",
                Recommendation = "检查信号质量和连接稳定性"
            });
        }
        
        // 触发警告事件
        foreach (var alert in alerts)
        {
            HealthAlert?.Invoke(this, new HealthAlertEventArgs(alert, metrics));
        }
    }
    
    /// <summary>
    /// 获取健康历史记录
    /// </summary>
    public List<HealthMetric> GetHealthHistory()
    {
        lock (healthHistory)
        {
            return healthHistory.ToList();
        }
    }
    
    /// <summary>
    /// 生成健康报告
    /// </summary>
    public HealthReport GenerateHealthReport()
    {
        var history = GetHealthHistory();
        if (history.Count == 0)
        {
            return new HealthReport { HasData = false };
        }
        
        var current = history.Last();
        var report = new HealthReport
        {
            HasData = true,
            CurrentStatus = AnalyzeHealthStatus(current),
            GeneratedAt = DateTime.Now,
            
            // 统计数据
            TotalSamples = history.Count,
            AverageLatency = TimeSpan.FromMilliseconds(
                history.Average(h => h.CommunicationLatency.TotalMilliseconds)),
            AverageErrorRate = history.Average(h => h.ErrorRate),
            UptimePercentage = history.Count(h => h.IsHealthy) / (double)history.Count,
            
            // 当前状态
            CurrentVoltage = current.BatteryVoltage,
            CurrentLatency = current.CommunicationLatency,
            CurrentErrorRate = current.ErrorRate,
            CurrentBufferUsage = current.BufferUsage
        };
        
        return report;
    }
}

/// <summary>
/// 健康指标数据模型
/// </summary>
public class HealthMetric
{
    public DateTime Timestamp { get; set; }
    public bool IsConnected { get; set; }
    public bool IsHealthy { get; set; }
    public string? VoltageStatus { get; set; }
    public double? BatteryVoltage { get; set; }
    public TimeSpan CommunicationLatency { get; set; }
    public double? DeviceTemperature { get; set; }
    public double BufferUsage { get; set; }
    public double ErrorRate { get; set; }
    public string? LastError { get; set; }
}

/// <summary>
/// 设备健康状态枚举
/// </summary>
public enum HealthStatus
{
    Disconnected,   // 未连接
    Critical,       // 严重问题
    Poor,          // 状态较差
    Fair,          // 一般
    Good,          // 良好
    Excellent      // 优秀
}

/// <summary>
/// 健康警告类型
/// </summary>
public enum HealthAlertType
{
    LowVoltage,         // 低电压
    HighLatency,        // 高延迟
    HighErrorRate,      // 高错误率
    BufferOverflow,     // 缓冲区溢出
    ConnectionLost,     // 连接丢失
    DeviceOverheating   // 设备过热
}

/// <summary>
/// 警告严重程度
/// </summary>
public enum AlertSeverity
{
    Info,       // 信息
    Warning,    // 警告
    Critical    // 严重
}
```

## 🔧 设备信息和能力查询

### 1. 设备能力查询系统

**DeviceCapabilityInspector 设备能力检查器**:
```csharp
/// <summary>
/// 设备能力深度检查器
/// 提供设备硬件规格、功能特性和性能参数的详细查询
/// </summary>
public class DeviceCapabilityInspector
{
    private readonly AnalyzerDriverBase driver;
    
    public DeviceCapabilityInspector(AnalyzerDriverBase driver)
    {
        this.driver = driver;
    }
    
    /// <summary>
    /// 获取完整的设备能力信息
    /// </summary>
    public async Task<DeviceCapabilityInfo> GetDeviceCapabilitiesAsync()
    {
        try
        {
            var info = new DeviceCapabilityInfo
            {
                // 基本信息
                DeviceVersion = driver.DeviceVersion,
                DriverType = driver.DriverType,
                IsNetworkDevice = driver.IsNetwork,
                
                // 硬件规格
                ChannelCount = driver.ChannelCount,
                MaxFrequency = driver.MaxFrequency,
                MinFrequency = driver.MinFrequency,
                BufferSize = driver.BufferSize,
                BlastFrequency = driver.BlastFrequency,
                
                // 采集能力
                SupportedCaptureModes = GetSupportedCaptureModes(),
                TriggerCapabilities = GetTriggerCapabilities(),
                
                // 性能指标
                MaxSampleRate = driver.MaxFrequency,
                MaxMemoryDepth = CalculateMaxMemoryDepth(),
                
                // 连接信息
                ConnectionType = GetConnectionType(),
                CommunicationProtocol = "Pico Logic Analyzer Protocol v1.0"
            };
            
            // 获取采集限制信息
            info.CaptureLimits = GetCaptureLimitsForAllModes();
            
            // 网络设备额外信息
            if (driver.IsNetwork)
            {
                info.NetworkCapabilities = await GetNetworkCapabilitiesAsync();
            }
            
            return info;
        }
        catch (Exception ex)
        {
            LogError($"获取设备能力信息失败: {ex.Message}");
            throw;
        }
    }
    
    /// <summary>
    /// 获取支持的采集模式
    /// </summary>
    private List<CaptureModeInfo> GetSupportedCaptureModes()
    {
        var modes = new List<CaptureModeInfo>();
        
        // 8通道模式 (最大采样深度)
        modes.Add(new CaptureModeInfo
        {
            Mode = CaptureMode.Channels_8,
            ChannelCount = 8,
            MaxSampleDepth = driver.BufferSize,
            Description = "8通道模式 - 最大采样深度",
            RecommendedFor = "需要长时间记录的应用"
        });
        
        // 16通道模式 (平衡模式)
        modes.Add(new CaptureModeInfo
        {
            Mode = CaptureMode.Channels_16,
            ChannelCount = 16,
            MaxSampleDepth = driver.BufferSize / 2,
            Description = "16通道模式 - 平衡通道数和采样深度",
            RecommendedFor = "大多数逻辑分析应用"
        });
        
        // 24通道模式 (最大通道数)
        modes.Add(new CaptureModeInfo
        {
            Mode = CaptureMode.Channels_24,
            ChannelCount = 24,
            MaxSampleDepth = driver.BufferSize / 3,
            Description = "24通道模式 - 最大通道数",
            RecommendedFor = "复杂多信号并行分析"
        });
        
        return modes;
    }
    
    /// <summary>
    /// 获取触发能力信息
    /// </summary>
    private TriggerCapabilityInfo GetTriggerCapabilities()
    {
        return new TriggerCapabilityInfo
        {
            SupportedTriggerTypes = new[]
            {
                TriggerType.Edge,       // 边沿触发
                TriggerType.Complex,    // 复杂触发
                TriggerType.Fast,       // 快速触发
                TriggerType.Blast       // 突发触发
            },
            
            MaxTriggerChannels = driver.ChannelCount,
            SupportsTriggerInversion = true,
            SupportsPatternTrigger = true,
            MaxPatternWidth = 16,
            
            TriggerDelays = new Dictionary<TriggerType, int>
            {
                [TriggerType.Edge] = 0,
                [TriggerType.Complex] = 5,      // 5个时钟周期延迟
                [TriggerType.Fast] = 3,         // 3个时钟周期延迟
                [TriggerType.Blast] = 0
            },
            
            Description = "支持多种触发模式，包括边沿、模式匹配和复杂逻辑触发"
        };
    }
    
    /// <summary>
    /// 获取所有采集模式的限制信息
    /// </summary>
    private Dictionary<CaptureMode, CaptureLimits> GetCaptureLimitsForAllModes()
    {
        var limits = new Dictionary<CaptureMode, CaptureLimits>();
        
        foreach (CaptureMode mode in Enum.GetValues<CaptureMode>())
        {
            var channelCounts = mode switch
            {
                CaptureMode.Channels_8 => Enumerable.Range(0, 8).ToArray(),
                CaptureMode.Channels_16 => Enumerable.Range(0, 16).ToArray(),
                CaptureMode.Channels_24 => Enumerable.Range(0, 24).ToArray(),
                _ => Array.Empty<int>()
            };
            
            limits[mode] = driver.GetLimits(channelCounts);
        }
        
        return limits;
    }
    
    /// <summary>
    /// 性能基准测试
    /// </summary>
    public async Task<PerformanceBenchmark> RunPerformanceBenchmarkAsync()
    {
        var benchmark = new PerformanceBenchmark
        {
            TestStartTime = DateTime.Now
        };
        
        try
        {
            // 通信延迟测试
            benchmark.CommunicationLatency = await MeasureCommunicationLatencyAsync();
            
            // 数据传输速率测试
            benchmark.DataTransferRate = await MeasureDataTransferRateAsync();
            
            // 触发响应时间测试
            benchmark.TriggerResponseTime = await MeasureTriggerResponseTimeAsync();
            
            // 稳定性测试
            benchmark.StabilityScore = await MeasureStabilityScoreAsync();
            
            benchmark.TestEndTime = DateTime.Now;
            benchmark.TotalTestDuration = benchmark.TestEndTime - benchmark.TestStartTime;
            benchmark.IsSuccessful = true;
            
            LogInfo($"性能基准测试完成: 延迟={benchmark.CommunicationLatency.TotalMilliseconds:F1}ms, " +
                   $"传输速率={benchmark.DataTransferRate:F1}MB/s");
        }
        catch (Exception ex)
        {
            benchmark.IsSuccessful = false;
            benchmark.ErrorMessage = ex.Message;
            LogError($"性能基准测试失败: {ex.Message}");
        }
        
        return benchmark;
    }
    
    /// <summary>
    /// 测量通信延迟
    /// </summary>
    private async Task<TimeSpan> MeasureCommunicationLatencyAsync()
    {
        const int testCount = 10;
        var latencies = new List<TimeSpan>();
        
        for (int i = 0; i < testCount; i++)
        {
            var startTime = DateTime.UtcNow;
            
            // 执行简单的设备查询 (获取版本信息)
            var version = driver.DeviceVersion;
            
            var endTime = DateTime.UtcNow;
            latencies.Add(endTime - startTime);
            
            // 避免连续测试影响
            await Task.Delay(10);
        }
        
        // 返回平均延迟 (排除最高和最低值)
        var sortedLatencies = latencies.OrderBy(l => l.TotalMilliseconds).ToList();
        var trimmedLatencies = sortedLatencies.Skip(1).Take(testCount - 2);
        
        return TimeSpan.FromMilliseconds(
            trimmedLatencies.Average(l => l.TotalMilliseconds));
    }
}

/// <summary>
/// 设备能力信息完整数据模型
/// </summary>
public class DeviceCapabilityInfo
{
    // 基本信息
    public string DeviceVersion { get; set; } = string.Empty;
    public AnalyzerDriverType DriverType { get; set; }
    public bool IsNetworkDevice { get; set; }
    
    // 硬件规格
    public int ChannelCount { get; set; }
    public int MaxFrequency { get; set; }
    public int MinFrequency { get; set; }
    public int BufferSize { get; set; }
    public int BlastFrequency { get; set; }
    
    // 功能特性
    public List<CaptureModeInfo> SupportedCaptureModes { get; set; } = new();
    public TriggerCapabilityInfo TriggerCapabilities { get; set; } = new();
    public Dictionary<CaptureMode, CaptureLimits> CaptureLimits { get; set; } = new();
    
    // 性能参数
    public int MaxSampleRate { get; set; }
    public long MaxMemoryDepth { get; set; }
    
    // 连接信息
    public string ConnectionType { get; set; } = string.Empty;
    public string CommunicationProtocol { get; set; } = string.Empty;
    
    // 网络能力 (可选)
    public NetworkCapabilityInfo? NetworkCapabilities { get; set; }
    
    /// <summary>
    /// 生成设备规格摘要
    /// </summary>
    public string GetSpecificationSummary()
    {
        return $"{DeviceVersion} - {ChannelCount}通道 @ {MaxFrequency / 1_000_000}MHz, " +
               $"{BufferSize / 1024}K采样缓存, {ConnectionType}连接";
    }
}

/// <summary>
/// 采集模式信息
/// </summary>
public class CaptureModeInfo
{
    public CaptureMode Mode { get; set; }
    public int ChannelCount { get; set; }
    public int MaxSampleDepth { get; set; }
    public string Description { get; set; } = string.Empty;
    public string RecommendedFor { get; set; } = string.Empty;
}

/// <summary>
/// 触发能力信息
/// </summary>
public class TriggerCapabilityInfo
{
    public TriggerType[] SupportedTriggerTypes { get; set; } = Array.Empty<TriggerType>();
    public int MaxTriggerChannels { get; set; }
    public bool SupportsTriggerInversion { get; set; }
    public bool SupportsPatternTrigger { get; set; }
    public int MaxPatternWidth { get; set; }
    public Dictionary<TriggerType, int> TriggerDelays { get; set; } = new();
    public string Description { get; set; } = string.Empty;
}

/// <summary>
/// 网络能力信息
/// </summary>
public class NetworkCapabilityInfo
{
    public bool SupportsWiFi { get; set; }
    public bool SupportsEthernet { get; set; }
    public string[] SupportedSecurityTypes { get; set; } = Array.Empty<string>();
    public int[] SupportedChannels { get; set; } = Array.Empty<int>();
    public bool SupportsDHCP { get; set; }
    public bool SupportsStaticIP { get; set; }
    public int DefaultPort { get; set; }
}

/// <summary>
/// 性能基准测试结果
/// </summary>
public class PerformanceBenchmark
{
    public DateTime TestStartTime { get; set; }
    public DateTime TestEndTime { get; set; }
    public TimeSpan TotalTestDuration { get; set; }
    public bool IsSuccessful { get; set; }
    public string? ErrorMessage { get; set; }
    
    // 性能指标
    public TimeSpan CommunicationLatency { get; set; }      // 通信延迟
    public double DataTransferRate { get; set; }            // 数据传输速率 (MB/s)
    public TimeSpan TriggerResponseTime { get; set; }       // 触发响应时间
    public double StabilityScore { get; set; }              // 稳定性评分 (0-100)
    
    /// <summary>
    /// 生成性能摘要
    /// </summary>
    public string GetPerformanceSummary()
    {
        if (!IsSuccessful)
            return $"测试失败: {ErrorMessage}";
            
        return $"延迟: {CommunicationLatency.TotalMilliseconds:F1}ms, " +
               $"传输: {DataTransferRate:F1}MB/s, " +
               $"稳定性: {StabilityScore:F0}%";
    }
}
```

## 🎯 VSCode插件实现要点

### 1. TypeScript设备管理接口

**核心接口转换**:
```typescript
// 设备信息接口
interface DeviceInfo {
  vendorId: string;                     // string VendorId
  productId: string;                    // string ProductId
  serialNumber: string;                 // string SerialNumber
  devicePath: string;                   // string DevicePath
  serialPort?: string;                  // string? SerialPort
  platform: DevicePlatform;            // DevicePlatform枚举
  detectedAt: Date;                     // DateTime DetectedAt
  
  readonly displayName: string;         // 计算属性
  readonly connectionString: string;    // 计算属性
}

// 连接管理器接口
interface IConnectionManager {
  connectToDevice(deviceInfo: DeviceInfo, options?: ConnectionOptions): Promise<ConnectionResult>;
  disconnectDevice(serialNumber: string): Promise<boolean>;
  getConnectionStatus(serialNumber: string): ConnectionStatus;
  getActiveConnections(): Map<string, IAnalyzerDriver>;
  
  // 事件
  onConnectionEstablished: (handler: (args: ConnectionEventArgs) => void) => void;
  onConnectionLost: (handler: (args: ConnectionEventArgs) => void) => void;
  onConnectionError: (handler: (args: ConnectionEventArgs) => void) => void;
}
```

### 2. Node.js设备检测实现

**跨平台设备检测**:
```typescript
import * as os from 'os';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class DeviceDetector {
  private static readonly TARGET_VID = '1209';
  private static readonly TARGET_PID = '3020';
  
  /**
   * 跨平台设备检测
   */
  static async detectDevices(): Promise<DeviceInfo[]> {
    try {
      const platform = os.platform();
      
      switch (platform) {
        case 'win32':
          return await this.detectWindowsDevices();
        case 'linux':
          return await this.detectLinuxDevices();
        case 'darwin':
          return await this.detectMacOSDevices();
        default:
          return [];
      }
    } catch (error) {
      console.error(`设备检测失败: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Linux设备检测实现
   */
  private static async detectLinuxDevices(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = [];
    
    try {
      const usbDevicesPath = '/sys/bus/usb/devices';
      const deviceDirs = await fs.readdir(usbDevicesPath);
      
      for (const dir of deviceDirs) {
        const devicePath = `${usbDevicesPath}/${dir}`;
        const deviceInfo = await this.parseLinuxDeviceDirectory(devicePath);
        
        if (deviceInfo && this.isTargetDevice(deviceInfo)) {
          deviceInfo.serialPort = await this.findLinuxSerialPort(devicePath);
          devices.push(deviceInfo);
        }
      }
    } catch (error) {
      console.warn(`Linux设备检测异常: ${error.message}`);
    }
    
    return devices;
  }
  
  /**
   * 解析Linux设备目录
   */
  private static async parseLinuxDeviceDirectory(devicePath: string): Promise<DeviceInfo | null> {
    try {
      const [vendorId, productId, serialNumber] = await Promise.all([
        fs.readFile(`${devicePath}/idVendor`, 'utf8').then(s => s.trim()),
        fs.readFile(`${devicePath}/idProduct`, 'utf8').then(s => s.trim()),
        fs.readFile(`${devicePath}/serial`, 'utf8').then(s => s.trim()).catch(() => 'Unknown')
      ]);
      
      return {
        vendorId,
        productId,
        serialNumber,
        devicePath,
        platform: DevicePlatform.Linux,
        detectedAt: new Date(),
        get displayName() { return `Pico Logic Analyzer (${this.serialNumber})`; },
        get connectionString() { return this.serialPort || `USB:${this.vendorId}:${this.productId}`; }
      };
    } catch {
      return null;
    }
  }
  
  /**
   * 查找Linux串口设备
   */
  private static async findLinuxSerialPort(devicePath: string): Promise<string | undefined> {
    try {
      // 查找ttyUSB或ttyACM设备
      const { stdout } = await execAsync(`find ${devicePath} -name "ttyUSB*" -o -name "ttyACM*" 2>/dev/null`);
      const ttyDevices = stdout.trim().split('\n').filter(line => line);
      
      if (ttyDevices.length > 0) {
        const deviceName = ttyDevices[0].split('/').pop();
        return `/dev/${deviceName}`;
      }
    } catch {
      // 忽略错误，返回undefined
    }
    
    return undefined;
  }
  
  /**
   * 检查是否为目标设备
   */
  private static isTargetDevice(deviceInfo: DeviceInfo): boolean {
    return deviceInfo.vendorId.toLowerCase() === this.TARGET_VID &&
           deviceInfo.productId.toLowerCase() === this.TARGET_PID;
  }
}
```

### 3. VSCode扩展集成

**设备管理器VSCode集成**:
```typescript
import * as vscode from 'vscode';

export class DeviceManagerProvider implements vscode.TreeDataProvider<DeviceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DeviceTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  private devices: DeviceInfo[] = [];
  private deviceMonitor: DeviceMonitor;
  
  constructor() {
    this.deviceMonitor = new DeviceMonitor();
    this.setupDeviceMonitoring();
    this.startDeviceDetection();
  }
  
  private setupDeviceMonitoring(): void {
    this.deviceMonitor.onDeviceConnected((device) => {
      this.devices.push(device);
      this._onDidChangeTreeData.fire(undefined);
      vscode.window.showInformationMessage(`设备已连接: ${device.displayName}`);
    });
    
    this.deviceMonitor.onDeviceDisconnected((device) => {
      this.devices = this.devices.filter(d => d.serialNumber !== device.serialNumber);
      this._onDidChangeTreeData.fire(undefined);
      vscode.window.showWarningMessage(`设备已断开: ${device.displayName}`);
    });
  }
  
  getTreeItem(element: DeviceTreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(element?: DeviceTreeItem): Thenable<DeviceTreeItem[]> {
    if (!element) {
      // 根节点：显示所有设备
      return Promise.resolve(
        this.devices.map(device => new DeviceTreeItem(device))
      );
    }
    
    return Promise.resolve([]);
  }
  
  /**
   * 连接到设备命令
   */
  async connectToDevice(item: DeviceTreeItem): Promise<void> {
    try {
      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `连接设备: ${item.device.displayName}`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: '正在连接...' });
        
        const connectionManager = new ConnectionManager();
        const result = await connectionManager.connectToDevice(item.device);
        
        progress.report({ increment: 100, message: '连接完成' });
        return result;
      });
      
      if (result.success) {
        vscode.window.showInformationMessage(`成功连接到 ${item.device.displayName}`);
        // 更新设备状态
        item.updateConnectionStatus(true);
        this._onDidChangeTreeData.fire(item);
      } else {
        vscode.window.showErrorMessage(`连接失败: ${result.errorMessage}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`连接异常: ${error.message}`);
    }
  }
}

class DeviceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly device: DeviceInfo,
    private isConnected: boolean = false
  ) {
    super(device.displayName, vscode.TreeItemCollapsibleState.None);
    
    this.tooltip = this.generateTooltip();
    this.description = device.connectionString;
    this.contextValue = isConnected ? 'connectedDevice' : 'disconnectedDevice';
    this.iconPath = this.getDeviceIcon();
    
    // 连接命令
    if (!isConnected) {
      this.command = {
        command: 'logicAnalyzer.connectDevice',
        title: '连接设备',
        arguments: [this]
      };
    }
  }
  
  private generateTooltip(): string {
    return `设备: ${this.device.displayName}\n` +
           `序列号: ${this.device.serialNumber}\n` +
           `连接: ${this.device.connectionString}\n` +
           `平台: ${this.device.platform}\n` +
           `检测时间: ${this.device.detectedAt.toLocaleString()}`;
  }
  
  private getDeviceIcon(): vscode.ThemeIcon {
    if (this.isConnected) {
      return new vscode.ThemeIcon('device-desktop', new vscode.ThemeColor('charts.green'));
    } else {
      return new vscode.ThemeIcon('device-desktop', new vscode.ThemeColor('charts.gray'));
    }
  }
  
  updateConnectionStatus(connected: boolean): void {
    this.isConnected = connected;
    this.contextValue = connected ? 'connectedDevice' : 'disconnectedDevice';
    this.iconPath = this.getDeviceIcon();
  }
}
```

## 📊 总结

本文档详细分析了 Pico Logic Analyzer 的设备管理功能系统，主要包含：

### 🔑 关键技术特点
1. **跨平台设备检测**: Windows注册表 + Linux sysfs的统一检测方案
2. **智能连接管理**: 自动连接、重试机制、状态监控
3. **实时健康监控**: 电压、延迟、错误率等关键指标监控
4. **网络配置管理**: WiFi配置、IP设置、网络扫描
5. **设备能力查询**: 完整的硬件规格和性能基准测试

### 🎯 VSCode插件实现价值
1. **成熟的检测算法**: 直接可用的跨平台设备发现方案
2. **完整的管理框架**: 连接、监控、配置的统一管理架构
3. **丰富的状态信息**: 设备健康、性能、能力的全面监控
4. **现代化的用户体验**: VSCode树形视图集成的设备管理界面

这个设备管理系统为VSCode插件项目提供了企业级的设备管理能力，确保了设备连接的稳定性和用户体验的流畅性。