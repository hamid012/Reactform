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
exports.Mob = void 0;
const schema_1 = require("@colyseus/schema");
//import data
const mobs_json_1 = __importDefault(require("../data/mobs.json"));
class Mob extends schema_1.Schema {
    constructor(id, x, y, type, spatialHash) {
        super();
        this.id = id;
        this.x = x;
        this.y = y;
        this.xvel = 0;
        this.yvel = 0;
        this.action = -1;
        this.direction = 0;
        this.time = 10;
        this.target = "";
        this.hit_time = 0;
        this.type = type;
        this.updated = false;
        this.isBeingRemoved = false;
        this.canShoot = false;
        this.projectileType = "fireball";
        this.projectileSpeed = 5;
        this.projectileDamage = 8;
        this.projectileRadius = 6;
        this.projectileLifetime = 60;
        this.shootCooldown = 120;
        this.shootTimer = 0;
        this.wantsToShoot = false;
        this.targetX = 0;
        this.targetY = 0;
        // Edit mob stats based on type here @Rembo
        const mobConfig = mobs_json_1.default.find(mob => mob.type === type);
        if (mobConfig) {
            this.passive = mobConfig.passive;
            this.attack = mobConfig.attack;
            this.attack_radius = mobConfig.attack_radius;
            this.attack_arc = mobConfig.attack_arc;
            this.attack_arc_displacment = mobConfig.attack_arc_displacment;
            this.health = mobConfig.health;
            this.max_health = mobConfig.max_health;
            this.aspeed = mobConfig.aspeed;
            this.strike_time = mobConfig.strike_time;
            this.speed = mobConfig.speed;
            this.radius = mobConfig.radius;
            this.canShoot = mobConfig.canShoot || false; // Allow for ranged mobs
            if (this.canShoot) {
                // If the mob can shoot, override projectile properties from the config if available
                this.projectileType = mobConfig.projectileType || this.projectileType;
                this.projectileSpeed = mobConfig.projectileSpeed || this.projectileSpeed;
                this.projectileDamage = mobConfig.projectileDamage || this.projectileDamage;
                this.projectileRadius = mobConfig.projectileRadius || this.projectileRadius;
                this.projectileLifetime = mobConfig.projectileLifetime || this.projectileLifetime;
                this.shootCooldown = mobConfig.shootCooldown || this.shootCooldown;
            }
        }
        else {
            // Default values if no specific type is found in the config
            this.passive = true;
            this.attack = 5;
            this.attack_radius = 20;
            this.attack_arc = 0.2;
            this.attack_arc_displacment = 0;
            this.health = 100;
            this.max_health = 100;
            this.aspeed = 30; // SPEED OF AN ATTACK CYCLE (WHOLE NUMBERS ONLY)
            this.strike_time = 4; // POINT IN ATTACK CYCLE WHEN DAMAGE IS DEALT (WHOLE NUMBERS ONLY)
            this.speed = 1.8;
            this.radius = 20;
        }
        spatialHash.addEntity(this);
    }
    updateColl(x, y, radius, push) {
        const distance = Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2);
        if (distance < this.radius + radius) {
            const angle = Math.atan2(this.y - y, this.x - x);
            const pushs = this.radius + radius - distance;
            if (push) {
                this.x += Math.cos(angle) * pushs / 2;
                this.y += Math.sin(angle) * pushs / 2;
                x -= Math.cos(angle) * pushs / 2;
                y -= Math.cos(angle) * pushs / 2;
            }
            else {
                this.x += Math.cos(angle) * pushs;
                this.y += Math.sin(angle) * pushs;
            }
        }
        return { x, y };
    }
    update() {
        this.xvel = this.xvel * 0.8;
        this.yvel = this.yvel * 0.8;
        this.x += this.xvel;
        this.y += this.yvel;
        if (this.hit_time < 1) {
            if (this.health < this.max_health) {
                this.health++;
            }
        }
        else {
            this.hit_time--;
        }
    }
    deleteme(spatialHash) {
        spatialHash.removeEntity(this);
    }
    updateHashing(spatialHash) {
        spatialHash.removeEntity(this);
        this.update();
        spatialHash.addEntity(this);
    }
    mobidle() {
        if (this.action === 0) {
            this.xvel += this.speed / 2 * Math.cos(this.direction);
            this.yvel += this.speed / 2 * Math.sin(this.direction);
        }
        if (this.time < 0) {
            if (this.action === -1) {
                this.action = 0;
                this.direction = 2 * Math.PI * Math.random();
                this.time = 5 + Math.floor(Math.random() * 50);
            }
            else {
                this.action = -1;
                this.time = 5 + Math.floor(Math.random() * 200);
            }
        }
        this.time -= 1;
    }
    mobact(x, y, radius) {
        if (this.passive) {
            if (Math.abs(Math.atan2(this.y - y, this.x - x) - this.direction) > 1) {
                this.direction = Math.atan2(this.y - y, this.x - x);
            }
            else {
                this.direction += (Math.atan2(this.y - y, this.x - x) - this.direction) * 0.2;
            }
        }
        else {
            if (Math.abs(Math.atan2(this.y - y, this.x - x) + Math.PI - this.direction) > this.attack_arc) {
                this.direction = Math.atan2(this.y - y, this.x - x) + Math.PI;
            }
            else {
                this.direction += (Math.atan2(this.y - y, this.x - x) + Math.PI - this.direction) * 0.2;
            }
            if (this.canShoot) {
                const distanceToTarget = Math.sqrt((this.y - y) ** 2 + (this.x - x) ** 2);
                // Optimal shooting range - not too close, not too far
                if (distanceToTarget > this.radius + 200 &&
                    distanceToTarget < 400 && this.shootTimer <= 0) {
                    this.action = 2; // Use attack action state
                    this.time = this.aspeed;
                    // Set flags for shooting in onTick
                    this.wantsToShoot = true;
                    this.targetX = x;
                    this.targetY = y;
                    return; // Skip movement
                }
            }
            if (Math.sqrt((this.y - y) ** 2 + (this.x - x) ** 2) < this.radius + radius + this.attack_radius / 3 && Math.abs(Math.atan2(this.y - y, this.x - x) + Math.PI - this.direction) < this.attack_arc / 2) {
                this.action = 2;
                this.time = this.aspeed;
            }
        }
        const distanceToTarget = Math.sqrt((this.y - y) ** 2 + (this.x - x) ** 2);
        const optimalDistance = this.canShoot ? 250 : (this.radius + radius + 3);
        if (this.passive || distanceToTarget > optimalDistance) {
            this.xvel += this.speed * Math.cos(this.direction);
            this.yvel += this.speed * Math.sin(this.direction);
        }
        else if (this.canShoot && distanceToTarget < 250) {
            // Back away if too close
            this.xvel += this.speed / 3 * 2 * Math.cos(this.direction + Math.PI);
            this.yvel += this.speed / 3 * 2 * Math.sin(this.direction + Math.PI);
        }
        if (distanceToTarget > 800) {
            this.action = -1;
        }
    }
    mobdmg(x, y, radius, dmg, target, direction, attackradius = 40, attackarc = 2.2, attackarc_start = -0.5) {
        const distance = Math.sqrt((x - this.x) ** 2 + (y - this.y) ** 2);
        if (distance > radius + this.radius + attackradius)
            return;
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
            this.target = target;
            this.hit_time = 300;
            if (this.passive)
                this.action = 1;
        }
    }
}
exports.Mob = Mob;
__decorate([
    (0, schema_1.type)("string")
], Mob.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("number")
], Mob.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], Mob.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("number")
], Mob.prototype, "action", void 0);
__decorate([
    (0, schema_1.type)("number")
], Mob.prototype, "direction", void 0);
__decorate([
    (0, schema_1.type)("number")
], Mob.prototype, "health", void 0);
__decorate([
    (0, schema_1.type)("number")
], Mob.prototype, "max_health", void 0);
__decorate([
    (0, schema_1.type)("string")
], Mob.prototype, "type", void 0);
