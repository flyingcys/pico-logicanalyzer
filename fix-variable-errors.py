#!/usr/bin/env python3
"""
修复TypeScript中的变量名错误
"""

import re
import os
from pathlib import Path

# 需要修复的文件和错误
fixes = {
    'src/decoders/DecoderManager.ts': [
        (503, 'error', '_error'),  # error -> _error
        (592, 'error', '_error'),
    ],
    'src/decoders/protocols/I2CDecoder.ts': [
        (139, 'sampleRate', '_sampleRate'),  # sampleRate -> _sampleRate
        (207, 'error', '_error'),
        (210, 'error', '_error'),
    ],
    'src/decoders/test-decoder-integration.ts': [
        (75, '_sampleRate', 'sampleRate'),  # _sampleRate -> sampleRate
        (95, 'error', '_error'),
        (178, 'error', '_error'),
    ],
    'src/decoders/tests/DecoderTestFramework.ts': [
        (242, 'error', '_error'),
    ],
    'src/decoders/week3-self-test.ts': [
        (132, 'error', '_error'),
        (186, '_error', 'error'),  # 函数参数需要反向修复
    ],
    'src/driver-sdk/examples/ExampleNetworkDriver.ts': [
        (35, 'port', '_port'),
        (54, '_params', 'params'),  # 参数名修复
        (216, 'session', '_session'),
        (223, 'session', '_session'),
        (224, 'session', '_session'),
        (225, 'session', '_session'),
        (228, 'session', '_session'),
        (229, 'session', '_session'),
        (230, 'session', '_session'),
        (231, 'session', '_session'),
        (448, 'error', '_error'),
    ],
    'src/driver-sdk/examples/ExampleSerialDriver.ts': [
        (44, '_params', 'params'),
        (110, 'args', '_args'),
        (111, 'args', '_args'),
        (131, 'session', '_session'),
        (134, 'session', '_session'),
        (156, 'session', '_session'),
        (158, 'session', '_session'),
    ],
    'src/driver-sdk/templates/GenericDriverTemplate.ts': [
        (109, '_params', 'params'),
        (129, 'error', '_error'),
        (231, 'error', '_error'),
        (296, 'session', '_session'),
        (300, 'session', '_session'),
        (304, 'session', '_session'),
        (367, 'error', '_error'),
        (407, 'session', '_session'),
        (413, 'session', '_session'),
        (424, 'session', '_session'),
        (429, 'error', '_error'),
        (442, 'session', '_session'),
    ],
    'src/driver-sdk/templates/NetworkDriverTemplate.ts': [
        (103, 'port', '_port'),
        (107, 'port', '_port'),
        (159, 'error', '_error'),
        (233, 'error', '_error'),
        (261, 'error', '_error'),
        (324, 'data', '_data'),
        (331, '_response', 'response'),
        (344, '_response', 'response'),
        (354, 'response', '_response'),
    ],
    'src/services/NetworkStabilityService.ts': [
        (155, '_error', 'error'),
        (361, '_error', 'error'),
        (657, '_error', 'error'),
    ],
    'src/utils/MemoryManager.ts': [
        (216, '_data', 'data'),
        (233, '_data', 'data'),
        (323, '_data', 'data'),
        (340, '_data', 'data'),
        (530, '_data', 'data'),
        (534, '_data', 'data'),
        (535, '_data', 'data'),
        (539, '_data', 'data'),
        (544, '_data', 'data'),
        (547, '_data', 'data'),
        (556, '_data', 'data'),
    ]
}

def fix_line(line, old_var, new_var):
    """修复一行中的变量名"""
    # 为了避免错误替换，使用单词边界
    pattern = r'\b' + re.escape(old_var) + r'\b'
    return re.sub(pattern, new_var, line)

def process_file(file_path, line_fixes):
    """处理单个文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        modified = False
        for line_num, old_var, new_var in line_fixes:
            # 行号从1开始，数组索引从0开始
            idx = line_num - 1
            if idx < len(lines):
                old_line = lines[idx]
                new_line = fix_line(old_line, old_var, new_var)
                if old_line != new_line:
                    lines[idx] = new_line
                    modified = True
                    print(f"  Line {line_num}: {old_var} -> {new_var}")
        
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            print(f"✅ Fixed: {file_path}")
            return True
        
        return False
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def fix_duplicate_imports():
    """修复重复导入"""
    file_path = 'src/decoders/protocols/I2CDecoder.ts'
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找所有导入语句
        lines = content.split('\n')
        import_map = {}
        new_lines = []
        
        for i, line in enumerate(lines):
            # 检查是否是导入语句
            match = re.match(r"^import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"];?", line)
            if match:
                imports = match.group(1).strip()
                module = match.group(2).strip()
                
                if module not in import_map:
                    import_map[module] = []
                    new_lines.append(line)
                
                # 解析导入项
                items = [item.strip() for item in imports.split(',')]
                import_map[module].extend(items)
            else:
                new_lines.append(line)
        
        # 合并重复的导入
        final_lines = []
        seen_modules = set()
        for line in new_lines:
            match = re.match(r"^import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"];?", line)
            if match:
                module = match.group(2).strip()
                if module not in seen_modules and module in import_map:
                    seen_modules.add(module)
                    unique_imports = list(set(import_map[module]))
                    merged_import = f"import {{ {', '.join(unique_imports)} }} from '{module}';"
                    final_lines.append(merged_import)
            else:
                final_lines.append(line)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(final_lines))
        
        print(f"✅ Fixed duplicate imports in {file_path}")
    except Exception as e:
        print(f"❌ Error fixing duplicate imports: {e}")

def fix_unused_variables():
    """修复未使用的变量"""
    files_to_fix = [
        ('src/decoders/DecoderManager.ts', ['StreamingResult']),
        ('src/decoders/test-decoder-integration.ts', ['AnalyzerChannel', 'sampleRate', 'mappingTest']),
        ('src/decoders/tests/DecoderTestFramework.ts', ['DecoderBase']),
        ('src/decoders/week3-self-test.ts', ['I2CDecoder']),
        ('src/driver-sdk/templates/GenericDriverTemplate.ts', ['CaptureMode']),
    ]
    
    for file_path, unused_vars in files_to_fix:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            for var in unused_vars:
                # 如果是导入语句中的变量，注释掉或添加下划线前缀
                pattern = r'(\b' + re.escape(var) + r'\b)'
                # 只在导入语句中修改
                import_pattern = r'(import\s+\{[^}]*)\b' + re.escape(var) + r'\b([^}]*\})'
                content = re.sub(import_pattern, r'\1_' + var + r'\2', content)
                
                # 对于局部变量，添加下划线前缀
                local_pattern = r'(const|let|var)\s+' + re.escape(var) + r'\b'
                content = re.sub(local_pattern, r'\1 _' + var, content)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✅ Fixed unused variables in {file_path}")
        except Exception as e:
            print(f"❌ Error fixing unused variables in {file_path}: {e}")

def fix_unreachable_code():
    """修复不可达代码"""
    file_path = 'src/driver-sdk/templates/GenericDriverTemplate.ts'
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # 删除第525行的不可达代码
        if len(lines) > 524:
            # 检查是否是return语句后的代码
            if 'return' in lines[523]:
                # 注释掉不可达的代码
                lines[524] = '      // ' + lines[524].lstrip()
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        
        print(f"✅ Fixed unreachable code in {file_path}")
    except Exception as e:
        print(f"❌ Error fixing unreachable code: {e}")

def main():
    print("🔧 开始修复TypeScript变量名错误...")
    
    fixed_count = 0
    
    # 修复变量名错误
    for file_path, line_fixes in fixes.items():
        if Path(file_path).exists():
            if process_file(file_path, line_fixes):
                fixed_count += 1
    
    # 修复重复导入
    fix_duplicate_imports()
    
    # 修复未使用的变量
    fix_unused_variables()
    
    # 修复不可达代码
    fix_unreachable_code()
    
    print(f"\n✅ 总共修复了 {fixed_count} 个文件")

if __name__ == '__main__':
    main()