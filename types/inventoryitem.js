"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryItem = void 0;
const schema_1 = require("@colyseus/schema");
class InventoryItem extends schema_1.Schema {
    constructor(name, quantity = 1, durability = 0, maxDurability = 0, maxStack = 999, equipSlot = "") {
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
exports.InventoryItem = InventoryItem;
__decorate([
    (0, schema_1.type)("string")
], InventoryItem.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("number")
], InventoryItem.prototype, "quantity", void 0);
__decorate([
    (0, schema_1.type)("number")
], InventoryItem.prototype, "durability", void 0);
__decorate([
    (0, schema_1.type)("number")
], InventoryItem.prototype, "maxDurability", void 0);
