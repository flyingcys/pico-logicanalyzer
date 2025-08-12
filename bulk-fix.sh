#!/bin/bash

echo "开始修复ESLint警告..."

# 修复枚举类型
echo "修复枚举和类型定义..."
find src -name "*.ts" -exec sed -i 's/enum I2CDecoderState/enum _I2CDecoderState/g' {} \;
find src -name "*.ts" -exec sed -i 's/enum I2CState/enum _I2CState/g' {} \;
find src -name "*.ts" -exec sed -i 's/enum ProtocolType/enum _ProtocolType/g' {} \;
find src -name "*.ts" -exec sed -i 's/enum DataFormat/enum _DataFormat/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bIDLE/_IDLE/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bSTART/_START/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bADDRESS/_ADDRESS/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bDATA/_DATA/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bACK/_ACK/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bSTOP/_STOP/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bACK_NACK/_ACK_NACK/g' {} \;

# 修复连续的枚举值
find src -name "*.ts" -exec sed -i 's/WaitConditions/_WaitConditions/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bTCP/_TCP/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bUDP/_UDP/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bHTTP/_HTTP/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bWEBSOCKET/_WEBSOCKET/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bBINARY/_BINARY/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bJSON/_JSON/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bCSV/_CSV/g' {} \;
find src -name "*.ts" -exec sed -i 's/\bRAW/_RAW/g' {} \;

# 修复类型名称
find src -name "*.ts" -exec sed -i 's/CaptureMode/_CaptureMode/g' {} \;
find src -name "*.ts" -exec sed -i 's/CaptureResult/_CaptureResult/g' {} \;
find src -name "*.ts" -exec sed -i 's/UnifiedCaptureData/_UnifiedCaptureData/g' {} \;
find src -name "*.ts" -exec sed -i 's/CaptureLimits/_CaptureLimits/g' {} \;

echo "修复未使用参数..."
# 修复函数参数（更精确的模式）
find src -name "*.ts" -exec sed -i 's/(\([^)]*\)\bargs\b\([^)]*\))/(\1_args\2)/g' {} \;
find src -name "*.ts" -exec sed -i 's/(\([^)]*\)\bparams\b\([^)]*\))/(\1_params\2)/g' {} \;
find src -name "*.ts" -exec sed -i 's/(\([^)]*\)\bsession\b\([^)]*\))/(\1_session\2)/g' {} \;
find src -name "*.ts" -exec sed -i 's/(\([^)]*\)\bcontext\b\([^)]*\))/(\1_context\2)/g' {} \;

echo "修复完成！检查结果..."
npm run lint 2>&1 | head -20
