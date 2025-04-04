import { Schema, type} from '@colyseus/schema';
import type { SpatialHashing } from './spatialhashing';

export class Item extends Schema {
  // Item identifier (e.g. "wood", "stone", "sword")
  @type("string")
  name: string;

  // How many of this item are in this stack.
  @type("number")
  quantity: number;

  // For items with durability (e.g. tools, weapons). If not used, set to 0.
  @type("number")
  durability: number; 

  // Maximum durability (if applicable).
  @type("number")
  maxDurability: number;

  // Maximum number allowed per stack. For example, wood may be 999, while a sword might be 1.
  maxStack: number;


  equipSlot: string;
  //does it equip to any certain slots:

  @type("string") id: string; // Player ID (can be any unique identifier)
  @type("number") x: number; // Player's X position
  @type("number") y: number; // Player's Y position

  constructor(
    id: string,
    x: number,
    y: number,
    spatialHash: SpatialHashing,
    name: string,
    quantity: number = 1,
    durability: number = 0,
    maxDurability: number = 0,
    maxStack: number = 999,
    equipSlot: string = "",
  ) {
    super();

    this.id = id;
    this.x = x
    this.y = y
    this.name = name;
    this.quantity = quantity;
    this.durability = durability;
    this.maxDurability = maxDurability;
    this.maxStack = maxStack;
    this.equipSlot = equipSlot;
    spatialHash.addEntity(this)
  }
  deleteme(spatialHash: SpatialHashing){
    spatialHash.removeEntity(this);
}
}