import alea from 'alea';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

/**
 * Seedable 2D noise with a fractal-Brownian-motion helper. Wraps simplex-noise
 * behind our own interface so the implementation can be swapped later. Multiple
 * independent channels are derived from the seed via distinct alea streams.
 */
export class Noise {
  private readonly base: NoiseFunction2D;

  constructor(seed: string | number, channel = 'terrain') {
    this.base = createNoise2D(alea(`${seed}:${channel}`));
  }

  /** Raw simplex in [-1, 1]. */
  sample(x: number, z: number): number {
    return this.base(x, z);
  }

  /**
   * Multi-octave fBm in [-1, 1]. Each octave doubles frequency (lacunarity) and
   * scales amplitude by persistence; the result is normalised by total
   * amplitude.
   */
  fbm2(
    x: number,
    z: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
    baseFreq: number,
  ): number {
    let amp = 1;
    let freq = baseFreq;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.base(x * freq, z * freq);
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return norm === 0 ? 0 : sum / norm;
  }
}
