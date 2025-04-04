"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Equipment = void 0;
const schema_1 = require("@colyseus/schema");
const inventoryitem_1 = require("./inventoryitem");
class Equipment extends schema_1.Schema {
    constructor() {
        super(...arguments);
        // Map keyed by equipment type (e.g., "hat", "shield") to the item.
        this.slots = new schema_1.MapSchema();
        // List of valid equipment slots.
        this.availableSlots = ["hat", "shield"];
    }
    /**
     * Attempts to equip an item in its designated slot.
     * Returns true if successful.
     */
    equipItem(item) {
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
exports.Equipment = Equipment;
__decorate([
    (0, schema_1.type)({ map: inventoryitem_1.InventoryItem })
], Equipment.prototype, "slots", void 0);
