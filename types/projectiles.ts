import { Schema, type} from '@colyseus/schema';
import type { SpatialHashing } from './spatialhashing';

export class Projectile extends Schema {
  @type("string") id: string;
  ownerId: string; // ID of entity that fired this projectile
  @type("number") x: number;
  @type("number") y: number;
  @type("number") velocityX: number;
  @type("number") velocityY: number;
  damage: number;
  @type("string") type: string; // "fireball", "arrow", etc.
  radius: number;
  lifetime: number; // How long projectile lives (in ticks)
  
  constructor(id: string, ownerId: string, x: number, y: number, 
              velocityX: number, velocityY: number, damage: number, 
              type: string, radius: number, lifetime: number, spatialHash: SpatialHashing) {
    super();
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.damage = damage;
    this.type = type;
    this.radius = radius;
    this.lifetime = lifetime;
    spatialHash.addEntity(this);
  }
  
  update() {
    this.x += this.velocityX;
    this.y += this.velocityY;
    this.lifetime--;
  }
  
  updateHashing(spatialHash: SpatialHashing) {
    spatialHash.removeEntity(this);
    this.update();
    spatialHash.addEntity(this);
  }
  
  deleteme(spatialHash: SpatialHashing) {
    spatialHash.removeEntity(this);
  }
}