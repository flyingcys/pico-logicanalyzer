#!/usr/bin/env python3
"""
修复TypeScript类型错误
"""

import re
import os
from pathlib import Path

def fix_decoder_output_type():
    """修复DecoderOutputType枚举"""
    file_path = 'src/decoders/types.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 取消注释枚举成员
    content = re.sub(
        r'export enum DecoderOutputType \{[^}]+\}',
        '''export enum DecoderOutputType {
  ANNOTATION = 0, // OUTPUT_ANN
  PYTHON = 1, // OUTPUT_PYTHON
  BINARY = 2, // OUTPUT_BINARY
  LOGIC = 3, // OUTPUT_LOGIC
  META = 4 // OUTPUT_META
}''',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Fixed DecoderOutputType in {file_path}")

def fix_error_property():
    """修复_error -> error属性名"""
    files = [
        'src/decoders/DecoderManager.ts',
        'src/driver-sdk/examples/ExampleNetworkDriver.ts',
        'src/driver-sdk/templates/GenericDriverTemplate.ts',
        'src/driver-sdk/templates/NetworkDriverTemplate.ts',
        'src/decoders/DecoderBase.ts'
    ]
    
    for file_path in files:
        if not Path(file_path).exists():
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 修复返回对象中的_error为error
        content = re.sub(r'\b_error:', 'error:', content)
        
        # 修复_StreamingResult为StreamingResult
        content = re.sub(r'\b_StreamingResult\b', 'StreamingResult', content)
        
        # 修复options为_options（在某些地方）
        content = re.sub(r'readonly options:', 'readonly _options:', content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Fixed error property in {file_path}")

def fix_sample_rate():
    """修复sampleRate拼写错误"""
    files = [
        'src/webview/engines/TimeAxisRenderer.ts',
        'src/decoders/protocols/I2CDecoder.ts'
    ]
    
    for file_path in files:
        if not Path(file_path).exists():
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for i, line in enumerate(lines):
            # 修复特定行的sampleRate问题
            if file_path == 'src/webview/engines/TimeAxisRenderer.ts':
                if i + 1 == 120:
                    lines[i] = line.replace('sampleRate', 'this.sampleRate')
                elif i + 1 == 126:
                    lines[i] = line.replace('sampleRate', 'this.sampleRate')
                elif i + 1 == 299:
                    lines[i] = line.replace('_sampleRate', 'sampleRate')
                elif i + 1 == 305:
                    lines[i] = line.replace('_sampleRate', 'sampleRate')
                elif i + 1 in [532, 533, 536, 537, 540, 541]:
                    lines[i] = line.replace('data', '_data')
            elif file_path == 'src/decoders/protocols/I2CDecoder.ts':
                if i + 1 == 139:
                    lines[i] = line.replace('_sampleRate', 'sampleRate')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print(f"✅ Fixed sampleRate in {file_path}")

def fix_event_types():
    """修复事件类型问题"""
    files = [
        'src/webview/engines/InteractionEngine.ts',
        'src/webview/engines/WaveformRenderer.ts'
    ]
    
    for file_path in files:
        if not Path(file_path).exists():
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 修复事件类型
        # 将 Event 改为 MouseEvent 或 TouchEvent
        content = re.sub(
            r'private handleMouseDown\(event\?: Event\)',
            'private handleMouseDown(event?: MouseEvent)',
            content
        )
        content = re.sub(
            r'private handleMouseMove\(event\?: Event\)',
            'private handleMouseMove(event?: MouseEvent)',
            content
        )
        content = re.sub(
            r'private handleMouseUp\(event\?: Event\)',
            'private handleMouseUp(event?: MouseEvent)',
            content
        )
        content = re.sub(
            r'private handleTouchStart\(event\?: Event\)',
            'private handleTouchStart(event?: TouchEvent)',
            content
        )
        content = re.sub(
            r'private handleTouchMove\(event\?: Event\)',
            'private handleTouchMove(event?: TouchEvent)',
            content
        )
        content = re.sub(
            r'private handleWheel\(event\?: Event\)',
            'private handleWheel(event?: WheelEvent)',
            content
        )
        content = re.sub(
            r'private handleKeyDown\(event\?: Event\)',
            'private handleKeyDown(event?: KeyboardEvent)',
            content
        )
        
        # 添加事件存在性检查
        content = re.sub(
            r'(event\?\.clientX)',
            r'(event && event.clientX)',
            content
        )
        content = re.sub(
            r'(event\?\.clientY)',
            r'(event && event.clientY)',
            content
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Fixed event types in {file_path}")

def fix_decoder_base():
    """修复DecoderBase中的options属性"""
    file_path = 'src/decoders/DecoderBase.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 将抽象属性options改为_options
    content = re.sub(
        r'abstract readonly options:',
        'abstract readonly _options:',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Fixed DecoderBase options property")

def fix_streaming_decoder():
    """修复StreamingDecoder导入"""
    file_path = 'src/decoders/StreamingDecoder.ts'
    if Path(file_path).exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 确保导出StreamingResult
        if 'export interface StreamingResult' not in content:
            content = re.sub(
                r'interface StreamingResult',
                'export interface StreamingResult',
                content
            )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Fixed StreamingDecoder exports")

def main():
    print("🔧 开始修复TypeScript类型错误...")
    
    # 执行所有修复
    fix_decoder_output_type()
    fix_error_property()
    fix_sample_rate()
    fix_event_types()
    fix_decoder_base()
    fix_streaming_decoder()
    
    print("\n✅ TypeScript类型错误修复完成")

if __name__ == '__main__':
    main()