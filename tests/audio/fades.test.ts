import { describe, expect, it } from 'vitest';
import {
  fadeIn,
  rampTo,
  scheduleEnvelope,
  sliderToGain,
} from '../../src/audio/FadeController';
import { FakeParam } from '../fakes/FakeAudioContext';

describe('FadeController', () => {
  it('schedules a fade in from silence to the target', () => {
    const param = new FakeParam(1);
    fadeIn(param, 0.8, 1.5, 10);

    expect(param.events).toHaveLength(3);
    expect(param.events[1]).toEqual({ type: 'set', value: 0, time: 10 });
    expect(param.events[2]).toEqual({ type: 'ramp', value: 0.8, time: 11.5 });
  });
  it('applies the target instantly when the duration is zero', () => {
    const param = new FakeParam(1);
    fadeIn(param, 0.5, 0, 4);
    expect(param.events.at(-1)).toEqual({ type: 'set', value: 0.5, time: 4 });
  });

  it('ramps to a new value over the requested duration', () => {
    const param = new FakeParam(1);
    rampTo(param, 0.25, 0.5, 2);
    expect(param.events[0]?.type).toBe('hold');
    expect(param.events[1]).toEqual({ type: 'set', value: 1, time: 2 });
    expect(param.events[2]).toEqual({ type: 'ramp', value: 0.25, time: 2.5 });
  });

  it('applies a value instantly when ramping with no duration', () => {
    const param = new FakeParam(1);
    rampTo(param, 0, 0, 3);
    expect(param.events.at(-1)).toEqual({ type: 'set', value: 0, time: 3 });
  });
});

describe('scheduleEnvelope', () => {
  it('fades in and out without overlapping', () => {
    const param = new FakeParam(1);
    scheduleEnvelope(param, {
      startTime: 0,
      durationSec: 10,
      fadeInSec: 2,
      fadeOutSec: 3,
      loop: false,
    });

    const types = param.events.map((event) => event.type);
    expect(types).toEqual(['hold', 'set', 'ramp', 'set', 'ramp']);

    // Fade in ramps from 0 to 1 between 0 and 2 seconds.
    expect(param.events[2]).toEqual({ type: 'ramp', value: 1, time: 2 });
    // Fade out starts at 10 - 3 = 7 seconds and ends at 10.
    expect(param.events[3]).toEqual({ type: 'set', value: 1, time: 7 });
    expect(param.events[4]).toEqual({ type: 'ramp', value: 0, time: 10 });
  });

  it('does not let the fade out overwrite the fade in on a short track', () => {
    const param = new FakeParam(1);
    scheduleEnvelope(param, {
      startTime: 0,
      durationSec: 1,
      fadeInSec: 0.6,
      fadeOutSec: 1.2,
      loop: false,
    });

    // The fade in has to be able to finish before the fade out starts.
    const fadeInRamp = param.events.find((event) => event.type === 'ramp');
    expect(fadeInRamp?.time).toBe(0.6);

    const lastRamp = param.events.filter((event) => event.type === 'ramp').at(-1);
    expect(lastRamp?.time).toBe(1);
  });

  it('skips the fade out when there is no room for it', () => {
    const param = new FakeParam(1);
    scheduleEnvelope(param, {
      startTime: 0,
      durationSec: 0.5,
      fadeInSec: 0.6,
      fadeOutSec: 1.2,
      loop: false,
    });

    // Solo está el fundido de entrada: no cabe un fundido de salida.
    expect(param.events.filter((event) => event.type === 'ramp')).toHaveLength(1);
  });

  it('does not apply a fade out when the track loops', () => {
    const param = new FakeParam(1);
    scheduleEnvelope(param, {
      startTime: 0,
      durationSec: 10,
      fadeInSec: 0,
      fadeOutSec: 3,
      loop: true,
    });

    const values = param.events.map((event) => event.value);
    expect(values).not.toContain(0);
  });

  it('handles a fade in that is longer than the track', () => {
    const param = new FakeParam(1);
    scheduleEnvelope(param, {
      startTime: 0,
      durationSec: 1,
      fadeInSec: 5,
      fadeOutSec: 0,
      loop: false,
    });

    const ramp = param.events.find((event) => event.type === 'ramp');
    expect(ramp?.value).toBe(1);
  });
});

describe('sliderToGain', () => {
  it('maps the slider range to a perceptual curve', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToGain(0.5)).toBeCloseTo(0.25);
    expect(sliderToGain(2)).toBe(1);
    expect(sliderToGain(-1)).toBe(0);
  });
});
