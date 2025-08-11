#!/usr/bin/env python3
"""
最终修复脚本
"""

import re
import os
from pathlib import Path

def fix_remaining_issues():
    """修复剩余的问题"""
    
    # 1. 修复I2CDecoder.ts中的重复导入和未定义变量
    file_path = 'src/decoders/protocols/I2CDecoder.ts'
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
    
    # 修复第139行的sampleRate
    for i, line in enumerate(new_lines):
        if i == 138:  # 第139行（索引138）
            new_lines[i] = line.replace('this.sampleRate = sampleRate;', 'this.sampleRate = _sampleRate;')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"✅ Fixed I2CDecoder.ts")
    
    # 2. 修复test-decoder-integration.ts
    file_path = 'src/decoders/test-decoder-integration.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复未使用的导入
    content = content.replace('AnalyzerChannel', '_AnalyzerChannel')
    # 修复第75行的sampleRate
    content = re.sub(r'(\n\s+)(sampleRate)(\s*,)', r'\1_sampleRate\3', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Fixed test-decoder-integration.ts")
    
    # 3. 修复NetworkDriverTemplate.ts
    file_path = 'src/driver-sdk/templates/NetworkDriverTemplate.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    replacements = {
        90: "      reject: (_error: Error) => void;",
        362: "      if (_response.success !== false) {",
        365: "        pending.reject(new Error(_response.error || '命令执行失败'));",
        455: "      return _response.success === true;",
        489: "      const eventArgs: CaptureEventArgs = {",
        494: "        success: true,",
        495: "        session: _session",
        496: "      };",
        497: "",
        498: "      this.emitCaptureCompleted(eventArgs);",
        499: "    } catch (_error) {",
        550: "        this.handleCaptureError(_session, `监控采集失败: ${_error}`);\n",
        591: "        session: _session",
        596: "    this.handleCaptureError(_session, `获取数据失败: ${_error}`);\n",
        604: "    if (_data.channels && Array.isArray(_data.channels)) {",
        605: "      for (const channel of _session.captureChannels) {",
        606: "        const channelData = _data.channels.find((ch: any) => ch.number === channel.channelNumber);",
        630: "        session: _session"
    }
    
    for line_num, replacement in replacements.items():
        if line_num - 1 < len(lines):
            lines[line_num - 1] = replacement + '\n' if replacement else ''
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"✅ Fixed NetworkDriverTemplate.ts")
    
    # 4. 修复GenericDriverTemplate.ts
    file_path = 'src/driver-sdk/templates/GenericDriverTemplate.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复参数名
    content = content.replace('params?: ConnectionParams', '_params?: ConnectionParams')
    # 删除不可达代码
    content = re.sub(r'(\s+return \'N/A\';[^\n]*\n)\s+// \} catch.*\n\s+logger\.error.*\n\s+return \'ERROR\';\n', 
                     r'\1', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Fixed GenericDriverTemplate.ts")
    
    # 5. 修复DecoderManager.ts
    file_path = 'src/decoders/DecoderManager.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 添加下划线前缀
    content = re.sub(r'\bStreamingResult\b', '_StreamingResult', content, count=1)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Fixed DecoderManager.ts")

def main():
    print("🔧 开始最终修复...")
    fix_remaining_issues()
    print("\n✅ 最终修复完成")

if __name__ == '__main__':
    main()