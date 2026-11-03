
启动 web:

npm run dev 


连接成功后按以下步骤采集：

  1. 确认左侧栏设备状态显示“已连接”。
  2. 在左侧“采集通道”中选择通道，默认启用前 8 个通道。
  3. 设置采样频率、Pre Samples、Post Samples。
  4. 首次测试建议：
      - 触发模式选择 Blast
      - Pre Samples：100
      - Post Samples：1000

  5. 确认逻辑分析仪 GND 和信号线已接好。
  6. 点击顶部工具栏的播放按钮，也就是“开始采集”按钮。

  对应代码入口：

  - UI 按钮：src/frontend/app/components/AppHeader.vue:151
  - 前端发送采集命令：src/frontend/app/composables/deviceCaptureCommands.ts:140
  - VS Code 宿主执行真实采集：src/providers/LACEditorProvider.ts:1253
  - 串口驱动读取和解析数据：src/drivers/LogicAnalyzerDriver.ts:157

  采集完成后，扩展会把真实样本写回当前 .lac 文档，前端刷新 sessionStore，中央区域的波形画布会显示波形。

  如果使用 Edge 模式，没有检测到触发边沿时设备会一直等待；首次验证建议使用 Blast。如果波形仍为空，优先检查触发模式、采集通道、GND 接线和输入信号。

## 命令行
通过现有 CLI 直接连接真实设备采集：

  node out/cli/index.js capture \
    --device /dev/tty.usbmodem23401 \
    --frequency 200000000 \
    --pre 0 \
    --post 1000 \
    --channels 0-7 \
    --trigger blast \
    --output /tmp/pico-diagnostic-blast.json \
    --format json