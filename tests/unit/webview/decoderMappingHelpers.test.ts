import {
  findChannelByName,
  getVisibleChannelEntries,
  resolveI2CMapping
} from '../../../src/frontend/core/stores/decoderMappingHelpers';

describe('decoderMappingHelpers', () => {
  it('应保留原始采集索引并过滤隐藏通道', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'D0', hidden: true },
      { channelNumber: 1, channelName: 'SCL', hidden: false },
      { channelNumber: 2, channelName: 'SDA', hidden: false }
    ]);

    expect(visibleChannels).toEqual([
      { captureIndex: 1, channel: { channelNumber: 1, channelName: 'SCL', hidden: false } },
      { captureIndex: 2, channel: { channelNumber: 2, channelName: 'SDA', hidden: false } }
    ]);
  });

  it('应按命名通道解析 I2C 映射并避免 SCL/SDA 复用', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'SDA', hidden: false },
      { channelNumber: 1, channelName: 'SCL', hidden: false },
      { channelNumber: 2, channelName: 'D2', hidden: false }
    ]);

    expect(resolveI2CMapping(visibleChannels)).toEqual({
      sclCaptureIndex: 1,
      sdaCaptureIndex: 0
    });
  });

  it('命名通道不足时应按 channelNumber、位置、剩余通道顺序回退', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 4, channelName: 'D4', hidden: false },
      { channelNumber: 1, channelName: 'D1', hidden: false },
      { channelNumber: 7, channelName: 'D7', hidden: false }
    ]);

    expect(resolveI2CMapping(visibleChannels)).toEqual({
      sclCaptureIndex: 0,
      sdaCaptureIndex: 1
    });
  });

  it('全部通道隐藏时应返回空 I2C 映射', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'SCL', hidden: true },
      { channelNumber: 1, channelName: 'SDA', hidden: true }
    ]);

    expect(visibleChannels).toEqual([]);
    expect(resolveI2CMapping(visibleChannels)).toEqual({
      sclCaptureIndex: null,
      sdaCaptureIndex: null
    });
  });

  it('只有一个可见通道时应只映射一个 I2C 角色且不复用', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'SCL', hidden: false },
      { channelNumber: 1, channelName: 'SDA', hidden: true }
    ]);

    expect(resolveI2CMapping(visibleChannels)).toEqual({
      sclCaptureIndex: 0,
      sdaCaptureIndex: null
    });
  });

  it('应支持大小写混合的 I2C 命名并保留原始采集索引', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'D0', hidden: true },
      { channelNumber: 1, channelName: 'i2c_sDa', hidden: false },
      { channelNumber: 2, channelName: 'I2C_sCl', hidden: false }
    ]);

    expect(resolveI2CMapping(visibleChannels)).toEqual({
      sclCaptureIndex: 2,
      sdaCaptureIndex: 1
    });
  });

  it('重复命名候选时应按可见顺序选择且 SCL/SDA 不复用', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'SCL_SDA_COMBINED', hidden: false },
      { channelNumber: 1, channelName: 'SCL_BACKUP', hidden: false },
      { channelNumber: 2, channelName: 'SDA_PRIMARY', hidden: false },
      { channelNumber: 3, channelName: 'SDA_BACKUP', hidden: false }
    ]);

    expect(resolveI2CMapping(visibleChannels)).toEqual({
      sclCaptureIndex: 0,
      sdaCaptureIndex: 2
    });
  });

  it('复用带全局标志的命名正则时不应受 lastIndex 状态影响', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'CLK', hidden: false }
    ]);
    const globalClockPattern = /clk/ig;

    expect(findChannelByName(visibleChannels, [globalClockPattern])).toBe(0);
    expect(findChannelByName(visibleChannels, [globalClockPattern])).toBe(0);
  });

  it('使用带全局标志的命名正则后应将 lastIndex 恢复为 0', () => {
    const visibleChannels = getVisibleChannelEntries([
      { channelNumber: 0, channelName: 'CLK', hidden: false }
    ]);
    const globalClockPattern = /clk/ig;

    expect(findChannelByName(visibleChannels, [globalClockPattern])).toBe(0);
    expect(globalClockPattern.lastIndex).toBe(0);
  });
});
