#!/bin/bash

# 迁移辅助脚本
# 提供测试目录迁移的自动化工具

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 显示帮助信息
show_help() {
  echo -e "${BLUE}测试目录迁移辅助工具${NC}"
  echo ""
  echo "用法: $0 [命令] [选项]"
  echo ""
  echo "命令:"
  echo "  analyze              分析@utest内容"
  echo "  migrate-core         迁移核心测试文件"
  echo "  migrate-additional   迁移其他有价值文件"
  echo "  validate             验证迁移结果"
  echo "  cleanup              清理和标记弃用"
  echo "  status               查看迁移状态"
  echo "  help                 显示此帮助信息"
  echo ""
  echo "示例:"
  echo "  $0 analyze"
  echo "  $0 migrate-core"
  echo "  $0 validate"
}

# 分析@utest内容
analyze_utest() {
  echo -e "${BLUE}=== 分析@utest目录内容 ===${NC}"
  
  if [[ ! -d "utest" ]]; then
    echo -e "${RED}❌ @utest目录不存在${NC}"
    return 1
  fi
  
  echo -e "${YELLOW}📊 测试文件统计:${NC}"
  find utest/ -name "*.test.ts" | wc -l | xargs -I {} echo "  总测试文件: {} 个"
  
  echo -e "\n${YELLOW}📏 文件大小分析 (按行数排序):${NC}"
  find utest/ -name "*.test.ts" -exec wc -l {} + | sort -n | head -20
  
  echo -e "\n${YELLOW}🎭 Mock文件分析:${NC}"
  find utest/mocks -name "*.ts" -o -name "*.js" 2>/dev/null | xargs ls -la 2>/dev/null || echo "  无Mock文件或目录不存在"
  
  echo -e "\n${YELLOW}🔍 核心测试文件检查:${NC}"
  local core_files=(
    "utest/unit/drivers/LogicAnalyzerDriver.core.test.ts"
    "utest/unit/models/CaptureModels.core.test.ts"
    "utest/unit/services/SessionManager.core.test.ts"
  )
  
  for file in "${core_files[@]}"; do
    if [[ -f "$file" ]]; then
      lines=$(wc -l < "$file")
      echo -e "  ${GREEN}✅ $file ($lines 行)${NC}"
    else
      echo -e "  ${RED}❌ $file (不存在)${NC}"
    fi
  done
}

# 迁移核心测试文件
migrate_core() {
  echo -e "${BLUE}=== 迁移核心测试文件 ===${NC}"
  
  # 创建目录结构
  echo -e "${YELLOW}📁 创建@tests目录结构...${NC}"
  mkdir -p tests/unit/{drivers,models,services,utils,framework}
  mkdir -p tests/fixtures/mocks
  
  # 核心文件迁移
  local core_migrations=(
    "utest/unit/drivers/LogicAnalyzerDriver.core.test.ts:tests/unit/drivers/"
    "utest/unit/models/CaptureModels.core.test.ts:tests/unit/models/"
    "utest/unit/services/SessionManager.core.test.ts:tests/unit/services/"
  )
  
  for migration in "${core_migrations[@]}"; do
    IFS=':' read -r source dest <<< "$migration"
    if [[ -f "$source" ]]; then
      cp "$source" "$dest"
      echo -e "${GREEN}✅ 迁移: $source → $dest${NC}"
    else
      echo -e "${RED}❌ 源文件不存在: $source${NC}"
    fi
  done
  
  # Mock文件迁移
  echo -e "\n${YELLOW}🎭 迁移Mock文件...${NC}"
  local mock_files=(
    "utest/mocks/simple-mocks.ts"
    "utest/mocks/vscode.ts"
  )
  
  for mock in "${mock_files[@]}"; do
    if [[ -f "$mock" ]]; then
      cp "$mock" "tests/fixtures/mocks/"
      filename=$(basename "$mock")
      echo -e "${GREEN}✅ Mock迁移: $filename${NC}"
    else
      echo -e "${YELLOW}⚠️ Mock文件不存在: $mock${NC}"
    fi
  done
  
  echo -e "\n${GREEN}🎉 核心文件迁移完成！${NC}"
}

# 迁移其他有价值文件
migrate_additional() {
  echo -e "${BLUE}=== 评估和迁移其他有价值文件 ===${NC}"
  
  echo -e "${YELLOW}🔍 寻找小文件（可能高质量）...${NC}"
  find utest/unit -name "*.test.ts" ! -name "*.core.test.ts" -exec wc -l {} + | \
    awk '$1 <= 200 {print $2 " (" $1 " lines)"}' | \
    head -10
  
  echo -e "\n${YELLOW}📋 建议迁移的文件:${NC}"
  local suggested_files=(
    "utest/unit/services/ConfigurationManager.basic.test.ts"
    "utest/unit/drivers/hardware-driver-manager/HardwareDriverManager.debug.test.ts"
  )
  
  for file in "${suggested_files[@]}"; do
    if [[ -f "$file" ]]; then
      lines=$(wc -l < "$file")
      echo -e "  📄 $file ($lines 行) - 建议迁移"
      
      # 询问是否迁移
      read -p "是否迁移此文件? (y/N): " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 确定目标目录
        if [[ "$file" == *"services"* ]]; then
          cp "$file" "tests/unit/services/"
          echo -e "${GREEN}✅ 已迁移到 tests/unit/services/${NC}"
        elif [[ "$file" == *"drivers"* ]]; then
          cp "$file" "tests/unit/drivers/"
          echo -e "${GREEN}✅ 已迁移到 tests/unit/drivers/${NC}"
        fi
      fi
    fi
  done
}

# 验证迁移结果
validate_migration() {
  echo -e "${BLUE}=== 验证迁移结果 ===${NC}"
  
  if [[ -f "scripts/validate-migration.sh" ]]; then
    echo -e "${YELLOW}📋 运行详细验证脚本...${NC}"
    ./scripts/validate-migration.sh
  else
    echo -e "${YELLOW}📋 运行基础验证...${NC}"
    
    # 基础目录检查
    local dirs=("tests/unit" "tests/integration" "tests/performance" "tests/stress" "tests/e2e")
    for dir in "${dirs[@]}"; do
      if [[ -d "$dir" ]]; then
        echo -e "${GREEN}✅ $dir 存在${NC}"
      else
        echo -e "${RED}❌ $dir 缺失${NC}"
      fi
    done
    
    # 核心文件检查
    local core_files=(
      "tests/unit/drivers/LogicAnalyzerDriver.core.test.ts"
      "tests/unit/models/CaptureModels.core.test.ts"
      "tests/unit/services/SessionManager.core.test.ts"
    )
    
    for file in "${core_files[@]}"; do
      if [[ -f "$file" ]]; then
        echo -e "${GREEN}✅ $file 存在${NC}"
      else
        echo -e "${RED}❌ $file 缺失${NC}"
      fi
    done
  fi
}

# 清理和标记弃用
cleanup_utest() {
  echo -e "${BLUE}=== 清理和标记@utest弃用 ===${NC}"
  
  # 检查是否已创建弃用说明
  if [[ -f "utest/DEPRECATED.md" ]]; then
    echo -e "${GREEN}✅ @utest弃用说明已存在${NC}"
  else
    echo -e "${YELLOW}📝 创建@utest弃用说明...${NC}"
    # 这里应该创建弃用说明，但由于文件内容较长，建议手动创建
    echo -e "${YELLOW}⚠️ 请手动创建 utest/DEPRECATED.md 文件${NC}"
  fi
  
  # 检查配置更新
  echo -e "\n${YELLOW}⚙️ 检查配置文件更新...${NC}"
  
  if grep -q "tests/unit" jest.config.js 2>/dev/null; then
    echo -e "${GREEN}✅ Jest配置已更新${NC}"
  else
    echo -e "${YELLOW}⚠️ Jest配置需要更新${NC}"
  fi
  
  if grep -q "tests/unit" scripts/ci-test-runner.js 2>/dev/null; then
    echo -e "${GREEN}✅ CI配置已更新${NC}"
  else
    echo -e "${YELLOW}⚠️ CI配置需要更新${NC}"
  fi
}

# 查看迁移状态
show_status() {
  echo -e "${BLUE}=== 迁移状态总览 ===${NC}"
  
  echo -e "\n${PURPLE}📊 5层架构状态:${NC}"
  local layers=(
    "tests/unit:P0-P1层(核心单元测试)"
    "tests/integration:P2.1层(集成测试)"
    "tests/performance:P2.2层(性能测试)"
    "tests/stress:P2.3层(压力测试)"
    "tests/e2e:端到端测试"
  )
  
  for layer in "${layers[@]}"; do
    IFS=':' read -r dir desc <<< "$layer"
    if [[ -d "$dir" ]]; then
      count=$(find "$dir" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
      echo -e "  ${GREEN}✅ $desc: $count 个测试文件${NC}"
    else
      echo -e "  ${RED}❌ $desc: 目录不存在${NC}"
    fi
  done
  
  echo -e "\n${PURPLE}📁 核心迁移状态:${NC}"
  local core_files=(
    "LogicAnalyzerDriver.core.test.ts"
    "CaptureModels.core.test.ts"
    "SessionManager.core.test.ts"
  )
  
  for file in "${core_files[@]}"; do
    if [[ -f "tests/unit/drivers/$file" ]] || [[ -f "tests/unit/models/$file" ]] || [[ -f "tests/unit/services/$file" ]]; then
      echo -e "  ${GREEN}✅ $file 已迁移${NC}"
    else
      echo -e "  ${RED}❌ $file 未迁移${NC}"
    fi
  done
  
  echo -e "\n${PURPLE}⚙️ 配置状态:${NC}"
  if [[ -f "utest/DEPRECATED.md" ]]; then
    echo -e "  ${GREEN}✅ @utest已标记弃用${NC}"
  else
    echo -e "  ${YELLOW}⚠️ @utest未标记弃用${NC}"
  fi
  
  if [[ -f "tests/README.md" ]]; then
    echo -e "  ${GREEN}✅ @tests文档已创建${NC}"
  else
    echo -e "  ${YELLOW}⚠️ @tests文档缺失${NC}"
  fi
}

# 主函数
main() {
  case "${1:-help}" in
    "analyze")
      analyze_utest
      ;;
    "migrate-core")
      migrate_core
      ;;
    "migrate-additional")
      migrate_additional
      ;;
    "validate")
      validate_migration
      ;;
    "cleanup")
      cleanup_utest
      ;;
    "status")
      show_status
      ;;
    "help"|*)
      show_help
      ;;
  esac
}

# 检查是否在正确的目录
if [[ ! -f "package.json" ]] || [[ ! -d "src" ]]; then
  echo -e "${RED}❌ 请在项目根目录下运行此脚本${NC}"
  exit 1
fi

# 执行主函数
main "$@"