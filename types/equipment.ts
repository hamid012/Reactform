import { Schema, type, MapSchema} from '@colyseus/schema';
import  { InventoryItem } from './inventoryitem';

export class Equipment extends Schema {
     // Map keyed by equipment type (e.g., "hat", "shield") to the item.
  @type({ map: InventoryItem })
  slots = new MapSchema<InventoryItem>();

  // List of valid equipment slots.
  readonly availableSlots: string[] = ["hat", "shield"];

  /**
   * Attempts to equip an item in its designated slot.
   * Returns true if successful.
   */
  equipItem(item: InventoryItem): boolean {
    if (item.equipSlot && this.availableSlots.includes(item.equipSlot)) {
      // Use get() instead of direct property access
      if (!this.slots.get(item.equipSlot)) {
        // Use set() instead of direct property assignment
        this.slots.set(item.equipSlot, item);
        return true;
      }
    }
    return false;
  }

}