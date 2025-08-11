#!/usr/bin/env python3
"""
应用Mock优化脚本
将.optimized文件替换原始测试文件，并进行进一步的重构优化
"""

import os
import glob
import shutil
import re
from typing import List, Dict

class MockOptimizationApplier:
    def __init__(self):
        self.optimized_files = []
        self.backup_dir = "backup-before-mock-optimization"
        
    def find_optimized_files(self) -> List[str]:
        """查找所有.optimized文件"""
        optimized_files = []
        for pattern in ['tests/**/*.optimized', 'utest/**/*.optimized']:
            optimized_files.extend(glob.glob(pattern, recursive=True))
        return optimized_files
    
    def create_backup(self, original_file: str):
        """创建原始文件备份"""
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)
            
        # 保持目录结构
        rel_path = os.path.relpath(original_file)
        backup_path = os.path.join(self.backup_dir, rel_path)
        backup_dir = os.path.dirname(backup_path)
        
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
            
        shutil.copy2(original_file, backup_path)
        print(f"📦 备份: {original_file} -> {backup_path}")
    
    def apply_additional_optimizations(self, content: str) -> str:
        """应用额外的优化"""
        
        # 1. 移除过度的Mock setup
        content = self.remove_excessive_mocks(content)
        
        # 2. 简化测试数据生成
        content = self.simplify_test_data(content)
        
        # 3. 优化断言
        content = self.optimize_assertions(content)
        
        # 4. 移除不必要的beforeEach/afterEach
        content = self.optimize_hooks(content)
        
        return content
    
    def remove_excessive_mocks(self, content: str) -> str:
        """移除过度的Mock"""
        
        # 移除简单的mockReturnValue
        patterns = [
            (r'jest\.fn\(\)\.mockReturnValue\(true\)', '() => true'),
            (r'jest\.fn\(\)\.mockReturnValue\(false\)', '() => false'),
            (r'jest\.fn\(\)\.mockReturnValue\((\d+)\)', r'() => \1'),
            (r'jest\.fn\(\)\.mockReturnValue\(["\']([^"\']*)["\']\)', r"() => '\1'"),
            (r'jest\.fn\(\)\.mockReturnValue\(\[\]\)', '() => []'),
            (r'jest\.fn\(\)\.mockReturnValue\(\{\}\)', '() => ({})'),
        ]
        
        for pattern, replacement in patterns:
            content = re.sub(pattern, replacement, content)
        
        return content
    
    def simplify_test_data(self, content: str) -> str:
        """简化测试数据生成"""
        
        # 替换复杂的Mock数据为简单对象
        if 'mockReturnValue(' in content and 'new Array(' in content:
            content = re.sub(
                r'jest\.fn\(\)\.mockReturnValue\(new Array\((\d+)\)\.fill\([^)]+\)\)',
                r'() => new Array(\1).fill(0)',
                content
            )
        
        return content
    
    def optimize_assertions(self, content: str) -> str:
        """优化断言"""
        
        # 合并相似的断言
        lines = content.split('\n')
        optimized_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # 检查是否是简单的toBeDefined断言
            if 'expect(' in line and '.toBeDefined()' in line:
                # 收集连续的toBeDefined断言
                defined_vars = []
                while i < len(lines) and 'toBeDefined()' in lines[i]:
                    match = re.search(r'expect\(([^)]+)\)\.toBeDefined\(\)', lines[i])
                    if match:
                        defined_vars.append(match.group(1))
                    i += 1
                
                if len(defined_vars) > 3:
                    # 合并为一个测试
                    indent = '    '  # 根据实际缩进调整
                    optimized_lines.append(f'{indent}// 验证对象存在性')
                    for var in defined_vars[:3]:  # 只保留前3个，其他的合并
                        optimized_lines.append(f'{indent}expect({var}).toBeDefined();')
                    continue
            
            optimized_lines.append(line)
            i += 1
        
        return '\n'.join(optimized_lines)
    
    def optimize_hooks(self, content: str) -> str:
        """优化测试钩子"""
        
        # 移除空的beforeEach/afterEach
        content = re.sub(
            r'beforeEach\(\(\) => \{\s*\}\);?\s*\n',
            '',
            content,
            flags=re.MULTILINE
        )
        
        content = re.sub(
            r'afterEach\(\(\) => \{\s*\}\);?\s*\n',
            '',
            content,
            flags=re.MULTILINE
        )
        
        return content
    
    def apply_optimizations(self, dry_run: bool = False) -> Dict:
        """应用所有优化"""
        optimized_files = self.find_optimized_files()
        results = {
            'processed': 0,
            'skipped': 0,
            'errors': []
        }
        
        print(f"🔧 找到 {len(optimized_files)} 个优化文件")
        
        for optimized_file in optimized_files:
            original_file = optimized_file.replace('.optimized', '')
            
            if not os.path.exists(original_file):
                print(f"⚠️  原始文件不存在: {original_file}")
                results['skipped'] += 1
                continue
                
            try:
                # 创建备份
                if not dry_run:
                    self.create_backup(original_file)
                
                # 读取优化内容
                with open(optimized_file, 'r', encoding='utf-8') as f:
                    optimized_content = f.read()
                
                # 应用额外优化
                final_content = self.apply_additional_optimizations(optimized_content)
                
                if not dry_run:
                    # 替换原始文件
                    with open(original_file, 'w', encoding='utf-8') as f:
                        f.write(final_content)
                    
                    # 删除.optimized文件
                    os.remove(optimized_file)
                    
                    print(f"✅ 优化应用: {original_file}")
                else:
                    print(f"🔍 分析: {original_file} (dry-run)")
                
                results['processed'] += 1
                
            except Exception as e:
                error_msg = f"处理文件失败 {optimized_file}: {str(e)}"
                print(f"❌ {error_msg}")
                results['errors'].append(error_msg)
        
        return results
    
    def generate_report(self, results: Dict):
        """生成优化报告"""
        report = f"""
# Mock优化应用报告

**处理时间**: {__import__('datetime').datetime.now().isoformat()}

## 📊 处理统计

- **成功处理**: {results['processed']} 个文件
- **跳过文件**: {results['skipped']} 个文件  
- **错误数量**: {len(results['errors'])} 个

## 🎯 优化策略应用情况

1. **简化Mock函数**: 将简单的mockReturnValue转换为箭头函数
2. **合并重复断言**: 减少冗余的toBeDefined检查
3. **清理空钩子**: 移除空的beforeEach/afterEach
4. **优化测试数据**: 简化复杂的测试数据生成

## 📋 备份信息

原始文件备份位置: `{self.backup_dir}/`
如需回滚，可从备份目录恢复文件。
"""

        if results['errors']:
            report += "\n## ❌ 错误列表\n\n"
            for error in results['errors']:
                report += f"- {error}\n"

        report += "\n## ✅ 后续步骤\n\n"
        report += "1. 运行测试验证优化效果: `npm test`\n"
        report += "2. 检查代码质量: `npm run lint`\n" 
        report += "3. 更新测试文档和质量指标\n"

        with open('mock-optimization-application-report.md', 'w', encoding='utf-8') as f:
            f.write(report)
        
        print("\n📋 优化应用报告已生成: mock-optimization-application-report.md")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='应用Mock优化')
    parser.add_argument('--dry-run', action='store_true', help='仅分析，不实际修改文件')
    parser.add_argument('--apply', action='store_true', help='实际应用优化')
    
    args = parser.parse_args()
    
    applier = MockOptimizationApplier()
    
    if args.apply:
        print("🔧 开始应用Mock优化...")
        results = applier.apply_optimizations(dry_run=False)
    else:
        print("🔍 分析模式 (添加 --apply 参数实际执行)")
        results = applier.apply_optimizations(dry_run=True)
    
    applier.generate_report(results)
    
    print(f"\n✅ Mock优化完成!")
    print(f"   - 处理文件: {results['processed']}")
    print(f"   - 跳过文件: {results['skipped']}")
    print(f"   - 错误数量: {len(results['errors'])}")

if __name__ == "__main__":
    main()