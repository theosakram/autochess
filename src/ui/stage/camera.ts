// A fixed perspective camera over the board, as pure math (no Pixi): world points in, screen points out.
//
// World space: x to the right, y up, z toward the viewer; one unit is one board cell. The camera sits above and in
// front of `target`, tilted down by `pitch`, and never rolls or turns sideways, so its right axis is always +x.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Projected {
  x: number;
  y: number;
  scale: number; // screen pixels per world unit at this depth
}

export interface CameraSpec {
  pitch: number; // radians down from the horizon
  distance: number; // from the target, in world units: farther is flatter perspective
  target: Vec3; // what the camera looks at
}

export const vec3 = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z });
export const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

export class Camera {
  private readonly eye: Vec3;
  private readonly forward: Vec3;
  private readonly up: Vec3;

  // `focal` and `offset` map the image plane to pixels: `offset` is where the target lands on screen.
  constructor(
    readonly spec: CameraSpec,
    private readonly focal = 1,
    private readonly offset = { x: 0, y: 0 },
  ) {
    const { pitch, distance, target } = spec;
    const [sin, cos] = [Math.sin(pitch), Math.cos(pitch)];
    this.eye = vec3(target.x, target.y + distance * sin, target.z + distance * cos);
    this.forward = vec3(0, -sin, -cos);
    this.up = vec3(0, cos, -sin);
  }

  project(p: Vec3): Projected {
    const v = sub(p, this.eye);
    const depth = dot(v, this.forward);
    const scale = this.focal / depth;
    return { x: this.offset.x + v.x * scale, y: this.offset.y - dot(v, this.up) * scale, scale };
  }

  // The point on the horizontal plane at height `planeY` under a screen point, or null if that ray misses it.
  pick(x: number, y: number, planeY = 0): Vec3 | null {
    const a = (x - this.offset.x) / this.focal;
    const b = -(y - this.offset.y) / this.focal;
    // Ray direction: forward plus the image-plane offset along right (+x) and up.
    const dir = vec3(a, this.forward.y + b * this.up.y, this.forward.z + b * this.up.z);
    if (dir.y >= 0) return null;
    const t = (planeY - this.eye.y) / dir.y;
    return vec3(this.eye.x + dir.x * t, planeY, this.eye.z + dir.z * t);
  }

  // The same view zoomed and shifted so `points` span exactly `width` pixels, their top edge at y = 0.
  // Returns the camera and the height the points then take up.
  framed(points: Vec3[], width: number): { camera: Camera; height: number } {
    const unit = new Camera(this.spec).bounds(points);
    const zoom = width / (unit.maxX - unit.minX);
    const offset = { x: -unit.minX * zoom, y: -unit.minY * zoom };
    return { camera: new Camera(this.spec, zoom, offset), height: (unit.maxY - unit.minY) * zoom };
  }

  private bounds(points: Vec3[]) {
    const ps = points.map((p) => this.project(p));
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
}

const sub = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
