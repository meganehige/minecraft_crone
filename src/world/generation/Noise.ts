import alea from 'alea';
import {
  createNoise2D,
  createNoise3D,
  type NoiseFunction2D,
  type NoiseFunction3D,
} from 'simplex-noise';

/**
 * Seedable 2D noise with a fractal-Brownian-motion helper. Wraps simplex-noise
 * behind our own interface so the implementation can be swapped later. Multiple
 * independent channels are derived from the seed via distinct alea streams.
 */
export class Noise {
  private readonly base: NoiseFunction2D;
  private base3: NoiseFunction3D | null = null;
  private readonly seedKey: string;

  constructor(seed: string | number, channel = 'terrain') {
    this.seedKey = `${seed}:${channel}`;
    this.base = createNoise2D(alea(this.seedKey));
  }

  /** Raw simplex in [-1, 1]. */
  sample(x: number, z: number): number {
    return this.base(x, z);
  }

  /** Raw 3D simplex in [-1, 1]. Built lazily: most channels never need it. */
  sample3(x: number, y: number, z: number): number {
    if (!this.base3) this.base3 = createNoise3D(alea(`${this.seedKey}:3d`));
    return this.base3(x, y, z);
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
