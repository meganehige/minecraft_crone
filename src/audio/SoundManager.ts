import type { SoundGroup } from '../world/blocks/BlockType';

export type SoundKind = 'break' | 'place' | 'step' | 'dig';

export interface SoundCounts {
  break: number;
  place: number;
  step: number;
  dig: number;
}

interface GroupParams {
  /** Bandpass centre frequency (Hz). */
  freq: number;
  /** Filter Q. */
  q: number;
  /** Noisiness 0..1 (1 = pure noise, 0 = tonal). */
  noise: number;
}

const GROUPS: Record<SoundGroup, GroupParams> = {
  stone: { freq: 820, q: 1.2, noise: 0.85 },
  dirt: { freq: 300, q: 0.8, noise: 1.0 },
  grass: { freq: 1500, q: 0.7, noise: 1.0 },
  sand: { freq: 2200, q: 0.6, noise: 1.0 },
  wood: { freq: 520, q: 2.5, noise: 0.55 },
  leaves: { freq: 3200, q: 0.5, noise: 1.0 },
};

const KIND_GAIN: Record<SoundKind, number> = {
  break: 0.5,
  place: 0.4,
  step: 0.22,
  dig: 0.28,
};

const KIND_DURATION: Record<SoundKind, number> = {
  break: 0.26,
  place: 0.16,
  step: 0.12,
  dig: 0.09,
};

/**
 * Procedurally synthesises block sounds with Web Audio (no audio assets):
 * a short noise/tone burst through a per-material band-pass filter with a fast
 * decay and randomised pitch. Play counts are tracked unconditionally so
 * headless tests can verify that the right events fired even when no audio
 * device is present.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly counts: SoundCounts = { break: 0, place: 0, step: 0, dig: 0 };

  /** Create/resume the audio context (call from a user gesture). */
  resume(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.buildNoise();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio unavailable; counters still work */
    }
  }

  getCounts(): SoundCounts {
    return { ...this.counts };
  }

  playBreak(group: SoundGroup): void {
    this.play(group, 'break');
  }
  playPlace(group: SoundGroup): void {
    this.play(group, 'place');
  }
  playStep(group: SoundGroup): void {
    this.play(group, 'step');
  }
  playDig(group: SoundGroup): void {
    this.play(group, 'dig');
  }

  private play(group: SoundGroup, kind: SoundKind): void {
    this.counts[kind] += 1; // count regardless of audio availability
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || ctx.state !== 'running') return;
    try {
      const p = GROUPS[group];
      const now = ctx.currentTime;
      const dur = KIND_DURATION[kind];
      const pitch = 0.8 + Math.random() * 0.5; // randomised pitch

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = pitch;

      const filter = ctx.createBiquadFilter();
      filter.type = p.noise > 0.7 ? 'bandpass' : 'lowpass';
      filter.frequency.value = p.freq * pitch;
      filter.Q.value = p.q;

      const gain = ctx.createGain();
      const peak = KIND_GAIN[kind];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + dur + 0.02);
    } catch {
      /* ignore playback errors */
    }
  }

  private buildNoise(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * 0.3);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }
}
