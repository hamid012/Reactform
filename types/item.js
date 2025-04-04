"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Item = void 0;
const schema_1 = require("@colyseus/schema");
class Item extends schema_1.Schema {
    constructor(id, x, y, spatialHash, name, quantity = 1, durability = 0, maxDurability = 0, maxStack = 999, equipSlot = "") {
        super();
        this.id = id;
        this.x = x;
        this.y = y;
        this.name = name;
        this.quantity = quantity;
        this.durability = durability;
        this.maxDurability = maxDurability;
        this.maxStack = maxStack;
        this.equipSlot = equipSlot;
        spatialHash.addEntity(this);
    }
    deleteme(spatialHash) {
        spatialHash.removeEntity(this);
    }
}
exports.Item = Item;
__decorate([
    (0, schema_1.type)("string")
], Item.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("number")
], Item.prototype, "quantity", void 0);
__decorate([
    (0, schema_1.type)("number")
], Item.prototype, "durability", void 0);
__decorate([
    (0, schema_1.type)("number")
], Item.prototype, "maxDurability", void 0);
__decorate([
    (0, schema_1.type)("string")
], Item.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("number")
], Item.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], Item.prototype, "y", void 0);
