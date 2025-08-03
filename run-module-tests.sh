#!/bin/bash

# 运行各个模块的测试并生成覆盖率报告
echo "开始运行模块化测试..."

# 测试模块列表
modules=(
  "utest/unit/drivers/AnalyzerDriverBase.test.ts"
  "utest/unit/drivers/OutputPacket.test.ts"
  "utest/unit/drivers/HardwareDriverManager.basic.test.ts"
  "utest/unit/decoders/ChannelMapping.test.ts"
  "utest/unit/models/AnalyzerTypes.test.ts"
  "utest/unit/models/BurstInfo.test.ts"
)

# 创建临时目录存储覆盖率数据
mkdir -p ./coverage-temp

for module in "${modules[@]}"; do
  echo "运行测试: $module"
  npx jest --testPathPattern="$module" --coverage --collectCoverageFrom="src/**/*.ts" --coverageDirectory="./coverage-temp/$(basename $module .test.ts)" --maxWorkers=1 --timeout=30000
  
  if [ $? -eq 0 ]; then
    echo "✅ $module 通过"
  else
    echo "❌ $module 失败"
  fi
  echo "----------------------------------------"
done

echo "所有模块测试完成!"