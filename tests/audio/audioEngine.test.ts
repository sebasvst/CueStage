import { beforeEach, describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { FakeAudioContext, type FakeGainNode } from '../fakes/FakeAudioContext';

function makeEngine(bufferDuration = 4): {
  engine: AudioEngine;
  context: FakeAudioContext;
} {
  const context = new FakeAudioContext({ bufferDuration });
  const engine = new AudioEngine(() => context);
  return { engine, context };
}

async function decodedBuffer(context: FakeAudioContext) {
  return context.decodeAudioData(new ArrayBuffer(8));
}

describe('AudioEngine', () => {
  let engine: AudioEngine;
  let context: FakeAudioContext;

  beforeEach(async () => {
    ({ engine, context } = makeEngine());
    await engine.init();
  });

  it('creates a single context and reports it as ready', () => {
    expect(context.gains.length).toBeGreaterThan(0);
    expect(engine.engineStatus).toBe('ready');
    expect(engine.contextState).toBe('running');
  });

  it('only initialises the context once', async () => {
    const before = context.gains.length;
    await engine.init();
    await engine.init();
    expect(context.gains.length).toBe(before);
  });

  it('builds the mixing graph: music and effects buses feed the master output', () => {
    const mixer = engine as unknown as { mixer: { music: FakeGainNode; sfx: FakeGainNode; master: FakeGainNode } };
    expect(mixer.mixer.music.connected).toBe(mixer.mixer.master);
    expect(mixer.mixer.sfx.connected).toBe(mixer.mixer.master);
    expect(mixer.mixer.master.connected).not.toBeNull();
    expect(mixer.mixer.master.connected).toBeInstanceOf(Object);
  });

  it('applies the volumes of music, effects and output independently', () => {
    engine.setMusicVolume(0.4);
    engine.setSfxVolume(0.7);
    engine.setMasterVolume(0.5);

    const volumes = engine.volumes;
    expect(volumes.music).toBeCloseTo(0.4);
    expect(volumes.sfx).toBeCloseTo(0.7);
    expect(volumes.master).toBeCloseTo(0.5);
  });

  it('clamps the volumes to the 0..1 range', () => {
    engine.setMusicVolume(4);
    engine.setSfxVolume(-2);
    expect(engine.volumes.music).toBe(1);
    expect(engine.volumes.sfx).toBe(0);
  });

  it('applies a perceptual curve so the bottom of the slider is usable', () => {
    const mixer = engine as unknown as {
      mixer: { music: FakeGainNode; sfx: FakeGainNode };
    };
    engine.setMusicVolume(0.5);
    engine.setSfxVolume(0.25);

    // 0,5 -> 0,25 de ganancia real; 0,25 -> 0,0625.
    expect(mixer.mixer.music.gain.value).toBeCloseTo(0.25, 3);
    expect(mixer.mixer.sfx.gain.value).toBeCloseTo(0.0625, 3);

    // El valor del mando sigue siendo el que se muestra en la interfaz.
    expect(engine.volumes.music).toBe(0.5);
    expect(engine.volumes.sfx).toBe(0.25);
  });
});

describe('Music playback', () => {
  let engine: AudioEngine;
  let context: FakeAudioContext;

  beforeEach(async () => {
    ({ engine, context } = makeEngine(10));
    await engine.init();
  });

  it('plays the main music and reports the position', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });

    expect(engine.playback.getMusicState().status).toBe('playing');
    expect(engine.playback.getMusicPosition()).toBe(0);

    context.advance(2);
    expect(engine.playback.getMusicPosition()).toBeCloseTo(2, 1);
  });

  it('keeps playing when an effect is triggered', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });
    context.advance(1);

    engine.playback.triggerPad({
      padId: 'pad-1',
      assetId: 'sfx-1',
      buffer,
      volume: 1,
      mode: 'once',
    });

    expect(engine.playback.getMusicState().status).toBe('playing');
    expect(engine.playback.getMusicPosition()).toBeCloseTo(1, 1);
    expect(engine.playback.getActiveEffectCount()).toBe(1);
  });

  it('pauses and resumes from the same position', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });
    context.advance(3);

    engine.playback.pauseMusic();
    expect(engine.playback.getMusicState().status).toBe('paused');
    expect(engine.playback.getMusicPosition()).toBeCloseTo(3, 1);

    context.advance(5);
    expect(engine.playback.getMusicPosition()).toBeCloseTo(3, 1);

    engine.playback.resumeMusic();
    expect(engine.playback.getMusicState().status).toBe('playing');

    context.advance(1);
    expect(engine.playback.getMusicPosition()).toBeCloseTo(4, 1);
  });

  it('seeks to an arbitrary position', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });
    context.advance(1);

    engine.playback.seekMusic(6);
    expect(engine.playback.getMusicPosition()).toBeCloseTo(6, 1);

    context.advance(1);
    expect(engine.playback.getMusicPosition()).toBeCloseTo(7, 1);
  });

  it('seeks while paused without starting the playback', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });
    context.advance(2);
    engine.playback.pauseMusic();

    engine.playback.seekMusic(5);
    expect(engine.playback.getMusicState().status).toBe('paused');
    expect(engine.playback.getMusicPosition()).toBeCloseTo(5, 1);
  });

  it('stops the music and rewinds the position', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });
    context.advance(3);

    engine.playback.stopMusic();
    expect(engine.playback.getMusicState().status).toBe('idle');
    expect(engine.playback.getMusicPosition()).toBe(0);
  });

  it('goes back to idle when the track finishes', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });
    context.advance(11);

    expect(engine.playback.getMusicState().status).toBe('idle');
    expect(engine.playback.getMusicPosition()).toBeCloseTo(10, 1);
  });
});

describe('Effects', () => {
  let engine: AudioEngine;
  let context: FakeAudioContext;

  beforeEach(async () => {
    ({ engine, context } = makeEngine(3));
    await engine.init();
  });

  it('plays several effects at the same time', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.triggerPad({
      padId: 'pad-1',
      assetId: 'sfx-1',
      buffer,
      volume: 1,
      mode: 'once',
    });
    engine.playback.triggerPad({
      padId: 'pad-2',
      assetId: 'sfx-2',
      buffer,
      volume: 1,
      mode: 'once',
    });
    engine.playback.triggerPad({
      padId: 'pad-3',
      assetId: 'sfx-3',
      buffer,
      volume: 1,
      mode: 'once',
    });

    expect(engine.playback.getActiveEffectCount()).toBe(3);
    expect(context.sources).toHaveLength(3);
  });

  it('does not accumulate sources when the same pad is pressed repeatedly', async () => {
    const buffer = await decodedBuffer(context);
    for (let i = 0; i < 5; i += 1) {
      engine.playback.triggerPad({
        padId: 'pad-1',
        assetId: 'sfx-1',
        buffer,
        volume: 1,
        mode: 'once',
      });
    }

    // Only one full voice is active at a time.
    expect(engine.playback.getActiveEffectCount()).toBe(1);
    expect(engine.playback.isPadActive('pad-1')).toBe(true);

    // Once the short fade of the replaced voices finishes, they are released.
    context.advance(0.05);
    const alive = context.sources.filter((source) => !source.ended);
    expect(alive).toHaveLength(1);
  });

  it('keeps a looping effect alive until it is stopped', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.triggerPad({
      padId: 'pad-loop',
      assetId: 'sfx-loop',
      buffer,
      volume: 1,
      mode: 'loop',
    });

    context.advance(10);
    expect(engine.playback.getActiveEffectCount()).toBe(1);

    engine.playback.stopPad('pad-loop', 0);
    expect(engine.playback.getActiveEffectCount()).toBe(0);
  });

  it('releases the resources when an effect finishes', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.triggerPad({
      padId: 'pad-1',
      assetId: 'sfx-1',
      buffer,
      volume: 1,
      mode: 'once',
    });

    context.advance(4);
    expect(engine.playback.getActiveEffectCount()).toBe(0);
    expect(engine.playback.isPadActive('pad-1')).toBe(false);
  });

  it('applies the individual volume of the pad', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.triggerPad({
      padId: 'pad-1',
      assetId: 'sfx-1',
      buffer,
      volume: 0.5,
      mode: 'once',
    });

    const source = context.sources[0];
    // The slider uses a perceptual curve: 0,5 → 0,25 de ganancia real.
    expect(source?.connected?.gain.value).toBeCloseTo(0.25, 2);
  });

  it('stops a single effect without touching the others', async () => {
    const buffer = await decodedBuffer(context);
    engine.playback.triggerPad({
      padId: 'pad-1',
      assetId: 'sfx-1',
      buffer,
      volume: 1,
      mode: 'once',
    });
    engine.playback.triggerPad({
      padId: 'pad-2',
      assetId: 'sfx-2',
      buffer,
      volume: 1,
      mode: 'once',
    });

    engine.playback.stopPad('pad-1', 0);
    expect(engine.playback.getActiveEffectCount()).toBe(1);
    expect(engine.playback.isPadActive('pad-2')).toBe(true);
  });
});

describe('Emergency stop', () => {
  it('stops the music and every effect', async () => {
    const context = new FakeAudioContext({ bufferDuration: 10 });
    const engine = new AudioEngine(() => context);
    await engine.init();

    const buffer = await decodedBuffer(context);
    engine.playback.playMusic({ assetId: 'music-1', buffer });
    engine.playback.triggerPad({
      padId: 'pad-1',
      assetId: 'sfx-1',
      buffer,
      volume: 1,
      mode: 'loop',
    });

    engine.stopAll();

    expect(engine.playback.getMusicState().status).toBe('idle');
    expect(engine.playback.getActiveEffectCount()).toBe(0);
  });

  it('silences the output before stopping the sources', async () => {
    const context = new FakeAudioContext({ bufferDuration: 10 });
    const engine = new AudioEngine(() => context);
    await engine.init();

    const mixer = engine as unknown as { mixer: { master: FakeGainNode } };
    mixer.mixer.master.gain.value = 0.9;

    engine.stopAll();
    expect(mixer.mixer.master.gain.value).toBe(0);
  });

  it('restores the output level after the emergency stop', async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeAudioContext({ bufferDuration: 10 });
      const engine = new AudioEngine(() => context);
      await engine.init();

      engine.setMasterVolume(0.8);
      const mixer = engine as unknown as { mixer: { master: FakeGainNode } };
      engine.stopAll();

      expect(mixer.mixer.master.gain.value).toBe(0);
      vi.advanceTimersByTime(200);
      // 0,8 en el mando equivale a 0,64 de ganancia real (curva perceptual).
      expect(mixer.mixer.master.gain.value).toBeCloseTo(0.64, 2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Buffer cache', () => {
  it('decodes each asset only once', async () => {
    const context = new FakeAudioContext();
    let decodeCalls = 0;
    const engine = new AudioEngine(() => context);
    const original = context.decodeAudioData.bind(context);
    context.decodeAudioData = async (data: ArrayBuffer) => {
      decodeCalls += 1;
      return original(data);
    };
    await engine.decode('asset-1', new ArrayBuffer(4));
    await engine.decode('asset-1', new ArrayBuffer(4));

    expect(decodeCalls).toBe(1);
    expect(engine.getBuffer('asset-1')).toBeDefined();
  });

  it('evicts the least recently used buffer when the budget is exceeded', async () => {
    const context = new FakeAudioContext({ bufferDuration: 10 });
    const engine = new AudioEngine(() => context);
    await engine.init();

    // 10 s * 48000 Hz * 2 channels * 4 bytes = 3.84 MB per buffer.
    const cache = engine.bufferCache;
    await engine.decode('a', new ArrayBuffer(4));
    await engine.decode('b', new ArrayBuffer(4));
    expect(cache.has('a')).toBe(true);

    // Shrink the budget to force an eviction.
    (cache as unknown as { budgetBytes: number }).budgetBytes = 1;
    await engine.decode('c', new ArrayBuffer(4));
    expect(cache.has('a')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });
});
