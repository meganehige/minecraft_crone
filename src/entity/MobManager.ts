import * as THREE from 'three';
import { moveAndCollide } from '../physics/Collision';
import { BlockRegistry } from '../world/blocks/BlockRegistry';
import { BlockId } from '../world/blocks/BlockType';
import type { World } from '../world/World';
import type { ItemId } from '../inventory/itemIds';
import { MOB_SPECS, type MobSpec, type MobType } from './Mob';

const GRAVITY = 24;
const TERMINAL = 60;
const JUMP_SPEED = 7.5;
/** How far a hostile mob notices the player. */
const AGGRO_RANGE = 16;
/** Horizontal reach of a hostile mob's attack. */
const ATTACK_RANGE = 1.5;
const ATTACK_COOLDOWN = 1.0; // seconds
/** Player melee reach. */
const MELEE_REACH = 4;
const KNOCKBACK = 4;
/** Per-tick decay of the knockback impulse. */
const KNOCKBACK_DECAY = 0.75;
const DESPAWN_DISTANCE = 56;
/** Natural spawn attempts happen on this interval. */
const SPAWN_INTERVAL = 2.0;
const MAX_MOBS = 10;
const MAX_PER_KIND = 6;
/** Hostiles only spawn in the dark (caves), like Minecraft's light rule. */
const HOSTILE_MAX_LIGHT = 7;

export interface MobSnapshot {
  id: number;
  type: MobType;
  x: number;
  y: number;
  z: number;
  health: number;
}

interface Mob {
  id: number;
  spec: MobSpec;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  health: number;
  onGround: boolean;
  /** Heading as a unit vector; zero while idling. */
  hx: number;
  hz: number;
  wanderTimer: number;
  attackTimer: number;
  /** Decaying horizontal impulse from being hit. */
  kx: number;
  kz: number;
  group: THREE.Group;
}

export interface MobHooks {
  /** Spawn a dropped item entity (mob loot). */
  drop: (x: number, y: number, z: number, item: ItemId, count: number) => void;
  /** Damage the player (hostile contact). */
  hurtPlayer: (amount: number) => void;
}

/**
 * Mobs: passive pigs that wander the surface and hostile zombies that spawn in
 * the dark and chase the player. They share the player's swept-AABB collision
 * so they walk on terrain, step up by jumping, and cannot pass through blocks.
 * Mobs do not collide with the player (nor each other) — that keeps movement
 * predictable and avoids shoving the player off ledges.
 */
export class MobManager {
  spawning = true;

  private readonly mobs: Mob[] = [];
  private readonly materials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly baseColors = new Map<string, THREE.Color>();
  private spawnTimer = 0;
  private nextId = 1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly hooks: MobHooks,
  ) {}

  get count(): number {
    return this.mobs.length;
  }

  list(): MobSnapshot[] {
    return this.mobs.map((m) => ({
      id: m.id,
      type: m.spec.type,
      x: m.pos.x,
      y: m.pos.y,
      z: m.pos.z,
      health: m.health,
    }));
  }

  clear(): void {
    for (let i = this.mobs.length - 1; i >= 0; i--) this.remove(i);
  }

  spawn(type: MobType, x: number, y: number, z: number): number {
    const spec = MOB_SPECS[type];
    const group = this.buildMesh(spec);
    group.position.set(x, y, z);
    this.scene.add(group);
    const mob: Mob = {
      id: this.nextId++,
      spec,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      health: spec.maxHealth,
      onGround: false,
      hx: 0,
      hz: 0,
      wanderTimer: 0,
      attackTimer: 0,
      kx: 0,
      kz: 0,
      group,
    };
    this.mobs.push(mob);
    return mob.id;
  }

  /** Scale mob colours by the day/night factor so they dim with the world. */
  setBrightness(b: number): void {
    for (const [key, mat] of this.materials) {
      const base = this.baseColors.get(key)!;
      mat.color.setRGB(base.r * b, base.g * b, base.b * b);
    }
  }

  update(dt: number, playerFeet: THREE.Vector3, playerEyeHeight: number): void {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i]!;
      this.think(m, dt, playerFeet);
      this.physics(m, dt);
      m.group.position.copy(m.pos);
      // Face the direction of travel.
      if (m.hx !== 0 || m.hz !== 0) {
        m.group.rotation.y = Math.atan2(m.hx, m.hz);
      }
      if (m.pos.distanceTo(playerFeet) > DESPAWN_DISTANCE || m.pos.y < -20) {
        this.remove(i);
      }
    }

    if (!this.spawning) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(playerFeet, playerEyeHeight);
    }
  }

  // --- AI ---

  private think(m: Mob, dt: number, playerFeet: THREE.Vector3): void {
    const dx = playerFeet.x - m.pos.x;
    const dz = playerFeet.z - m.pos.z;
    const dist = Math.hypot(dx, dz);

    m.attackTimer = Math.max(0, m.attackTimer - dt);

    if (m.spec.hostile && dist < AGGRO_RANGE && dist > 0.001) {
      m.hx = dx / dist;
      m.hz = dz / dist;
      const dy = Math.abs(playerFeet.y - m.pos.y);
      if (dist < ATTACK_RANGE && dy < 2 && m.attackTimer === 0) {
        m.attackTimer = ATTACK_COOLDOWN;
        this.hooks.hurtPlayer(m.spec.attackDamage);
      }
      return;
    }

    // Wander: pick a new heading (or a pause) every few seconds.
    m.wanderTimer -= dt;
    if (m.wanderTimer <= 0) {
      m.wanderTimer = 2 + Math.random() * 3;
      if (Math.random() < 0.3) {
        m.hx = 0;
        m.hz = 0;
      } else {
        const a = Math.random() * Math.PI * 2;
        m.hx = Math.cos(a);
        m.hz = Math.sin(a);
      }
    }
  }

  private physics(m: Mob, dt: number): void {
    const speed = m.spec.speed;
    // Walking intent plus whatever knockback is left over from the last hit.
    m.vel.x = m.hx * speed + m.kx;
    m.vel.z = m.hz * speed + m.kz;
    m.kx *= KNOCKBACK_DECAY;
    m.kz *= KNOCKBACK_DECAY;
    if (Math.abs(m.kx) < 0.01) m.kx = 0;
    if (Math.abs(m.kz) < 0.01) m.kz = 0;
    m.vel.y -= GRAVITY * dt;
    if (m.vel.y < -TERMINAL) m.vel.y = -TERMINAL;

    const wantX = m.vel.x;
    const wantZ = m.vel.z;
    m.onGround = moveAndCollide(
      this.world,
      m.pos,
      m.vel,
      m.spec.half,
      m.spec.height,
      dt,
    );

    // Walked into a wall while grounded: hop over it (step-up without a
    // dedicated step solver).
    const blocked =
      (wantX !== 0 && m.vel.x === 0) || (wantZ !== 0 && m.vel.z === 0);
    if (blocked && m.onGround) m.vel.y = JUMP_SPEED;
  }

  // --- Combat ---

  /**
   * Attack the first mob along the look ray within melee reach. Returns the
   * damage dealt, or 0 if nothing was hit.
   */
  attack(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    damage: number,
  ): number {
    let best: Mob | null = null;
    let bestT = MELEE_REACH;
    for (const m of this.mobs) {
      const t = rayBox(
        ox, oy, oz, dx, dy, dz,
        m.pos.x - m.spec.half, m.pos.y, m.pos.z - m.spec.half,
        m.pos.x + m.spec.half, m.pos.y + m.spec.height, m.pos.z + m.spec.half,
      );
      if (t !== null && t < bestT) {
        bestT = t;
        best = m;
      }
    }
    if (!best) return 0;

    best.health -= damage;
    // Knock the mob away from the attacker.
    const len = Math.hypot(dx, dz) || 1;
    best.kx = (dx / len) * KNOCKBACK;
    best.kz = (dz / len) * KNOCKBACK;
    best.vel.y = 4;
    if (best.health <= 0) this.kill(best);
    return damage;
  }

  private kill(m: Mob): void {
    const i = this.mobs.indexOf(m);
    if (i < 0) return;
    for (const d of m.spec.drops) {
      this.hooks.drop(m.pos.x, m.pos.y + 0.4, m.pos.z, d.item, d.count);
    }
    this.remove(i);
  }

  // --- Spawning ---

  /**
   * One natural spawn attempt near the player: pigs on lit grass at the
   * surface, zombies on any solid floor dark enough to count as a cave.
   */
  private trySpawn(playerFeet: THREE.Vector3, playerEyeHeight: number): void {
    if (this.mobs.length >= MAX_MOBS) return;
    const hostile = Math.random() < 0.5;
    const kindCount = this.mobs.filter(
      (m) => m.spec.hostile === hostile,
    ).length;
    if (kindCount >= MAX_PER_KIND) return;

    const angle = Math.random() * Math.PI * 2;
    const radius = 12 + Math.random() * 16;
    const x = Math.floor(playerFeet.x + Math.cos(angle) * radius);
    const z = Math.floor(playerFeet.z + Math.sin(angle) * radius);

    const y = hostile
      ? Math.floor(playerFeet.y + playerEyeHeight - 4 + Math.random() * 10)
      : this.world.generator.surfaceHeight(x, z);
    if (!this.isSpawnable(x, y, z, hostile)) return;
    this.spawn(hostile ? 'zombie' : 'pig', x + 0.5, y + 1, z + 0.5);
  }

  private isSpawnable(x: number, y: number, z: number, hostile: boolean): boolean {
    const floor = this.world.getBlock(x, y, z);
    if (!BlockRegistry.isSolid(floor)) return false;
    if (this.world.getBlock(x, y + 1, z) !== BlockId.Air) return false;
    if (this.world.getBlock(x, y + 2, z) !== BlockId.Air) return false;
    const light = this.world.getLight(x, y + 1, z);
    if (hostile) return light <= HOSTILE_MAX_LIGHT;
    return floor === BlockId.Grass && light >= 9;
  }

  // --- Rendering ---

  private buildMesh(spec: MobSpec): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(spec.half * 2, spec.height * 0.75, spec.half * 2),
      this.material(`${spec.type}:body`, spec.bodyColor),
    );
    body.position.y = spec.height * 0.375;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(spec.headSize, spec.headSize, spec.headSize),
      this.material(`${spec.type}:head`, spec.headColor),
    );
    head.position.y = spec.height * 0.75 + spec.headSize / 2;
    // The head sits forward of the body so the facing direction reads clearly.
    head.position.z = spec.half * 0.5;
    group.add(body, head);
    return group;
  }

  private material(key: string, color: number): THREE.MeshBasicMaterial {
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      this.materials.set(key, mat);
      this.baseColors.set(key, new THREE.Color(color));
    }
    return mat;
  }

  private remove(i: number): void {
    const m = this.mobs[i]!;
    this.scene.remove(m.group);
    for (const child of m.group.children) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    this.mobs.splice(i, 1);
  }
}

/** Slab-method ray/AABB test; returns the entry distance or null. */
function rayBox(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [ox, dx, minX, maxX],
    [oy, dy, minY, maxY],
    [oz, dz, minZ, maxZ],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
