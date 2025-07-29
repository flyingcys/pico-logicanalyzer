# Pico Logic Analyzer 用户界面系统深度分析

## 1. UI系统架构概览

### 1.1 UI框架技术栈
```
┌─────────────────────────────────────────────────────────────┐
│                    Avalonia UI 框架                         │
│              跨平台桌面应用程序框架                          │
├─────────────────────────────────────────────────────────────┤
│                   XAML 声明式布局                            │
│              .axaml 文件定义界面结构                         │
├─────────────────────────────────────────────────────────────┤
│                  SkiaSharp 图形引擎                          │
│              高性能 2D 图形渲染和绘制                       │
├─────────────────────────────────────────────────────────────┤
│                   MVVM 架构模式                              │
│          Model-View-ViewModel 数据绑定                      │
├─────────────────────────────────────────────────────────────┤
│                  自定义控件系统                              │
│      SampleViewer | ChannelViewer | AnnotationViewer       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 UI模块组织结构

| 目录/文件 | 功能职责 | 核心组件 |
|----------|---------|----------|
| `MainWindow.axaml` | 主窗口界面 | MainWindow |
| `Controls/` | 自定义控件库 | 8个专业控件 |
| `Dialogs/` | 对话框系统 | 12个功能对话框 |
| `Styles/` | 样式和主题 | ButtonStyles, ToolWindow |
| `Assets/` | 资源文件 | 图标、字体、图片 |

## 2. MainWindow 主窗口系统

### 2.1 主窗口布局结构

```xml
<!-- MainWindow.axaml 布局架构 -->
<Window x:Class="LogicAnalyzer.MainWindow">
  <DockPanel>
    <!-- 顶部菜单栏 -->
    <Menu DockPanel.Dock="Top">
      <MenuItem Header="文件" />
      <MenuItem Header="编辑" />
      <MenuItem Header="网络" />
      <MenuItem Header="协议" />
    </Menu>
    
    <!-- 顶部工具栏 -->
    <Border DockPanel.Dock="Top">
      <Grid ColumnDefinitions="Auto,*,Auto,Auto,Auto">
        <Button Grid.Column="0" Name="btnStart" Content="开始采集" />
        <TextBlock Grid.Column="1" Name="lblDeviceInfo" />
        <Button Grid.Column="2" Name="btnSettings" />
        <Button Grid.Column="3" Name="btnConnect" />
        <Image Grid.Column="4" Name="imgStatus" />
      </Grid>
    </Border>
    
    <!-- 主要内容区域 -->
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="*" />
        <RowDefinition Height="200" />
      </Grid.RowDefinitions>
      
      <!-- 波形显示区域 -->
      <Grid Grid.Row="0">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="150" />
          <ColumnDefinition Width="*" />
        </Grid.ColumnDefinitions>
        
        <!-- 通道列表 -->
        <Controls:ChannelViewer Grid.Column="0" Name="channelViewer" />
        
        <!-- 波形显示 -->
        <Controls:SampleViewer Grid.Column="1" Name="sampleViewer" />
      </Grid>
      
      <!-- 底部区域 -->
      <TabControl Grid.Row="1">
        <TabItem Header="解码器">
          <Controls:SigrokDecoderManager Name="decoderManager" />
        </TabItem>
        <TabItem Header="注释">
          <Controls:AnnotationViewer Name="annotationViewer" />
        </TabItem>
      </TabControl>
    </Grid>
  </DockPanel>
</Window>
```

### 2.2 主窗口控制器逻辑

```csharp
public partial class MainWindow : PersistableWindowBase
{
    // 核心组件
    AnalyzerDriverBase? driver;              // 硬件驱动
    CaptureSession session;                  // 采集会话
    SigrokProvider? decoderProvider;         // 解码器提供者
    
    // UI状态管理
    bool isCapturing = false;                // 采集状态
    bool deviceConnected = false;            // 设备连接状态
    
    // 显示接口集合
    List<ISampleDisplay> sampleDisplays;     // 样本显示接口
    List<IRegionDisplay> regionDisplays;     // 区域显示接口
    List<IMarkerDisplay> markerDisplays;     // 标记显示接口
    
    public MainWindow()
    {
        InitializeComponent();
        InitializeSession();
        InitializeDisplayInterfaces();
        SetupEventHandlers();
    }
}
```

### 2.3 事件处理系统

#### 设备连接事件处理
```csharp
private async void btnConnect_Click(object? sender, RoutedEventArgs e)
{
    if (deviceConnected)
    {
        // 断开设备
        DisconnectDevice();
    }
    else
    {
        // 连接设备
        await ConnectDevice();
    }
}

private async Task ConnectDevice()
{
    try
    {
        // 1. 显示设备选择对话框
        var deviceDialog = new DeviceSelectorDialog();
        var selectedDevice = await deviceDialog.ShowDialog(this);
        
        if (selectedDevice != null)
        {
            // 2. 创建对应的驱动
            driver = DriverFactory.CreateDriver(selectedDevice);
            
            // 3. 尝试连接
            if (await driver.ConnectAsync())
            {
                deviceConnected = true;
                UpdateUIState();
                LoadDecoders();
            }
        }
    }
    catch (Exception ex)
    {
        ShowErrorMessage($"设备连接失败: {ex.Message}");
    }
}
```

#### 采集控制事件处理
```csharp
private async void btnStart_Click(object? sender, RoutedEventArgs e)
{
    if (isCapturing)
    {
        // 停止采集
        StopCapture();
    }
    else
    {
        // 开始采集
        await StartCapture();
    }
}

private async Task StartCapture()
{
    if (driver == null || !deviceConnected)
    {
        ShowErrorMessage("设备未连接");
        return;
    }
    
    try
    {
        // 1. 验证采集配置
        var validationResult = ValidateCaptureSettings();
        if (!validationResult.IsValid)
        {
            ShowErrorMessage(validationResult.ErrorMessage);
            return;
        }
        
        // 2. 更新UI状态
        isCapturing = true;
        UpdateUIState();
        
        // 3. 启动采集
        var result = await driver.StartCaptureAsync(session, OnCaptureCompleted);
        
        if (result != CaptureError.None)
        {
            ShowErrorMessage($"采集启动失败: {result}");
            isCapturing = false;
            UpdateUIState();
        }
    }
    catch (Exception ex)
    {
        ShowErrorMessage($"采集异常: {ex.Message}");
        isCapturing = false;
        UpdateUIState();
    }
}
```

## 3. Controls 自定义控件系统

### 3.1 SampleViewer 波形显示控件

#### 控件核心结构
```csharp
public partial class SampleViewer : UserControl, ISampleDisplay, IRegionDisplay, IMarkerDisplay
{
    // 显示参数常量
    private const int MIN_CHANNEL_HEIGHT = 48;      // 最小通道高度
    private const int CHANNEL_MARGIN = 4;           // 通道间距
    private const int TIME_AXIS_HEIGHT = 30;        // 时间轴高度
    
    // 核心数据
    private AnalyzerChannel[]? channels;            // 通道数据
    private List<SampleRegion> regions;             // 选中区域
    private List<SampleMarker> markers;             // 标记点
    
    // 显示状态
    private int visibleSamples;                     // 可见样本数
    private int firstSample;                        // 首个可见样本
    private double samplesPerPixel;                 // 每像素样本数
    private double pixelsPerSample;                 // 每样本像素数
    
    // 性能优化缓存
    private List<interval[]> intervals;             // 间隔预计算缓存
    private Dictionary<int, Bitmap> channelCache;   // 通道渲染缓存
}
```

#### 波形渲染核心算法
```csharp
public override void Render(DrawingContext context)
{
    if (channels == null || channels.Length == 0)
        return;
        
    var bounds = Bounds;
    var channelHeight = Math.Max(MIN_CHANNEL_HEIGHT, 
        (bounds.Height - TIME_AXIS_HEIGHT) / channels.Length);
    
    // 1. 绘制背景网格
    DrawTimeGrid(context, bounds);
    
    // 2. 绘制各通道波形
    for (int channelIndex = 0; channelIndex < channels.Length; channelIndex++)
    {
        var channel = channels[channelIndex];
        if (channel.Hidden) continue;
        
        var channelBounds = new Rect(0, channelIndex * channelHeight, 
            bounds.Width, channelHeight);
            
        DrawChannelWaveform(context, channel, channelBounds, channelIndex);
    }
    
    // 3. 绘制选中区域
    DrawSelectedRegions(context, bounds);
    
    // 4. 绘制标记点
    DrawMarkers(context, bounds);
    
    // 5. 绘制时间轴
    DrawTimeAxis(context, new Rect(0, bounds.Height - TIME_AXIS_HEIGHT, 
        bounds.Width, TIME_AXIS_HEIGHT));
}
```

#### 高性能间隔预计算
```csharp
private void ComputeIntervals()
{
    if (channels == null) return;
    
    intervals = new List<interval[]>(channels.Length);
    
    foreach (var channel in channels)
    {
        var channelIntervals = new List<interval>();
        
        if (channel.Samples != null && channel.Samples.Length > 0)
        {
            byte currentState = channel.Samples[0];
            int startSample = 0;
            
            // 查找所有状态变化点
            for (int i = 1; i < channel.Samples.Length; i++)
            {
                if (channel.Samples[i] != currentState)
                {
                    // 记录间隔
                    channelIntervals.Add(new interval
                    {
                        start = startSample,
                        end = i - 1,
                        state = currentState
                    });
                    
                    currentState = channel.Samples[i];
                    startSample = i;
                }
            }
            
            // 添加最后一个间隔
            channelIntervals.Add(new interval
            {
                start = startSample,
                end = channel.Samples.Length - 1,
                state = currentState
            });
        }
        
        intervals.Add(channelIntervals.ToArray());
    }
}
```

#### 交互处理系统
```csharp
protected override void OnPointerPressed(PointerPressedEventArgs e)
{
    var position = e.GetPosition(this);
    var clickedSample = PixelToSample(position.X);
    
    switch (e.GetCurrentPoint(this).Properties.PointerUpdateKind)
    {
        case PointerUpdateKind.LeftButtonPressed:
            if (e.KeyModifiers.HasFlag(KeyModifiers.Control))
            {
                // Ctrl+Click: 添加标记
                AddMarker(clickedSample);
            }
            else if (e.KeyModifiers.HasFlag(KeyModifiers.Shift))
            {
                // Shift+Click: 扩展选择区域
                ExtendSelection(clickedSample);
            }
            else
            {
                // 普通点击: 开始新的选择
                StartSelection(clickedSample);
            }
            break;
            
        case PointerUpdateKind.RightButtonPressed:
            // 右键: 显示上下文菜单
            ShowContextMenu(position);
            break;
    }
    
    base.OnPointerPressed(e);
}

protected override void OnPointerWheelChanged(PointerWheelEventArgs e)
{
    var position = e.GetPosition(this);
    var zoomCenter = PixelToSample(position.X);
    
    if (e.Delta.Y > 0)
    {
        // 放大
        ZoomIn(zoomCenter);
    }
    else
    {
        // 缩小
        ZoomOut(zoomCenter);
    }
    
    base.OnPointerWheelChanged(e);
}
```

### 3.2 ChannelViewer 通道管理控件

#### 控件功能设计
```csharp
public partial class ChannelViewer : UserControl
{
    private AnalyzerChannel[]? channels;
    private ObservableCollection<ChannelViewModel> channelViewModels;
    
    // UI元素模板
    private const string CHANNEL_ITEM_TEMPLATE = @"
        <DataTemplate>
            <Grid ColumnDefinitions='Auto,*,Auto,Auto'>
                <CheckBox Grid.Column='0' IsChecked='{Binding IsVisible}' />
                <TextBox Grid.Column='1' Text='{Binding Name}' />
                <Button Grid.Column='2' Background='{Binding ColorBrush}' 
                        Command='{Binding ChangeColorCommand}' />
                <Button Grid.Column='3' Content='...' 
                        Command='{Binding ShowOptionsCommand}' />
            </Grid>
        </DataTemplate>";
    
    public ChannelViewer()
    {
        InitializeComponent();
        channelViewModels = new ObservableCollection<ChannelViewModel>();
        DataContext = channelViewModels;
    }
}
```

#### ChannelViewModel 数据绑定
```csharp
public class ChannelViewModel : INotifyPropertyChanged
{
    private AnalyzerChannel channel;
    private bool isVisible = true;
    private string name;
    private SolidColorBrush colorBrush;
    
    public string Name
    {
        get => name;
        set
        {
            if (name != value)
            {
                name = value;
                channel.ChannelName = value;
                OnPropertyChanged();
            }
        }
    }
    
    public bool IsVisible
    {
        get => isVisible;
        set
        {
            if (isVisible != value)
            {
                isVisible = value;
                channel.Hidden = !value;
                OnPropertyChanged();
                // 通知波形显示更新
                RequestWaveformUpdate?.Invoke();
            }
        }
    }
    
    public ICommand ChangeColorCommand { get; }
    public ICommand ShowOptionsCommand { get; }
    
    public event Action? RequestWaveformUpdate;
}
```

### 3.3 AnnotationViewer 注释显示控件

#### 注释数据结构
```csharp
public class AnnotationData
{
    public int StartSample { get; set; }        // 起始样本
    public int EndSample { get; set; }          // 结束样本
    public string ProtocolName { get; set; }    // 协议名称
    public string AnnotationType { get; set; }  // 注释类型
    public string[] Values { get; set; }        // 注释值
    public Color AnnotationColor { get; set; }  // 注释颜色
}
```

#### 注释渲染系统
```csharp
public partial class AnnotationViewer : UserControl
{
    private List<AnnotationData> annotations = new();
    private Dictionary<string, AnnotationStyle> protocolStyles = new();
    
    public void AddAnnotations(IEnumerable<AnnotationData> newAnnotations)
    {
        annotations.AddRange(newAnnotations);
        InvalidateVisual();  // 触发重绘
    }
    
    public override void Render(DrawingContext context)
    {
        var bounds = Bounds;
        
        foreach (var annotation in annotations)
        {
            if (IsAnnotationVisible(annotation))
            {
                DrawAnnotation(context, annotation, bounds);
            }
        }
    }
    
    private void DrawAnnotation(DrawingContext context, AnnotationData annotation, Rect bounds)
    {
        var startX = SampleToPixel(annotation.StartSample);
        var endX = SampleToPixel(annotation.EndSample);
        var width = Math.Max(1, endX - startX);
        
        var style = protocolStyles.GetValueOrDefault(annotation.ProtocolName, 
            AnnotationStyle.Default);
        
        // 绘制注释背景
        var backgroundRect = new Rect(startX, 0, width, bounds.Height);
        context.FillRectangle(style.BackgroundBrush, backgroundRect);
        
        // 绘制注释文本
        if (width > 20)  // 只有足够宽度时才显示文本
        {
            var text = string.Join(" ", annotation.Values);
            var formattedText = new FormattedText(text, CultureInfo.CurrentCulture,
                FlowDirection.LeftToRight, style.Typeface, style.FontSize, style.ForegroundBrush);
                
            context.DrawText(formattedText, new Point(startX + 2, 2));
        }
    }
}
```

### 3.4 SampleMarker 标记工具控件

#### 标记数据模型
```csharp
public class SampleMarker
{
    public int SamplePosition { get; set; }     // 标记位置
    public string Label { get; set; }           // 标记标签
    public Color MarkerColor { get; set; }      // 标记颜色
    public MarkerType Type { get; set; }        // 标记类型
    public bool IsVisible { get; set; } = true; // 是否可见
}

public enum MarkerType
{
    Time,           // 时间标记
    Trigger,        // 触发标记
    User,           // 用户标记
    Measurement     // 测量标记
}
```

#### 标记交互功能
```csharp
public partial class SampleMarker : UserControl, IMarkerDisplay
{
    private List<SampleMarker> markers = new();
    private SampleMarker? draggedMarker;
    private bool isDragging = false;
    
    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
        var position = e.GetPosition(this);
        var clickedMarker = FindMarkerAtPosition(position);
        
        if (clickedMarker != null)
        {
            if (e.GetCurrentPoint(this).Properties.IsRightButtonPressed)
            {
                // 右键: 显示标记上下文菜单
                ShowMarkerContextMenu(clickedMarker, position);
            }
            else
            {
                // 左键: 开始拖拽
                draggedMarker = clickedMarker;
                isDragging = true;
                this.CaptureMouse();
            }
        }
        
        base.OnPointerPressed(e);
    }
    
    protected override void OnPointerMoved(PointerEventArgs e)
    {
        if (isDragging && draggedMarker != null)
        {
            var position = e.GetPosition(this);
            var newSample = PixelToSample(position.X);
            
            // 更新标记位置
            draggedMarker.SamplePosition = newSample;
            InvalidateVisual();
            
            // 通知位置变化
            MarkerPositionChanged?.Invoke(draggedMarker);
        }
        
        base.OnPointerMoved(e);
    }
    
    public event Action<SampleMarker>? MarkerPositionChanged;
}
```

## 4. Dialogs 对话框系统

### 4.1 CaptureDialog 采集配置对话框

#### 对话框界面结构
```xml
<!-- CaptureDialog.axaml -->
<Window x:Class="LogicAnalyzer.Dialogs.CaptureDialog">
  <Grid RowDefinitions="*,Auto">
    <TabControl Grid.Row="0">
      <!-- 基础设置标签页 -->
      <TabItem Header="基础设置">
        <StackPanel Margin="10">
          <Grid ColumnDefinitions="Auto,*" RowDefinitions="Auto,Auto,Auto,Auto">
            <Label Grid.Row="0" Grid.Column="0" Content="采样频率:" />
            <ComboBox Grid.Row="0" Grid.Column="1" Name="cmbFrequency" />
            
            <Label Grid.Row="1" Grid.Column="0" Content="触发前样本:" />
            <NumericUpDown Grid.Row="1" Grid.Column="1" Name="numPreSamples" />
            
            <Label Grid.Row="2" Grid.Column="0" Content="触发后样本:" />
            <NumericUpDown Grid.Row="2" Grid.Column="1" Name="numPostSamples" />
            
            <Label Grid.Row="3" Grid.Column="0" Content="总样本数:" />
            <TextBlock Grid.Row="3" Grid.Column="1" Name="lblTotalSamples" />
          </Grid>
        </StackPanel>
      </TabItem>
      
      <!-- 触发设置标签页 -->
      <TabItem Header="触发设置">
        <StackPanel Margin="10">
          <Label Content="触发类型:" />
          <ComboBox Name="cmbTriggerType" />
          
          <Label Content="触发通道:" />
          <ComboBox Name="cmbTriggerChannel" />
          
          <CheckBox Name="chkTriggerInverted" Content="触发反转" />
          
          <!-- 触发模式配置面板 -->
          <Border Name="pnlTriggerPattern" IsVisible="False">
            <Grid ColumnDefinitions="*,*,*,*,*,*,*,*">
              <!-- 8位触发模式选择 -->
            </Grid>
          </Border>
        </StackPanel>
      </TabItem>
      
      <!-- 通道选择标签页 -->
      <TabItem Header="通道选择">
        <Controls:ChannelSelector Name="channelSelector" />
      </TabItem>
    </TabControl>
    
    <!-- 底部按钮 -->
    <StackPanel Grid.Row="1" Orientation="Horizontal" HorizontalAlignment="Right">
      <Button Name="btnOK" Content="确定" Margin="5" />
      <Button Name="btnCancel" Content="取消" Margin="5" />
    </StackPanel>
  </Grid>
</Window>
```

#### 对话框控制逻辑
```csharp
public partial class CaptureDialog : Window
{
    private CaptureSession session;
    private AnalyzerDriverBase driver;
    private CaptureLimits currentLimits;
    
    public CaptureDialog(CaptureSession session, AnalyzerDriverBase driver)
    {
        InitializeComponent();
        this.session = session.CloneSettings();
        this.driver = driver;
        
        InitializeFrequencyOptions();
        InitializeTriggerOptions();
        InitializeChannelSelector();
        LoadSessionSettings();
        SetupValidation();
    }
    
    private void InitializeFrequencyOptions()
    {
        var frequencies = new[]
        {
            1000,      // 1 KHz
            10000,     // 10 KHz
            100000,    // 100 KHz
            1000000,   // 1 MHz
            10000000,  // 10 MHz
            driver.MaxFrequency  // 最大频率
        };
        
        cmbFrequency.ItemsSource = frequencies
            .Where(f => f <= driver.MaxFrequency)
            .Select(f => new FrequencyOption { Value = f, Display = FormatFrequency(f) });
    }
    
    private void OnFrequencyChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (cmbFrequency.SelectedItem is FrequencyOption option)
        {
            session.Frequency = option.Value;
            
            // 更新采集限制
            var selectedChannels = channelSelector.GetSelectedChannels();
            currentLimits = driver.GetLimits(selectedChannels);
            
            UpdateSampleLimits();
            ValidateAndUpdateTotalSamples();
        }
    }
    
    private void ValidateAndUpdateTotalSamples()
    {
        var totalSamples = session.PreTriggerSamples + session.PostTriggerSamples;
        
        if (totalSamples > currentLimits.MaxTotalSamples)
        {
            // 自动调整样本数以符合限制
            var ratio = (double)currentLimits.MaxTotalSamples / totalSamples;
            session.PreTriggerSamples = (int)(session.PreTriggerSamples * ratio);
            session.PostTriggerSamples = (int)(session.PostTriggerSamples * ratio);
            
            // 更新UI显示
            numPreSamples.Value = session.PreTriggerSamples;
            numPostSamples.Value = session.PostTriggerSamples;
        }
        
        lblTotalSamples.Text = $"{session.TotalSamples:N0} 样本";
    }
}
```

### 4.2 MeasureDialog 测量工具对话框

#### 测量功能设计
```csharp
public partial class MeasureDialog : Window
{
    private CaptureSession session;
    private List<MeasurementResult> measurements = new();
    
    public struct MeasurementResult
    {
        public string Name { get; set; }
        public double Value { get; set; }
        public string Unit { get; set; }
        public MeasurementType Type { get; set; }
    }
    
    public enum MeasurementType
    {
        Time,           // 时间测量
        Frequency,      // 频率测量
        DutyCycle,      // 占空比
        RiseTime,       // 上升时间
        FallTime,       // 下降时间
        PulseWidth,     // 脉冲宽度
        Period          // 周期
    }
    
    public MeasureDialog(CaptureSession session)
    {
        InitializeComponent();
        this.session = session;
        
        PerformMeasurements();
        DisplayResults();
    }
    
    private void PerformMeasurements()
    {
        foreach (var channel in session.CaptureChannels)
        {
            if (channel.Samples == null || channel.Hidden) continue;
            
            // 基础测量
            measurements.Add(MeasureFrequency(channel));
            measurements.Add(MeasureDutyCycle(channel));
            measurements.Add(MeasurePeriod(channel));
            
            // 边沿测量
            var edges = FindEdges(channel);
            if (edges.RisingEdges.Count > 0)
            {
                measurements.Add(MeasureRiseTime(channel, edges.RisingEdges[0]));
            }
            if (edges.FallingEdges.Count > 0)
            {
                measurements.Add(MeasureFallTime(channel, edges.FallingEdges[0]));
            }
        }
    }
}
```

### 4.3 NetworkDialog 网络配置对话框

#### 网络设置功能
```csharp
public partial class NetworkDialog : Window
{
    private AnalyzerDriverBase driver;
    private NetworkConfiguration config;
    
    public NetworkDialog(AnalyzerDriverBase driver)
    {
        InitializeComponent();
        this.driver = driver;
        
        LoadCurrentConfiguration();
        SetupValidation();
    }
    
    private void LoadCurrentConfiguration()
    {
        // 从设备读取当前网络配置
        config = driver.GetNetworkConfiguration();
        
        txtSSID.Text = config.SSID;
        txtPassword.Text = config.Password;
        txtIPAddress.Text = config.IPAddress;
        numPort.Value = config.Port;
        chkDHCP.IsChecked = config.UseDHCP;
    }
    
    private async void btnApply_Click(object? sender, RoutedEventArgs e)
    {
        if (!ValidateNetworkSettings())
            return;
            
        try
        {
            // 发送网络配置到设备
            var result = await driver.SendNetworkConfigAsync(
                txtSSID.Text,
                txtPassword.Text,
                txtIPAddress.Text,
                (ushort)numPort.Value
            );
            
            if (result)
            {
                ShowSuccessMessage("网络配置已成功应用");
                DialogResult = true;
                Close();
            }
            else
            {
                ShowErrorMessage("网络配置应用失败");
            }
        }
        catch (Exception ex)
        {
            ShowErrorMessage($"网络配置错误: {ex.Message}");
        }
    }
}
```

## 5. 显示接口系统

### 5.1 接口定义

#### ISampleDisplay 样本显示接口
```csharp
public interface ISampleDisplay
{
    // 数据更新
    void SetChannels(AnalyzerChannel[] channels);
    void UpdateSamples();
    void ClearDisplay();
    
    // 视图控制
    void SetViewRange(int firstSample, int visibleSamples);
    void ZoomToRange(int startSample, int endSample);
    void ZoomToFit();
    
    // 事件通知
    event EventHandler<SampleSelectionEventArgs>? SampleSelectionChanged;
    event EventHandler<ViewRangeEventArgs>? ViewRangeChanged;
}
```

#### IRegionDisplay 区域显示接口
```csharp
public interface IRegionDisplay
{
    // 区域管理
    void AddRegion(SampleRegion region);
    void RemoveRegion(SampleRegion region);
    void ClearRegions();
    
    // 区域选择
    SampleRegion[] GetSelectedRegions();
    void SetSelectedRegions(SampleRegion[] regions);
    
    // 事件通知
    event EventHandler<RegionEventArgs>? RegionAdded;
    event EventHandler<RegionEventArgs>? RegionRemoved;
    event EventHandler<RegionEventArgs>? RegionSelected;
}
```

#### IMarkerDisplay 标记显示接口
```csharp
public interface IMarkerDisplay
{
    // 标记管理
    void AddMarker(SampleMarker marker);
    void RemoveMarker(SampleMarker marker);
    void ClearMarkers();
    
    // 标记查找
    SampleMarker? FindMarkerAt(int samplePosition);
    SampleMarker[] GetMarkers();
    
    // 事件通知
    event EventHandler<MarkerEventArgs>? MarkerAdded;
    event EventHandler<MarkerEventArgs>? MarkerMoved;
    event EventHandler<MarkerEventArgs>? MarkerRemoved;
}
```

### 5.2 接口协调系统

#### DisplayCoordinator 显示协调器
```csharp
public class DisplayCoordinator
{
    private readonly List<ISampleDisplay> sampleDisplays = new();
    private readonly List<IRegionDisplay> regionDisplays = new();
    private readonly List<IMarkerDisplay> markerDisplays = new();
    
    public void RegisterDisplay(object display)
    {
        if (display is ISampleDisplay sampleDisplay)
        {
            sampleDisplays.Add(sampleDisplay);
            sampleDisplay.ViewRangeChanged += OnViewRangeChanged;
        }
        
        if (display is IRegionDisplay regionDisplay)
        {
            regionDisplays.Add(regionDisplay);
            regionDisplay.RegionSelected += OnRegionSelected;
        }
        
        if (display is IMarkerDisplay markerDisplay)
        {
            markerDisplays.Add(markerDisplay);
            markerDisplay.MarkerMoved += OnMarkerMoved;
        }
    }
    
    private void OnViewRangeChanged(object? sender, ViewRangeEventArgs e)
    {
        // 同步所有显示控件的视图范围
        foreach (var display in sampleDisplays)
        {
            if (display != sender)
            {
                display.SetViewRange(e.FirstSample, e.VisibleSamples);
            }
        }
    }
}
```

## 6. 样式和主题系统

### 6.1 样式定义

#### ButtonStyles.axaml 按钮样式
```xml
<Styles xmlns="https://github.com/avaloniaui">
  <!-- 主要按钮样式 -->
  <Style Selector="Button.primary">
    <Setter Property="Background" Value="#0078D4" />
    <Setter Property="Foreground" Value="White" />
    <Setter Property="CornerRadius" Value="4" />
    <Setter Property="Padding" Value="12,6" />
  </Style>
  
  <!-- 工具栏按钮样式 -->
  <Style Selector="Button.toolbar">
    <Setter Property="Background" Value="Transparent" />
    <Setter Property="BorderThickness" Value="0" />
    <Setter Property="Padding" Value="8,6" />
  </Style>
  
  <!-- 危险操作按钮样式 -->
  <Style Selector="Button.danger">
    <Setter Property="Background" Value="#E74C3C" />
    <Setter Property="Foreground" Value="White" />
  </Style>
</Styles>
```

#### ToolWindow.axaml 工具窗口样式
```xml
<Styles xmlns="https://github.com/avaloniaui">
  <!-- 工具窗口容器样式 -->
  <Style Selector="Border.tool-window">
    <Setter Property="Background" Value="#F8F9FA" />
    <Setter Property="BorderBrush" Value="#DEE2E6" />
    <Setter Property="BorderThickness" Value="1" />
    <Setter Property="CornerRadius" Value="4" />
  </Style>
  
  <!-- 工具窗口标题样式 -->
  <Style Selector="TextBlock.tool-window-title">
    <Setter Property="FontWeight" Value="Bold" />
    <Setter Property="FontSize" Value="14" />
    <Setter Property="Foreground" Value="#495057" />
  </Style>
</Styles>
```

### 6.2 主题管理

#### ThemeManager 主题管理器
```csharp
public class ThemeManager
{
    public enum Theme
    {
        Light,
        Dark,
        Auto
    }
    
    private Theme currentTheme = Theme.Light;
    
    public void ApplyTheme(Theme theme)
    {
        currentTheme = theme;
        
        var app = Application.Current;
        if (app == null) return;
        
        // 清除现有主题
        app.Styles.Clear();
        
        // 应用新主题
        switch (theme)
        {
            case Theme.Light:
                app.Styles.Add(new FluentTheme(new Uri("avares://Avalonia.Themes.Fluent/FluentLight.xaml")));
                break;
                
            case Theme.Dark:
                app.Styles.Add(new FluentTheme(new Uri("avares://Avalonia.Themes.Fluent/FluentDark.xaml")));
                break;
                
            case Theme.Auto:
                ApplyAutoTheme();
                break;
        }
        
        // 应用自定义样式
        app.Styles.Add(new StyleInclude(new Uri("avares://LogicAnalyzer/Styles/ButtonStyles.axaml")));
        app.Styles.Add(new StyleInclude(new Uri("avares://LogicAnalyzer/Styles/ToolWindow.axaml")));
    }
}
```

## 7. 国际化支持

### 7.1 资源管理

#### 多语言资源定义
```csharp
public class ResourceManager
{
    private static readonly Dictionary<string, Dictionary<string, string>> Resources = new()
    {
        ["zh-CN"] = new Dictionary<string, string>
        {
            ["Menu.File"] = "文件",
            ["Menu.Edit"] = "编辑",
            ["Menu.Network"] = "网络",
            ["Menu.Protocols"] = "协议",
            ["Button.Start"] = "开始采集",
            ["Button.Stop"] = "停止采集",
            ["Button.Connect"] = "连接设备",
            ["Status.Connected"] = "已连接",
            ["Status.Disconnected"] = "未连接",
            ["Error.DeviceNotFound"] = "找不到设备",
            ["Error.CaptureTimeout"] = "采集超时"
        },
        
        ["en-US"] = new Dictionary<string, string>
        {
            ["Menu.File"] = "File",
            ["Menu.Edit"] = "Edit", 
            ["Menu.Network"] = "Network",
            ["Menu.Protocols"] = "Protocols",
            ["Button.Start"] = "Start Capture",
            ["Button.Stop"] = "Stop Capture",
            ["Button.Connect"] = "Connect Device",
            ["Status.Connected"] = "Connected",
            ["Status.Disconnected"] = "Disconnected",
            ["Error.DeviceNotFound"] = "Device not found",
            ["Error.CaptureTimeout"] = "Capture timeout"
        }
    };
    
    public static string GetString(string key, string culture = "zh-CN")
    {
        if (Resources.TryGetValue(culture, out var cultureResources) &&
            cultureResources.TryGetValue(key, out var value))
        {
            return value;
        }
        
        return key;  // fallback to key if not found
    }
}
```

## 8. 性能优化策略

### 8.1 UI渲染优化

#### 虚拟化显示
```csharp
public class VirtualizedRenderer
{
    private readonly Dictionary<int, RenderCache> renderCache = new();
    
    public void RenderVirtualized(DrawingContext context, Rect bounds, 
        int firstSample, int visibleSamples)
    {
        // 计算需要渲染的区块
        var startBlock = firstSample / BLOCK_SIZE;
        var endBlock = (firstSample + visibleSamples) / BLOCK_SIZE + 1;
        
        for (int blockIndex = startBlock; blockIndex <= endBlock; blockIndex++)
        {
            if (!renderCache.TryGetValue(blockIndex, out var cachedRender))
            {
                // 渲染新区块
                cachedRender = RenderBlock(blockIndex);
                renderCache[blockIndex] = cachedRender;
                
                // 限制缓存大小
                if (renderCache.Count > MAX_CACHE_SIZE)
                {
                    ClearOldCache();
                }
            }
            
            // 绘制缓存的区块
            DrawCachedBlock(context, cachedRender, bounds);
        }
    }
}
```

### 8.2 内存使用优化

#### 数据压缩存储
```csharp
public class CompressedChannelData
{
    private readonly byte[] compressedData;
    private readonly int originalLength;
    private readonly CompressionType compressionType;
    
    public static CompressedChannelData Compress(byte[] originalData)
    {
        // 选择最佳压缩算法
        var rleCompressed = RLECompress(originalData);
        var deltaCompressed = DeltaCompress(originalData);
        
        // 选择压缩率最高的算法
        if (rleCompressed.Length < deltaCompressed.Length)
        {
            return new CompressedChannelData(rleCompressed, originalData.Length, CompressionType.RLE);
        }
        else
        {
            return new CompressedChannelData(deltaCompressed, originalData.Length, CompressionType.Delta);
        }
    }
    
    public byte[] Decompress()
    {
        return compressionType switch
        {
            CompressionType.RLE => RLEDecompress(compressedData, originalLength),
            CompressionType.Delta => DeltaDecompress(compressedData, originalLength),
            _ => compressedData
        };
    }
}
```

## 9. 对VSCode插件项目的UI架构启示

### 9.1 可借鉴的设计模式
1. **组件化设计**: 将复杂功能拆分为独立的UI组件
2. **接口驱动**: 定义清晰的显示接口，便于组件协调
3. **MVVM模式**: 数据绑定和状态管理的最佳实践
4. **性能优化**: 虚拟化渲染和缓存机制
5. **主题系统**: 统一的样式管理和主题切换

### 9.2 Vue3转换策略
1. **组件映射**: Avalonia控件 → Vue3组件
2. **数据绑定**: XAML绑定 → Vue3响应式数据
3. **事件处理**: C#事件 → Vue3事件系统
4. **样式系统**: XAML样式 → CSS样式
5. **国际化**: 资源文件 → Vue-i18n

### 9.3 VSCode集成优势
1. **Webview集成**: 更灵活的UI布局和交互
2. **Web技术**: 丰富的CSS和JavaScript生态
3. **现代框架**: Vue3的组合式API和TypeScript支持
4. **响应式设计**: 更好的多屏幕适配能力

---

## 总结

Pico Logic Analyzer的用户界面系统展现了专业桌面应用的完整UI架构，其组件化设计、接口驱动、性能优化和主题管理为我们的VSCode插件项目提供了宝贵的UI设计参考。关键是要在保持专业性和功能完整性的同时，充分利用Vue3和Web技术的优势，打造更加现代化和用户友好的界面体验。