"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Projectile = void 0;
const schema_1 = require("@colyseus/schema");
class Projectile extends schema_1.Schema {
    constructor(id, ownerId, x, y, velocityX, velocityY, damage, type, radius, lifetime, spatialHash) {
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
    updateHashing(spatialHash) {
        spatialHash.removeEntity(this);
        this.update();
        spatialHash.addEntity(this);
    }
    deleteme(spatialHash) {
        spatialHash.removeEntity(this);
    }
}
exports.Projectile = Projectile;
__decorate([
    (0, schema_1.type)("string")
], Projectile.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "velocityX", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "velocityY", void 0);
__decorate([
    (0, schema_1.type)("string")
], Projectile.prototype, "type", void 0);
