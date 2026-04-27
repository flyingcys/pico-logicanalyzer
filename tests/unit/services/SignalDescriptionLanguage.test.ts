import {
  SignalDescriptionLanguage,
  SignalDslParseError
} from '../../../src/services/SignalDescriptionLanguage';
import { LACFileFormat } from '../../../src/models/LACFileFormat';

describe('SignalDescriptionLanguage', () => {
  it('parses a compact signal description into typed statements', () => {
    const program = SignalDescriptionLanguage.parse(`
      # 1 MHz synthetic capture
      sample_rate 1000000
      samples 8
      channel 0 CLK clock period=4 duty=0.5
      channel 1 DATA pattern bits=1010 repeat=true
      channel 2 CS constant value=1
      channel 3 IRQ pulse start=2 width=3 value=1
    `);

    expect(program.sampleRate).toBe(1000000);
    expect(program.sampleCount).toBe(8);
    expect(program.channels).toHaveLength(4);
    expect(program.channels[0]).toMatchObject({
      channelNumber: 0,
      name: 'CLK',
      waveform: { kind: 'clock', period: 4, duty: 0.5, phase: 0 }
    });
    expect(program.channels[1]).toMatchObject({
      channelNumber: 1,
      name: 'DATA',
      waveform: { kind: 'pattern', bits: '1010', repeat: true, step: 1 }
    });
  });

  it('generates CaptureSession samples for clock, pattern, constant and pulse waveforms', () => {
    const session = SignalDescriptionLanguage.generateCaptureSession(`
      sample_rate 2000000
      samples 8
      channel 0 CLK clock period=4 duty=0.5
      channel 1 DATA pattern bits=10 repeat=true
      channel 2 CS constant value=1
      channel 3 IRQ pulse start=2 width=3 value=1
    `);

    expect(session.frequency).toBe(2000000);
    expect(session.preTriggerSamples).toBe(0);
    expect(session.postTriggerSamples).toBe(8);
    expect(session.captureChannels.map(channel => channel.channelName)).toEqual([
      'CLK',
      'DATA',
      'CS',
      'IRQ'
    ]);
    expect(Array.from(session.captureChannels[0].samples ?? [])).toEqual([1, 1, 0, 0, 1, 1, 0, 0]);
    expect(Array.from(session.captureChannels[1].samples ?? [])).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    expect(Array.from(session.captureChannels[2].samples ?? [])).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(Array.from(session.captureChannels[3].samples ?? [])).toEqual([0, 0, 1, 1, 1, 0, 0, 0]);
  });

  it('creates an original-compatible LAC payload with PascalCase Settings and packed Samples', () => {
    const session = SignalDescriptionLanguage.generateCaptureSession(`
      sample_rate 1000000
      samples 4
      channel 0 A pattern bits=1010
      channel 1 B pattern bits=0101
    `);

    const exported = LACFileFormat.createFromCaptureSession(session, undefined, true);

    expect(exported.Settings).toBe(session);
    expect(exported.Samples).toEqual([
      '00000000000000000000000000000001',
      '00000000000000000000000000000002',
      '00000000000000000000000000000001',
      '00000000000000000000000000000002'
    ]);
    expect((exported as any).settings).toBeUndefined();
  });

  it('rejects invalid signal descriptions with line numbers', () => {
    expect(() => SignalDescriptionLanguage.parse(`
      sample_rate 0
      samples 8
      channel 24 BAD constant value=1
    `)).toThrow(SignalDslParseError);

    expect(() => SignalDescriptionLanguage.parse(`
      sample_rate 1000000
      samples 8
      channel 0 BAD pattern bits=102
    `)).toThrow(/line 4/i);
  });
});
