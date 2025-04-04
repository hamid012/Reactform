import { Schema, type, MapSchema} from '@colyseus/schema';
import  { InventoryItem } from './inventoryitem';

export class Inventory extends Schema{
@type({ map: InventoryItem })
slots = new MapSchema<InventoryItem>();
@type('number') version : number;
  // Total number of available slots.
  readonly MAX_SLOTS: number = 41;
/**
   * Returns the first available slot index (0 .. MAX_SLOTS-1)
   * or null if all slots are taken.
   */
constructor(){
  super();
  this.version = 0;
}
getFreeSlot(): number | null {
    for (let i = 0; i < this.MAX_SLOTS; i++) {
      const key = i.toString();
      // We cast to any to allow bracket notation.
      /*
      if (!((this.slots as any)[key])) {
        return i;
      }
      */
      if (!this.slots.get(key)) {
        return i;
      }
    }
    return null;
  }
Version(): void{
this.version ++;
if(this.version>50){
  this.version = 0
}
}
   /**
   * Adds an item to the inventory.
   * If targetSlot is provided, it will attempt to put it there (stacking if possible,
   * or swapping if the slot is already occupied).
   * Otherwise, it will first try to add to any partially filled stack (if stackable),
   * then use the first free slot.
   */
   addItem(newItem: InventoryItem, targetSlot?: number): void{
    // --- If a specific slot is requested ---
    if (targetSlot !== undefined) {
      const key = targetSlot.toString();
      //const slotItem: InventoryItem = (this.slots as any)[key];
      const slotItem = this.slots.get(key);
      if (!slotItem) {
        //(this.slots as any)[key] = newItem;
        this.slots.set(key, newItem);
        return;
      } else {
        // If the slot is occupied and the items can stack, add to the stack.
        if (
          slotItem.name === newItem.name &&
          slotItem.maxStack > 1 &&
          slotItem.quantity < slotItem.maxStack
        ) {
          const availableSpace = slotItem.maxStack - slotItem.quantity;
          const addAmount = Math.min(availableSpace, newItem.quantity);
          slotItem.quantity += addAmount;
          newItem.quantity -= addAmount;
          // If there’s any quantity left, try adding it normally.
          if (newItem.quantity > 0) {
            this.addItem(newItem);
          }
          return;
        } else {
          // Otherwise, if stacking isn’t possible, try swapping.
          const freeSlot = this.getFreeSlot();
          if (freeSlot !== null) {
            this.slots.set(freeSlot.toString(), slotItem);
            this.slots.set(key, newItem);
          } else {
            //console.log("No free slot to swap with at slot", targetSlot);
          }
          return; // No items added, but the original item remains.
        }
      }
    }

    // --- No specific slot requested: first try stacking ---
    if (newItem.maxStack > 1) {
      // Using MapSchema's forEach: note that we cannot break early.
      this.slots.forEach((slotItem: InventoryItem, key: string) => {
        if (
          slotItem &&
          slotItem.name === newItem.name &&
          slotItem.maxStack > 1 &&
          slotItem.quantity < slotItem.maxStack &&
          newItem.quantity > 0
        ) {
          const space = slotItem.maxStack - slotItem.quantity;
          const toAdd = Math.min(space, newItem.quantity);
          slotItem.quantity += toAdd;
          newItem.quantity -= toAdd;
        }
      });
    }

    // --- Place any remaining quantity into free slots ---
    while (newItem.quantity > 0) {
      const freeSlot = this.getFreeSlot();
      if (freeSlot === null) {
        //console.log("Inventory full. Could not add all items; remaining:", newItem.quantity);
        break;
      }
      // For stackable items, add up to the maxStack amount per slot; otherwise add one.
      const toAdd = newItem.maxStack > 1 ? Math.min(newItem.maxStack, newItem.quantity) : 1;
      this.slots.set(freeSlot.toString(), new InventoryItem(
        newItem.name,
        toAdd,
        newItem.durability,
        newItem.maxDurability,
        newItem.maxStack,
        newItem.equipSlot
      ));

      newItem.quantity -= toAdd;
    }
    this.Version();
    return;

  }

 /**
   * Moves an item from one slot to another.
   * - If the target slot is empty, the item is moved.
   * - If the target slot contains the same stackable item and there’s room, the stacks merge.
   * - Otherwise, the items are swapped.
   */
 moveItem(fromSlot: number, toSlot: number): void {
  // Special case for picking up an item (-1 destination)
  if (toSlot === -1) {
    return;
}

const fromKey = fromSlot.toString();
const toKey = toSlot.toString();

const fromItem = this.slots.get(fromKey);
const toItem = this.slots.get(toKey);

if (!fromItem) {
    return;
}

this.Version();

// Case 1: Empty destination slot
if (!toItem) {
    // Create a NEW item with the same properties instead of moving the reference
    const newItem = new InventoryItem(
        fromItem.name,
        fromItem.quantity,
        fromItem.durability,
        fromItem.maxDurability,
        fromItem.maxStack,
        fromItem.equipSlot
    );
    
    // Set the new item in the destination slot
    this.slots.set(toKey, newItem);
    
    // Remove the original item
    this.slots.delete(fromKey);
    return;
}

// Case 2: Same item type, stackable
if (
    fromItem.name === toItem.name &&
    fromItem.maxStack > 1 &&
    toItem.quantity < toItem.maxStack
) {
    const space = toItem.maxStack - toItem.quantity;
    const toMove = Math.min(space, fromItem.quantity);
    
    toItem.quantity += toMove;
    fromItem.quantity -= toMove;
    
    if (fromItem.quantity === 0) {
        this.slots.delete(fromKey);
    }
    return;
}

// Case 3: Different item types or not stackable - swap them
// Create NEW items for the swap
const newToItem = new InventoryItem(
    fromItem.name,
    fromItem.quantity,
    fromItem.durability,
    fromItem.maxDurability,
    fromItem.maxStack,
    fromItem.equipSlot
);

const newFromItem = new InventoryItem(
    toItem.name,
    toItem.quantity,
    toItem.durability,
    toItem.maxDurability,
    toItem.maxStack,
    toItem.equipSlot
);

// First remove both items to avoid reference collisions
this.slots.delete(fromKey);
this.slots.delete(toKey);

// Then add the new items
this.slots.set(toKey, newToItem);
this.slots.set(fromKey, newFromItem);
}
    /**
   * Returns the total quantity of a given item across all inventory slots.
   */
  getTotalQuantity(itemName: string): number {
      let total = 0;
      this.slots.forEach((slot: InventoryItem) => {
        if (slot.name === itemName) {
          total += slot.quantity;
        }
      });
      return total;
  }
  removeItem(itemName: string, quantity: number): boolean {
    // First, check that there is enough total quantity.
    const total = this.getTotalQuantity(itemName);
    if (total < quantity) {
      return false;
    }
    this.Version();
  
    // Iterate over all slots using forEach.
    // forEach doesn’t support breaking out early, so we simply check if nothing remains to remove.
    this.slots.forEach((slot: InventoryItem, key: string) => {
      if (quantity <= 0) return; // Nothing left to remove.
      if (slot.name === itemName) {
        if (slot.quantity <= quantity) {
          // Use up the entire stack.
          quantity -= slot.quantity;
          //delete (this.slots as any)[key];
          this.slots.delete(key);
        } else {
          // Remove only part of the stack.
          slot.quantity -= quantity;
          quantity = 0;
        }
      }
    });
    return true;
  }
  removeSlot(itemslot: number): boolean{
    const itemKey = itemslot.toString();
    const item = this.slots.get(itemKey);
    if(!item){
      return false
    }
    this.Version();
    this.slots.delete(itemKey);
    

    return true
  }
  

}