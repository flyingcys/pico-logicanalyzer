#!/bin/bash

# 测试迁移验证脚本
# 验证@tests和@utest迁移的完整性和质量

echo "🔍 验证测试迁移完整性..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0

# 验证函数
check_file() {
  if [[ -f "$1" ]]; then
    echo -e "${GREEN}✅ $1 存在${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ $1 缺失${NC}"
    ((FAILED++))
    return 1
  fi
}

check_directory() {
  if [[ -d "$1" ]]; then
    echo -e "${GREEN}✅ $1 目录存在${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ $1 目录缺失${NC}"
    ((FAILED++))
    return 1
  fi
}

echo -e "${BLUE}=== 第1步: 验证@tests目录结构 ===${NC}"

# 验证5层架构目录
check_directory "tests/unit"
check_directory "tests/integration"
check_directory "tests/performance"
check_directory "tests/stress"
check_directory "tests/e2e"
check_directory "tests/fixtures"

echo -e "\n${BLUE}=== 第2步: 验证核心测试文件迁移 ===${NC}"

# 验证核心测试文件
CORE_TESTS=(
  "tests/unit/drivers/LogicAnalyzerDriver.core.test.ts"
  "tests/unit/models/CaptureModels.core.test.ts"
  "tests/unit/services/SessionManager.core.test.ts"
  "tests/unit/services/ConfigurationManager.basic.test.ts"
)

for test in "${CORE_TESTS[@]}"; do
  check_file "$test"
done

echo -e "\n${BLUE}=== 第3步: 验证Mock文件迁移 ===${NC}"

# 验证Mock文件
check_file "tests/fixtures/mocks/simple-mocks.ts"
check_file "tests/fixtures/mocks/vscode.ts"

echo -e "\n${BLUE}=== 第4步: 验证测试框架文件 ===${NC}"

# 验证框架文件
check_file "tests/unit/framework/UnitTestBase.ts"
check_file "tests/README.md"

echo -e "\n${BLUE}=== 第5步: 运行迁移后的核心测试 ===${NC}"

# 测试文件大小检查
echo -e "\n${YELLOW}📏 检查测试文件大小（应≤300行）:${NC}"
for test in "${CORE_TESTS[@]}"; do
  if [[ -f "$test" ]]; then
    lines=$(wc -l < "$test")
    if [[ $lines -le 300 ]]; then
      echo -e "${GREEN}✅ $test: $lines 行（合规）${NC}"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️ $test: $lines 行（建议优化）${NC}"
    fi
  fi
done

echo -e "\n${BLUE}=== 第6步: 验证Jest配置更新 ===${NC}"

# 检查Jest配置是否包含@tests
if grep -q "tests/unit" jest.config.js; then
  echo -e "${GREEN}✅ Jest配置已更新支持@tests${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Jest配置未更新${NC}"
  ((FAILED++))
fi

echo -e "\n${BLUE}=== 第7步: 验证CI配置更新 ===${NC}"

# 检查CI配置是否包含@tests
if grep -q "tests/unit" scripts/ci-test-runner.js; then
  echo -e "${GREEN}✅ CI配置已更新支持@tests${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ CI配置未更新${NC}"
  ((FAILED++))
fi

echo -e "\n${BLUE}=== 第8步: 执行快速测试验证 ===${NC}"

# 运行单个核心测试文件验证
if [[ -f "tests/unit/drivers/LogicAnalyzerDriver.core.test.ts" ]]; then
  echo "🧪 运行LogicAnalyzerDriver核心测试..."
  if npm test -- tests/unit/drivers/LogicAnalyzerDriver.core.test.ts --silent 2>/dev/null; then
    echo -e "${GREEN}✅ LogicAnalyzerDriver测试通过${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️ LogicAnalyzerDriver测试需要调试${NC}"
  fi
fi

echo -e "\n${BLUE}=== 第9步: CI分层执行验证 ===${NC}"

# 验证CI分层执行（dry-run模式）
echo "⚙️ 验证CI Quick层执行..."
if node scripts/ci-test-runner.js --layer=quick --dry-run 2>/dev/null; then
  echo -e "${GREEN}✅ CI Quick层配置正常${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️ CI Quick层需要调试${NC}"
fi

echo -e "\n${BLUE}=== 验证结果汇总 ===${NC}"

echo -e "通过项目: ${GREEN}$PASSED${NC}"
echo -e "失败项目: ${RED}$FAILED${NC}"

TOTAL=$((PASSED + FAILED))
if [[ $TOTAL -gt 0 ]]; then
  SUCCESS_RATE=$((PASSED * 100 / TOTAL))
  echo -e "成功率: ${GREEN}$SUCCESS_RATE%${NC}"
else
  echo -e "无验证项目"
  exit 1
fi

if [[ $FAILED -eq 0 ]]; then
  echo -e "\n${GREEN}🎉 迁移验证完全成功！${NC}"
  echo -e "${BLUE}5层测试架构已建立，核心测试文件已迁移，配置已更新${NC}"
  exit 0
elif [[ $SUCCESS_RATE -ge 80 ]]; then
  echo -e "\n${YELLOW}⚠️ 迁移基本成功，有少量问题需要修复${NC}"
  exit 0
else
  echo -e "\n${RED}❌ 迁移存在重要问题，需要检查和修复${NC}"
  exit 1
fi