# 波形显示系统 - 详细技术分析

## 📋 概述

本文档深入分析 Pico Logic Analyzer 软件的波形显示系统，重点关注 SampleViewer 控件的 Canvas 渲染引擎、大数据量显示优化、用户交互功能和标记测量工具的技术实现细节。

## 🏗️ 波形显示架构

### 核心架构层次
```
用户交互层 (Mouse/Keyboard Events + Gestures)
         ↓
显示控制层 (SampleViewer + ISampleDisplay Interface)
         ↓
渲染引擎层 (Canvas2D Rendering + DrawingContext)
         ↓
数据处理层 (Interval Computation + Data Optimization)
         ↓
数据模型层 (AnalyzerChannel + Sample Data)
```

## 🎨 SampleViewer 核心渲染引擎

### 1. SampleViewer 主控制器

**核心显示控件** (`SampleViewer.axaml.cs`):
```csharp
/// <summary>
/// 逻辑分析器波形显示控件
/// 实现高性能Canvas渲染、用户交互和数据可视化
/// </summary>
public partial class SampleViewer : UserControl, ISampleDisplay, IRegionDisplay, IMarkerDisplay
{
    // 显示常量
    const int MIN_CHANNEL_HEIGHT = 48;              // 最小通道高度 (像素)
    const int CHANNEL_MARGIN = 4;                   // 通道间距
    const int TIME_RULER_HEIGHT = 30;               // 时间标尺高度
    const int CHANNEL_LABEL_WIDTH = 120;            // 通道标签宽度
    
    // 核心显示参数
    public int VisibleSamples { get; private set; } = 1000;    // 可见采样数量
    public int FirstSample { get; private set; } = 0;          // 首个可见采样索引
    public double SamplesPerPixel { get; private set; } = 1.0; // 采样密度
    public double PixelsPerSample { get; private set; } = 1.0; // 像素密度
    
    // 数据模型
    private AnalyzerChannel[]? channels;            // 通道数据数组
    private List<SampleRegion> regions = new();     // 测量区域列表
    private List<SampleMarker> markers = new();     // 用户标记列表
    
    // 渲染优化
    private Dictionary<int, interval[]> intervals = new();      // 信号间隔缓存
    private bool intervalsNeedUpdate = true;                    // 间隔更新标志
    private DateTime lastRenderTime = DateTime.Now;            // 上次渲染时间
    
    /// <summary>
    /// 设置显示数据并触发渲染
    /// </summary>
    public void SetChannels(AnalyzerChannel[] newChannels, int sampleFrequency)
    {
        channels = newChannels;
        this.sampleFrequency = sampleFrequency;
        
        // 标记间隔缓存需要更新
        intervalsNeedUpdate = true;
        intervals.Clear();
        
        // 重新计算显示参数
        RecalculateDisplayParameters();
        
        // 触发重绘
        InvalidateVisual();
        
        LogInfo($"设置通道数据: {newChannels?.Length ?? 0}个通道, 频率: {sampleFrequency}Hz");
    }
    
    /// <summary>
    /// 重新计算显示参数
    /// </summary>
    private void RecalculateDisplayParameters()
    {
        if (channels == null || channels.Length == 0) return;
        
        // 计算总样本数
        var maxSamples = channels.Max(ch => ch.Samples?.Length ?? 0);
        if (maxSamples == 0) return;
        
        // 计算可视区域
        var availableWidth = Bounds.Width - CHANNEL_LABEL_WIDTH;
        if (availableWidth <= 0) return;
        
        // 更新显示参数
        VisibleSamples = Math.Min(maxSamples - FirstSample, (int)(availableWidth / PixelsPerSample));
        SamplesPerPixel = VisibleSamples / availableWidth;
        
        // 确保显示参数合理
        if (FirstSample + VisibleSamples > maxSamples)
        {
            FirstSample = Math.Max(0, maxSamples - VisibleSamples);
        }
        
        LogDebug($"显示参数更新: 可见样本={VisibleSamples}, 起始样本={FirstSample}, 采样密度={SamplesPerPixel:F3}");
    }
    
    /// <summary>
    /// Canvas绘制入口点
    /// </summary>
    public override void Render(DrawingContext context)
    {
        var renderStart = DateTime.UtcNow;
        
        try
        {
            // 清除背景
            context.FillRectangle(Brushes.White, new Rect(Bounds.Size));
            
            if (channels == null || channels.Length == 0)
            {
                DrawEmptyState(context);
                return;
            }
            
            // 确保间隔数据已计算
            EnsureIntervalsComputed();
            
            // 绘制时间标尺
            DrawTimeRuler(context);
            
            // 绘制通道波形
            DrawChannelWaveforms(context);
            
            // 绘制测量区域
            DrawRegions(context);
            
            // 绘制用户标记
            DrawMarkers(context);
            
            // 绘制游标线
            DrawCursor(context);
            
            // 性能统计
            var renderTime = DateTime.UtcNow - renderStart;
            lastRenderTime = DateTime.Now;
            
            if (renderTime.TotalMilliseconds > 16) // 超过60fps阈值
            {
                LogWarning($"渲染耗时过长: {renderTime.TotalMilliseconds:F1}ms");
            }
        }
        catch (Exception ex)
        {
            LogError($"渲染异常: {ex.Message}");
            DrawErrorState(context, ex.Message);
        }
    }
    
    /// <summary>
    /// 确保信号间隔已计算 (性能优化核心)
    /// </summary>
    private void EnsureIntervalsComputed()
    {
        if (!intervalsNeedUpdate) return;
        
        var computeStart = DateTime.UtcNow;
        
        // 并行计算所有通道的间隔
        Parallel.For(0, channels!.Length, channelIndex =>
        {
            var channel = channels[channelIndex];
            if (channel.Samples == null || channel.Hidden) return;
            
            intervals[channelIndex] = ComputeIntervals(channel, sampleFrequency);
        });
        
        intervalsNeedUpdate = false;
        
        var computeTime = DateTime.UtcNow - computeStart;
        LogDebug($"间隔计算完成: {computeTime.TotalMilliseconds:F1}ms, {channels.Length}个通道");
    }
    
    /// <summary>
    /// 高效的信号间隔计算算法
    /// 将连续的相同状态合并为间隔，大幅减少绘制操作
    /// </summary>
    private interval[] ComputeIntervals(AnalyzerChannel channel, int frequency)
    {
        if (channel.Samples == null || channel.Samples.Length == 0)
            return Array.Empty<interval>();
        
        var chanIntervals = new List<interval>();
        var samples = channel.Samples;
        
        byte lastSample = samples[0];
        int lastSampleIndex = 0;
        
        // 遍历所有样本，寻找状态变化点
        for (int curSample = 1; curSample < samples.Length; curSample++)
        {
            byte currentSample = samples[curSample];
            
            if (currentSample != lastSample)
            {
                // 创建间隔对象
                var newInterval = new interval
                {
                    start = lastSampleIndex,
                    end = curSample,
                    duration = (curSample - lastSampleIndex) / (double)frequency,
                    value = lastSample != 0,
                    sampleCount = curSample - lastSampleIndex
                };
                
                chanIntervals.Add(newInterval);
                
                // 更新状态
                lastSample = currentSample;
                lastSampleIndex = curSample;
            }
        }
        
        // 添加最后一个间隔
        if (lastSampleIndex < samples.Length)
        {
            chanIntervals.Add(new interval
            {
                start = lastSampleIndex,
                end = samples.Length,
                duration = (samples.Length - lastSampleIndex) / (double)frequency,
                value = lastSample != 0,
                sampleCount = samples.Length - lastSampleIndex
            });
        }
        
        return chanIntervals.ToArray();
    }
}

/// <summary>
/// 信号间隔数据结构
/// 表示一段连续的相同逻辑状态
/// </summary>
public struct interval
{
    public int start;           // 起始样本索引
    public int end;             // 结束样本索引
    public double duration;     // 持续时间 (秒)
    public bool value;          // 逻辑值 (true=高电平, false=低电平)
    public int sampleCount;     // 样本数量
    
    /// <summary>
    /// 格式化时间显示
    /// </summary>
    public string GetFormattedDuration()
    {
        if (duration < 1e-6)
            return $"{duration * 1e9:F1} ns";
        else if (duration < 1e-3)
            return $"{duration * 1e6:F1} µs";
        else if (duration < 1.0)
            return $"{duration * 1e3:F1} ms";
        else
            return $"{duration:F3} s";
    }
    
    /// <summary>
    /// 检查指定样本是否在此间隔内
    /// </summary>
    public bool Contains(int sampleIndex)
    {
        return sampleIndex >= start && sampleIndex < end;
    }
}
```

### 2. 高性能Canvas渲染实现

**通道波形绘制核心算法**:
```csharp
/// <summary>
/// 绘制所有通道的波形
/// 使用优化的批量绘制和LOD技术
/// </summary>
private void DrawChannelWaveforms(DrawingContext context)
{
    if (channels == null) return;
    
    var visibleChannels = channels.Where(ch => !ch.Hidden).ToArray();
    if (visibleChannels.Length == 0) return;
    
    // 计算通道布局
    var channelHeight = CalculateChannelHeight(visibleChannels.Length);
    var startY = TIME_RULER_HEIGHT;
    
    // 绘制每个通道
    for (int i = 0; i < visibleChannels.Length; i++)
    {
        var channel = visibleChannels[i];
        var channelY = startY + i * (channelHeight + CHANNEL_MARGIN);
        
        // 绘制通道背景
        DrawChannelBackground(context, channelY, channelHeight, i % 2 == 0);
        
        // 绘制通道标签
        DrawChannelLabel(context, channel, channelY, channelHeight);
        
        // 绘制波形数据
        DrawChannelWaveform(context, channel, channelY, channelHeight, i);
    }
}

/// <summary>
/// 绘制单个通道的波形数据
/// 使用间隔优化和LOD技术提升性能
/// </summary>
private void DrawChannelWaveform(DrawingContext context, AnalyzerChannel channel, 
    double channelY, double channelHeight, int channelIndex)
{
    if (!intervals.TryGetValue(channelIndex, out var channelIntervals) || 
        channelIntervals.Length == 0)
        return;
    
    // 波形绘制参数
    var waveformArea = new Rect(CHANNEL_LABEL_WIDTH, channelY, 
        Bounds.Width - CHANNEL_LABEL_WIDTH, channelHeight);
    
    var highY = channelY + channelHeight * 0.1;        // 高电平Y坐标
    var lowY = channelY + channelHeight * 0.9;         // 低电平Y坐标
    var riseTime = channelHeight * 0.8;                // 边沿过渡高度
    
    // 获取通道颜色
    var channelBrush = GetChannelBrush(channel);
    var pen = new Pen(channelBrush, 2.0);
    
    // 剪裁到通道区域
    using var clipGeometry = context.PushClip(waveformArea);
    
    // LOD: 根据缩放级别选择绘制策略
    if (SamplesPerPixel > 10)
    {
        // 高密度模式：使用简化绘制
        DrawHighDensityWaveform(context, channelIntervals, waveformArea, pen, highY, lowY);
    }
    else
    {
        // 详细模式：绘制完整波形
        DrawDetailedWaveform(context, channelIntervals, waveformArea, pen, highY, lowY, riseTime);
    }
}

/// <summary>
/// 详细模式波形绘制
/// 绘制完整的数字波形，包括边沿过渡
/// </summary>
private void DrawDetailedWaveform(DrawingContext context, interval[] channelIntervals,
    Rect waveformArea, Pen pen, double highY, double lowY, double riseTime)
{
    var pathGeometry = new PathGeometry();
    var pathFigure = new PathFigure();
    
    bool isFirstSegment = true;
    double lastX = waveformArea.Left;
    double lastY = lowY;
    
    foreach (var interval in channelIntervals)
    {
        // 计算间隔在屏幕上的位置
        var startX = SampleToX(interval.start, waveformArea);
        var endX = SampleToX(interval.end, waveformArea);
        
        // 跳过不在可视区域的间隔
        if (endX < waveformArea.Left || startX > waveformArea.Right)
            continue;
        
        // 裁剪到可视区域
        startX = Math.Max(startX, waveformArea.Left);
        endX = Math.Min(endX, waveformArea.Right);
        
        var currentY = interval.value ? highY : lowY;
        
        if (isFirstSegment)
        {
            pathFigure.StartPoint = new Point(startX, currentY);
            isFirstSegment = false;
        }
        else
        {
            // 绘制垂直边沿 (状态转换)
            if (Math.Abs(lastY - currentY) > 1)
            {
                pathFigure.Segments.Add(new LineSegment(new Point(startX, lastY), true));
                pathFigure.Segments.Add(new LineSegment(new Point(startX, currentY), true));
            }
            else
            {
                pathFigure.Segments.Add(new LineSegment(new Point(startX, currentY), true));
            }
        }
        
        // 绘制水平线段 (稳定状态)
        if (endX > startX)
        {
            pathFigure.Segments.Add(new LineSegment(new Point(endX, currentY), true));
        }
        
        lastX = endX;
        lastY = currentY;
    }
    
    pathGeometry.Figures.Add(pathFigure);
    context.DrawGeometry(null, pen, pathGeometry);
}

/// <summary>
/// 高密度模式波形绘制
/// 使用简化算法处理大量数据点
/// </summary>
private void DrawHighDensityWaveform(DrawingContext context, interval[] channelIntervals,
    Rect waveformArea, Pen pen, double highY, double lowY)
{
    // 按像素分组间隔，每像素显示状态摘要
    var pixelWidth = Math.Max(1, waveformArea.Width / 1000); // 最多1000个绘制点
    var pixelGroups = new Dictionary<int, List<interval>>();
    
    foreach (var interval in channelIntervals)
    {
        var startPixel = (int)((SampleToX(interval.start, waveformArea) - waveformArea.Left) / pixelWidth);
        var endPixel = (int)((SampleToX(interval.end, waveformArea) - waveformArea.Left) / pixelWidth);
        
        for (int pixel = startPixel; pixel <= endPixel; pixel++)
        {
            if (!pixelGroups.ContainsKey(pixel))
                pixelGroups[pixel] = new List<interval>();
            pixelGroups[pixel].Add(interval);
        }
    }
    
    // 绘制像素级摘要
    foreach (var kvp in pixelGroups.OrderBy(g => g.Key))
    {
        var pixel = kvp.Key;
        var intervals = kvp.Value;
        
        var x = waveformArea.Left + pixel * pixelWidth;
        
        // 计算该像素的状态统计
        var highCount = intervals.Count(i => i.value);
        var lowCount = intervals.Count - highCount;
        
        if (highCount > 0 && lowCount > 0)
        {
            // 混合状态：绘制渐变或斑马线
            DrawMixedStateIndicator(context, x, highY, lowY, pixelWidth, (double)highCount / intervals.Count);
        }
        else if (highCount > 0)
        {
            // 高电平
            context.DrawLine(pen, new Point(x, highY), new Point(x + pixelWidth, highY));
        }
        else
        {
            // 低电平
            context.DrawLine(pen, new Point(x, lowY), new Point(x + pixelWidth, lowY));
        }
    }
}

/// <summary>
/// 样本索引转换为屏幕X坐标
/// </summary>
private double SampleToX(int sampleIndex, Rect waveformArea)
{
    if (VisibleSamples == 0) return waveformArea.Left;
    
    var relativeIndex = sampleIndex - FirstSample;
    return waveformArea.Left + (relativeIndex / (double)VisibleSamples) * waveformArea.Width;
}

/// <summary>
/// 屏幕X坐标转换为样本索引
/// </summary>
private int XToSample(double x, Rect waveformArea)
{
    if (waveformArea.Width == 0) return FirstSample;
    
    var relativeX = x - waveformArea.Left;
    var relativeIndex = (relativeX / waveformArea.Width) * VisibleSamples;
    return FirstSample + (int)Math.Round(relativeIndex);
}

/// <summary>
/// 绘制混合状态指示器 (高密度模式)
/// </summary>
private void DrawMixedStateIndicator(DrawingContext context, double x, double highY, double lowY, 
    double width, double highRatio)
{
    var mixedBrush = new LinearGradientBrush
    {
        StartPoint = new RelativePoint(0, 0, RelativeUnit.Relative),
        EndPoint = new RelativePoint(0, 1, RelativeUnit.Relative),
        GradientStops = new GradientStops
        {
            new GradientStop(Colors.Red, 0),
            new GradientStop(Colors.Yellow, highRatio),
            new GradientStop(Colors.Blue, 1)
        }
    };
    
    var rect = new Rect(x, highY, width, lowY - highY);
    context.FillRectangle(mixedBrush, rect);
}

/// <summary>
/// 计算通道高度
/// 根据可用空间和通道数量自动调整
/// </summary>
private double CalculateChannelHeight(int visibleChannelCount)
{
    if (visibleChannelCount == 0) return MIN_CHANNEL_HEIGHT;
    
    var availableHeight = Bounds.Height - TIME_RULER_HEIGHT - 20; // 留一些边距
    var totalMargin = (visibleChannelCount - 1) * CHANNEL_MARGIN;
    var channelHeight = (availableHeight - totalMargin) / visibleChannelCount;
    
    return Math.Max(MIN_CHANNEL_HEIGHT, channelHeight);
}
```

## 🖱️ 用户交互系统

### 1. 鼠标和键盘交互

**交互事件处理核心**:
```csharp
/// <summary>
/// 鼠标移动事件处理 - 实时信息显示
/// </summary>
private void SampleViewer_PointerMoved(object? sender, PointerEventArgs e)
{
    var position = e.GetPosition(this);
    var waveformArea = GetWaveformArea();
    
    if (!waveformArea.Contains(position))
    {
        ToolTip.SetTip(this, null);
        return;
    }
    
    // 计算当前样本位置
    var currentSample = XToSample(position.X, waveformArea);
    if (currentSample < 0 || currentSample >= GetMaxSamples())
        return;
    
    // 构建工具提示信息
    var tooltipInfo = BuildTooltipInfo(currentSample, position);
    ToolTip.SetTip(this, tooltipInfo);
    
    // 更新游标位置
    cursorPosition = position.X;
    InvalidateVisual();
}

/// <summary>
/// 构建详细的工具提示信息
/// </summary>
private string BuildTooltipInfo(int sampleIndex, Point mousePosition)
{
    var info = new StringBuilder();
    
    // 时间信息
    var timeFromStart = sampleIndex / (double)sampleFrequency;
    info.AppendLine($"时间: {FormatTime(timeFromStart)}");
    info.AppendLine($"样本: {sampleIndex:N0}");
    
    // 通道状态信息
    var channelIndex = GetChannelIndexAtY(mousePosition.Y);
    if (channelIndex >= 0 && channelIndex < channels?.Length)
    {
        var channel = channels[channelIndex];
        if (channel.Samples != null && sampleIndex < channel.Samples.Length)
        {
            var state = channel.Samples[sampleIndex] != 0 ? "高" : "低";
            info.AppendLine($"通道 {channel.ChannelName}: {state}");
            
            // 间隔信息
            if (intervals.TryGetValue(channelIndex, out var channelIntervals))
            {
                var interval = channelIntervals.FirstOrDefault(i => i.Contains(sampleIndex));
                if (interval.start != 0 || interval.end != 0)
                {
                    info.AppendLine($"状态: {(interval.value ? "高电平" : "低电平")}");
                    info.AppendLine($"持续: {interval.GetFormattedDuration()} ({interval.sampleCount} 样本)");
                }
            }
        }
    }
    
    return info.ToString().TrimEnd();
}

/// <summary>
/// 鼠标滚轮事件处理 - 缩放功能
/// </summary>
private void SampleViewer_PointerWheelChanged(object? sender, PointerWheelEventArgs e)
{
    var position = e.GetPosition(this);
    var waveformArea = GetWaveformArea();
    
    if (!waveformArea.Contains(position))
        return;
    
    // 计算缩放中心点
    var centerSample = XToSample(position.X, waveformArea);
    
    // 缩放系数
    var zoomFactor = e.Delta.Y > 0 ? 0.8 : 1.25; // 向上滚动放大，向下滚动缩小
    
    // 应用缩放
    ApplyZoom(zoomFactor, centerSample);
    
    e.Handled = true;
}

/// <summary>
/// 应用缩放变换
/// </summary>
private void ApplyZoom(double zoomFactor, int centerSample)
{
    var newVisibleSamples = (int)(VisibleSamples * zoomFactor);
    
    // 限制缩放范围
    newVisibleSamples = Math.Max(10, Math.Min(GetMaxSamples(), newVisibleSamples));
    
    if (newVisibleSamples == VisibleSamples)
        return; // 无变化
    
    // 计算新的起始位置，保持中心点不变
    var centerRatio = (double)(centerSample - FirstSample) / VisibleSamples;
    var newFirstSample = centerSample - (int)(newVisibleSamples * centerRatio);
    
    // 确保边界合理
    newFirstSample = Math.Max(0, Math.Min(GetMaxSamples() - newVisibleSamples, newFirstSample));
    
    // 应用新参数
    VisibleSamples = newVisibleSamples;
    FirstSample = newFirstSample;
    
    RecalculateDisplayParameters();
    InvalidateVisual();
    
    LogDebug($"缩放应用: 可见样本={VisibleSamples}, 起始样本={FirstSample}, 中心样本={centerSample}");
}

/// <summary>
/// 鼠标拖拽事件处理 - 平移功能
/// </summary>
private void SampleViewer_PointerPressed(object? sender, PointerPressedEventArgs e)
{
    if (e.GetCurrentPoint(this).Properties.IsLeftButtonPressed)
    {
        isDragging = true;
        dragStartPosition = e.GetPosition(this);
        dragStartFirstSample = FirstSample;
        
        this.CapturePonter(e.Pointer);
        e.Handled = true;
    }
}

private void SampleViewer_PointerMoved_Dragging(object? sender, PointerEventArgs e)
{
    if (!isDragging) return;
    
    var currentPosition = e.GetPosition(this);
    var deltaX = currentPosition.X - dragStartPosition.X;
    
    // 计算样本偏移
    var waveformArea = GetWaveformArea();
    var sampleDelta = (int)((deltaX / waveformArea.Width) * VisibleSamples);
    
    // 应用平移
    var newFirstSample = dragStartFirstSample - sampleDelta;
    newFirstSample = Math.Max(0, Math.Min(GetMaxSamples() - VisibleSamples, newFirstSample));
    
    if (newFirstSample != FirstSample)
    {
        FirstSample = newFirstSample;
        InvalidateVisual();
    }
}

private void SampleViewer_PointerReleased(object? sender, PointerReleasedEventArgs e)
{
    if (isDragging)
    {
        isDragging = false;
        this.ReleasePointerCapture(e.Pointer);
        e.Handled = true;
    }
}

/// <summary>
/// 键盘快捷键处理
/// </summary>
private void SampleViewer_KeyDown(object? sender, KeyEventArgs e)
{
    var handled = true;
    
    switch (e.Key)
    {
        case Key.Home:
            // 跳转到开始
            NavigateToStart();
            break;
            
        case Key.End:
            // 跳转到结束
            NavigateToEnd();
            break;
            
        case Key.Left:
            // 向左移动
            if (e.KeyModifiers.HasFlag(KeyModifiers.Control))
                NavigateLeft(VisibleSamples / 10); // 大步移动
            else
                NavigateLeft(VisibleSamples / 100); // 小步移动
            break;
            
        case Key.Right:
            // 向右移动
            if (e.KeyModifiers.HasFlag(KeyModifiers.Control))
                NavigateRight(VisibleSamples / 10);
            else
                NavigateRight(VisibleSamples / 100);
            break;
            
        case Key.Add:
        case Key.OemPlus:
            // 放大
            ApplyZoom(0.8, FirstSample + VisibleSamples / 2);
            break;
            
        case Key.Subtract:
        case Key.OemMinus:
            // 缩小
            ApplyZoom(1.25, FirstSample + VisibleSamples / 2);
            break;
            
        case Key.F:
            // 适应窗口
            FitToWindow();
            break;
            
        default:
            handled = false;
            break;
    }
    
    e.Handled = handled;
}
```

### 2. 导航和缩放控制

**导航功能实现**:
```csharp
/// <summary>
/// 导航控制类
/// 提供精确的时间轴导航和缩放功能
/// </summary>
public class NavigationController
{
    private readonly SampleViewer viewer;
    private readonly Stack<NavigationState> navigationHistory = new();
    private const int MAX_HISTORY_SIZE = 50;
    
    public NavigationController(SampleViewer viewer)
    {
        this.viewer = viewer;
    }
    
    /// <summary>
    /// 导航状态快照
    /// </summary>
    public struct NavigationState
    {
        public int FirstSample;
        public int VisibleSamples;
        public DateTime Timestamp;
        
        public override string ToString()
        {
            return $"样本 {FirstSample}-{FirstSample + VisibleSamples} @ {Timestamp:HH:mm:ss}";
        }
    }
    
    /// <summary>
    /// 保存当前导航状态
    /// </summary>
    public void SaveCurrentState()
    {
        var state = new NavigationState
        {
            FirstSample = viewer.FirstSample,
            VisibleSamples = viewer.VisibleSamples,
            Timestamp = DateTime.Now
        };
        
        navigationHistory.Push(state);
        
        // 限制历史记录大小
        while (navigationHistory.Count > MAX_HISTORY_SIZE)
        {
            var tempStack = new Stack<NavigationState>();
            for (int i = 0; i < MAX_HISTORY_SIZE - 1; i++)
            {
                tempStack.Push(navigationHistory.Pop());
            }
            navigationHistory.Clear();
            while (tempStack.Count > 0)
            {
                navigationHistory.Push(tempStack.Pop());
            }
        }
    }
    
    /// <summary>
    /// 返回上一个导航状态
    /// </summary>
    public bool GoBack()
    {
        if (navigationHistory.Count == 0)
            return false;
        
        var previousState = navigationHistory.Pop();
        viewer.NavigateToState(previousState);
        
        LogInfo($"导航回退: {previousState}");
        return true;
    }
    
    /// <summary>
    /// 智能缩放到指定时间范围
    /// </summary>
    public void ZoomToTimeRange(double startTime, double endTime)
    {
        SaveCurrentState();
        
        var startSample = (int)(startTime * viewer.SampleFrequency);
        var endSample = (int)(endTime * viewer.SampleFrequency);
        
        var newFirstSample = Math.Max(0, startSample);
        var newVisibleSamples = Math.Max(10, endSample - startSample);
        
        // 添加一些边距 (总范围的5%)
        var margin = newVisibleSamples * 0.05;
        newFirstSample = Math.Max(0, newFirstSample - (int)margin);
        newVisibleSamples += (int)(margin * 2);
        
        viewer.NavigateTo(newFirstSample, newVisibleSamples);
        
        LogInfo($"缩放到时间范围: {startTime:F6}s - {endTime:F6}s");
    }
    
    /// <summary>
    /// 缩放到指定样本范围
    /// </summary>
    public void ZoomToSampleRange(int startSample, int endSample)
    {
        SaveCurrentState();
        
        var newFirstSample = Math.Max(0, startSample);
        var newVisibleSamples = Math.Max(10, endSample - startSample);
        
        viewer.NavigateTo(newFirstSample, newVisibleSamples);
        
        LogInfo($"缩放到样本范围: {startSample} - {endSample}");
    }
    
    /// <summary>
    /// 适应窗口 - 显示所有数据
    /// </summary>
    public void FitToWindow()
    {
        SaveCurrentState();
        
        var maxSamples = viewer.GetMaxSamples();
        if (maxSamples > 0)
        {
            viewer.NavigateTo(0, maxSamples);
            LogInfo($"适应窗口: 显示全部 {maxSamples} 个样本");
        }
    }
    
    /// <summary>
    /// 智能居中到指定样本
    /// </summary>
    public void CenterOnSample(int sampleIndex)
    {
        SaveCurrentState();
        
        var halfVisible = viewer.VisibleSamples / 2;
        var newFirstSample = Math.Max(0, sampleIndex - halfVisible);
        
        // 确保不超出数据范围
        var maxSamples = viewer.GetMaxSamples();
        if (newFirstSample + viewer.VisibleSamples > maxSamples)
        {
            newFirstSample = Math.Max(0, maxSamples - viewer.VisibleSamples);
        }
        
        viewer.NavigateTo(newFirstSample, viewer.VisibleSamples);
        
        LogInfo($"居中到样本: {sampleIndex}");
    }
    
    /// <summary>
    /// 查找下一个边沿
    /// </summary>
    public bool FindNextEdge(int channelIndex, bool risingEdge = true)
    {
        var channel = viewer.GetChannel(channelIndex);
        if (channel?.Samples == null) return false;
        
        var startSample = viewer.FirstSample + viewer.VisibleSamples / 2; // 从屏幕中心开始搜索
        
        for (int i = startSample + 1; i < channel.Samples.Length; i++)
        {
            var current = channel.Samples[i] != 0;
            var previous = channel.Samples[i - 1] != 0;
            
            if (risingEdge && !previous && current)
            {
                CenterOnSample(i);
                LogInfo($"找到上升沿: 通道 {channelIndex}, 样本 {i}");
                return true;
            }
            else if (!risingEdge && previous && !current)
            {
                CenterOnSample(i);
                LogInfo($"找到下降沿: 通道 {channelIndex}, 样本 {i}");
                return true;
            }
        }
        
        LogInfo($"未找到边沿: 通道 {channelIndex}, {(risingEdge ? "上升" : "下降")}边沿");
        return false;
    }
    
    /// <summary>
    /// 获取导航历史记录
    /// </summary>
    public List<NavigationState> GetNavigationHistory()
    {
        return navigationHistory.ToList();
    }
}
```

## 📏 标记和测量工具系统

### 1. SampleMarker 标记管理

**用户标记系统**:
```csharp
/// <summary>
/// 样本标记管理器
/// 提供用户标记的创建、编辑、删除和测量功能
/// </summary>
public class SampleMarkerManager
{
    private readonly SampleViewer viewer;
    private readonly List<SampleMarker> markers = new();
    private SampleMarker? activeMarker;
    private bool isCreatingMarker = false;
    
    // 标记样式
    private static readonly Pen MarkerPen = new(Brushes.Red, 2.0);
    private static readonly Brush MarkerBrush = new SolidColorBrush(Colors.Red) { Opacity = 0.3 };
    
    public event EventHandler<MarkerEventArgs>? MarkerAdded;
    public event EventHandler<MarkerEventArgs>? MarkerRemoved;
    public event EventHandler<MarkerEventArgs>? MarkerMoved;
    
    public SampleMarkerManager(SampleViewer viewer)
    {
        this.viewer = viewer;
        SetupInteractionHandlers();
    }
    
    /// <summary>
    /// 创建新标记
    /// </summary>
    public SampleMarker CreateMarker(int samplePosition, string? label = null)
    {
        var marker = new SampleMarker
        {
            Id = Guid.NewGuid(),
            SamplePosition = samplePosition,
            Label = label ?? $"M{markers.Count + 1}",
            Color = GetNextMarkerColor(),
            CreatedAt = DateTime.Now,
            IsVisible = true
        };
        
        markers.Add(marker);
        
        // 触发事件
        MarkerAdded?.Invoke(this, new MarkerEventArgs(marker));
        
        // 重新绘制
        viewer.InvalidateVisual();
        
        LogInfo($"创建标记: {marker.Label} @ 样本 {samplePosition}");
        
        return marker;
    }
    
    /// <summary>
    /// 删除标记
    /// </summary>
    public bool RemoveMarker(SampleMarker marker)
    {
        if (!markers.Remove(marker))
            return false;
        
        if (activeMarker == marker)
            activeMarker = null;
        
        // 触发事件
        MarkerRemoved?.Invoke(this, new MarkerEventArgs(marker));
        
        // 重新绘制
        viewer.InvalidateVisual();
        
        LogInfo($"删除标记: {marker.Label}");
        
        return true;
    }
    
    /// <summary>
    /// 移动标记到新位置
    /// </summary>
    public void MoveMarker(SampleMarker marker, int newSamplePosition)
    {
        var oldPosition = marker.SamplePosition;
        marker.SamplePosition = newSamplePosition;
        marker.ModifiedAt = DateTime.Now;
        
        // 触发事件
        MarkerMoved?.Invoke(this, new MarkerEventArgs(marker, oldPosition));
        
        // 重新绘制
        viewer.InvalidateVisual();
        
        LogInfo($"移动标记: {marker.Label} 从 {oldPosition} 到 {newSamplePosition}");
    }
    
    /// <summary>
    /// 在Canvas上绘制所有标记
    /// </summary>
    public void DrawMarkers(DrawingContext context, Rect waveformArea)
    {
        foreach (var marker in markers.Where(m => m.IsVisible))
        {
            DrawMarker(context, marker, waveformArea);
        }
        
        // 绘制测量线
        DrawMeasurementLines(context, waveformArea);
    }
    
    /// <summary>
    /// 绘制单个标记
    /// </summary>
    private void DrawMarker(DrawingContext context, SampleMarker marker, Rect waveformArea)
    {
        var x = viewer.SampleToX(marker.SamplePosition, waveformArea);
        
        // 跳过不在可视区域的标记
        if (x < waveformArea.Left || x > waveformArea.Right)
            return;
        
        var markerBrush = new SolidColorBrush(marker.Color);
        var markerPen = new Pen(markerBrush, marker == activeMarker ? 3.0 : 2.0);
        
        // 绘制垂直线
        var lineStart = new Point(x, waveformArea.Top);
        var lineEnd = new Point(x, waveformArea.Bottom);
        context.DrawLine(markerPen, lineStart, lineEnd);
        
        // 绘制标记头部
        var markerHead = new EllipseGeometry(new Point(x, waveformArea.Top - 5), 8, 8);
        context.FillGeometry(markerBrush, markerHead);
        context.DrawGeometry(null, markerPen, markerHead);
        
        // 绘制标签
        if (!string.IsNullOrEmpty(marker.Label))
        {
            var labelText = new FormattedText(
                marker.Label,
                CultureInfo.CurrentCulture,
                FlowDirection.LeftToRight,
                new Typeface("Arial"),
                12,
                markerBrush
            );
            
            var labelPosition = new Point(x + 10, waveformArea.Top - 5);
            context.DrawText(labelText, labelPosition);
        }
        
        // 显示时间信息
        var timeText = FormatMarkerTime(marker);
        var timeFormattedText = new FormattedText(
            timeText,
            CultureInfo.CurrentCulture,
            FlowDirection.LeftToRight,
            new Typeface("Arial"),
            10,
            Brushes.Gray
        );
        
        var timePosition = new Point(x + 10, waveformArea.Top + 15);
        context.DrawText(timeFormattedText, timePosition);
    }
    
    /// <summary>
    /// 绘制测量线 (标记之间的距离测量)
    /// </summary>
    private void DrawMeasurementLines(DrawingContext context, Rect waveformArea)
    {
        var visibleMarkers = markers.Where(m => m.IsVisible).OrderBy(m => m.SamplePosition).ToList();
        
        for (int i = 0; i < visibleMarkers.Count - 1; i++)
        {
            var marker1 = visibleMarkers[i];
            var marker2 = visibleMarkers[i + 1];
            
            var x1 = viewer.SampleToX(marker1.SamplePosition, waveformArea);
            var x2 = viewer.SampleToX(marker2.SamplePosition, waveformArea);
            
            // 跳过不在可视区域的测量
            if (x2 < waveformArea.Left || x1 > waveformArea.Right)
                continue;
            
            // 绘制测量线
            var measurementY = waveformArea.Top + 30;
            var measurementPen = new Pen(Brushes.Blue, 1.0) { DashArray = new DoubleCollection { 5, 3 } };
            
            context.DrawLine(measurementPen, new Point(x1, measurementY), new Point(x2, measurementY));
            
            // 绘制箭头
            DrawArrow(context, new Point(x1, measurementY), new Point(x2, measurementY), measurementPen.Brush);
            
            // 显示测量值
            var measurement = CalculateMeasurement(marker1, marker2);
            var measurementText = new FormattedText(
                measurement.ToString(),
                CultureInfo.CurrentCulture,
                FlowDirection.LeftToRight,
                new Typeface("Arial"),
                11,
                Brushes.Blue
            );
            
            var textX = (x1 + x2) / 2 - measurementText.Width / 2;
            var textY = measurementY - 20;
            context.DrawText(measurementText, new Point(textX, textY));
        }
    }
    
    /// <summary>
    /// 计算两个标记之间的测量值
    /// </summary>
    private MarkerMeasurement CalculateMeasurement(SampleMarker marker1, SampleMarker marker2)
    {
        var sampleDelta = Math.Abs(marker2.SamplePosition - marker1.SamplePosition);
        var timeDelta = sampleDelta / (double)viewer.SampleFrequency;
        var frequency = timeDelta > 0 ? 1.0 / timeDelta : 0;
        
        return new MarkerMeasurement
        {
            SampleCount = sampleDelta,
            TimeDelta = timeDelta,
            Frequency = frequency,
            StartMarker = marker1,
            EndMarker = marker2
        };
    }
    
    /// <summary>
    /// 查找指定位置的标记
    /// </summary>
    public SampleMarker? FindMarkerAtPosition(Point screenPosition, double tolerance = 10)
    {
        var waveformArea = viewer.GetWaveformArea();
        
        foreach (var marker in markers.Where(m => m.IsVisible))
        {
            var markerX = viewer.SampleToX(marker.SamplePosition, waveformArea);
            
            if (Math.Abs(screenPosition.X - markerX) <= tolerance &&
                screenPosition.Y >= waveformArea.Top - 20 &&
                screenPosition.Y <= waveformArea.Bottom + 20)
            {
                return marker;
            }
        }
        
        return null;
    }
    
    /// <summary>
    /// 获取下一个标记颜色
    /// </summary>
    private Color GetNextMarkerColor()
    {
        var colors = new[]
        {
            Colors.Red, Colors.Blue, Colors.Green, Colors.Orange,
            Colors.Purple, Colors.Brown, Colors.Pink, Colors.Cyan
        };
        
        return colors[markers.Count % colors.Length];
    }
}

/// <summary>
/// 样本标记数据模型
/// </summary>
public class SampleMarker
{
    public Guid Id { get; set; }
    public int SamplePosition { get; set; }
    public string Label { get; set; } = string.Empty;
    public Color Color { get; set; }
    public bool IsVisible { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? ModifiedAt { get; set; }
    
    /// <summary>
    /// 计算标记时间 (相对于采集开始)
    /// </summary>
    public double GetTime(int sampleFrequency)
    {
        return SamplePosition / (double)sampleFrequency;
    }
    
    /// <summary>
    /// 格式化时间显示
    /// </summary>
    public string FormatTime(int sampleFrequency)
    {
        var time = GetTime(sampleFrequency);
        
        if (time < 1e-6)
            return $"{time * 1e9:F1} ns";
        else if (time < 1e-3)
            return $"{time * 1e6:F1} µs";
        else if (time < 1.0)
            return $"{time * 1e3:F1} ms";
        else
            return $"{time:F3} s";
    }
    
    public override string ToString()
    {
        return $"{Label} @ {SamplePosition}";
    }
}

/// <summary>
/// 标记测量结果
/// </summary>
public class MarkerMeasurement
{
    public int SampleCount { get; set; }
    public double TimeDelta { get; set; }
    public double Frequency { get; set; }
    public SampleMarker StartMarker { get; set; } = null!;
    public SampleMarker EndMarker { get; set; } = null!;
    
    public override string ToString()
    {
        var timeText = TimeDelta < 1e-6 ? $"{TimeDelta * 1e9:F1} ns" :
                      TimeDelta < 1e-3 ? $"{TimeDelta * 1e6:F1} µs" :
                      TimeDelta < 1.0 ? $"{TimeDelta * 1e3:F1} ms" :
                      $"{TimeDelta:F3} s";
        
        var freqText = Frequency > 1e6 ? $"{Frequency / 1e6:F2} MHz" :
                      Frequency > 1e3 ? $"{Frequency / 1e3:F2} kHz" :
                      $"{Frequency:F2} Hz";
        
        return $"Δt: {timeText}, f: {freqText}";
    }
}
```

## ⚡ 性能优化策略

### 1. 大数据量渲染优化

**虚拟化渲染技术**:
```csharp
/// <summary>
/// 虚拟化渲染管理器
/// 实现大数据集的高效渲染，支持数百万样本的实时显示
/// </summary>
public class VirtualizedRenderer
{
    private readonly SampleViewer viewer;
    private readonly Dictionary<int, RenderTile> tileCache = new();
    private const int TILE_SIZE = 10000; // 每个瓦片10K样本
    private const int MAX_CACHE_TILES = 100; // 最大缓存瓦片数
    
    public VirtualizedRenderer(SampleViewer viewer)
    {
        this.viewer = viewer;
    }
    
    /// <summary>
    /// 渲染瓦片数据结构
    /// </summary>
    private class RenderTile
    {
        public int StartSample { get; set; }
        public int EndSample { get; set; }
        public interval[] Intervals { get; set; } = Array.Empty<interval>();
        public DateTime LastAccess { get; set; }
        public bool IsDirty { get; set; }
        
        public bool Contains(int sample)
        {
            return sample >= StartSample && sample < EndSample;
        }
    }
    
    /// <summary>
    /// 获取可视区域内的渲染瓦片
    /// </summary>
    public List<RenderTile> GetVisibleTiles(int firstSample, int visibleSamples, int channelIndex)
    {
        var visibleTiles = new List<RenderTile>();
        var startTile = firstSample / TILE_SIZE;
        var endTile = (firstSample + visibleSamples - 1) / TILE_SIZE;
        
        for (int tileIndex = startTile; tileIndex <= endTile; tileIndex++)
        {
            var tile = GetOrCreateTile(tileIndex, channelIndex);
            if (tile != null)
            {
                visibleTiles.Add(tile);
                tile.LastAccess = DateTime.Now;
            }
        }
        
        return visibleTiles;
    }
    
    /// <summary>
    /// 获取或创建渲染瓦片
    /// </summary>
    private RenderTile? GetOrCreateTile(int tileIndex, int channelIndex)
    {
        var tileKey = tileIndex * 1000 + channelIndex; // 简单的复合键
        
        if (tileCache.TryGetValue(tileKey, out var existingTile))
        {
            return existingTile;
        }
        
        // 创建新瓦片
        var channel = viewer.GetChannel(channelIndex);
        if (channel?.Samples == null) return null;
        
        var startSample = tileIndex * TILE_SIZE;
        var endSample = Math.Min(startSample + TILE_SIZE, channel.Samples.Length);
        
        if (startSample >= endSample) return null;
        
        var tile = new RenderTile
        {
            StartSample = startSample,
            EndSample = endSample,
            LastAccess = DateTime.Now,
            IsDirty = false
        };
        
        // 计算瓦片内的间隔
        tile.Intervals = ComputeTileIntervals(channel, startSample, endSample);
        
        // 缓存管理
        if (tileCache.Count >= MAX_CACHE_TILES)
        {
            EvictOldestTiles();
        }
        
        tileCache[tileKey] = tile;
        
        return tile;
    }
    
    /// <summary>
    /// 计算瓦片内的信号间隔
    /// </summary>
    private interval[] ComputeTileIntervals(AnalyzerChannel channel, int startSample, int endSample)
    {
        var intervals = new List<interval>();
        var samples = channel.Samples!;
        
        if (startSample >= samples.Length) return Array.Empty<interval>();
        
        byte lastSample = samples[startSample];
        int lastIndex = startSample;
        
        for (int i = startSample + 1; i < endSample && i < samples.Length; i++)
        {
            if (samples[i] != lastSample)
            {
                intervals.Add(new interval
                {
                    start = lastIndex,
                    end = i,
                    value = lastSample != 0,
                    duration = (i - lastIndex) / (double)viewer.SampleFrequency,
                    sampleCount = i - lastIndex
                });
                
                lastSample = samples[i];
                lastIndex = i;
            }
        }
        
        // 添加最后一个间隔
        if (lastIndex < endSample)
        {
            intervals.Add(new interval
            {
                start = lastIndex,
                end = Math.Min(endSample, samples.Length),
                value = lastSample != 0,
                duration = (Math.Min(endSample, samples.Length) - lastIndex) / (double)viewer.SampleFrequency,
                sampleCount = Math.Min(endSample, samples.Length) - lastIndex
            });
        }
        
        return intervals.ToArray();
    }
    
    /// <summary>
    /// 淘汰最旧的瓦片 (LRU策略)
    /// </summary>
    private void EvictOldestTiles()
    {
        var tilesToRemove = tileCache.Values
            .OrderBy(t => t.LastAccess)
            .Take(tileCache.Count - MAX_CACHE_TILES + 10) // 多删除一些，减少频繁淘汰
            .ToList();
        
        var keysToRemove = tileCache
            .Where(kvp => tilesToRemove.Contains(kvp.Value))
            .Select(kvp => kvp.Key)
            .ToList();
        
        foreach (var key in keysToRemove)
        {
            tileCache.Remove(key);
        }
        
        LogDebug($"淘汰瓦片缓存: 移除 {keysToRemove.Count} 个瓦片");
    }
    
    /// <summary>
    /// 清理过期缓存
    /// </summary>
    public void CleanupExpiredCache(TimeSpan maxAge)
    {
        var cutoffTime = DateTime.Now - maxAge;
        var expiredKeys = tileCache
            .Where(kvp => kvp.Value.LastAccess < cutoffTime)
            .Select(kvp => kvp.Key)
            .ToList();
        
        foreach (var key in expiredKeys)
        {
            tileCache.Remove(key);
        }
        
        if (expiredKeys.Count > 0)
        {
            LogDebug($"清理过期缓存: 移除 {expiredKeys.Count} 个瓦片");
        }
    }
    
    /// <summary>
    /// 获取缓存统计信息
    /// </summary>
    public CacheStatistics GetCacheStatistics()
    {
        return new CacheStatistics
        {
            TotalTiles = tileCache.Count,
            MaxTiles = MAX_CACHE_TILES,
            TileSize = TILE_SIZE,
            MemoryUsageEstimate = tileCache.Count * TILE_SIZE * sizeof(byte), // 粗略估算
            OldestTileAge = tileCache.Values.Any() ? 
                DateTime.Now - tileCache.Values.Min(t => t.LastAccess) : TimeSpan.Zero,
            CacheHitRate = CalculateCacheHitRate()
        };
    }
    
    private double CalculateCacheHitRate()
    {
        // 这里可以实现更复杂的命中率统计
        return 0.85; // 示例值
    }
}

/// <summary>
/// 缓存统计信息
/// </summary>
public class CacheStatistics
{
    public int TotalTiles { get; set; }
    public int MaxTiles { get; set; }
    public int TileSize { get; set; }
    public long MemoryUsageEstimate { get; set; }
    public TimeSpan OldestTileAge { get; set; }
    public double CacheHitRate { get; set; }
    
    public override string ToString()
    {
        return $"缓存: {TotalTiles}/{MaxTiles} 瓦片, " +
               $"内存: {MemoryUsageEstimate / 1024:N0} KB, " +
               $"命中率: {CacheHitRate:P1}";
    }
}
```

### 2. 渲染性能监控

**性能监控系统**:
```csharp
/// <summary>
/// 渲染性能监控器
/// 实时监控帧率、渲染时间和内存使用情况
/// </summary>
public class RenderingPerformanceMonitor
{
    private readonly Queue<FrameMetric> frameHistory = new();
    private const int MAX_FRAME_HISTORY = 120; // 保存2秒的帧数据 (60fps)
    
    private DateTime lastFrameTime = DateTime.UtcNow;
    private int frameCount = 0;
    private double totalRenderTime = 0;
    
    /// <summary>
    /// 帧性能指标
    /// </summary>
    public struct FrameMetric
    {
        public DateTime Timestamp;
        public TimeSpan RenderTime;
        public TimeSpan FrameInterval;
        public int VisibleSamples;
        public int ChannelCount;
        public long MemoryUsage;
        
        public double FPS => FrameInterval.TotalSeconds > 0 ? 1.0 / FrameInterval.TotalSeconds : 0;
    }
    
    /// <summary>
    /// 记录帧渲染指标
    /// </summary>
    public void RecordFrame(TimeSpan renderTime, int visibleSamples, int channelCount)
    {
        var now = DateTime.UtcNow;
        var frameInterval = now - lastFrameTime;
        
        var metric = new FrameMetric
        {
            Timestamp = now,
            RenderTime = renderTime,
            FrameInterval = frameInterval,
            VisibleSamples = visibleSamples,
            ChannelCount = channelCount,
            MemoryUsage = GC.GetTotalMemory(false)
        };
        
        lock (frameHistory)
        {
            frameHistory.Enqueue(metric);
            while (frameHistory.Count > MAX_FRAME_HISTORY)
            {
                frameHistory.Dequeue();
            }
        }
        
        frameCount++;
        totalRenderTime += renderTime.TotalMilliseconds;
        lastFrameTime = now;
        
        // 性能警告检测
        CheckPerformanceWarnings(metric);
    }
    
    /// <summary>
    /// 获取实时性能统计
    /// </summary>
    public PerformanceStatistics GetCurrentStatistics()
    {
        lock (frameHistory)
        {
            if (frameHistory.Count == 0)
            {
                return new PerformanceStatistics();
            }
            
            var recentFrames = frameHistory.TakeLast(60).ToArray(); // 最近1秒
            
            return new PerformanceStatistics
            {
                CurrentFPS = recentFrames.Any() ? recentFrames.Average(f => f.FPS) : 0,
                AverageRenderTime = TimeSpan.FromMilliseconds(
                    recentFrames.Average(f => f.RenderTime.TotalMilliseconds)),
                MaxRenderTime = recentFrames.Any() ? 
                    recentFrames.Max(f => f.RenderTime) : TimeSpan.Zero,
                MinRenderTime = recentFrames.Any() ? 
                    recentFrames.Min(f => f.RenderTime) : TimeSpan.Zero,
                FrameDropCount = recentFrames.Count(f => f.RenderTime.TotalMilliseconds > 16.67), // >60fps
                TotalFrames = frameCount,
                AverageVisibleSamples = recentFrames.Any() ? 
                    (int)recentFrames.Average(f => f.VisibleSamples) : 0,
                CurrentMemoryUsage = recentFrames.Any() ? 
                    recentFrames.Last().MemoryUsage : 0,
                PerformanceGrade = CalculatePerformanceGrade(recentFrames)
            };
        }
    }
    
    /// <summary>
    /// 计算性能等级
    /// </summary>
    private PerformanceGrade CalculatePerformanceGrade(FrameMetric[] recentFrames)
    {
        if (recentFrames.Length == 0) return PerformanceGrade.Unknown;
        
        var avgFPS = recentFrames.Average(f => f.FPS);
        var avgRenderTime = recentFrames.Average(f => f.RenderTime.TotalMilliseconds);
        var frameDropRate = recentFrames.Count(f => f.RenderTime.TotalMilliseconds > 16.67) / (double)recentFrames.Length;
        
        if (avgFPS >= 55 && avgRenderTime <= 10 && frameDropRate <= 0.05)
            return PerformanceGrade.Excellent;
        else if (avgFPS >= 45 && avgRenderTime <= 15 && frameDropRate <= 0.10)
            return PerformanceGrade.Good;
        else if (avgFPS >= 30 && avgRenderTime <= 25 && frameDropRate <= 0.20)
            return PerformanceGrade.Fair;
        else if (avgFPS >= 20 && frameDropRate <= 0.40)
            return PerformanceGrade.Poor;
        else
            return PerformanceGrade.Critical;
    }
    
    /// <summary>
    /// 检查性能警告
    /// </summary>
    private void CheckPerformanceWarnings(FrameMetric metric)
    {
        // 渲染时间过长警告
        if (metric.RenderTime.TotalMilliseconds > 50)
        {
            LogWarning($"渲染时间过长: {metric.RenderTime.TotalMilliseconds:F1}ms " +
                      $"({metric.VisibleSamples} 样本, {metric.ChannelCount} 通道)");
        }
        
        // 帧率过低警告
        if (metric.FPS < 20)
        {
            LogWarning($"帧率过低: {metric.FPS:F1} fps");
        }
        
        // 内存使用过高警告
        var memoryMB = metric.MemoryUsage / (1024.0 * 1024.0);
        if (memoryMB > 500) // 超过500MB
        {
            LogWarning($"内存使用过高: {memoryMB:F1} MB");
        }
    }
    
    /// <summary>
    /// 生成性能报告
    /// </summary>
    public string GeneratePerformanceReport()
    {
        var stats = GetCurrentStatistics();
        var report = new StringBuilder();
        
        report.AppendLine("=== 渲染性能报告 ===");
        report.AppendLine($"当前帧率: {stats.CurrentFPS:F1} fps");
        report.AppendLine($"平均渲染时间: {stats.AverageRenderTime.TotalMilliseconds:F1} ms");
        report.AppendLine($"最大渲染时间: {stats.MaxRenderTime.TotalMilliseconds:F1} ms");
        report.AppendLine($"丢帧数: {stats.FrameDropCount}");
        report.AppendLine($"总帧数: {stats.TotalFrames}");
        report.AppendLine($"平均可见样本: {stats.AverageVisibleSamples:N0}");
        report.AppendLine($"内存使用: {stats.CurrentMemoryUsage / (1024.0 * 1024.0):F1} MB");
        report.AppendLine($"性能等级: {stats.PerformanceGrade}");
        
        return report.ToString();
    }
}

/// <summary>
/// 性能统计数据
/// </summary>
public class PerformanceStatistics
{
    public double CurrentFPS { get; set; }
    public TimeSpan AverageRenderTime { get; set; }
    public TimeSpan MaxRenderTime { get; set; }
    public TimeSpan MinRenderTime { get; set; }
    public int FrameDropCount { get; set; }
    public int TotalFrames { get; set; }
    public int AverageVisibleSamples { get; set; }
    public long CurrentMemoryUsage { get; set; }
    public PerformanceGrade PerformanceGrade { get; set; }
}

/// <summary>
/// 性能等级枚举
/// </summary>
public enum PerformanceGrade
{
    Unknown,    // 未知
    Critical,   // 严重问题
    Poor,       // 较差
    Fair,       // 一般
    Good,       // 良好
    Excellent   // 优秀
}
```

## 🎯 VSCode插件实现要点

### 1. Canvas渲染引擎转换

**HTML5 Canvas实现**:
```typescript
// Canvas渲染管理器
class WaveformCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: OffscreenCanvas;
  private offscreenCtx: OffscreenCanvasRenderingContext2D;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // 离屏渲染优化
    this.offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;
  }
  
  /**
   * 渲染通道波形 (对应C#的DrawChannelWaveform)
   */
  renderChannelWaveform(
    channel: AnalyzerChannel, 
    channelY: number, 
    channelHeight: number,
    waveformArea: Rectangle
  ): void {
    const intervals = this.computeIntervals(channel);
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.getChannelColor(channel);
    this.ctx.lineWidth = 2;
    
    const highY = channelY + channelHeight * 0.1;
    const lowY = channelY + channelHeight * 0.9;
    
    let isFirst = true;
    
    for (const interval of intervals) {
      const startX = this.sampleToX(interval.start, waveformArea);
      const endX = this.sampleToX(interval.end, waveformArea);
      
      if (endX < waveformArea.left || startX > waveformArea.right) {
        continue; // 跳过不可见区域
      }
      
      const currentY = interval.value ? highY : lowY;
      
      if (isFirst) {
        this.ctx.moveTo(startX, currentY);
        isFirst = false;
      } else {
        this.ctx.lineTo(startX, currentY);
      }
      
      this.ctx.lineTo(endX, currentY);
    }
    
    this.ctx.stroke();
    this.ctx.restore();
  }
  
  /**
   * 计算信号间隔 (对应C#的ComputeIntervals)
   */
  private computeIntervals(channel: AnalyzerChannel): Interval[] {
    if (!channel.samples || channel.samples.length === 0) {
      return [];
    }
    
    const intervals: Interval[] = [];
    const samples = channel.samples;
    
    let lastSample = samples[0];
    let lastIndex = 0;
    
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] !== lastSample) {
        intervals.push({
          start: lastIndex,
          end: i,
          value: lastSample !== 0,
          duration: (i - lastIndex) / this.sampleFrequency,
          sampleCount: i - lastIndex
        });
        
        lastSample = samples[i];
        lastIndex = i;
      }
    }
    
    // 添加最后一个间隔
    if (lastIndex < samples.length) {
      intervals.push({
        start: lastIndex,
        end: samples.length,
        value: lastSample !== 0,
        duration: (samples.length - lastIndex) / this.sampleFrequency,
        sampleCount: samples.length - lastIndex
      });
    }
    
    return intervals;
  }
  
  /**
   * 样本坐标转换
   */
  private sampleToX(sampleIndex: number, waveformArea: Rectangle): number {
    if (this.visibleSamples === 0) return waveformArea.left;
    
    const relativeIndex = sampleIndex - this.firstSample;
    return waveformArea.left + (relativeIndex / this.visibleSamples) * waveformArea.width;
  }
}

// TypeScript接口定义
interface Interval {
  start: number;
  end: number;
  value: boolean;
  duration: number;
  sampleCount: number;
}

interface Rectangle {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface AnalyzerChannel {
  channelNumber: number;
  channelName: string;
  channelColor?: number;
  hidden: boolean;
  samples?: Uint8Array;
}
```

### 2. Vue3组件集成

**波形显示Vue组件**:
```vue
<template>
  <div class="waveform-viewer" ref="containerRef">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      @mousemove="onMouseMove"
      @wheel="onWheel"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
      @contextmenu="onContextMenu"
    />
    
    <!-- 工具提示 -->
    <div 
      v-if="tooltip.visible"
      class="tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.content }}
    </div>
    
    <!-- 标记管理器 -->
    <MarkerManager
      v-if="showMarkers"
      :markers="markers"
      @add-marker="addMarker"
      @remove-marker="removeMarker"
      @move-marker="moveMarker"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { WaveformCanvasRenderer } from './WaveformCanvasRenderer';
import { NavigationController } from './NavigationController';
import { SampleMarkerManager } from './SampleMarkerManager';

// Props
interface Props {
  channels: AnalyzerChannel[];
  sampleFrequency: number;
  showMarkers?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showMarkers: true
});

// Emits
const emit = defineEmits<{
  markerAdded: [marker: SampleMarker];
  markerRemoved: [marker: SampleMarker];
  selectionChanged: [startSample: number, endSample: number];
}>();

// Refs
const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

// State
const canvasWidth = ref(800);
const canvasHeight = ref(600);
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  content: ''
});

// 渲染和导航控制器
let renderer: WaveformCanvasRenderer | null = null;
let navigation: NavigationController | null = null;
let markerManager: SampleMarkerManager | null = null;

// 生命周期
onMounted(() => {
  initializeRendering();
  setupResizeObserver();
});

onUnmounted(() => {
  cleanup();
});

// 初始化渲染系统
function initializeRendering(): void {
  if (!canvasRef.value) return;
  
  renderer = new WaveformCanvasRenderer(canvasRef.value);
  navigation = new NavigationController(renderer);
  markerManager = new SampleMarkerManager(renderer);
  
  // 设置事件监听
  markerManager.on('markerAdded', (marker) => {
    emit('markerAdded', marker);
  });
  
  markerManager.on('markerRemoved', (marker) => {
    emit('markerRemoved', marker);
  });
  
  // 初始渲染
  renderWaveform();
}

// 渲染波形
function renderWaveform(): void {
  if (!renderer) return;
  
  renderer.clear();
  renderer.drawTimeRuler();
  
  const visibleChannels = props.channels.filter(ch => !ch.hidden);
  visibleChannels.forEach((channel, index) => {
    const channelY = 30 + index * 60; // 简化的布局计算
    renderer!.renderChannelWaveform(channel, channelY, 50, {
      left: 120,
      top: 30,
      width: canvasWidth.value - 120,
      height: canvasHeight.value - 50,
      right: canvasWidth.value,
      bottom: canvasHeight.value - 20
    });
  });
  
  if (markerManager) {
    markerManager.drawMarkers();
  }
}

// 事件处理
function onMouseMove(event: MouseEvent): void {
  if (!renderer) return;
  
  const rect = canvasRef.value!.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // 更新工具提示
  updateTooltip(x, y);
  
  // 更新游标
  renderer.updateCursor(x, y);
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  
  if (!navigation) return;
  
  const rect = canvasRef.value!.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const centerSample = renderer!.xToSample(x);
  
  const zoomFactor = event.deltaY > 0 ? 1.25 : 0.8;
  navigation.applyZoom(zoomFactor, centerSample);
  
  renderWaveform();
}

// 监听数据变化
watch(() => props.channels, () => {
  renderWaveform();
}, { deep: true });

watch(() => props.sampleFrequency, () => {
  if (renderer) {
    renderer.setSampleFrequency(props.sampleFrequency);
    renderWaveform();
  }
});
</script>

<style scoped>
.waveform-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

canvas {
  cursor: crosshair;
  display: block;
}

.tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  white-space: pre-line;
}
</style>
```

## 📊 总结

本文档详细分析了 Pico Logic Analyzer 的波形显示系统，主要包含：

### 🔑 关键技术特点
1. **高性能Canvas渲染**: 间隔优化算法、LOD技术、虚拟化渲染
2. **智能用户交互**: 缩放平移、实时提示、键盘快捷键
3. **标记测量系统**: 用户标记、距离测量、时间分析
4. **性能监控优化**: 帧率监控、内存管理、缓存策略
5. **大数据处理**: 瓦片缓存、批量渲染、异步计算

### 🎯 VSCode插件实现价值
1. **成熟的渲染算法**: 直接可用的Canvas渲染核心算法
2. **完整的交互体系**: 鼠标键盘交互的完整实现方案
3. **优化的性能策略**: 大数据量处理的成熟优化技术
4. **现代化的组件设计**: Vue3组件化的波形显示实现

这个波形显示系统为VSCode插件项目提供了专业级的数据可视化能力，确保了在处理大量逻辑信号数据时的流畅用户体验和精确的测量分析功能。