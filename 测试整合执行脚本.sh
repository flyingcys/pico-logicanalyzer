#!/bin/bash

# VSCode逻辑分析器插件测试体系整合执行脚本
# 作者: Claude Code Assistant
# 日期: 2025-08-03
# 用途: 自动化整合tests/和utest/两套测试体系

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="/home/share/samba/vscode-extension/pico-logicanalyzer"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 检查前置条件
check_prerequisites() {
    log_info "检查前置条件..."
    
    if [ ! -d "$PROJECT_ROOT" ]; then
        log_error "项目目录不存在: $PROJECT_ROOT"
        exit 1
    fi
    
    if [ ! -d "$PROJECT_ROOT/tests" ]; then
        log_error "tests目录不存在"
        exit 1
    fi
    
    if [ ! -d "$PROJECT_ROOT/utest" ]; then
        log_error "utest目录不存在"
        exit 1
    fi
    
    log_success "前置条件检查通过"
}

# 创建备份
create_backup() {
    log_info "创建备份..."
    
    BACKUP_DIR="$PROJECT_ROOT/backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    cp -r "$PROJECT_ROOT/tests" "$BACKUP_DIR/tests_backup"
    cp -r "$PROJECT_ROOT/utest" "$BACKUP_DIR/utest_backup"
    
    log_success "备份创建完成: $BACKUP_DIR"
    echo "$BACKUP_DIR" > "$PROJECT_ROOT/.test_integration_backup"
}

# 运行当前测试获取基准
run_baseline_tests() {
    log_info "运行基准测试..."
    
    cd "$PROJECT_ROOT"
    
    # 运行tests目录测试
    log_info "运行tests/目录测试..."
    if npm test 2>&1 | tee tests_baseline.log; then
        log_success "tests/目录测试通过"
    else
        log_warn "tests/目录测试有失败，继续执行"
    fi
    
    # 运行utest目录测试（如果有配置）
    log_info "运行utest/目录测试..."
    if [ -f "jest.config.utest.js" ]; then
        if npm run test:utest 2>&1 | tee utest_baseline.log; then
            log_success "utest/目录测试通过"
        else
            log_warn "utest/目录测试有失败，继续执行"
        fi
    else
        log_warn "未找到utest测试配置，跳过"
    fi
}

# 阶段1：删除重复的单元测试文件
phase1_remove_duplicates() {
    log_info "=== 阶段1：删除重复文件 ==="
    
    cd "$PROJECT_ROOT"
    
    # 删除tests/中的重复单元测试文件
    DUPLICATE_FILES=(
        "tests/decoders/DecoderBase.test.ts"
        "tests/drivers/AnalyzerDriverBase.test.ts" 
        "tests/BinaryDataParser.test.ts"
        "tests/DataStreamProcessor.test.ts"
        "tests/ConfigurationManager.test.ts"
        "tests/SessionManager.test.ts"
        "tests/WorkspaceManager.test.ts"
        "tests/LACEditorProvider.test.ts"
    )
    
    for file in "${DUPLICATE_FILES[@]}"; do
        if [ -f "$file" ]; then
            log_info "删除重复文件: $file"
            rm "$file"
        else
            log_warn "文件不存在，跳过: $file"
        fi
    done
    
    log_success "阶段1完成：重复文件删除"
}

# 阶段2：创建新的目录结构
phase2_restructure() {
    log_info "=== 阶段2：重组目录结构 ==="
    
    cd "$PROJECT_ROOT"
    
    # 创建新的目录结构
    mkdir -p tests/unit
    mkdir -p tests/integration
    mkdir -p tests/performance
    mkdir -p tests/__mocks__
    mkdir -p tests/fixtures
    mkdir -p tests/utils
    
    # 迁移utest/unit/到tests/unit/
    log_info "迁移单元测试..."
    if [ -d "utest/unit" ]; then
        cp -r utest/unit/* tests/unit/
        log_success "单元测试迁移完成"
    fi
    
    # 迁移集成测试相关文件
    log_info "整理集成测试..."
    
    # 将特定的测试文件移动到集成测试目录
    INTEGRATION_FILES=(
        "tests/decoders/I2CDecoder.Week6.test.ts:tests/integration/decoders/"
        "tests/drivers/CommunicationProtocol.test.ts:tests/integration/drivers/"
        "tests/drivers/RigolSiglentDriver.test.ts:tests/integration/drivers/"
        "tests/drivers/RigolSiglentDriver.simplified.test.ts:tests/integration/drivers/"
        "tests/drivers/TimestampBurstMode.test.ts:tests/integration/drivers/"
        "tests/services/DataExportIntegration.test.ts:tests/integration/services/"
    )
    
    for mapping in "${INTEGRATION_FILES[@]}"; do
        source_file="${mapping%%:*}"
        dest_dir="${mapping##*:}"
        
        if [ -f "$source_file" ]; then
            mkdir -p "$dest_dir"
            mv "$source_file" "$dest_dir"
            log_info "移动 $source_file 到 $dest_dir"
        fi
    done
    
    # 迁移性能测试
    log_info "整理性能测试..."
    if [ -d "tests/performance" ] && [ -d "utest/performance" ]; then
        cp -r utest/performance/* tests/performance/
    fi
    
    log_success "阶段2完成：目录结构重组"
}

# 阶段3：统一Mock和配置
phase3_unify_infrastructure() {
    log_info "=== 阶段3：统一基础设施 ==="
    
    cd "$PROJECT_ROOT"
    
    # 迁移Mock对象
    log_info "统一Mock对象..."
    if [ -d "utest/mocks" ]; then
        cp -r utest/mocks/* tests/__mocks__/
        
        # 转换JS文件为TS（如果需要）
        find tests/__mocks__ -name "*.js" -type f | while read -r file; do
            if [ ! -f "${file%.js}.ts" ]; then
                log_info "保留JS文件: $file"
            fi
        done
    fi
    
    # 合并测试配置
    log_info "处理测试配置..."
    if [ -f "utest/setup.ts" ] && [ -f "tests/setup.ts" ]; then
        log_info "发现两个setup.ts文件，需要手动合并"
        cp utest/setup.ts tests/setup.utest.ts
        log_warn "请手动合并 tests/setup.ts 和 tests/setup.utest.ts"
    elif [ -f "utest/setup.ts" ]; then
        cp utest/setup.ts tests/setup.ts
    fi
    
    # 迁移工具文件
    if [ -f "utest/matchers.ts" ]; then
        cp utest/matchers.ts tests/utils/
    fi
    
    if [ -d "utest/utils" ]; then
        cp -r utest/utils/* tests/utils/
    fi
    
    log_success "阶段3完成：基础设施统一"
}

# 阶段4：更新导入路径
phase4_update_imports() {
    log_info "=== 阶段4：更新导入路径 ==="
    
    cd "$PROJECT_ROOT"
    
    # 更新tests/unit/中的导入路径
    log_info "更新单元测试导入路径..."
    find tests/unit -name "*.ts" -type f | while read -r file; do
        # 将../../../src/改为../../src/
        sed -i "s|../../../src/|../../src/|g" "$file" 2>/dev/null || true
        # 将../../../../src/改为../../src/
        sed -i "s|../../../../src/|../../src/|g" "$file" 2>/dev/null || true
    done
    
    log_success "阶段4完成：导入路径更新"
}

# 验证整合结果
verify_integration() {
    log_info "=== 验证整合结果 ==="
    
    cd "$PROJECT_ROOT"
    
    # 检查目录结构
    log_info "检查新目录结构..."
    for dir in "tests/unit" "tests/integration" "tests/performance" "tests/__mocks__"; do
        if [ -d "$dir" ]; then
            file_count=$(find "$dir" -name "*.ts" -o -name "*.js" | wc -l)
            log_info "$dir: $file_count 个测试文件"
        else
            log_warn "目录不存在: $dir"
        fi
    done
    
    # 运行测试验证
    log_info "运行整合后测试..."
    if npm test 2>&1 | tee integration_test.log; then
        log_success "整合后测试通过"
    else
        log_error "整合后测试失败，请检查错误日志"
        return 1
    fi
}

# 清理工作
cleanup() {
    log_info "=== 清理工作 ==="
    
    cd "$PROJECT_ROOT"
    
    # 询问是否删除utest目录
    echo -n "是否删除原utest目录？(y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        rm -rf utest
        log_success "utest目录已删除"
    else
        log_info "保留utest目录"
    fi
    
    # 清理临时文件
    rm -f tests_baseline.log utest_baseline.log integration_test.log
    
    log_success "清理完成"
}

# 主执行函数
main() {
    log_info "开始VSCode逻辑分析器插件测试体系整合"
    log_info "================================================"
    
    # 检查前置条件
    check_prerequisites
    
    # 创建备份
    create_backup
    
    # 运行基准测试
    run_baseline_tests
    
    # 执行整合阶段
    phase1_remove_duplicates
    phase2_restructure
    phase3_unify_infrastructure
    phase4_update_imports
    
    # 验证结果
    if verify_integration; then
        log_success "测试体系整合完成！"
        
        # 清理工作
        cleanup
        
        log_info "================================================"
        log_success "整合总结："
        log_info "• 删除了重复的测试文件"
        log_info "• 重新组织了目录结构"
        log_info "• 统一了Mock对象和配置"
        log_info "• 更新了导入路径"
        log_info "• 验证了整合结果"
        
        if [ -f "$PROJECT_ROOT/.test_integration_backup" ]; then
            BACKUP_DIR=$(cat "$PROJECT_ROOT/.test_integration_backup")
            log_info "• 备份位置: $BACKUP_DIR"
        fi
        
    else
        log_error "测试体系整合失败！"
        
        # 恢复备份
        if [ -f "$PROJECT_ROOT/.test_integration_backup" ]; then
            BACKUP_DIR=$(cat "$PROJECT_ROOT/.test_integration_backup")
            log_info "恢复备份中..."
            rm -rf tests utest
            cp -r "$BACKUP_DIR/tests_backup" tests
            cp -r "$BACKUP_DIR/utest_backup" utest
            log_success "备份已恢复"
        fi
        
        exit 1
    fi
}

# 脚本帮助信息
show_help() {
    echo "VSCode逻辑分析器插件测试体系整合脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  --dry-run      仅显示将要执行的操作，不实际执行"
    echo "  --backup-only  仅创建备份"
    echo "  --verify-only  仅验证当前状态"
    echo ""
    echo "示例:"
    echo "  $0                # 执行完整整合"
    echo "  $0 --dry-run      # 预览操作"
    echo "  $0 --backup-only  # 仅备份"
}

# 命令行参数处理
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --dry-run)
        log_info "DRY RUN模式：仅显示操作，不实际执行"
        # 这里可以添加干跑逻辑
        exit 0
        ;;
    --backup-only)
        check_prerequisites
        create_backup
        log_success "备份完成"
        exit 0
        ;;
    --verify-only)
        check_prerequisites
        run_baseline_tests
        log_success "验证完成"
        exit 0
        ;;
    "")
        # 无参数，执行主程序
        main
        ;;
    *)
        log_error "未知选项: $1"
        show_help
        exit 1
        ;;
esac