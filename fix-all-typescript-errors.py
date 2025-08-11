#!/usr/bin/env python3
"""
全面修复TypeScript编译错误
"""

import re
import os
from pathlib import Path

def fix_variable_names():
    """修复所有变量名错误"""
    
    # 需要修复的文件列表
    files_to_fix = []
    
    # 收集所有.ts文件
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.ts'):
                files_to_fix.append(os.path.join(root, file))
    
    # 变量名映射规则
    replacements = {
        # 在函数参数中
        r'\(([^)]*)\bsession\b': r'(\1_session',
        r'\(([^)]*)\boptions\b': r'(\1_options',
        r'\(([^)]*)\berror\b': r'(\1_error',
        r'\(([^)]*)\bdata\b': r'(\1_data',
        r'\(([^)]*)\bport\b': r'(\1_port',
        r'\(([^)]*)\bargs\b': r'(\1_args',
        r'\(([^)]*)\bparams\b': r'(\1_params',
        r'\(([^)]*)\bevent\b': r'(\1_event',
        r'\(([^)]*)\bresponse\b': r'(\1_response',
        r'\(([^)]*)\brinfo\b': r'(\1_rinfo',
        
        # 在函数体中使用
        r'(?<!\.)(?<!_)\bsession\.': '_session.',
        r'(?<!\.)(?<!_)\boptions\.': '_options.',
        r'(?<!\.)(?<!_)\berror\.': '_error.',
        r'(?<!\.)(?<!_)\bdata\.': '_data.',
        r'(?<!\.)(?<!_)\bport(?!\w)': '_port',
        r'(?<!\.)(?<!_)\bargs\.': '_args.',
        r'(?<!\.)(?<!_)\bparams\.': '_params.',
        r'(?<!\.)(?<!_)\bevent\.': '_event.',
        r'(?<!\.)(?<!_)\bresponse\.': '_response.',
        
        # 在对象中使用
        r'(?<![\'"])session(?![\'":])': '_session',
        r'(?<![\'"])options(?![\'":])': '_options',
        r'(?<![\'"])error(?![\'":])': '_error',
        r'(?<![\'"])data(?![\'":])': '_data',
    }
    
    fixed_count = 0
    
    for file_path in files_to_fix:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # 应用替换规则
            for pattern, replacement in replacements.items():
                content = re.sub(pattern, replacement, content)
            
            # 特殊处理：修复具体的模式
            # 修复 catch 块中的 error
            content = re.sub(
                r'catch \(error\)',
                'catch (_error)',
                content
            )
            content = re.sub(
                r'catch \(e\)',
                'catch (_error)',
                content
            )
            
            # 修复函数参数
            content = re.sub(
                r'(\w+)\s*\(\s*session:',
                r'\1(_session:',
                content
            )
            content = re.sub(
                r'(\w+)\s*\(\s*options:',
                r'\1(_options:',
                content
            )
            content = re.sub(
                r'(\w+)\s*\(\s*data:',
                r'\1(_data:',
                content
            )
            content = re.sub(
                r'(\w+)\s*\(\s*error:',
                r'\1(_error:',
                content
            )
            content = re.sub(
                r'(\w+)\s*\(\s*event:',
                r'\1(_event:',
                content
            )
            
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                fixed_count += 1
                print(f"✅ Fixed: {file_path}")
        
        except Exception as e:
            print(f"❌ Error fixing {file_path}: {e}")
    
    return fixed_count

def fix_decoder_base():
    """修复DecoderBase的options属性"""
    file_path = 'src/decoders/DecoderBase.ts'
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 确保是_options而不是options
        content = re.sub(
            r'abstract readonly options:',
            'abstract readonly _options:',
            content
        )
        
        # 修复getInfo方法
        content = re.sub(
            r'options: this\.options',
            '_options: this._options',
            content
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Fixed DecoderBase.ts")
    except Exception as e:
        print(f"❌ Error fixing DecoderBase.ts: {e}")

def fix_streaming_result():
    """修复StreamingResult的导入"""
    file_path = 'src/decoders/StreamingDecoder.ts'
    if Path(file_path).exists():
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 确保StreamingResult被导出
            if 'export interface StreamingResult' not in content:
                content = re.sub(
                    r'interface StreamingResult',
                    'export interface StreamingResult',
                    content
                )
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed StreamingDecoder.ts")
        except Exception as e:
            print(f"❌ Error fixing StreamingDecoder.ts: {e}")

def fix_event_types():
    """修复事件类型"""
    files = [
        'src/webview/engines/InteractionEngine.ts',
        'src/webview/engines/WaveformRenderer.ts'
    ]
    
    for file_path in files:
        if not Path(file_path).exists():
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 修复事件处理器类型
            replacements = {
                r'handleMouseDown\(event\?: Event\)': 'handleMouseDown(event?: MouseEvent)',
                r'handleMouseMove\(event\?: Event\)': 'handleMouseMove(event?: MouseEvent)',
                r'handleMouseUp\(event\?: Event\)': 'handleMouseUp(event?: MouseEvent)',
                r'handleTouchStart\(event\?: Event\)': 'handleTouchStart(event?: TouchEvent)',
                r'handleTouchMove\(event\?: Event\)': 'handleTouchMove(event?: TouchEvent)',
                r'handleTouchEnd\(event\?: Event\)': 'handleTouchEnd(event?: TouchEvent)',
                r'handleWheel\(event\?: Event\)': 'handleWheel(event?: WheelEvent)',
                r'handleKeyDown\(event\?: Event\)': 'handleKeyDown(event?: KeyboardEvent)',
                r'handleKeyUp\(event\?: Event\)': 'handleKeyUp(event?: KeyboardEvent)',
                r'handleClick\(event\?: Event\)': 'handleClick(event?: MouseEvent)',
                r'handleDoubleClick\(event\?: Event\)': 'handleDoubleClick(event?: MouseEvent)',
                r'handleContextMenu\(event\?: Event\)': 'handleContextMenu(event?: MouseEvent)',
            }
            
            for pattern, replacement in replacements.items():
                content = re.sub(pattern, replacement, content)
            
            # 添加类型守卫
            content = re.sub(
                r'if \(event\)',
                'if (event)',
                content
            )
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed event types in {file_path}")
        
        except Exception as e:
            print(f"❌ Error fixing {file_path}: {e}")

def fix_specific_files():
    """修复特定文件的问题"""
    
    # 修复I2CDecoder.ts
    file_path = 'src/decoders/protocols/I2CDecoder.ts'
    if Path(file_path).exists():
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # 删除重复的导入
            new_lines = []
            seen_imports = set()
            for line in lines:
                if 'import' in line and '../types' in line:
                    if '../types' not in seen_imports:
                        seen_imports.add('../types')
                        new_lines.append(line)
                else:
                    new_lines.append(line)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            print(f"✅ Fixed I2CDecoder.ts")
        except Exception as e:
            print(f"❌ Error fixing I2CDecoder.ts: {e}")
    
    # 修复DecoderManager.ts
    file_path = 'src/decoders/DecoderManager.ts'
    if Path(file_path).exists():
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 修复StreamingResult导入
            content = re.sub(
                r'import \{([^}]*?)_StreamingResult',
                r'import {\1StreamingResult',
                content
            )
            
            # 修复error属性
            content = re.sub(
                r'\.error',
                r'.error',
                content
            )
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed DecoderManager.ts")
        except Exception as e:
            print(f"❌ Error fixing DecoderManager.ts: {e}")

def fix_vue_files():
    """修复Vue文件"""
    vue_files = []
    for root, dirs, files in os.walk('src/webview'):
        for file in files:
            if file.endswith('.vue'):
                vue_files.append(os.path.join(root, file))
    
    for file_path in vue_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 修复TypeScript部分的变量名
            if '<script' in content and 'lang="ts"' in content:
                # 提取script部分
                script_match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
                if script_match:
                    script_content = script_match.group(1)
                    original_script = script_content
                    
                    # 应用修复
                    script_content = re.sub(r'\berror\b(?!:)', '_error', script_content)
                    script_content = re.sub(r'\bdata\b(?!:)', '_data', script_content)
                    script_content = re.sub(r'\bevent\b(?!:)', '_event', script_content)
                    
                    if script_content != original_script:
                        content = content.replace(original_script, script_content)
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"✅ Fixed Vue file: {file_path}")
        
        except Exception as e:
            print(f"❌ Error fixing {file_path}: {e}")

def main():
    print("🔧 开始全面修复TypeScript编译错误...")
    
    # 1. 修复变量名
    print("\n1. 修复变量名...")
    fixed = fix_variable_names()
    print(f"   修复了 {fixed} 个文件")
    
    # 2. 修复DecoderBase
    print("\n2. 修复DecoderBase...")
    fix_decoder_base()
    
    # 3. 修复StreamingResult
    print("\n3. 修复StreamingResult...")
    fix_streaming_result()
    
    # 4. 修复事件类型
    print("\n4. 修复事件类型...")
    fix_event_types()
    
    # 5. 修复特定文件
    print("\n5. 修复特定文件...")
    fix_specific_files()
    
    # 6. 修复Vue文件
    print("\n6. 修复Vue文件...")
    fix_vue_files()
    
    print("\n✅ 全面修复完成！")

if __name__ == '__main__':
    main()