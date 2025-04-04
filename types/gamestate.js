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
exports.GameState = void 0;
const schema_1 = require("@colyseus/schema");
const spatialhashing_1 = require("./spatialhashing");
const player_1 = require("./player");
const building_1 = require("./building");
const projectiles_1 = require("./projectiles");
const item_1 = require("./item");
const resource_1 = require("./resource"); // Import the Resource class for resources like trees, ores, etc.
const mob_1 = require("./mob"); // Import the Mob class for AI entities like animals or enemies
const team_1 = require("./team"); // Import the Team class for team management
const keys_json_1 = __importDefault(require("../data/keys.json"));
// Ensure you import the Item class
class GameState extends schema_1.Schema {
    constructor() {
        super();
        this.players = new schema_1.MapSchema();
        this.resources = new schema_1.MapSchema();
        this.mobs = new schema_1.MapSchema();
        this.items = new schema_1.MapSchema();
        this.teams = new schema_1.MapSchema();
        this.projectiles = new schema_1.MapSchema();
        this.buildings = new schema_1.MapSchema();
        this.Hash = new spatialhashing_1.SpatialHashing(1000);
        this.keys = keys_json_1.default;
    }
}
exports.GameState = GameState;
__decorate([
    (0, schema_1.type)({ map: player_1.Player })
], GameState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)({ map: resource_1.Resource })
], GameState.prototype, "resources", void 0);
__decorate([
    (0, schema_1.type)({ map: mob_1.Mob })
], GameState.prototype, "mobs", void 0);
__decorate([
    (0, schema_1.type)({ map: item_1.Item })
], GameState.prototype, "items", void 0);
__decorate([
    (0, schema_1.type)({ map: team_1.Team })
], GameState.prototype, "teams", void 0);
__decorate([
    (0, schema_1.type)({ map: projectiles_1.Projectile })
], GameState.prototype, "projectiles", void 0);
__decorate([
    (0, schema_1.type)({ map: building_1.Building })
], GameState.prototype, "buildings", void 0);
