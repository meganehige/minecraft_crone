import { Item, type ItemId } from '../inventory/itemIds';

export type MobType = 'pig' | 'zombie';

export interface MobDrop {
  item: ItemId;
  count: number;
}

export interface MobSpec {
  type: MobType;
  maxHealth: number;
  /** Horizontal half-extent of the collision box. */
  half: number;
  height: number;
  /** Walking speed in blocks/s. */
  speed: number;
  /** Hostile mobs seek the player; passive ones only wander. */
  hostile: boolean;
  /** Contact damage per hit (hostile only). */
  attackDamage: number;
  bodyColor: number;
  headColor: number;
  /** Size of the head cube relative to the body. */
  headSize: number;
  drops: MobDrop[];
}

export const MOB_SPECS: Record<MobType, MobSpec> = {
  pig: {
    type: 'pig',
    maxHealth: 10,
    half: 0.45,
    height: 0.9,
    speed: 1.3,
    hostile: false,
    attackDamage: 0,
    bodyColor: 0xf0a5a2,
    headColor: 0xf6bdba,
    headSize: 0.5,
    drops: [{ item: Item.Porkchop, count: 2 }],
  },
  zombie: {
    type: 'zombie',
    maxHealth: 20,
    half: 0.3,
    height: 1.95,
    speed: 2.1,
    hostile: true,
    attackDamage: 2,
    bodyColor: 0x3a7a4a,
    headColor: 0x4f8f5a,
    headSize: 0.5,
    drops: [],
  },
};
