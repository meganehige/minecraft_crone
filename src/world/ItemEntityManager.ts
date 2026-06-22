import * as THREE from 'three';
import { getMaterials } from '../render/materials';
import { tileUVRect } from '../render/atlas';
import { BlockRegistry } from './blocks/BlockRegistry';
import { BlockId } from './blocks/BlockType';
import type { World } from './World';

const GRAVITY = 18;
const SIZE = 0.28;
const PICKUP_RANGE = 1.6;
const COLLECT_RANGE = 0.9;
const DESPAWN_AGE = 300; // seconds

interface ItemEntity {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  item: BlockId;
  count: number;
  age: number;
  mesh: THREE.Mesh;
}

/** Collect callback returns the leftover count that did not fit. */
export type CollectFn = (item: BlockId, count: number) => number;

/**
 * Dropped item entities: small textured cubes that fall, rest on the ground,
 * drift toward a nearby player, and get collected into the inventory.
 */
export class ItemEntityManager {
  private readonly entities: ItemEntity[] = [];
  private readonly material: THREE.Material;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
  ) {
    this.material = new THREE.MeshBasicMaterial({
      map: getMaterials().texture,
    });
  }

  get count(): number {
    return this.entities.length;
  }

  spawn(x: number, y: number, z: number, item: BlockId, count: number): void {
    if (item === BlockId.Air || count <= 0) return;
    const mesh = new THREE.Mesh(this.buildGeometry(item), this.material);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.entities.push({
      pos: mesh.position,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 2, (Math.random() - 0.5) * 1.5),
      item,
      count,
      age: 0,
      mesh,
    });
  }

  update(dt: number, playerFeet: THREE.Vector3, collect: CollectFn): void {
    const center = new THREE.Vector3(
      playerFeet.x,
      playerFeet.y + 0.9,
      playerFeet.z,
    );
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]!;
      e.age += dt;

      // Gravity + rest on the block below.
      e.vel.y -= GRAVITY * dt;
      e.pos.addScaledVector(e.vel, dt);
      e.vel.x *= 0.8;
      e.vel.z *= 0.8;
      const belowSolid = BlockRegistry.isSolid(
        this.world.getBlock(
          Math.floor(e.pos.x),
          Math.floor(e.pos.y - SIZE),
          Math.floor(e.pos.z),
        ),
      );
      if (belowSolid && e.vel.y <= 0) {
        e.pos.y = Math.floor(e.pos.y - SIZE) + 1 + SIZE;
        e.vel.y = 0;
      }

      e.mesh.rotation.y += dt * 1.5;

      // Drift toward and get collected by a nearby player.
      const dist = center.distanceTo(e.pos);
      if (dist < PICKUP_RANGE) {
        e.pos.lerp(center, Math.min(1, dt * 8));
      }
      if (dist < COLLECT_RANGE) {
        const leftover = collect(e.item, e.count);
        if (leftover <= 0) {
          this.remove(i);
          continue;
        }
        e.count = leftover;
      }

      if (e.age > DESPAWN_AGE) this.remove(i);
    }
  }

  clear(): void {
    for (let i = this.entities.length - 1; i >= 0; i--) this.remove(i);
  }

  private remove(i: number): void {
    const e = this.entities[i]!;
    this.scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    this.entities.splice(i, 1);
  }

  private buildGeometry(item: BlockId): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const tile = BlockRegistry.get(item).tiles.side;
    const [u0, v0, u1, v1] = tileUVRect(tile);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    // BoxGeometry has 4 uvs per face (24 total); map every face to the tile.
    for (let f = 0; f < 6; f++) {
      const o = f * 4;
      uv.setXY(o + 0, u0, v1);
      uv.setXY(o + 1, u1, v1);
      uv.setXY(o + 2, u0, v0);
      uv.setXY(o + 3, u1, v0);
    }
    uv.needsUpdate = true;
    return geo;
  }
}
