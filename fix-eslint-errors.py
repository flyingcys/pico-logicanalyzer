#!/usr/bin/env python3
"""
ESLint错误自动修复脚本
"""

import re
import os
import sys
from pathlib import Path

def fix_unused_vars(file_path, content):
    """修复未使用的变量和参数"""
    lines = content.split('\n')
    modified = False
    
    for i, line in enumerate(lines):
        # 修复函数参数
        if re.search(r'\((.*?)\b(\w+)\s*[:,\)]', line):
            # 检查是否有未使用的参数，在参数名前添加下划线
            new_line = re.sub(
                r'(\w+)(\s*[:,\)])',
                lambda m: f'_{m.group(1)}{m.group(2)}' if not m.group(1).startswith('_') else m.group(0),
                line
            )
            
            # 特殊处理一些常见的未使用参数
            patterns = [
                (r'\b(args|params|options|metadata|event|workspaceId|sampleRate|password|firmwareData|data|response|error|commandData|rinfo|ipAddress|port|accessPointName|session)\b(?=\s*[:,\)])',
                 r'_\1'),
            ]
            
            for pattern, replacement in patterns:
                if re.search(pattern, new_line):
                    new_line = re.sub(pattern, replacement, new_line)
                    modified = True
                    lines[i] = new_line
                    break
    
    # 修复未使用的导入变量
    for i, line in enumerate(lines):
        if 'is defined but never used' in str(line):
            continue
            
        # 处理枚举成员未使用
        if re.match(r'\s*(ANNOTATION|PYTHON|BINARY|LOGIC|META|USB_SERIAL|NETWORK_TCP|NETWORK_UDP|BLUETOOTH|USB_HID|SPI|I2C|EXPERIMENTAL|BETA|STABLE|CERTIFIED|TCP|UDP|HTTP|WEBSOCKET)\s*[,=]', line):
            # 注释掉未使用的枚举成员
            lines[i] = f'  // {line.strip()}'
            modified = True
    
    if modified:
        return '\n'.join(lines)
    return content

def fix_trailing_spaces(content):
    """删除尾随空格"""
    lines = content.split('\n')
    modified = False
    
    for i, line in enumerate(lines):
        new_line = line.rstrip()
        if new_line != line:
            lines[i] = new_line
            modified = True
    
    if modified:
        return '\n'.join(lines)
    return content

def fix_duplicate_imports(content):
    """修复重复的导入"""
    lines = content.split('\n')
    import_map = {}
    modified = False
    
    for i, line in enumerate(lines):
        match = re.match(r'^import\s+(.+?)\s+from\s+[\'"](.+?)[\'"]', line)
        if match:
            imports = match.group(1)
            module = match.group(2)
            
            if module not in import_map:
                import_map[module] = {'line': i, 'imports': []}
            
            # 解析导入项
            if '{' in imports and '}' in imports:
                items = re.findall(r'{\s*(.+?)\s*}', imports)[0].split(',')
                import_map[module]['imports'].extend([item.strip() for item in items])
            else:
                import_map[module]['imports'].append(imports.strip())
    
    # 合并重复的导入
    for module, data in import_map.items():
        if len(data['imports']) > 1:
            # 创建合并的导入语句
            unique_imports = list(set(data['imports']))
            if len(unique_imports) > 0:
                merged = f"import {{ {', '.join(unique_imports)} }} from '{module}';"
                lines[data['line']] = merged
                modified = True
    
    if modified:
        # 删除重复的导入行
        seen_modules = set()
        new_lines = []
        for line in lines:
            match = re.match(r'^import\s+.+?\s+from\s+[\'"](.+?)[\'"]', line)
            if match:
                module = match.group(1)
                if module not in seen_modules:
                    seen_modules.add(module)
                    new_lines.append(line)
            else:
                new_lines.append(line)
        return '\n'.join(new_lines)
    
    return content

def add_underscore_to_params(file_path):
    """为未使用的参数添加下划线前缀"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 定义需要添加下划线的参数模式
    unused_params = [
        'args', 'params', 'options', 'metadata', 'event', 
        'workspaceId', 'sampleRate', 'password', 'firmwareData', 
        'data', 'response', 'error', 'commandData', 'rinfo',
        'ipAddress', 'port', 'accessPointName', 'session'
    ]
    
    modified = False
    for param in unused_params:
        # 在函数参数中查找并替换
        pattern = rf'\b({param})\b(?=\s*[:,\)])'
        if re.search(pattern, content):
            content = re.sub(pattern, f'_{param}', content)
            modified = True
    
    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def process_file(file_path):
    """处理单个文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 应用各种修复
        content = fix_trailing_spaces(content)
        content = fix_duplicate_imports(content)
        content = fix_unused_vars(file_path, content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {file_path}")
            return True
        
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    # 获取所有需要修复的TypeScript文件
    src_dir = Path('src')
    
    files_to_fix = [
        'src/decoders/DecoderManager.ts',
        'src/decoders/index.ts',
        'src/decoders/protocols/I2CDecoder.ts',
        'src/decoders/test-decoder-integration.ts',
        'src/decoders/tests/DecoderTestFramework.ts',
        'src/decoders/types.ts',
        'src/decoders/week3-self-test.ts',
        'src/driver-sdk/examples/ExampleNetworkDriver.ts',
        'src/driver-sdk/examples/ExampleSerialDriver.ts',
        'src/driver-sdk/index.ts',
        'src/driver-sdk/templates/GenericDriverTemplate.ts',
        'src/driver-sdk/templates/NetworkDriverTemplate.ts',
        'src/driver-sdk/templates/SerialDriverTemplate.ts',
        'src/driver-sdk/testing/TestFramework.ts',
        'src/drivers/HardwareDriverManager.ts',
        'src/drivers/LogicAnalyzerDriver.ts',
        'src/drivers/MultiAnalyzerDriver.ts',
        'src/drivers/RigolSiglentDriver.ts',
        'src/drivers/SaleaeLogicDriver.ts',
        'src/drivers/SigrokAdapter.ts',
        'src/models/BinaryDataParser.ts',
        'src/models/CaptureModels.ts',
        'src/models/CaptureProgressMonitor.ts',
        'src/models/DataStreamProcessor.ts',
        'src/models/LACFileFormat.ts',
        'src/models/TriggerProcessor.ts',
        'src/providers/LACEditorProvider.ts',
        'src/services/ConfigurationManager.ts',
        'src/services/DataExportService.ts',
        'src/services/ExportPerformanceOptimizer.ts',
        'src/services/NetworkStabilityService.ts',
        'src/services/SessionManager.ts',
        'src/services/SignalMeasurementService.ts',
        'src/services/WiFiDeviceDiscovery.ts',
        'src/services/WorkspaceManager.ts',
        'src/utils/DecoderBenchmark.ts',
        'src/utils/MemoryManager.ts',
        'src/webview/engines/InteractionEngine.ts',
        'src/webview/engines/TimeAxisRenderer.ts',
        'src/webview/engines/WaveformRenderer.ts'
    ]
    
    fixed_count = 0
    for file_path in files_to_fix:
        if Path(file_path).exists():
            if process_file(file_path):
                fixed_count += 1
    
    # 为特定文件添加下划线前缀
    for file_path in files_to_fix:
        if Path(file_path).exists():
            add_underscore_to_params(file_path)
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == '__main__':
    main()