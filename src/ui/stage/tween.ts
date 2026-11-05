// Minimal tweening driven by the Pixi ticker. A keyed tween replaces any running tween with
// the same key (e.g. a new move cancels the unit's previous one); unkeyed tweens just run.

interface Tween {
  elapsed: number;
  duration: number;
  step: (k: number) => void; // k goes 0 -> 1
  done?: () => void;
}

export class Tweens {
  private running = new Map<string | symbol, Tween>();

  add(duration: number, step: (k: number) => void, done?: () => void, key: string | symbol = Symbol()): void {
    if (duration <= 0) {
      step(1);
      done?.();
      return;
    }
    this.running.set(key, { elapsed: 0, duration, step, done });
  }

  update(deltaMs: number): void {
    for (const [key, tw] of this.running) {
      tw.elapsed += deltaMs;
      const k = Math.min(1, tw.elapsed / tw.duration);
      tw.step(k);
      if (k >= 1) {
        this.running.delete(key);
        tw.done?.();
      }
    }
  }

  clear(): void {
    this.running.clear();
  }
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
