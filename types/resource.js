"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resource = void 0;
const schema_1 = require("@colyseus/schema");
const resources_json_1 = __importDefault(require("../data/resources.json")); // Importing resource data for reference
class Resource extends schema_1.Schema {
    constructor(id, x, y, spatialHash, type) {
        super();
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type;
        // Edit resource stats based on type here @Rembo
        const resourceConfig = resources_json_1.default.find(resource => resource.type === type);
        if (resourceConfig) {
            this.radius = resourceConfig.radius;
            this.health = resourceConfig.health;
        }
        else {
            this.health = 100;
            this.radius = 25;
        }
        spatialHash.addEntity(this);
    }
    resourcedmg(x, y, radius, dmg, direction, attackradius = 40, attackarc = 2.2, attackarc_start = -0.5) {
        const distance = Math.sqrt((x - this.x) ** 2 + (y - this.y) ** 2);
        if (distance > radius + this.radius + attackradius)
            return false;
        let attackDirection = direction < 0 ? direction + 2 * Math.PI : direction;
        attackDirection -= Math.PI / 2;
        if (attackDirection >= 2 * Math.PI)
            attackDirection -= 2 * Math.PI;
        let targetAngle = Math.atan2(this.y - y, this.x - x);
        if (targetAngle < 0)
            targetAngle += 2 * Math.PI;
        let angleDiff = Math.abs(targetAngle - attackDirection);
        if (angleDiff > Math.PI)
            angleDiff = 2 * Math.PI - angleDiff;
        if (angleDiff <= attackarc / 2 + attackarc_start) {
            this.health -= dmg;
            return true;
        }
        return false;
    }
}
exports.Resource = Resource;
__decorate([
    (0, schema_1.type)("string")
], Resource.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("number")
], Resource.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], Resource.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("number")
], Resource.prototype, "health", void 0);
__decorate([
    (0, schema_1.type)("string")
], Resource.prototype, "type", void 0);
