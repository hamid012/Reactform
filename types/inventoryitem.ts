import { Schema, type} from '@colyseus/schema';

export class InventoryItem extends Schema {
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

    //does it equip to any certain slots:
    equipSlot: string;
    
  
    constructor(
      name: string,
      quantity: number = 1,
      durability: number = 0,
      maxDurability: number = 0,
      maxStack: number = 999,
      equipSlot: string = "",
    ) {
      super();
      this.name = name;
      this.quantity = quantity;
      this.durability = durability;
      this.maxDurability = maxDurability;
      this.maxStack = maxStack;
      this.equipSlot = equipSlot;
      //modify item stats based on name
    }
  }