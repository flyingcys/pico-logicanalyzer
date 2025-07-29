# 测量分析工具系统 - 详细技术分析

## 📋 概述

本文档深入分析 Pico Logic Analyzer 软件的测量分析工具系统，包括基础测量功能、高级分析算法、统计计算工具、测量结果管理和数据导出等核心功能的技术实现细节。

## 🏗️ 测量工具架构

### 核心架构层次
```
用户界面层 (MeasureDialog + SampleViewer Integration)
         ↓
测量控制层 (MeasurementManager + AnalysisEngine)
         ↓
算法计算层 (Statistical Analysis + Signal Processing)
         ↓
数据管理层 (MeasurementResult + DataExport)
         ↓
数据模型层 (AnalyzerChannel + SampleRegion)
```

## 📏 基础测量功能系统

### 1. MeasureDialog 测量对话框

**测量对话框核心控制器** (`MeasureDialog.axaml.cs`):
```csharp
/// <summary>
/// 测量对话框主控制器
/// 提供交互式测量功能和实时结果显示
/// </summary>
public partial class MeasureDialog : Window
{
    private readonly CaptureSession session;
    private readonly SampleRegion? selectedRegion;
    private readonly MeasurementEngine measurementEngine;
    private readonly List<MeasurementResult> measurementResults = new();
    
    // UI控件引用
    private ComboBox? cmbChannel;
    private ComboBox? cmbMeasurementType;
    private TextBox? txtStartSample;
    private TextBox? txtEndSample;
    private DataGrid? dgResults;
    private Button? btnMeasure;
    private Button? btnExport;
    
    public MeasureDialog(CaptureSession session, SampleRegion? selectedRegion = null)
    {
        InitializeComponent();
        
        this.session = session;
        this.selectedRegion = selectedRegion;
        this.measurementEngine = new MeasurementEngine(session);
        
        InitializeUI();
        LoadDefaultValues();
        SetupEventHandlers();
    }
    
    /// <summary>
    /// 初始化用户界面
    /// </summary>
    private void InitializeUI()
    {
        // 初始化通道选择器
        cmbChannel = this.FindControl<ComboBox>("cmbChannel");
        if (cmbChannel != null)
        {
            var channelItems = session.CaptureChannels
                .Where(ch => !ch.Hidden)
                .Select(ch => new ChannelItem(ch))
                .ToList();
                
            // 添加"所有通道"选项
            channelItems.Insert(0, new ChannelItem { DisplayName = "全部通道", ChannelNumber = -1 });
            
            cmbChannel.Items = channelItems;
            cmbChannel.SelectedIndex = 0;
        }
        
        // 初始化测量类型选择器
        cmbMeasurementType = this.FindControl<ComboBox>("cmbMeasurementType");
        if (cmbMeasurementType != null)
        {
            cmbMeasurementType.Items = Enum.GetValues<MeasurementType>()
                .Select(mt => new MeasurementTypeItem(mt))
                .ToList();
            cmbMeasurementType.SelectedIndex = 0;
        }
        
        // 初始化样本范围控件
        txtStartSample = this.FindControl<TextBox>("txtStartSample");
        txtEndSample = this.FindControl<TextBox>("txtEndSample");
        
        // 初始化结果数据网格
        dgResults = this.FindControl<DataGrid>("dgResults");
        if (dgResults != null)
        {
            SetupResultsDataGrid();
        }
        
        // 初始化按钮
        btnMeasure = this.FindControl<Button>("btnMeasure");
        btnExport = this.FindControl<Button>("btnExport");
    }
    
    /// <summary>
    /// 加载默认值
    /// </summary>
    private void LoadDefaultValues()
    {
        if (selectedRegion != null)
        {
            // 使用选定区域的范围
            if (txtStartSample != null)
                txtStartSample.Text = selectedRegion.FirstSample.ToString();
            if (txtEndSample != null)
                txtEndSample.Text = selectedRegion.LastSample.ToString();
        }
        else
        {
            // 使用全部样本范围
            var maxSamples = session.CaptureChannels.Max(ch => ch.Samples?.Length ?? 0);
            if (txtStartSample != null)
                txtStartSample.Text = "0";
            if (txtEndSample != null)
                txtEndSample.Text = (maxSamples - 1).ToString();
        }
    }
    
    /// <summary>
    /// 设置事件处理器
    /// </summary>
    private void SetupEventHandlers()
    {
        if (btnMeasure != null)
        {
            btnMeasure.Click += async (s, e) => await PerformMeasurement();
        }
        
        if (btnExport != null)
        {
            btnExport.Click += async (s, e) => await ExportResults();
        }
        
        // 样本范围变化时实时预览
        if (txtStartSample != null && txtEndSample != null)
        {
            txtStartSample.TextChanged += OnSampleRangeChanged;
            txtEndSample.TextChanged += OnSampleRangeChanged;
        }
        
        // 测量类型变化时更新UI
        if (cmbMeasurementType != null)
        {
            cmbMeasurementType.SelectionChanged += OnMeasurementTypeChanged;
        }
    }
    
    /// <summary>
    /// 执行测量操作
    /// </summary>
    private async Task PerformMeasurement()
    {
        try
        {
            btnMeasure.IsEnabled = false;
            
            // 获取测量参数
            var measurementRequest = BuildMeasurementRequest();
            if (measurementRequest == null)
            {
                ShowError("请检查测量参数设置");
                return;
            }
            
            // 显示进度
            var progressDialog = new ProgressDialog("正在执行测量分析...");
            progressDialog.Show();
            
            try
            {
                // 执行测量计算
                var results = await Task.Run(() => 
                    measurementEngine.PerformMeasurement(measurementRequest));
                
                // 更新结果显示
                measurementResults.Clear();
                measurementResults.AddRange(results);
                RefreshResultsDisplay();
                
                // 显示成功消息
                ShowInfo($"测量完成，共生成 {results.Count} 项结果");
            }
            finally
            {
                progressDialog.Close();
            }
        }
        catch (Exception ex)
        {
            ShowError($"测量失败: {ex.Message}");
            LogError("测量执行异常", ex);
        }
        finally
        {
            btnMeasure.IsEnabled = true;
        }
    }
    
    /// <summary>
    /// 构建测量请求对象
    /// </summary>
    private MeasurementRequest? BuildMeasurementRequest()
    {
        try
        {
            // 解析样本范围
            if (!int.TryParse(txtStartSample?.Text, out int startSample) ||
                !int.TryParse(txtEndSample?.Text, out int endSample))
            {
                return null;
            }
            
            if (startSample < 0 || endSample <= startSample)
            {
                return null;
            }
            
            // 获取选定通道
            var selectedChannelItem = cmbChannel?.SelectedItem as ChannelItem;
            if (selectedChannelItem == null)
            {
                return null;
            }
            
            // 获取测量类型
            var selectedMeasurementType = cmbMeasurementType?.SelectedItem as MeasurementTypeItem;
            if (selectedMeasurementType == null)
            {
                return null;
            }
            
            // 构建请求对象
            return new MeasurementRequest
            {
                StartSample = startSample,
                EndSample = endSample,
                ChannelNumber = selectedChannelItem.ChannelNumber,
                MeasurementType = selectedMeasurementType.Type,
                SampleFrequency = session.Frequency,
                IncludeStatistics = true,
                IncludeHistogram = selectedMeasurementType.Type == MeasurementType.PulseWidthDistribution
            };
        }
        catch
        {
            return null;
        }
    }
    
    /// <summary>
    /// 设置结果数据网格
    /// </summary>
    private void SetupResultsDataGrid()
    {
        if (dgResults == null) return;
        
        dgResults.Columns.Clear();
        
        // 添加数据列
        dgResults.Columns.Add(new DataGridTextColumn
        {
            Header = "通道",
            Binding = new Binding("ChannelName"),
            Width = new DataGridLength(80)
        });
        
        dgResults.Columns.Add(new DataGridTextColumn
        {
            Header = "测量类型",
            Binding = new Binding("MeasurementTypeName"),
            Width = new DataGridLength(120)
        });
        
        dgResults.Columns.Add(new DataGridTextColumn
        {
            Header = "结果",
            Binding = new Binding("FormattedValue"),
            Width = new DataGridLength(100)
        });
        
        dgResults.Columns.Add(new DataGridTextColumn
        {
            Header = "单位",
            Binding = new Binding("Unit"),
            Width = new DataGridLength(60)
        });
        
        dgResults.Columns.Add(new DataGridTextColumn
        {
            Header = "样本数",
            Binding = new Binding("SampleCount"),
            Width = new DataGridLength(80)
        });
        
        dgResults.Columns.Add(new DataGridTextColumn
        {
            Header = "置信度",
            Binding = new Binding("ConfidenceLevel"),
            Width = new DataGridLength(80)
        });
        
        dgResults.Columns.Add(new DataGridTextColumn
        {
            Header = "备注",
            Binding = new Binding("Notes"),
            Width = new DataGridLength(200)
        });
    }
    
    /// <summary>
    /// 刷新结果显示
    /// </summary>
    private void RefreshResultsDisplay()
    {
        if (dgResults != null)
        {
            dgResults.Items = measurementResults;
        }
        
        // 更新导出按钮状态
        if (btnExport != null)
        {
            btnExport.IsEnabled = measurementResults.Count > 0;
        }
    }
}

/// <summary>
/// 通道选择项
/// </summary>
public class ChannelItem
{
    public int ChannelNumber { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    
    public ChannelItem() { }
    
    public ChannelItem(AnalyzerChannel channel)
    {
        ChannelNumber = channel.ChannelNumber;
        DisplayName = $"通道 {channel.ChannelNumber + 1}: {channel.ChannelName}";
    }
    
    public override string ToString() => DisplayName;
}

/// <summary>
/// 测量类型选择项  
/// </summary>
public class MeasurementTypeItem
{
    public MeasurementType Type { get; set; }
    public string DisplayName { get; set; }
    public string Description { get; set; }
    
    public MeasurementTypeItem(MeasurementType type)
    {
        Type = type;
        (DisplayName, Description) = GetMeasurementTypeInfo(type);
    }
    
    private static (string displayName, string description) GetMeasurementTypeInfo(MeasurementType type)
    {
        return type switch
        {
            MeasurementType.Frequency => ("频率", "信号的基本频率"),
            MeasurementType.Period => ("周期", "信号的基本周期"),
            MeasurementType.PulseWidth => ("脉宽", "高电平持续时间"),
            MeasurementType.DutyCycle => ("占空比", "高电平时间比例"),
            MeasurementType.RiseTime => ("上升时间", "信号上升沿时间"),
            MeasurementType.FallTime => ("下降时间", "信号下降沿时间"),
            MeasurementType.EdgeCount => ("边沿计数", "上升/下降边沿数量"),
            MeasurementType.StateTime => ("状态时间", "高/低电平总时间"),
            MeasurementType.PulseWidthDistribution => ("脉宽分布", "脉宽值的统计分布"),
            MeasurementType.TimingAnalysis => ("时序分析", "完整的时序特征分析"),
            _ => ("未知", "未定义的测量类型")
        };
    }
    
    public override string ToString() => DisplayName;
}
```

### 2. MeasurementEngine 测量计算引擎

**核心测量算法实现**:
```csharp
/// <summary>
/// 测量计算引擎
/// 实现各种信号测量和统计分析算法
/// </summary>
public class MeasurementEngine
{
    private readonly CaptureSession session;
    private readonly SignalProcessor signalProcessor;
    private readonly StatisticalAnalyzer statisticalAnalyzer;
    
    public MeasurementEngine(CaptureSession session)
    {
        this.session = session;
        this.signalProcessor = new SignalProcessor(session.Frequency);
        this.statisticalAnalyzer = new StatisticalAnalyzer();
    }
    
    /// <summary>
    /// 执行测量分析
    /// </summary>
    public List<MeasurementResult> PerformMeasurement(MeasurementRequest request)
    {
        var results = new List<MeasurementResult>();
        
        try
        {
            // 获取目标通道
            var targetChannels = GetTargetChannels(request.ChannelNumber);
            
            foreach (var channel in targetChannels)
            {
                // 提取测量范围内的样本数据
                var sampleData = ExtractSampleData(channel, request.StartSample, request.EndSample);
                if (sampleData.Length == 0) continue;
                
                // 执行具体的测量算法
                var channelResults = ExecuteMeasurement(sampleData, channel, request);
                results.AddRange(channelResults);
            }
            
            LogInfo($"测量完成: {request.MeasurementType}, 通道 {request.ChannelNumber}, " +
                   $"样本 {request.StartSample}-{request.EndSample}, 结果数 {results.Count}");
        }
        catch (Exception ex)
        {
            LogError($"测量执行异常: {ex.Message}");
            throw;
        }
        
        return results;
    }
    
    /// <summary>
    /// 执行具体的测量算法
    /// </summary>
    private List<MeasurementResult> ExecuteMeasurement(
        byte[] sampleData, 
        AnalyzerChannel channel, 
        MeasurementRequest request)
    {
        return request.MeasurementType switch
        {
            MeasurementType.Frequency => MeasureFrequency(sampleData, channel, request),
            MeasurementType.Period => MeasurePeriod(sampleData, channel, request),
            MeasurementType.PulseWidth => MeasurePulseWidth(sampleData, channel, request),
            MeasurementType.DutyCycle => MeasureDutyCycle(sampleData, channel, request),
            MeasurementType.RiseTime => MeasureRiseTime(sampleData, channel, request),
            MeasurementType.FallTime => MeasureFallTime(sampleData, channel, request),
            MeasurementType.EdgeCount => MeasureEdgeCount(sampleData, channel, request),
            MeasurementType.StateTime => MeasureStateTime(sampleData, channel, request),
            MeasurementType.PulseWidthDistribution => MeasurePulseWidthDistribution(sampleData, channel, request),
            MeasurementType.TimingAnalysis => MeasureTimingAnalysis(sampleData, channel, request),
            _ => throw new ArgumentException($"不支持的测量类型: {request.MeasurementType}")
        };
    }
    
    /// <summary>
    /// 频率测量算法
    /// 通过边沿检测和周期计算来确定信号频率
    /// </summary>
    private List<MeasurementResult> MeasureFrequency(
        byte[] sampleData, 
        AnalyzerChannel channel, 
        MeasurementRequest request)
    {
        try
        {
            // 检测上升沿
            var risingEdges = signalProcessor.DetectRisingEdges(sampleData);
            if (risingEdges.Count < 2)
            {
                return new List<MeasurementResult>
                {
                    MeasurementResult.CreateError(channel, MeasurementType.Frequency, 
                        "样本中检测到的边沿数量不足 (需要至少2个上升沿)")
                };
            }
            
            // 计算周期数组
            var periods = new List<double>();
            for (int i = 1; i < risingEdges.Count; i++)
            {
                var periodSamples = risingEdges[i] - risingEdges[i - 1];
                var periodTime = periodSamples / (double)request.SampleFrequency;
                periods.Add(periodTime);
            }
            
            // 统计分析
            var stats = statisticalAnalyzer.CalculateStatistics(periods);
            var frequency = 1.0 / stats.Mean;
            
            var result = new MeasurementResult
            {
                ChannelNumber = channel.ChannelNumber,
                ChannelName = channel.ChannelName,
                MeasurementType = MeasurementType.Frequency,
                Value = frequency,
                Unit = GetFrequencyUnit(frequency),
                SampleCount = sampleData.Length,
                Statistics = stats,
                ConfidenceLevel = CalculateConfidenceLevel(stats),
                Notes = $"基于 {risingEdges.Count} 个上升沿, {periods.Count} 个周期"
            };
            
            return new List<MeasurementResult> { result };
        }
        catch (Exception ex)
        {
            return new List<MeasurementResult>
            {
                MeasurementResult.CreateError(channel, MeasurementType.Frequency, ex.Message)
            };
        }
    }
    
    /// <summary>
    /// 脉宽测量算法
    /// 测量高电平和低电平的持续时间
    /// </summary>
    private List<MeasurementResult> MeasurePulseWidth(
        byte[] sampleData, 
        AnalyzerChannel channel, 
        MeasurementRequest request)
    {
        try
        {
            var results = new List<MeasurementResult>();
            
            // 检测脉冲 (高电平区间)
            var pulses = signalProcessor.DetectPulses(sampleData, true); // 高电平脉冲
            if (pulses.Count == 0)
            {
                return new List<MeasurementResult>
                {
                    MeasurementResult.CreateError(channel, MeasurementType.PulseWidth, 
                        "未检测到高电平脉冲")
                };
            }
            
            // 计算脉宽数组
            var pulseWidths = pulses.Select(pulse => 
                (pulse.End - pulse.Start) / (double)request.SampleFrequency).ToList();
            
            // 统计分析
            var stats = statisticalAnalyzer.CalculateStatistics(pulseWidths);
            
            // 高电平脉宽结果
            results.Add(new MeasurementResult
            {
                ChannelNumber = channel.ChannelNumber,
                ChannelName = channel.ChannelName,
                MeasurementType = MeasurementType.PulseWidth,
                Value = stats.Mean,
                Unit = GetTimeUnit(stats.Mean),
                SampleCount = sampleData.Length,
                Statistics = stats,
                ConfidenceLevel = CalculateConfidenceLevel(stats),
                Notes = $"高电平脉宽: {pulses.Count} 个脉冲",
                AdditionalData = new Dictionary<string, object>
                {
                    ["PulseType"] = "High",
                    ["PulseCount"] = pulses.Count,
                    ["MinWidth"] = stats.Min,
                    ["MaxWidth"] = stats.Max,
                    ["PulseWidths"] = pulseWidths
                }
            });
            
            // 检测低电平脉冲
            var lowPulses = signalProcessor.DetectPulses(sampleData, false);
            if (lowPulses.Count > 0)
            {
                var lowPulseWidths = lowPulses.Select(pulse => 
                    (pulse.End - pulse.Start) / (double)request.SampleFrequency).ToList();
                    
                var lowStats = statisticalAnalyzer.CalculateStatistics(lowPulseWidths);
                
                results.Add(new MeasurementResult
                {
                    ChannelNumber = channel.ChannelNumber,
                    ChannelName = channel.ChannelName,
                    MeasurementType = MeasurementType.PulseWidth,
                    Value = lowStats.Mean,
                    Unit = GetTimeUnit(lowStats.Mean),
                    SampleCount = sampleData.Length,
                    Statistics = lowStats,
                    ConfidenceLevel = CalculateConfidenceLevel(lowStats),
                    Notes = $"低电平脉宽: {lowPulses.Count} 个脉冲",
                    AdditionalData = new Dictionary<string, object>
                    {
                        ["PulseType"] = "Low",
                        ["PulseCount"] = lowPulses.Count,
                        ["MinWidth"] = lowStats.Min,
                        ["MaxWidth"] = lowStats.Max,
                        ["PulseWidths"] = lowPulseWidths
                    }
                });
            }
            
            return results;
        }
        catch (Exception ex)
        {
            return new List<MeasurementResult>
            {
                MeasurementResult.CreateError(channel, MeasurementType.PulseWidth, ex.Message)
            };
        }
    }
    
    /// <summary>
    /// 占空比测量算法
    /// 计算高电平时间占总时间的比例
    /// </summary>
    private List<MeasurementResult> MeasureDutyCycle(
        byte[] sampleData, 
        AnalyzerChannel channel, 
        MeasurementRequest request)
    {
        try
        {
            // 计算高电平总时间
            int highSamples = sampleData.Count(sample => sample != 0);
            double highTime = highSamples / (double)request.SampleFrequency;
            
            // 计算总时间
            double totalTime = sampleData.Length / (double)request.SampleFrequency;
            
            // 计算占空比
            double dutyCycle = totalTime > 0 ? (highTime / totalTime) * 100.0 : 0.0;
            
            var result = new MeasurementResult
            {
                ChannelNumber = channel.ChannelNumber,
                ChannelName = channel.ChannelName,
                MeasurementType = MeasurementType.DutyCycle,
                Value = dutyCycle,
                Unit = "%",
                SampleCount = sampleData.Length,
                ConfidenceLevel = 0.95, // 占空比测量通常很可靠
                Notes = $"高电平: {highSamples} 样本 ({GetTimeUnit(highTime)}), " +
                       $"总时间: {GetTimeUnit(totalTime)}",
                AdditionalData = new Dictionary<string, object>
                {
                    ["HighSamples"] = highSamples,
                    ["TotalSamples"] = sampleData.Length,
                    ["HighTime"] = highTime,
                    ["TotalTime"] = totalTime
                }
            };
            
            return new List<MeasurementResult> { result };
        }
        catch (Exception ex)
        {
            return new List<MeasurementResult>
            {
                MeasurementResult.CreateError(channel, MeasurementType.DutyCycle, ex.Message)
            };
        }
    }
    
    /// <summary>
    /// 边沿计数算法
    /// 统计上升沿和下降沿的数量
    /// </summary>
    private List<MeasurementResult> MeasureEdgeCount(
        byte[] sampleData, 
        AnalyzerChannel channel, 
        MeasurementRequest request)
    {
        try
        {
            var results = new List<MeasurementResult>();
            
            // 检测上升沿
            var risingEdges = signalProcessor.DetectRisingEdges(sampleData);
            results.Add(new MeasurementResult
            {
                ChannelNumber = channel.ChannelNumber,
                ChannelName = channel.ChannelName,
                MeasurementType = MeasurementType.EdgeCount,
                Value = risingEdges.Count,
                Unit = "个",
                SampleCount = sampleData.Length,
                ConfidenceLevel = 1.0, // 边沿计数是精确的
                Notes = "上升沿数量",
                AdditionalData = new Dictionary<string, object>
                {
                    ["EdgeType"] = "Rising",
                    ["EdgePositions"] = risingEdges
                }
            });
            
            // 检测下降沿
            var fallingEdges = signalProcessor.DetectFallingEdges(sampleData);
            results.Add(new MeasurementResult
            {
                ChannelNumber = channel.ChannelNumber,
                ChannelName = channel.ChannelName,
                MeasurementType = MeasurementType.EdgeCount,
                Value = fallingEdges.Count,
                Unit = "个",
                SampleCount = sampleData.Length,
                ConfidenceLevel = 1.0,
                Notes = "下降沿数量",
                AdditionalData = new Dictionary<string, object>
                {
                    ["EdgeType"] = "Falling",
                    ["EdgePositions"] = fallingEdges
                }
            });
            
            // 总边沿数
            results.Add(new MeasurementResult
            {
                ChannelNumber = channel.ChannelNumber,
                ChannelName = channel.ChannelName,
                MeasurementType = MeasurementType.EdgeCount,
                Value = risingEdges.Count + fallingEdges.Count,
                Unit = "个",
                SampleCount = sampleData.Length,
                ConfidenceLevel = 1.0,
                Notes = "总边沿数量 (上升沿 + 下降沿)",
                AdditionalData = new Dictionary<string, object>
                {
                    ["EdgeType"] = "Total",
                    ["RisingCount"] = risingEdges.Count,
                    ["FallingCount"] = fallingEdges.Count
                }
            });
            
            return results;
        }
        catch (Exception ex)
        {
            return new List<MeasurementResult>
            {
                MeasurementResult.CreateError(channel, MeasurementType.EdgeCount, ex.Message)
            };
        }
    }
    
    /// <summary>
    /// 脉宽分布测量算法
    /// 分析脉宽值的统计分布特征
    /// </summary>
    private List<MeasurementResult> MeasurePulseWidthDistribution(
        byte[] sampleData, 
        AnalyzerChannel channel, 
        MeasurementRequest request)
    {
        try
        {
            var results = new List<MeasurementResult>();
            
            // 检测所有脉冲
            var highPulses = signalProcessor.DetectPulses(sampleData, true);
            if (highPulses.Count == 0)
            {
                return new List<MeasurementResult>
                {
                    MeasurementResult.CreateError(channel, MeasurementType.PulseWidthDistribution, 
                        "未检测到脉冲信号")
                };
            }
            
            // 计算脉宽数组
            var pulseWidths = highPulses.Select(pulse => 
                (pulse.End - pulse.Start) / (double)request.SampleFrequency).ToArray();
            
            // 统计分析
            var stats = statisticalAnalyzer.CalculateStatistics(pulseWidths);
            var distribution = statisticalAnalyzer.CalculateDistribution(pulseWidths, 20); // 20个区间
            
            // 基础统计结果
            results.Add(new MeasurementResult
            {
                ChannelNumber = channel.ChannelNumber,
                ChannelName = channel.ChannelName,
                MeasurementType = MeasurementType.PulseWidthDistribution,
                Value = stats.Mean,
                Unit = GetTimeUnit(stats.Mean),
                SampleCount = sampleData.Length,
                Statistics = stats,
                ConfidenceLevel = CalculateConfidenceLevel(stats),
                Notes = $"脉宽分布分析: {highPulses.Count} 个脉冲",
                AdditionalData = new Dictionary<string, object>
                {
                    ["PulseCount"] = highPulses.Count,
                    ["Distribution"] = distribution,
                    ["PulseWidths"] = pulseWidths,
                    ["Histogram"] = GenerateHistogram(pulseWidths, 20)
                }
            });
            
            // 分位数分析
            var percentiles = statisticalAnalyzer.CalculatePercentiles(pulseWidths, 
                new[] { 5, 10, 25, 50, 75, 90, 95 });
                
            foreach (var percentile in percentiles)
            {
                results.Add(new MeasurementResult
                {
                    ChannelNumber = channel.ChannelNumber,
                    ChannelName = channel.ChannelName,
                    MeasurementType = MeasurementType.PulseWidthDistribution,
                    Value = percentile.Value,
                    Unit = GetTimeUnit(percentile.Value),
                    SampleCount = sampleData.Length,
                    ConfidenceLevel = 0.95,
                    Notes = $"第 {percentile.Key} 百分位数",
                    AdditionalData = new Dictionary<string, object>
                    {
                        ["StatisticType"] = "Percentile",
                        ["PercentileRank"] = percentile.Key
                    }
                });
            }
            
            return results;
        }
        catch (Exception ex)
        {
            return new List<MeasurementResult>
            {
                MeasurementResult.CreateError(channel, MeasurementType.PulseWidthDistribution, ex.Message)
            };
        }
    }
    
    /// <summary>
    /// 提取指定范围的样本数据
    /// </summary>
    private byte[] ExtractSampleData(AnalyzerChannel channel, int startSample, int endSample)
    {
        if (channel.Samples == null || channel.Samples.Length == 0)
            return Array.Empty<byte>();
        
        startSample = Math.Max(0, startSample);
        endSample = Math.Min(channel.Samples.Length - 1, endSample);
        
        if (startSample >= endSample)
            return Array.Empty<byte>();
        
        var length = endSample - startSample + 1;
        var result = new byte[length];
        Array.Copy(channel.Samples, startSample, result, 0, length);
        
        return result;
    }
    
    /// <summary>
    /// 获取目标通道列表
    /// </summary>
    private List<AnalyzerChannel> GetTargetChannels(int channelNumber)
    {
        if (channelNumber == -1) // 全部通道
        {
            return session.CaptureChannels.Where(ch => !ch.Hidden).ToList();
        }
        else
        {
            var channel = session.CaptureChannels.FirstOrDefault(ch => ch.ChannelNumber == channelNumber);
            return channel != null ? new List<AnalyzerChannel> { channel } : new List<AnalyzerChannel>();
        }
    }
    
    /// <summary>
    /// 计算置信度等级
    /// </summary>
    private double CalculateConfidenceLevel(StatisticalSummary stats)
    {
        // 基于变异系数和样本数量计算置信度
        var coefficientOfVariation = stats.Mean != 0 ? stats.StandardDeviation / Math.Abs(stats.Mean) : 1.0;
        var sampleSizeFactor = Math.Min(1.0, stats.Count / 100.0); // 样本数量因子
        
        // 变异系数越小，样本数量越多，置信度越高
        var confidence = (1.0 - Math.Min(0.5, coefficientOfVariation)) * sampleSizeFactor;
        return Math.Max(0.5, Math.Min(0.99, confidence));
    }
    
    /// <summary>
    /// 获取合适的时间单位
    /// </summary>
    private string GetTimeUnit(double timeValue)
    {
        var absTime = Math.Abs(timeValue);
        
        if (absTime < 1e-6)
            return "ns";
        else if (absTime < 1e-3)
            return "µs";
        else if (absTime < 1.0)
            return "ms";
        else
            return "s";
    }
    
    /// <summary>
    /// 获取合适的频率单位
    /// </summary>
    private string GetFrequencyUnit(double frequencyValue)
    {
        var absFreq = Math.Abs(frequencyValue);
        
        if (absFreq >= 1e6)
            return "MHz";
        else if (absFreq >= 1e3)
            return "kHz";
        else
            return "Hz";
    }
}
```

## 📊 高级统计分析系统

### 1. StatisticalAnalyzer 统计分析器

**统计计算核心算法**:
```csharp
/// <summary>
/// 统计分析器
/// 提供完整的统计计算和数据分析功能
/// </summary>
public class StatisticalAnalyzer
{
    /// <summary>
    /// 计算基础统计摘要
    /// </summary>
    public StatisticalSummary CalculateStatistics(IEnumerable<double> values)
    {
        var data = values.ToArray();
        if (data.Length == 0)
        {
            return new StatisticalSummary();
        }
        
        Array.Sort(data); // 排序用于中位数和分位数计算
        
        var summary = new StatisticalSummary
        {
            Count = data.Length,
            Min = data[0],
            Max = data[data.Length - 1],
            Mean = data.Average(),
            Median = CalculateMedian(data),
            Range = data[data.Length - 1] - data[0]
        };
        
        // 计算方差和标准差
        var variance = data.Sum(x => Math.Pow(x - summary.Mean, 2)) / data.Length;
        summary.Variance = variance;
        summary.StandardDeviation = Math.Sqrt(variance);
        
        // 计算偏度和峰度
        summary.Skewness = CalculateSkewness(data, summary.Mean, summary.StandardDeviation);
        summary.Kurtosis = CalculateKurtosis(data, summary.Mean, summary.StandardDeviation);
        
        // 计算四分位数
        summary.Q1 = CalculatePercentile(data, 25);
        summary.Q3 = CalculatePercentile(data, 75);
        summary.IQR = summary.Q3 - summary.Q1;
        
        return summary;
    }
    
    /// <summary>
    /// 计算中位数
    /// </summary>
    private double CalculateMedian(double[] sortedData)
    {
        int n = sortedData.Length;
        if (n % 2 == 0)
        {
            return (sortedData[n / 2 - 1] + sortedData[n / 2]) / 2.0;
        }
        else
        {
            return sortedData[n / 2];
        }
    }
    
    /// <summary>
    /// 计算百分位数
    /// </summary>
    private double CalculatePercentile(double[] sortedData, double percentile)
    {
        if (sortedData.Length == 0) return 0;
        if (percentile <= 0) return sortedData[0];
        if (percentile >= 100) return sortedData[sortedData.Length - 1];
        
        double index = (percentile / 100.0) * (sortedData.Length - 1);
        int lowerIndex = (int)Math.Floor(index);
        int upperIndex = (int)Math.Ceiling(index);
        
        if (lowerIndex == upperIndex)
        {
            return sortedData[lowerIndex];
        }
        else
        {
            double weight = index - lowerIndex;
            return sortedData[lowerIndex] * (1 - weight) + sortedData[upperIndex] * weight;
        }
    }
    
    /// <summary>
    /// 计算多个百分位数
    /// </summary>
    public Dictionary<double, double> CalculatePercentiles(double[] values, double[] percentileRanks)
    {
        var sortedData = values.ToArray();
        Array.Sort(sortedData);
        
        var results = new Dictionary<double, double>();
        foreach (var rank in percentileRanks)
        {
            results[rank] = CalculatePercentile(sortedData, rank);
        }
        
        return results;
    }
    
    /// <summary>
    /// 计算偏度 (Skewness)
    /// 衡量分布的非对称性
    /// </summary>
    private double CalculateSkewness(double[] data, double mean, double stdDev)
    {
        if (stdDev == 0 || data.Length < 3) return 0;
        
        var sum = data.Sum(x => Math.Pow((x - mean) / stdDev, 3));
        return sum / data.Length;
    }
    
    /// <summary>
    /// 计算峰度 (Kurtosis)
    /// 衡量分布的尖锐程度
    /// </summary>
    private double CalculateKurtosis(double[] data, double mean, double stdDev)
    {
        if (stdDev == 0 || data.Length < 4) return 0;
        
        var sum = data.Sum(x => Math.Pow((x - mean) / stdDev, 4));
        return (sum / data.Length) - 3; // 减去3使正态分布的峰度为0
    }
    
    /// <summary>
    /// 计算数据分布直方图
    /// </summary>
    public HistogramData CalculateDistribution(double[] values, int binCount = 20)
    {
        if (values.Length == 0 || binCount <= 0)
        {
            return new HistogramData();
        }
        
        var min = values.Min();
        var max = values.Max();
        var range = max - min;
        
        if (range == 0)
        {
            // 所有值相同
            return new HistogramData
            {
                BinCount = 1,
                BinWidth = 0,
                MinValue = min,
                MaxValue = max,
                Bins = new HistogramBin[]
                {
                    new HistogramBin
                    {
                        LowerBound = min,
                        UpperBound = max,
                        Count = values.Length,
                        Frequency = 1.0
                    }
                }
            };
        }
        
        var binWidth = range / binCount;
        var bins = new HistogramBin[binCount];
        
        // 初始化区间
        for (int i = 0; i < binCount; i++)
        {
            bins[i] = new HistogramBin
            {
                LowerBound = min + i * binWidth,
                UpperBound = min + (i + 1) * binWidth,
                Count = 0,
                Frequency = 0.0
            };
        }
        
        // 统计每个区间的数据点
        foreach (var value in values)
        {
            int binIndex = (int)((value - min) / binWidth);
            
            // 处理边界情况
            if (binIndex >= binCount) binIndex = binCount - 1;
            if (binIndex < 0) binIndex = 0;
            
            bins[binIndex].Count++;
        }
        
        // 计算频率
        foreach (var bin in bins)
        {
            bin.Frequency = (double)bin.Count / values.Length;
        }
        
        return new HistogramData
        {
            BinCount = binCount,
            BinWidth = binWidth,
            MinValue = min,
            MaxValue = max,
            Bins = bins
        };
    }
    
    /// <summary>
    /// 异常值检测 (使用IQR方法)
    /// </summary>
    public OutlierAnalysis DetectOutliers(double[] values, double iqrMultiplier = 1.5)
    {
        var stats = CalculateStatistics(values);
        var lowerFence = stats.Q1 - iqrMultiplier * stats.IQR;
        var upperFence = stats.Q3 + iqrMultiplier * stats.IQR;
        
        var outliers = new List<OutlierInfo>();
        var normalValues = new List<double>();
        
        for (int i = 0; i < values.Length; i++)
        {
            var value = values[i];
            if (value < lowerFence || value > upperFence)
            {
                outliers.Add(new OutlierInfo
                {
                    Index = i,
                    Value = value,
                    IsLowOutlier = value < lowerFence,
                    DeviationFromFence = value < lowerFence ? lowerFence - value : value - upperFence
                });
            }
            else
            {
                normalValues.Add(value);
            }
        }
        
        return new OutlierAnalysis
        {
            TotalCount = values.Length,
            OutlierCount = outliers.Count,
            OutlierRate = (double)outliers.Count / values.Length,
            LowerFence = lowerFence,
            UpperFence = upperFence,
            Outliers = outliers,
            CleanedStatistics = normalValues.Count > 0 ? CalculateStatistics(normalValues) : null
        };
    }
    
    /// <summary>
    /// 趋势分析 (线性回归)
    /// </summary>
    public TrendAnalysis AnalyzeTrend(double[] xValues, double[] yValues)
    {
        if (xValues.Length != yValues.Length || xValues.Length < 2)
        {
            return new TrendAnalysis { IsValid = false };
        }
        
        var n = xValues.Length;
        var sumX = xValues.Sum();
        var sumY = yValues.Sum();
        var sumXY = xValues.Zip(yValues, (x, y) => x * y).Sum();
        var sumX2 = xValues.Sum(x => x * x);
        
        // 计算斜率和截距
        var denominator = n * sumX2 - sumX * sumX;
        if (Math.Abs(denominator) < 1e-10)
        {
            return new TrendAnalysis { IsValid = false };
        }
        
        var slope = (n * sumXY - sumX * sumY) / denominator;
        var intercept = (sumY - slope * sumX) / n;
        
        // 计算相关系数
        var meanX = sumX / n;
        var meanY = sumY / n;
        
        var numerator = xValues.Zip(yValues, (x, y) => (x - meanX) * (y - meanY)).Sum();
        var denomX = Math.Sqrt(xValues.Sum(x => (x - meanX) * (x - meanX)));
        var denomY = Math.Sqrt(yValues.Sum(y => (y - meanY) * (y - meanY)));
        
        var correlation = (denomX * denomY) > 0 ? numerator / (denomX * denomY) : 0;
        
        // 计算R²
        var rSquared = correlation * correlation;
        
        return new TrendAnalysis
        {
            IsValid = true,
            Slope = slope,
            Intercept = intercept,
            CorrelationCoefficient = correlation,
            RSquared = rSquared,
            TrendDirection = slope > 0.001 ? TrendDirection.Increasing :
                           slope < -0.001 ? TrendDirection.Decreasing : TrendDirection.Stable,
            DataPointCount = n
        };
    }
}

/// <summary>
/// 统计摘要数据模型
/// </summary>
public class StatisticalSummary
{
    public int Count { get; set; }
    public double Min { get; set; }
    public double Max { get; set; }
    public double Mean { get; set; }
    public double Median { get; set; }
    public double Range { get; set; }
    public double Variance { get; set; }
    public double StandardDeviation { get; set; }
    public double Skewness { get; set; }
    public double Kurtosis { get; set; }
    public double Q1 { get; set; }        // 第一四分位数
    public double Q3 { get; set; }        // 第三四分位数
    public double IQR { get; set; }       // 四分位距
    
    /// <summary>
    /// 变异系数 (标准差与均值的比值)
    /// </summary>
    public double CoefficientOfVariation => Mean != 0 ? StandardDeviation / Math.Abs(Mean) : 0;
    
    /// <summary>
    /// 格式化统计摘要
    /// </summary>
    public override string ToString()
    {
        return $"样本数: {Count}, 均值: {Mean:F6}, 标准差: {StandardDeviation:F6}, " +
               $"范围: [{Min:F6}, {Max:F6}]";
    }
}

/// <summary>
/// 直方图数据模型
/// </summary>
public class HistogramData
{
    public int BinCount { get; set; }
    public double BinWidth { get; set; }
    public double MinValue { get; set; }
    public double MaxValue { get; set; }
    public HistogramBin[] Bins { get; set; } = Array.Empty<HistogramBin>();
}

/// <summary>
/// 直方图区间
/// </summary>
public class HistogramBin
{
    public double LowerBound { get; set; }
    public double UpperBound { get; set; }
    public int Count { get; set; }
    public double Frequency { get; set; }
    
    /// <summary>
    /// 区间中点
    /// </summary>
    public double MidPoint => (LowerBound + UpperBound) / 2.0;
    
    public override string ToString()
    {
        return $"[{LowerBound:F3}, {UpperBound:F3}): {Count} ({Frequency:P1})";
    }
}

/// <summary>
/// 异常值分析结果
/// </summary>
public class OutlierAnalysis
{
    public int TotalCount { get; set; }
    public int OutlierCount { get; set; }
    public double OutlierRate { get; set; }
    public double LowerFence { get; set; }
    public double UpperFence { get; set; }
    public List<OutlierInfo> Outliers { get; set; } = new();
    public StatisticalSummary? CleanedStatistics { get; set; }
}

/// <summary>
/// 异常值信息
/// </summary>
public class OutlierInfo
{
    public int Index { get; set; }
    public double Value { get; set; }
    public bool IsLowOutlier { get; set; }
    public double DeviationFromFence { get; set; }
    
    public string OutlierType => IsLowOutlier ? "低异常值" : "高异常值";
}

/// <summary>
/// 趋势分析结果
/// </summary>
public class TrendAnalysis
{
    public bool IsValid { get; set; }
    public double Slope { get; set; }
    public double Intercept { get; set; }
    public double CorrelationCoefficient { get; set; }
    public double RSquared { get; set; }
    public TrendDirection TrendDirection { get; set; }
    public int DataPointCount { get; set; }
    
    /// <summary>
    /// 预测值
    /// </summary>
    public double Predict(double x) => Slope * x + Intercept;
}

/// <summary>
/// 趋势方向枚举
/// </summary>
public enum TrendDirection
{
    Increasing,    // 上升趋势
    Decreasing,    // 下降趋势
    Stable         // 稳定/无明显趋势
}
```

## 🔬 信号处理算法系统

### 1. SignalProcessor 信号处理器

**数字信号分析核心算法**:
```csharp
/// <summary>
/// 信号处理器
/// 提供数字信号的各种分析和处理算法
/// </summary>
public class SignalProcessor
{
    private readonly double sampleFrequency;
    
    public SignalProcessor(double sampleFrequency)
    {
        this.sampleFrequency = sampleFrequency;
    }
    
    /// <summary>
    /// 检测上升沿
    /// 返回上升沿位置的样本索引数组
    /// </summary>
    public List<int> DetectRisingEdges(byte[] samples)
    {
        var edges = new List<int>();
        
        if (samples.Length < 2) return edges;
        
        for (int i = 1; i < samples.Length; i++)
        {
            if (samples[i - 1] == 0 && samples[i] != 0)
            {
                edges.Add(i);
            }
        }
        
        return edges;
    }
    
    /// <summary>
    /// 检测下降沿
    /// </summary>
    public List<int> DetectFallingEdges(byte[] samples)
    {
        var edges = new List<int>();
        
        if (samples.Length < 2) return edges;
        
        for (int i = 1; i < samples.Length; i++)
        {
            if (samples[i - 1] != 0 && samples[i] == 0)
            {
                edges.Add(i);
            }
        }
        
        return edges;
    }
    
    /// <summary>
    /// 检测脉冲 (连续的高电平或低电平区间)
    /// </summary>
    public List<PulseInfo> DetectPulses(byte[] samples, bool detectHighPulses = true)
    {
        var pulses = new List<PulseInfo>();
        
        if (samples.Length == 0) return pulses;
        
        bool currentState = samples[0] != 0;
        int pulseStart = 0;
        
        for (int i = 1; i < samples.Length; i++)
        {
            bool newState = samples[i] != 0;
            
            if (newState != currentState)
            {
                // 状态变化：结束当前脉冲，开始新脉冲
                if (currentState == detectHighPulses && i > pulseStart + 1) // 至少2个样本
                {
                    pulses.Add(new PulseInfo
                    {
                        Start = pulseStart,
                        End = i - 1,
                        Level = currentState,
                        Duration = (i - pulseStart) / sampleFrequency,
                        SampleCount = i - pulseStart
                    });
                }
                
                currentState = newState;
                pulseStart = i;
            }
        }
        
        // 处理最后一个脉冲
        if (currentState == detectHighPulses && samples.Length > pulseStart + 1)
        {
            pulses.Add(new PulseInfo
            {
                Start = pulseStart,
                End = samples.Length - 1,
                Level = currentState,
                Duration = (samples.Length - pulseStart) / sampleFrequency,
                SampleCount = samples.Length - pulseStart
            });
        }
        
        return pulses;
    }
    
    /// <summary>
    /// 测量上升时间 (10%-90%标准)
    /// </summary>
    public List<EdgeTimingInfo> MeasureRiseTime(byte[] samples, double lowThreshold = 0.1, double highThreshold = 0.9)
    {
        var riseTimeResults = new List<EdgeTimingInfo>();
        var risingEdges = DetectRisingEdges(samples);
        
        foreach (var edgeIndex in risingEdges)
        {
            var timingInfo = AnalyzeEdgeTiming(samples, edgeIndex, true, lowThreshold, highThreshold);
            if (timingInfo != null)
            {
                riseTimeResults.Add(timingInfo);
            }
        }
        
        return riseTimeResults;
    }
    
    /// <summary>
    /// 测量下降时间 (90%-10%标准)
    /// </summary>
    public List<EdgeTimingInfo> MeasureFallTime(byte[] samples, double highThreshold = 0.9, double lowThreshold = 0.1)
    {
        var fallTimeResults = new List<EdgeTimingInfo>();
        var fallingEdges = DetectFallingEdges(samples);
        
        foreach (var edgeIndex in fallingEdges)
        {
            var timingInfo = AnalyzeEdgeTiming(samples, edgeIndex, false, lowThreshold, highThreshold);
            if (timingInfo != null)
            {
                fallTimeResults.Add(timingInfo);
            }
        }
        
        return fallTimeResults;
    }
    
    /// <summary>
    /// 分析边沿时序特征
    /// 这是一个简化实现，实际的边沿时序分析需要更高的采样率和更复杂的算法
    /// </summary>
    private EdgeTimingInfo? AnalyzeEdgeTiming(byte[] samples, int edgeIndex, bool isRisingEdge, 
        double lowThreshold, double highThreshold)
    {
        // 对于数字信号，边沿通常是瞬时的，这里提供基础的分析框架
        
        // 搜索范围：边沿前后各10个样本
        int searchStart = Math.Max(0, edgeIndex - 10);
        int searchEnd = Math.Min(samples.Length - 1, edgeIndex + 10);
        
        // 检查边沿前后的稳定状态
        bool preState = false, postState = false;
        int preStateSamples = 0, postStateSamples = 0;
        
        // 分析边沿前状态
        for (int i = searchStart; i < edgeIndex; i++)
        {
            if (samples[i] != 0 == preState || preStateSamples == 0)
            {
                preState = samples[i] != 0;
                preStateSamples++;
            }
            else
            {
                break; // 状态不稳定
            }
        }
        
        // 分析边沿后状态
        for (int i = edgeIndex; i <= searchEnd; i++)
        {
            if (samples[i] != 0 == postState || postStateSamples == 0)
            {
                postState = samples[i] != 0;
                postStateSamples++;
            }
            else
            {
                break; // 状态不稳定
            }
        }
        
        // 验证这确实是一个有效的边沿
        if (isRisingEdge && (!preState && postState) || !isRisingEdge && (preState && !postState))
        {
            return new EdgeTimingInfo
            {
                EdgeIndex = edgeIndex,
                EdgeType = isRisingEdge ? EdgeType.Rising : EdgeType.Falling,
                PreStateStable = preStateSamples >= 3,
                PostStateStable = postStateSamples >= 3,
                EstimatedTransitionTime = 1.0 / sampleFrequency, // 最小可测量时间
                PreStateLevel = preState,
                PostStateLevel = postState
            };
        }
        
        return null;
    }
    
    /// <summary>
    /// 计算信号的统计特征
    /// </summary>
    public SignalStatistics CalculateSignalStatistics(byte[] samples)
    {
        if (samples.Length == 0)
        {
            return new SignalStatistics();
        }
        
        var stats = new SignalStatistics
        {
            TotalSamples = samples.Length,
            HighSamples = samples.Count(s => s != 0),
            LowSamples = samples.Count(s => s == 0),
            Duration = samples.Length / sampleFrequency
        };
        
        stats.DutyCycle = stats.TotalSamples > 0 ? (double)stats.HighSamples / stats.TotalSamples : 0;
        
        // 边沿统计
        stats.RisingEdges = DetectRisingEdges(samples).Count;
        stats.FallingEdges = DetectFallingEdges(samples).Count;
        stats.TotalEdges = stats.RisingEdges + stats.FallingEdges;
        
        // 频率估算 (基于边沿数量)
        if (stats.RisingEdges > 1)
        {
            stats.EstimatedFrequency = (stats.RisingEdges - 1) / stats.Duration;
        }
        
        // 脉冲统计
        var highPulses = DetectPulses(samples, true);
        var lowPulses = DetectPulses(samples, false);
        
        stats.HighPulseCount = highPulses.Count;
        stats.LowPulseCount = lowPulses.Count;
        
        if (highPulses.Count > 0)
        {
            stats.AverageHighPulseWidth = highPulses.Average(p => p.Duration);
            stats.MinHighPulseWidth = highPulses.Min(p => p.Duration);
            stats.MaxHighPulseWidth = highPulses.Max(p => p.Duration);
        }
        
        if (lowPulses.Count > 0)
        {
            stats.AverageLowPulseWidth = lowPulses.Average(p => p.Duration);
            stats.MinLowPulseWidth = lowPulses.Min(p => p.Duration);
            stats.MaxLowPulseWidth = lowPulses.Max(p => p.Duration);
        }
        
        return stats;
    }
    
    /// <summary>
    /// 检测信号活动区间
    /// 识别信号中有意义的活动部分，过滤掉静默区间
    /// </summary>
    public List<ActivityRegion> DetectActivityRegions(byte[] samples, int minActivitySamples = 10)
    {
        var regions = new List<ActivityRegion>();
        
        if (samples.Length == 0) return regions;
        
        bool inActivity = false;
        int activityStart = 0;
        int lastEdge = -1;
        
        // 检测所有边沿
        var allEdges = new List<int>();
        allEdges.AddRange(DetectRisingEdges(samples));
        allEdges.AddRange(DetectFallingEdges(samples));
        allEdges.Sort();
        
        foreach (var edge in allEdges)
        {
            if (!inActivity)
            {
                // 开始新的活动区间
                inActivity = true;
                activityStart = Math.Max(0, edge - minActivitySamples / 2);
            }
            
            lastEdge = edge;
        }
        
        // 如果有活动，创建区间
        if (inActivity && lastEdge >= 0)
        {
            var activityEnd = Math.Min(samples.Length - 1, lastEdge + minActivitySamples / 2);
            
            if (activityEnd - activityStart >= minActivitySamples)
            {
                regions.Add(new ActivityRegion
                {
                    StartSample = activityStart,
                    EndSample = activityEnd,
                    Duration = (activityEnd - activityStart) / sampleFrequency,
                    EdgeCount = allEdges.Count(e => e >= activityStart && e <= activityEnd),
                    ActivityLevel = CalculateActivityLevel(samples, activityStart, activityEnd)
                });
            }
        }
        
        return regions;
    }
    
    /// <summary>
    /// 计算区间内的活动水平
    /// </summary>
    private double CalculateActivityLevel(byte[] samples, int start, int end)
    {
        if (end <= start) return 0;
        
        int transitions = 0;
        for (int i = start + 1; i <= end && i < samples.Length; i++)
        {
            if (samples[i] != samples[i - 1])
            {
                transitions++;
            }
        }
        
        // 活动水平 = 状态变化数 / 最大可能变化数
        int maxPossibleTransitions = end - start;
        return maxPossibleTransitions > 0 ? (double)transitions / maxPossibleTransitions : 0;
    }
}

/// <summary>
/// 脉冲信息数据模型
/// </summary>
public class PulseInfo
{
    public int Start { get; set; }          // 脉冲起始样本
    public int End { get; set; }            // 脉冲结束样本
    public bool Level { get; set; }         // 脉冲电平 (true=高, false=低)
    public double Duration { get; set; }    // 脉冲持续时间 (秒)
    public int SampleCount { get; set; }    // 脉冲样本数
    
    /// <summary>
    /// 脉冲宽度 (样本数)
    /// </summary>
    public int Width => End - Start + 1;
    
    /// <summary>
    /// 脉冲类型描述
    /// </summary>
    public string PulseType => Level ? "高电平脉冲" : "低电平脉冲";
    
    public override string ToString()
    {
        return $"{PulseType}: {Start}-{End} ({SampleCount} 样本, {Duration * 1e6:F1} µs)";
    }
}

/// <summary>
/// 边沿时序信息
/// </summary>
public class EdgeTimingInfo
{
    public int EdgeIndex { get; set; }
    public EdgeType EdgeType { get; set; }
    public bool PreStateStable { get; set; }
    public bool PostStateStable { get; set; }
    public double EstimatedTransitionTime { get; set; }
    public bool PreStateLevel { get; set; }
    public bool PostStateLevel { get; set; }
    
    public override string ToString()
    {
        return $"{EdgeType}边沿 @ {EdgeIndex}: 转换时间 ≈ {EstimatedTransitionTime * 1e9:F1} ns";
    }
}

/// <summary>
/// 边沿类型枚举
/// </summary>
public enum EdgeType
{
    Rising,    // 上升沿
    Falling    // 下降沿
}

/// <summary>
/// 信号统计信息
/// </summary>
public class SignalStatistics
{
    public int TotalSamples { get; set; }
    public int HighSamples { get; set; }
    public int LowSamples { get; set; }
    public double Duration { get; set; }
    public double DutyCycle { get; set; }
    
    public int RisingEdges { get; set; }
    public int FallingEdges { get; set; }
    public int TotalEdges { get; set; }
    
    public double EstimatedFrequency { get; set; }
    
    public int HighPulseCount { get; set; }
    public int LowPulseCount { get; set; }
    
    public double AverageHighPulseWidth { get; set; }
    public double MinHighPulseWidth { get; set; }
    public double MaxHighPulseWidth { get; set; }
    
    public double AverageLowPulseWidth { get; set; }
    public double MinLowPulseWidth { get; set; }
    public double MaxLowPulseWidth { get; set; }
    
    public override string ToString()
    {
        return $"信号统计: {TotalSamples} 样本, 占空比 {DutyCycle:P1}, " +
               $"频率 ≈ {EstimatedFrequency:F2} Hz, 边沿 {TotalEdges} 个";
    }
}

/// <summary>
/// 活动区间信息
/// </summary>
public class ActivityRegion
{
    public int StartSample { get; set; }
    public int EndSample { get; set; }
    public double Duration { get; set; }
    public int EdgeCount { get; set; }
    public double ActivityLevel { get; set; }
    
    /// <summary>
    /// 区间长度 (样本数)
    /// </summary>
    public int Length => EndSample - StartSample + 1;
    
    /// <summary>
    /// 活动密度 (边沿数/秒)
    /// </summary>
    public double ActivityDensity => Duration > 0 ? EdgeCount / Duration : 0;
    
    public override string ToString()
    {
        return $"活动区间: {StartSample}-{EndSample} ({Duration * 1000:F1} ms, " +
               $"{EdgeCount} 边沿, 活动水平 {ActivityLevel:P1})";
    }
}
```

## 📤 测量结果管理和导出系统

### 1. MeasurementResult 测量结果模型

**测量结果数据模型**:
```csharp
/// <summary>
/// 测量结果数据模型
/// 包含完整的测量信息和元数据
/// </summary>
public class MeasurementResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime Timestamp { get; set; } = DateTime.Now;
    
    // 基本信息
    public int ChannelNumber { get; set; }
    public string ChannelName { get; set; } = string.Empty;
    public MeasurementType MeasurementType { get; set; }
    
    // 测量值
    public double Value { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string FormattedValue => FormatValue();
    
    // 样本信息
    public int SampleCount { get; set; }
    public int StartSample { get; set; }
    public int EndSample { get; set; }
    
    // 统计信息
    public StatisticalSummary? Statistics { get; set; }
    public double ConfidenceLevel { get; set; }
    
    // 元数据
    public string Notes { get; set; } = string.Empty;
    public Dictionary<string, object> AdditionalData { get; set; } = new();
    
    // 错误信息
    public bool IsError { get; set; }
    public string? ErrorMessage { get; set; }
    
    /// <summary>
    /// 测量类型显示名称
    /// </summary>
    public string MeasurementTypeName => GetMeasurementTypeName(MeasurementType);
    
    /// <summary>
    /// 格式化测量值
    /// </summary>
    private string FormatValue()
    {
        if (IsError)
        {
            return "错误";
        }
        
        return MeasurementType switch
        {
            MeasurementType.Frequency => FormatFrequency(Value),
            MeasurementType.Period => FormatTime(Value),
            MeasurementType.PulseWidth => FormatTime(Value),
            MeasurementType.RiseTime => FormatTime(Value),
            MeasurementType.FallTime => FormatTime(Value),
            MeasurementType.DutyCycle => $"{Value:F2}%",
            MeasurementType.EdgeCount => $"{Value:F0}",
            MeasurementType.StateTime => FormatTime(Value),
            _ => $"{Value:F6}"
        };
    }
    
    /// <summary>
    /// 格式化频率值
    /// </summary>
    private string FormatFrequency(double frequency)
    {
        var absFreq = Math.Abs(frequency);
        
        if (absFreq >= 1e9)
            return $"{frequency / 1e9:F3} GHz";
        else if (absFreq >= 1e6)
            return $"{frequency / 1e6:F3} MHz";
        else if (absFreq >= 1e3)
            return $"{frequency / 1e3:F3} kHz";
        else
            return $"{frequency:F3} Hz";
    }
    
    /// <summary>
    /// 格式化时间值
    /// </summary>
    private string FormatTime(double time)
    {
        var absTime = Math.Abs(time);
        
        if (absTime >= 1.0)
            return $"{time:F3} s";
        else if (absTime >= 1e-3)
            return $"{time * 1e3:F3} ms";
        else if (absTime >= 1e-6)
            return $"{time * 1e6:F3} µs";
        else
            return $"{time * 1e9:F1} ns";
    }
    
    /// <summary>
    /// 获取测量类型显示名称
    /// </summary>
    private static string GetMeasurementTypeName(MeasurementType type)
    {
        return type switch
        {
            MeasurementType.Frequency => "频率",
            MeasurementType.Period => "周期",
            MeasurementType.PulseWidth => "脉宽",
            MeasurementType.DutyCycle => "占空比",
            MeasurementType.RiseTime => "上升时间",
            MeasurementType.FallTime => "下降时间",
            MeasurementType.EdgeCount => "边沿计数",
            MeasurementType.StateTime => "状态时间",
            MeasurementType.PulseWidthDistribution => "脉宽分布",
            MeasurementType.TimingAnalysis => "时序分析",
            _ => "未知"
        };
    }
    
    /// <summary>
    /// 创建错误结果
    /// </summary>
    public static MeasurementResult CreateError(AnalyzerChannel channel, MeasurementType measurementType, string errorMessage)
    {
        return new MeasurementResult
        {
            ChannelNumber = channel.ChannelNumber,
            ChannelName = channel.ChannelName,
            MeasurementType = measurementType,
            IsError = true,
            ErrorMessage = errorMessage,
            Value = double.NaN,
            Unit = "",
            ConfidenceLevel = 0
        };
    }
    
    /// <summary>
    /// 导出为CSV行
    /// </summary>
    public string ToCsv()
    {
        var values = new[]
        {
            Timestamp.ToString("yyyy-MM-dd HH:mm:ss.fff"),
            Id.ToString(),
            ChannelNumber.ToString(),
            EscapeCsv(ChannelName),
            EscapeCsv(MeasurementTypeName),
            IsError ? "ERROR" : Value.ToString("G15"),
            EscapeCsv(Unit),
            SampleCount.ToString(),
            ConfidenceLevel.ToString("F3"),
            EscapeCsv(Notes),
            IsError ? EscapeCsv(ErrorMessage ?? "") : ""
        };
        
        return string.Join(",", values);
    }
    
    /// <summary>
    /// CSV字段转义
    /// </summary>
    private static string EscapeCsv(string field)
    {
        if (field.Contains(",") || field.Contains("\"") || field.Contains("\n"))
        {
            return $"\"{field.Replace("\"", "\"\"")}\"";
        }
        return field;
    }
    
    /// <summary>
    /// 导出为JSON
    /// </summary>
    public string ToJson()
    {
        var data = new
        {
            Id,
            Timestamp,
            Channel = new { Number = ChannelNumber, Name = ChannelName },
            Measurement = new { Type = MeasurementType.ToString(), TypeName = MeasurementTypeName },
            Result = new { Value, Unit, FormattedValue, IsError, ErrorMessage },
            Sample = new { Count = SampleCount, Start = StartSample, End = EndSample },
            Quality = new { ConfidenceLevel },
            Statistics,
            Notes,
            AdditionalData
        };
        
        return System.Text.Json.JsonSerializer.Serialize(data, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
    }
}

/// <summary>
/// 测量类型枚举
/// </summary>
public enum MeasurementType
{
    Frequency,                  // 频率
    Period,                     // 周期
    PulseWidth,                 // 脉宽
    DutyCycle,                  // 占空比
    RiseTime,                   // 上升时间
    FallTime,                   // 下降时间
    EdgeCount,                  // 边沿计数
    StateTime,                  // 状态时间
    PulseWidthDistribution,     // 脉宽分布
    TimingAnalysis              // 时序分析
}

/// <summary>
/// 测量请求数据模型
/// </summary>
public class MeasurementRequest
{
    public int StartSample { get; set; }
    public int EndSample { get; set; }
    public int ChannelNumber { get; set; }      // -1 表示所有通道
    public MeasurementType MeasurementType { get; set; }
    public double SampleFrequency { get; set; }
    public bool IncludeStatistics { get; set; } = true;
    public bool IncludeHistogram { get; set; } = false;
    
    /// <summary>
    /// 样本范围
    /// </summary>
    public int SampleRange => EndSample - StartSample + 1;
    
    /// <summary>
    /// 测量时间范围
    /// </summary>
    public double TimeRange => SampleRange / SampleFrequency;
    
    public override string ToString()
    {
        return $"{MeasurementType} 测量: 通道 {ChannelNumber}, " +
               $"样本 {StartSample}-{EndSample} ({TimeRange * 1000:F1} ms)";
    }
}
```

### 2. MeasurementExporter 结果导出器

**测量结果导出系统**:
```csharp
/// <summary>
/// 测量结果导出器
/// 支持多种格式的测量结果导出
/// </summary>
public class MeasurementExporter
{
    /// <summary>
    /// 导出为CSV格式
    /// </summary>
    public static async Task<bool> ExportToCsvAsync(List<MeasurementResult> results, string fileName)
    {
        try
        {
            using var writer = new StreamWriter(fileName, false, Encoding.UTF8);
            
            // 写入CSV头部
            await writer.WriteLineAsync(GetCsvHeader());
            
            // 写入数据行
            foreach (var result in results)
            {
                await writer.WriteLineAsync(result.ToCsv());
            }
            
            LogInfo($"成功导出 {results.Count} 个测量结果到 {fileName}");
            return true;
        }
        catch (Exception ex)
        {
            LogError($"CSV导出失败: {ex.Message}");
            return false;
        }
    }
    
    /// <summary>
    /// 导出为JSON格式
    /// </summary>
    public static async Task<bool> ExportToJsonAsync(List<MeasurementResult> results, string fileName)
    {
        try
        {
            var exportData = new
            {
                ExportInfo = new
                {
                    Timestamp = DateTime.Now,
                    ResultCount = results.Count,
                    ExportVersion = "1.0"
                },
                Results = results
            };
            
            var json = System.Text.Json.JsonSerializer.Serialize(exportData, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            
            await File.WriteAllTextAsync(fileName, json, Encoding.UTF8);
            
            LogInfo($"成功导出 {results.Count} 个测量结果到 {fileName}");
            return true;
        }
        catch (Exception ex)
        {
            LogError($"JSON导出失败: {ex.Message}");
            return false;
        }
    }
    
    /// <summary>
    /// 导出为HTML报告
    /// </summary>
    public static async Task<bool> ExportToHtmlReportAsync(List<MeasurementResult> results, string fileName)
    {
        try
        {
            var html = GenerateHtmlReport(results);
            await File.WriteAllTextAsync(fileName, html, Encoding.UTF8);
            
            LogInfo($"成功导出HTML报告到 {fileName}");
            return true;
        }
        catch (Exception ex)
        {
            LogError($"HTML报告导出失败: {ex.Message}");
            return false;
        }
    }
    
    /// <summary>
    /// 生成HTML报告
    /// </summary>
    private static string GenerateHtmlReport(List<MeasurementResult> results)
    {
        var html = new StringBuilder();
        
        html.AppendLine("<!DOCTYPE html>");
        html.AppendLine("<html><head>");
        html.AppendLine("<meta charset='utf-8'>");
        html.AppendLine("<title>逻辑分析器测量报告</title>");
        html.AppendLine("<style>");
        html.AppendLine(GetHtmlStyles());
        html.AppendLine("</style>");
        html.AppendLine("</head><body>");
        
        // 报告头部
        html.AppendLine("<div class='header'>");
        html.AppendLine("<h1>逻辑分析器测量报告</h1>");
        html.AppendLine($"<p>生成时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}</p>");
        html.AppendLine($"<p>测量结果数量: {results.Count}</p>");
        html.AppendLine("</div>");
        
        // 统计摘要
        html.AppendLine("<div class='summary'>");
        html.AppendLine("<h2>测量摘要</h2>");
        html.AppendLine(GenerateSummaryTable(results));
        html.AppendLine("</div>");
        
        // 详细结果表格
        html.AppendLine("<div class='results'>");
        html.AppendLine("<h2>详细结果</h2>");
        html.AppendLine(GenerateResultsTable(results));
        html.AppendLine("</div>");
        
        // 统计图表 (简化的文本表示)
        if (results.Any(r => r.Statistics != null))
        {
            html.AppendLine("<div class='charts'>");
            html.AppendLine("<h2>统计图表</h2>");
            html.AppendLine(GenerateStatisticsCharts(results));
            html.AppendLine("</div>");
        }
        
        html.AppendLine("</body></html>");
        
        return html.ToString();
    }
    
    /// <summary>
    /// 获取CSV头部
    /// </summary>
    private static string GetCsvHeader()
    {
        return "时间戳,ID,通道号,通道名称,测量类型,测量值,单位,样本数,置信度,备注,错误信息";
    }
    
    /// <summary>
    /// 生成HTML样式
    /// </summary>
    private static string GetHtmlStyles()
    {
        return @"
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #f0f0f0; padding: 15px; margin-bottom: 20px; }
            .summary, .results, .charts { margin-bottom: 30px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .error { color: red; font-weight: bold; }
            .good { color: green; }
            .warning { color: orange; }
            .chart { margin: 20px 0; padding: 15px; background: #f9f9f9; }
        ";
    }
    
    /// <summary>
    /// 生成摘要表格
    /// </summary>
    private static string GenerateSummaryTable(List<MeasurementResult> results)
    {
        var summary = new StringBuilder();
        
        // 按测量类型分组统计
        var groups = results.GroupBy(r => r.MeasurementType)
                           .Select(g => new {
                               Type = g.Key,
                               Count = g.Count(),
                               SuccessCount = g.Count(r => !r.IsError),
                               ErrorCount = g.Count(r => r.IsError),
                               AvgConfidence = g.Where(r => !r.IsError).Average(r => r.ConfidenceLevel)
                           });
        
        summary.AppendLine("<table>");
        summary.AppendLine("<tr><th>测量类型</th><th>总数</th><th>成功</th><th>错误</th><th>平均置信度</th></tr>");
        
        foreach (var group in groups)
        {
            var confidenceClass = group.AvgConfidence > 0.8 ? "good" : 
                                 group.AvgConfidence > 0.6 ? "warning" : "error";
            
            summary.AppendLine($"<tr>");
            summary.AppendLine($"<td>{GetMeasurementTypeName(group.Type)}</td>");
            summary.AppendLine($"<td>{group.Count}</td>");
            summary.AppendLine($"<td class='good'>{group.SuccessCount}</td>");
            summary.AppendLine($"<td class='error'>{group.ErrorCount}</td>");
            summary.AppendLine($"<td class='{confidenceClass}'>{group.AvgConfidence:P1}</td>");
            summary.AppendLine($"</tr>");
        }
        
        summary.AppendLine("</table>");
        
        return summary.ToString();
    }
    
    /// <summary>
    /// 生成结果表格
    /// </summary>
    private static string GenerateResultsTable(List<MeasurementResult> results)
    {
        var table = new StringBuilder();
        
        table.AppendLine("<table>");
        table.AppendLine("<tr>");
        table.AppendLine("<th>时间</th><th>通道</th><th>测量类型</th>");
        table.AppendLine("<th>结果</th><th>单位</th><th>置信度</th><th>备注</th>");
        table.AppendLine("</tr>");
        
        foreach (var result in results.OrderBy(r => r.Timestamp))
        {
            var rowClass = result.IsError ? "error" : "";
            
            table.AppendLine($"<tr class='{rowClass}'>");
            table.AppendLine($"<td>{result.Timestamp:HH:mm:ss}</td>");
            table.AppendLine($"<td>{result.ChannelName}</td>");
            table.AppendLine($"<td>{result.MeasurementTypeName}</td>");
            
            if (result.IsError)
            {
                table.AppendLine($"<td class='error'>错误</td>");
                table.AppendLine($"<td>-</td>");
                table.AppendLine($"<td>-</td>");
                table.AppendLine($"<td>{result.ErrorMessage}</td>");
            }
            else
            {
                table.AppendLine($"<td>{result.FormattedValue}</td>");
                table.AppendLine($"<td>{result.Unit}</td>");
                table.AppendLine($"<td>{result.ConfidenceLevel:P1}</td>");
                table.AppendLine($"<td>{result.Notes}</td>");
            }
            
            table.AppendLine("</tr>");
        }
        
        table.AppendLine("</table>");
        
        return table.ToString();
    }
    
    private static string GetMeasurementTypeName(MeasurementType type)
    {
        return type switch
        {
            MeasurementType.Frequency => "频率",
            MeasurementType.Period => "周期",
            MeasurementType.PulseWidth => "脉宽",
            MeasurementType.DutyCycle => "占空比",
            MeasurementType.RiseTime => "上升时间",
            MeasurementType.FallTime => "下降时间",
            MeasurementType.EdgeCount => "边沿计数",
            MeasurementType.StateTime => "状态时间",
            MeasurementType.PulseWidthDistribution => "脉宽分布",
            MeasurementType.TimingAnalysis => "时序分析",
            _ => "未知"
        };
    }
}
```

## 🎯 VSCode插件实现要点

### 1. TypeScript测量引擎

**测量引擎TypeScript实现**:
```typescript
// 测量引擎接口
interface IMeasurementEngine {
  performMeasurement(request: MeasurementRequest): Promise<MeasurementResult[]>;
  getSupportedMeasurementTypes(): MeasurementType[];
  validateMeasurementRequest(request: MeasurementRequest): ValidationResult;
}

// 测量引擎实现
class MeasurementEngine implements IMeasurementEngine {
  private signalProcessor: SignalProcessor;
  private statisticalAnalyzer: StatisticalAnalyzer;
  
  constructor(sampleFrequency: number) {
    this.signalProcessor = new SignalProcessor(sampleFrequency);
    this.statisticalAnalyzer = new StatisticalAnalyzer();
  }
  
  async performMeasurement(request: MeasurementRequest): Promise<MeasurementResult[]> {
    try {
      // 验证请求
      const validation = this.validateMeasurementRequest(request);
      if (!validation.isValid) {
        throw new Error(validation.errorMessage);
      }
      
      // 执行测量
      switch (request.measurementType) {
        case MeasurementType.Frequency:
          return await this.measureFrequency(request);
        case MeasurementType.PulseWidth:
          return await this.measurePulseWidth(request);
        case MeasurementType.DutyCycle:
          return await this.measureDutyCycle(request);
        // ... 其他测量类型
        default:
          throw new Error(`不支持的测量类型: ${request.measurementType}`);
      }
    } catch (error) {
      console.error('测量执行失败:', error);
      throw error;
    }
  }
  
  private async measureFrequency(request: MeasurementRequest): Promise<MeasurementResult[]> {
    // 对应C#的MeasureFrequency方法
    const sampleData = this.extractSampleData(request);
    const risingEdges = this.signalProcessor.detectRisingEdges(sampleData);
    
    if (risingEdges.length < 2) {
      return [{
        channelNumber: request.channelNumber,
        measurementType: MeasurementType.Frequency,
        isError: true,
        errorMessage: '检测到的边沿数量不足',
        value: NaN,
        unit: 'Hz',
        timestamp: new Date()
      }];
    }
    
    // 计算周期
    const periods: number[] = [];
    for (let i = 1; i < risingEdges.length; i++) {
      const periodSamples = risingEdges[i] - risingEdges[i - 1];
      const periodTime = periodSamples / request.sampleFrequency;
      periods.push(periodTime);
    }
    
    // 统计分析
    const stats = this.statisticalAnalyzer.calculateStatistics(periods);
    const frequency = 1.0 / stats.mean;
    
    return [{
      channelNumber: request.channelNumber,
      measurementType: MeasurementType.Frequency,
      value: frequency,
      unit: this.getFrequencyUnit(frequency),
      statistics: stats,
      confidenceLevel: this.calculateConfidenceLevel(stats),
      timestamp: new Date(),
      isError: false
    }];
  }
}

// Vue3测量面板组件
// MeasurementPanel.vue
<template>
  <div class="measurement-panel">
    <el-card>
      <template #header>
        <span>测量分析</span>
      </template>
      
      <el-form :model="measurementForm" label-width="120px">
        <el-form-item label="测量类型">
          <el-select v-model="measurementForm.measurementType">
            <el-option 
              v-for="type in measurementTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="通道选择">
          <el-select v-model="measurementForm.channelNumber">
            <el-option label="全部通道" :value="-1" />
            <el-option 
              v-for="channel in channels"
              :key="channel.channelNumber"
              :label="`通道 ${channel.channelNumber + 1}: ${channel.channelName}`"
              :value="channel.channelNumber"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="样本范围">
          <el-input-number 
            v-model="measurementForm.startSample" 
            :min="0" 
            placeholder="起始样本"
          />
          <span style="margin: 0 10px;">到</span>
          <el-input-number 
            v-model="measurementForm.endSample" 
            :min="measurementForm.startSample + 1"
            placeholder="结束样本"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            @click="performMeasurement"
            :loading="measuring"
          >
            开始测量
          </el-button>
          <el-button @click="clearResults">清除结果</el-button>
          <el-button @click="exportResults" :disabled="results.length === 0">
            导出结果
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <!-- 测量结果表格 -->
    <el-card style="margin-top: 20px;" v-if="results.length > 0">
      <template #header>
        <span>测量结果 ({{ results.length }} 项)</span>
      </template>
      
      <el-table :data="results" style="width: 100%">
        <el-table-column prop="channelName" label="通道" width="100" />
        <el-table-column prop="measurementTypeName" label="类型" width="120" />
        <el-table-column prop="formattedValue" label="结果" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="confidenceLevel" label="置信度" width="100">
          <template #default="scope">
            <el-tag 
              :type="getConfidenceTagType(scope.row.confidenceLevel)"
              size="small"
            >
              {{ (scope.row.confidenceLevel * 100).toFixed(1) }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { MeasurementEngine } from './MeasurementEngine';

// Props和Emits
interface Props {
  channels: AnalyzerChannel[];
  sampleFrequency: number;
  selectedRegion?: SampleRegion;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  measurementCompleted: [results: MeasurementResult[]];
}>();

// 状态
const measuring = ref(false);
const results = ref<MeasurementResult[]>([]);
const measurementEngine = ref<MeasurementEngine>();

const measurementForm = ref({
  measurementType: MeasurementType.Frequency,
  channelNumber: -1,
  startSample: 0,
  endSample: 10000
});

// 计算属性
const measurementTypes = computed(() => [
  { value: MeasurementType.Frequency, label: '频率' },
  { value: MeasurementType.PulseWidth, label: '脉宽' },
  { value: MeasurementType.DutyCycle, label: '占空比' },
  { value: MeasurementType.EdgeCount, label: '边沿计数' },
  // ... 更多类型
]);

// 生命周期
onMounted(() => {
  measurementEngine.value = new MeasurementEngine(props.sampleFrequency);
  
  // 如果有选定区域，使用其范围
  if (props.selectedRegion) {
    measurementForm.value.startSample = props.selectedRegion.firstSample;
    measurementForm.value.endSample = props.selectedRegion.lastSample;
  }
});

// 方法
async function performMeasurement(): Promise<void> {
  if (!measurementEngine.value) return;
  
  measuring.value = true;
  
  try {
    const request: MeasurementRequest = {
      ...measurementForm.value,
      sampleFrequency: props.sampleFrequency
    };
    
    const measurementResults = await measurementEngine.value.performMeasurement(request);
    results.value = measurementResults;
    
    emit('measurementCompleted', measurementResults);
    
    ElMessage.success(`测量完成，共生成 ${measurementResults.length} 项结果`);
  } catch (error) {
    ElMessage.error(`测量失败: ${error.message}`);
  } finally {
    measuring.value = false;
  }
}

function clearResults(): void {
  results.value = [];
}

function getConfidenceTagType(confidence: number): string {
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'danger';
}

async function exportResults(): Promise<void> {
  // 实现结果导出功能
  try {
    // 调用VSCode API保存文件
    const csvContent = generateCsvContent(results.value);
    // vscode API调用保存文件
    ElMessage.success('结果导出成功');
  } catch (error) {
    ElMessage.error(`导出失败: ${error.message}`);
  }
}
</script>
```

## 📊 总结

本文档详细分析了 Pico Logic Analyzer 的测量分析工具系统，主要包含：

### 🔑 关键技术特点
1. **完整的测量算法**: 频率、脉宽、占空比、边沿计数等核心测量
2. **高级统计分析**: 均值、方差、分位数、异常值检测、趋势分析
3. **信号处理算法**: 边沿检测、脉冲分析、活动区间识别
4. **多格式导出**: CSV、JSON、HTML报告等多种导出格式
5. **实时交互界面**: 测量参数配置、结果显示、进度监控

### 🎯 VSCode插件实现价值
1. **成熟的算法库**: 直接可用的信号分析和统计计算算法
2. **完整的UI设计**: 测量对话框和结果显示的完整实现方案
3. **标准化的数据模型**: 测量结果和统计信息的规范化数据结构
4. **现代化的组件架构**: Vue3组件化的测量工具实现

这个测量分析工具系统为VSCode插件项目提供了专业级的信号分析能力，确保了在逻辑信号测量和统计分析方面的准确性和可靠性。