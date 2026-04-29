  1. VSCode Extension Host 或实际 VSIX 安装后打开 .lac 文件。
  2. 确认波形正常显示、缩放/选择/区域保存/导出可用。
  3. 打开右侧协议解码面板，确认 I2C 映射 SCL/SDA 后可运行并显示结果。
  4. 确认 HTML 调试宿主显示 I²C HTML 模拟 标记，VSCode host 走真实 DecoderManager 路径。
  5. 如有 Pico 硬件，再做真实采集、保存 .lac、记录 hash 和截图。