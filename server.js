"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// https or http
const http = __importStar(require("http"));
const express_1 = __importDefault(require("express"));
const colyseus_1 = require("colyseus");
const colyseus_2 = require("colyseus");
// import * as fs from 'fs';       // Import fs to read SSL certificate files DEPLOY ONLY
const schema_1 = require("@colyseus/schema");
// importing the classes for the game logic
const player_1 = require("./types/player");
const inventoryitem_1 = require("./types/inventoryitem");
const building_1 = require("./types/building");
const projectiles_1 = require("./types/projectiles");
const item_1 = require("./types/item");
const resource_1 = require("./types/resource"); // Import the Resource class for resources like trees, ores, etc.
const mob_1 = require("./types/mob"); // Import the Mob class for AI entities like animals or enemies
const gamestate_1 = require("./types/gamestate");
// importing utility functions
const textfilters_1 = require("./utils/textfilters"); // Import the filter function for bad words
const textfilters_2 = require("./utils/textfilters");
// import handlers
const teamhandlers_1 = require("./handlers/teamhandlers");
const buildinghandler_1 = require("./handlers/buildinghandler");
const utilityhandlers_1 = require("./handlers/utilityhandlers"); // Import the utility class for position validation and finding valid positions
//import data files for replacements and other configurations
const replacements_json_1 = __importDefault(require("./data/replacements.json")); // Load the replacements data from JSON file.
const replacements = replacements_json_1.default;
const app = (0, express_1.default)();
const port = 3000; // testing
//const port = 80; //(http)
//const port = 443; // https:
// Load SSL certificates (update file paths to match where Certbot saved them) DEPLOY ONLY
//const privateKey = fs.readFileSync('/etc/letsencrypt/live/jagar.io/privkey.pem', 'utf8');
//const certificate = fs.readFileSync('/etc/letsencrypt/live/jagar.io/cert.pem', 'utf8');
//const ca = fs.readFileSync('/etc/letsencrypt/live/jagar.io/chain.pem', 'utf8');
// Express setup to serve static files
app.use(express_1.default.static('public'));
// deploy use only
/*
const server = http.createServer({
    key: privateKey,
    cert: certificate,
    ca: ca,
  },app);
*/
const server = http.createServer(app);
const gameServer = new colyseus_1.Server({
    server: server,
});
// Create a simple Colyseus Room
class Map extends colyseus_2.Room {
    constructor() {
        super(...arguments);
        this.state = new gamestate_1.GameState();
    }
    onCreate(options) {
        this.teamHandlers = new teamhandlers_1.TeamHandlers(this); // Initialize team handlers
        this.buildingHandler = new buildinghandler_1.buildingHandler(this); // Initialize building handler
        this.utility = new utilityhandlers_1.utility(this); // Initialize utility functions
        const resource = new resource_1.Resource("0", 0, 0, this.state.Hash, "tree");
        const mob = new mob_1.Mob("0", 90, 0, "pig", this.state.Hash);
        this.state.resources.set("0", resource);
        this.state.mobs.set("0", mob);
        let resource2 = new resource_1.Resource("1", 180, 50, this.state.Hash, "tree");
        this.state.resources.set(resource2.id, resource2);
        resource2 = new resource_1.Resource("2", 250, 250, this.state.Hash, "tree2");
        this.state.resources.set(resource2.id, resource2);
        resource2 = new resource_1.Resource("3", 100, 270, this.state.Hash, "tree3");
        this.state.resources.set(resource2.id, resource2);
        resource2 = new resource_1.Resource("4", -100, -270, this.state.Hash, "rock");
        this.state.resources.set(resource2.id, resource2);
        resource2 = new resource_1.Resource("5", 100, -260, this.state.Hash, "rock2");
        this.state.resources.set(resource2.id, resource2);
        resource2 = new resource_1.Resource("6", -600, -760, this.state.Hash, "rock3");
        this.state.resources.set(resource2.id, resource2);
        resource2 = new resource_1.Resource("7", -400, -400, this.state.Hash, "gold");
        this.state.resources.set(resource2.id, resource2);
        resource2 = new resource_1.Resource("8", -40, -200, this.state.Hash, "crystal");
        this.state.resources.set(resource2.id, resource2);
        let mob2 = new mob_1.Mob("1", 110, 8, "pig", this.state.Hash);
        this.state.mobs.set("1", mob2);
        mob2 = new mob_1.Mob("2", 110, 4, "spider", this.state.Hash);
        this.state.mobs.set("2", mob2);
        mob2 = new mob_1.Mob("3", 300, 300, "redspider", this.state.Hash);
        this.state.mobs.set(mob2.id, mob2);
        mob2 = new mob_1.Mob("4", -300, -300, "bear", this.state.Hash);
        this.state.mobs.set(mob2.id, mob2);
        mob2 = new mob_1.Mob("5", -300, 300, "polarbear", this.state.Hash);
        this.state.mobs.set(mob2.id, mob2);
        this.clock.start();
        this.clock.setInterval(() => {
            this.onTick();
        }, 1000 / 60);
        this.onMessage("move", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.move = message.move;
                player.direction = message.direction;
                player.ruse = message.ruse;
            }
            // Ensure the player exists in the state
        });
        this.onMessage("select", (client, select) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.select = select;
                player.updateStats();
            }
            // Ensure the player exists in the state
        });
        this.onMessage("chat", (client, chat) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.chat = (0, textfilters_2.shorten)((0, textfilters_1.filterBadWords)(chat, replacements), 120);
                player.chatdisplay = true;
                player.chat_timer = 150;
            }
            // Ensure the player exists in the state
        });
        this.onMessage("interact", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.interact_ticker = !player.interact_ticker;
                switch (true) {
                    case player.interact instanceof item_1.Item:
                        const item = player.interact;
                        //addItem(new InventoryItem("goldensword",1, 75,100, 0))
                        const result = player.addItem(new inventoryitem_1.InventoryItem(item.name, item.quantity, item.durability, item.maxDurability, item.maxStack, item.equipSlot));
                        if (result === item.quantity) {
                            const flooritem = this.state.items.get(item.id);
                            if (flooritem) {
                                flooritem.deleteme(this.state.Hash);
                                this.state.items.delete(item.id);
                            }
                        }
                        else {
                            const flooritem = this.state.items.get(item.id);
                            if (flooritem) {
                                flooritem.quantity -= result;
                                if (flooritem.quantity <= 0) {
                                    flooritem.deleteme(this.state.Hash);
                                    this.state.items.delete(item.id);
                                }
                            }
                        }
                        break;
                }
            }
            // Ensure the player exists in the state
        });
        this.onMessage("toss", (client, target) => {
            const player = this.state.players.get(client.sessionId);
            if (!player)
                return;
            // Helper function to create floor item at valid position
            const createFloorItem = (itemObj) => {
                const position = this.utility.findValidItemPosition(player.x + player.radius * Math.cos(player.direction - Math.PI / 2) * 1.5, player.y + player.radius * Math.sin(player.direction - Math.PI / 2) * 1.5, this.state.Hash);
                const floorItem = new item_1.Item(Math.random().toString(), position.x, position.y, this.state.Hash, itemObj.name, itemObj.quantity, itemObj.durability, itemObj.maxDurability, itemObj.maxStack, itemObj.equipSlot);
                this.state.items.set(floorItem.id, floorItem);
            };
            // Check if target is specified
            if (target) {
                // Case 1: Equipment item (target starts with "equip_")
                if (typeof target === 'string' && target.startsWith('equip_')) {
                    const equipSlot = target.substring(6); // Remove "equip_" prefix
                    const equipItem = player.equipment.slots.get(equipSlot);
                    if (equipItem) {
                        // Create floor item
                        createFloorItem(equipItem);
                        // Remove from equipment
                        player.equipment.slots.delete(equipSlot);
                        // Update player stats
                        player.right = "hand";
                        player.updateStats();
                    }
                }
                // Case 2: Inventory item
                else {
                    const item = player.inventory.slots.get(target);
                    if (item) {
                        // Create floor item
                        createFloorItem(item);
                        // Remove from inventory
                        player.inventory.removeSlot(target);
                        // Update player stats
                        player.right = "hand";
                        player.updateStats();
                    }
                }
            }
            // No target specified - toss selected item
            else {
                const item = player.inventory.slots.get(player.select.toString());
                if (item) {
                    // Create floor item
                    createFloorItem(item);
                    // Remove from inventory
                    player.inventory.removeSlot(player.select);
                    // Update player stats
                    player.right = "hand";
                    player.updateStats();
                }
            }
        });
        this.onMessage("moveItem", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                // Special case for picking up an item without placing it yet
                if (message.toslot === -1) {
                    //console.log(`Player ${client.sessionId} picked up item from slot ${message.fromslot}`);
                    return;
                }
                // Regular item movement between inventory slots
                if (message.from === "inv" && message.to === "inv") {
                    console.log("inv movement");
                    // Get references to the items before they're moved
                    const fromKey = message.fromslot.toString();
                    const toKey = message.toslot.toString();
                    // Whether the source and destination slots have items
                    //const hasSourceItem = player.inventory.slots.get(fromKey) !== undefined;
                    //const hasDestItem = player.inventory.slots.get(toKey) !== undefined;
                    // Perform the actual move/swap
                    player.moveInventoryItem(message.fromslot, message.toslot);
                    player.updateStats();
                }
                else if (message.from === "equip" && message.to === "inv") {
                    const equipSlot = message.fromslot.toString(); // "hat" or "shield"
                    const invSlot = parseInt(message.toslot.toString());
                    player.updateStats();
                    player.unequipItem(equipSlot, invSlot);
                    console.log("cya");
                    console.log(equipSlot);
                    console.log(invSlot);
                }
                else if (message.from === "inv" && message.to === "equip") {
                    const invSlot = parseInt(message.fromslot.toString());
                    player.equipItemFromInventory(invSlot);
                    console.log("hi");
                    console.log(invSlot);
                    player.updateStats();
                }
                player.inventory.Version();
            }
            // Ensure the player exists in the state
        });
        this.onMessage("splitStack", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player)
                return;
            const fromSlotKey = message.fromSlot.toString();
            const item = player.inventory.slots.get(fromSlotKey);
            if (!item || item.quantity <= 1 || item.quantity < message.quantity) {
                return; // Invalid request
            }
            // Reduce quantity in original slot
            item.quantity -= message.quantity;
            // Create a new item with the split quantity
            const splitItem = new inventoryitem_1.InventoryItem(item.name, message.quantity, item.durability, item.maxDurability, item.maxStack, item.equipSlot);
            // Give the split item to the player's mouse
            const freeSlot = player.inventory.getFreeSlot();
            if (freeSlot !== null) {
                player.inventory.slots.set(freeSlot.toString(), splitItem);
                player.inventory.Version();
            }
            else {
                // If no free slot, drop it on the ground
                const position = this.utility.findValidItemPosition(player.x + player.radius * Math.cos(player.direction - Math.PI / 2) * 1.5, player.y + player.radius * Math.sin(player.direction - Math.PI / 2) * 1.5, this.state.Hash);
                const floorItem = new item_1.Item(Math.random().toString(), position.x, position.y, this.state.Hash, splitItem.name, splitItem.quantity, splitItem.durability, splitItem.maxDurability, splitItem.maxStack);
                this.state.items.set(floorItem.id, floorItem);
            }
        });
        this.onMessage("craft", (client, message) => {
            console.log(message.recipie);
            const player = this.state.players.get(client.sessionId);
            if (player) {
                switch (message.recipie) {
                    case "goldensword":
                        if (player.getQuantity("wood") >= 2 && player.getQuantity("gold") >= 5) {
                            player.removeInventoryItem("wood", 2);
                            player.removeInventoryItem("gold", 5);
                            const result = player.addItem(new inventoryitem_1.InventoryItem("goldensword", 1, 100, 100, 0));
                            if (result < 1) {
                                // If the inventory is full, drop the item on the ground
                                const position = this.utility.findValidItemPosition(player.x + player.radius * Math.cos(player.direction - Math.PI / 2) * 1.5, player.y + player.radius * Math.sin(player.direction - Math.PI / 2) * 1.5, this.state.Hash);
                                const floorItem = new item_1.Item(Math.random().toString(), position.x, position.y, this.state.Hash, "goldensword", 1, 100, 100, 0);
                                this.state.items.set(floorItem.id, floorItem);
                            }
                        }
                        break;
                    case "woodenshield":
                        if (player.getQuantity("wood") >= 2) {
                            player.removeInventoryItem("wood", 2);
                            player.removeInventoryItem("gold", 5);
                            const result = player.addItem(new inventoryitem_1.InventoryItem("woodenshield", 1, 0, 0, 0, "shield"));
                            if (result < 1) {
                                // If the inventory is full, drop the item on the ground
                                const position = this.utility.findValidItemPosition(player.x + player.radius * Math.cos(player.direction - Math.PI / 2) * 1.5, player.y + player.radius * Math.sin(player.direction - Math.PI / 2) * 1.5, this.state.Hash);
                                const floorItem = new item_1.Item(Math.random().toString(), position.x, position.y, this.state.Hash, "woodenshield", 1, 0, 0, 0);
                                this.state.items.set(floorItem.id, floorItem);
                            }
                        }
                        break;
                }
            }
        });
        //building events
        //Team Events
        this.onMessage("createTeam", (client, message) => {
            this.teamHandlers.handleCreateTeam(client, message.teamName);
        });
        this.onMessage("placeBuilding", (client, message) => {
            this.buildingHandler.handlePlaceBuilding(client, message);
        });
        this.onMessage("joinTeam", (client, message) => {
            this.teamHandlers.handleJoinTeam(client, message.teamId);
        });
        this.onMessage("leaveTeam", (client) => {
            this.teamHandlers.handleLeaveTeam(client);
        });
        this.onMessage("transferLeadership", (client, message) => {
            this.teamHandlers.handleTransferLeadership(client, message.newLeaderId);
        });
        this.onMessage("kickMember", (client, message) => {
            this.teamHandlers.handleKickMember(client, message.memberId);
        });
        this.onMessage("requestJoinTeam", (client, message) => {
            this.teamHandlers.handleTeamJoinRequest(client, message.teamId);
        });
        this.onMessage("responseJoinTeam", (client, message) => {
            this.teamHandlers.handleTeamJoinResponse(client, message.playerId, message.teamId, message.accepted, message.timeout);
        });
        this.onMessage("teamChat", (client, message) => {
            this.teamHandlers.handleTeamChatMessage(client, message.message);
        });
        this.onMessage("*", (client, type, message) => {
            console.log("Unkonwn message received");
            console.log("received message:", type, message);
        });
    }
    onAuth(client, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { nickname, passkey } = options;
            if (passkey !== "squishbugs") {
                if (!this.state.keys.hasOwnProperty(passkey)) {
                    throw new Error("Invalid passkey!");
                }
                if (this.state.keys[passkey] !== null) {
                    throw new Error("Passkey already in use!");
                }
                this.state.keys[passkey] = client.sessionId;
            }
            console.log(`${nickname} authenticated with passkey: ${passkey}`);
            return { nickname, passkey };
        });
    }
    onJoin(client, options, auth) {
        console.log(`${client.sessionId} joined the room`);
        const player = new player_1.Player(client.sessionId, this.state.Hash, (0, textfilters_2.shorten)((0, textfilters_1.filterBadWords)(auth.nickname, replacements), 25), auth.passkey);
        this.state.players.set(client.sessionId, player);
        client.view = new schema_1.StateView();
        client.view.add(player);
        //client.view.add(player.inventory);
        //client.view.add(player.inventory.slots);
    }
    onLeave(client) {
        console.log(`${client.sessionId} left the room`);
        const player = this.state.players.get(client.sessionId);
        if (player) {
            if (player.team !== "") {
                this.teamHandlers.handleLeaveTeam(client);
            }
            if (player.passkey !== "squishbugs") {
                this.state.keys[player.passkey] = null;
                console.log(this.state.keys);
            }
            player.deleteme(this.state.Hash);
            this.state.players.delete(client.sessionId);
        }
    }
    onTick() {
        // Collision check  with hashing
        const hash = this.state.Hash;
        //update projectiles
        this.buildingHandler.updateBuildings(1 / 60);
        this.state.projectiles.forEach((projectile, id) => {
            // Update position
            projectile.updateHashing(hash);
            // Check lifetime
            if (projectile.lifetime <= 0) {
                projectile.deleteme(hash);
                this.state.projectiles.delete(id);
                return;
            }
            // Check collisions with nearby entities
            const nearby = hash.getNearbyEntities(projectile.x, projectile.y);
            let hasCollided = false;
            nearby.forEach((entity) => {
                // Skip if already collided or if hitting owner
                if (hasCollided || entity.id === projectile.ownerId)
                    return;
                // Calculate distance
                const distance = Math.sqrt((projectile.x - entity.x) ** 2 +
                    (projectile.y - entity.y) ** 2);
                switch (true) {
                    case entity instanceof player_1.Player:
                        // Skip if on same team (for team projectiles)
                        const owner = this.state.players.get(projectile.ownerId) ||
                            this.state.mobs.get(projectile.ownerId);
                        if (owner instanceof player_1.Player &&
                            owner.team &&
                            owner.team === entity.team &&
                            owner.team !== "") {
                            return;
                        }
                        // Check collision
                        if (distance < projectile.radius + entity.radius) {
                            // Deal damage
                            entity.health -= projectile.damage;
                            entity.health_t = entity.health_t_tot;
                            // Mark for deletion
                            hasCollided = true;
                        }
                        break;
                    case entity instanceof mob_1.Mob:
                        // Only check player-fired projectiles hitting mobs
                        if (this.state.players.has(projectile.ownerId)) {
                            if (distance < projectile.radius + entity.radius) {
                                // Deal damage to mob
                                entity.health -= projectile.damage;
                                entity.target = projectile.ownerId; // Aggro
                                entity.hit_time = 300;
                                // Mark for deletion
                                hasCollided = true;
                            }
                        }
                        else {
                            if (distance < projectile.radius + entity.radius) {
                                // Deal damage to mob
                                entity.health -= projectile.damage;
                                entity.hit_time = 300;
                                // Mark for deletion
                                hasCollided = true;
                            }
                        }
                        break;
                    case entity instanceof resource_1.Resource:
                        // Check for terrain collisions
                        if (distance < projectile.radius + entity.radius) {
                            hasCollided = true;
                        }
                        break;
                }
            });
            // Remove projectile if it hit something
            if (hasCollided) {
                projectile.deleteme(hash);
                this.state.projectiles.delete(id);
            }
        });
        this.state.mobs.forEach((mob, id) => {
            if (mob.isBeingRemoved || mob.health < 1) {
                this.utility.drops(mob.type, mob.x, mob.y, hash);
                mob.deleteme(this.state.Hash);
                this.state.mobs.delete(id);
            }
            else {
                mob.updated = false;
                if (mob.action === 2 && mob.time === mob.strike_time && mob.wantsToShoot) {
                    // Create projectile
                    const projectileId = `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                    // Calculate velocity
                    const dx = mob.targetX - mob.x;
                    const dy = mob.targetY - mob.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const velX = (dx / length) * mob.projectileSpeed;
                    const velY = (dy / length) * mob.projectileSpeed;
                    // Create projectile
                    const projectile = new projectiles_1.Projectile(projectileId, mob.id, mob.x + mob.radius * Math.cos(mob.direction), mob.y + mob.radius * Math.sin(mob.direction), velX, velY, mob.projectileDamage, mob.projectileType, mob.projectileRadius, mob.projectileLifetime, hash);
                    // Add to game state
                    this.state.projectiles.set(projectileId, projectile);
                    // Reset shooting state
                    mob.wantsToShoot = false;
                    mob.shootTimer = mob.shootCooldown;
                }
                // Decrease shooting cooldown timer
                if (mob.shootTimer > 0) {
                    mob.shootTimer--;
                }
            }
        });
        this.state.players.forEach((player) => {
            if (player.checkDeath()) {
                const client = this.clients.find(c => c.sessionId === player.id);
                if (client) {
                    this.handlePlayerDeath(client);
                    return; // Skip further processing for dead players
                }
            }
            //Item notifcations
            if (player.lastItemAdded) {
                // Send notification to the specific client
                const client = this.clients.find(c => c.sessionId === player.id);
                if (client) {
                    client.send("itemAdded", player.lastItemAdded);
                }
                // Clear the notification to avoid sending it again
                player.lastItemAdded = null;
            }
            if (player) {
                player.interact = null;
                player.interact_distance = 180;
                player.updateHashing(hash);
                const nearby = hash.getNearbyEntities(player.x, player.y);
                nearby.forEach((entity) => {
                    // collision detection
                    switch (true) {
                        case entity instanceof player_1.Player:
                            if (player.id !== entity.id) {
                                player.updateColl(entity.x, entity.y, entity.radius, true);
                            }
                            break;
                        case entity instanceof mob_1.Mob:
                            //Mob Collision
                            ({ x: entity.x, y: entity.y } = player.updateColl(entity.x, entity.y, entity.radius, true));
                            //Mobs are only updated when near another player to reduce server computations
                            //update mob
                            if (!entity.updated) {
                                if (entity.health < 1) {
                                    ///mobs dying
                                    entity.updated = true;
                                    entity.isBeingRemoved = true;
                                    this.utility.drops(entity.type, entity.x, entity.y, hash);
                                    entity.deleteme(hash);
                                    this.state.mobs.delete(entity.id);
                                    return;
                                }
                                else {
                                    entity.updated = true;
                                    entity.updateHashing(hash);
                                    if (entity.action === 2) {
                                        entity.time--;
                                        if (entity.time === 0) {
                                            const mobTarget = this.state.players.get(entity.target);
                                            if (mobTarget) {
                                                if (Math.sqrt((entity.y - mobTarget.y) ** 2 + (entity.x - mobTarget.x) ** 2) < entity.radius + mobTarget.radius + entity.attack_radius / 3 && Math.abs(Math.atan2(entity.y - mobTarget.y, entity.x - mobTarget.x) + Math.PI - entity.direction) < entity.attack_arc / 2) {
                                                    entity.time = entity.aspeed;
                                                }
                                                else {
                                                    entity.action = 1;
                                                }
                                            }
                                            else {
                                                entity.action = 1;
                                            }
                                        }
                                    }
                                    else if (entity.action === 1) {
                                        const aplayer = this.state.players.get(entity.target);
                                        if (aplayer) {
                                            entity.mobact(aplayer.x, aplayer.y, aplayer.radius);
                                        }
                                        else {
                                            entity.action = -1;
                                            entity.time = 20;
                                        }
                                    }
                                    else {
                                        entity.mobidle();
                                        if (Math.sqrt((player.x - entity.x) ** 2 + (player.y - entity.y) ** 2) < 150 + entity.radius && !entity.passive) {
                                            entity.action = 1;
                                            entity.target = player.id;
                                        }
                                    }
                                    //Mob collisions and attacks
                                    const mnearby = hash.getNearbyEntities(entity.x, entity.y);
                                    mnearby.forEach((oentity) => {
                                        switch (true) {
                                            case oentity instanceof resource_1.Resource:
                                                entity.updateColl(oentity.x, oentity.y, oentity.radius, false);
                                                break;
                                            case oentity instanceof mob_1.Mob:
                                                if (entity.id !== oentity.id) {
                                                    ({ x: oentity.x, y: oentity.y } = entity.updateColl(oentity.x, oentity.y, oentity.radius, true));
                                                }
                                                break;
                                            case oentity instanceof building_1.Building:
                                                const newMobPosition = oentity.resolveCollision(entity);
                                                entity.x = newMobPosition.x;
                                                entity.y = newMobPosition.y;
                                                break;
                                            case oentity instanceof player_1.Player:
                                                if (entity.action === 2 && entity.time === entity.strike_time) {
                                                    //hits the player
                                                    if (oentity && entity) {
                                                        oentity.playerdmg(entity.x, entity.y, entity.radius, entity.attack, entity.direction + Math.PI / 2, entity.attack_radius, entity.attack_arc, entity.attack_arc_displacment);
                                                    }
                                                }
                                                break;
                                            default:
                                            //do nothing
                                        }
                                    });
                                    // end Mob collisions
                                }
                            }
                            else {
                                if (Math.sqrt((player.x - entity.x) ** 2 + (player.y - entity.y) ** 2) < 150 + entity.radius && !entity.passive && (entity.action === 0 || entity.action === -1)) {
                                    entity.action = 1;
                                    entity.target = player.id;
                                }
                            }
                            //end mob updates
                            break;
                        case entity instanceof resource_1.Resource:
                            if (player) {
                                player.updateColl(entity.x, entity.y, entity.radius, false);
                            }
                            break;
                        case entity instanceof item_1.Item:
                            const distance = Math.sqrt((player.x - entity.x) ** 2 + (player.y - entity.y) ** 2);
                            if (distance < player.interact_distance) {
                                player.interact_distance = distance;
                                player.interact = entity;
                            }
                            break;
                        case entity instanceof building_1.Building:
                            // Handle building collision
                            const newPosition = entity.resolveCollision(player);
                            if (newPosition) {
                                player.x = newPosition.x;
                                player.y = newPosition.y;
                            }
                            break;
                    }
                });
                //player hit detection
                if (player.ruse_t === player.strike_time) {
                    const itemheld = player.inventory.slots.get(player.select.toString());
                    if (itemheld) {
                        if (itemheld.maxDurability > 0) {
                            itemheld.durability--;
                            if (itemheld.durability < 1) {
                                player.inventory.removeSlot(player.select);
                                player.right = "hand";
                                player.updateStats();
                            }
                            else {
                                player.inventory.Version();
                            }
                        }
                    }
                    player.stamina += player.stam_cost;
                    player.stamina_recovery = player.stam_recov;
                    nearby.forEach((entity) => {
                        switch (true) {
                            case entity instanceof mob_1.Mob:
                                entity.mobdmg(player.x, player.y, player.radius, player.attack, player.id, player.direction, player.attack_radius, player.attack_arc, player.attack_arc_start);
                                break;
                            case entity instanceof player_1.Player:
                                if (player.team != entity.team || (entity.team === "" && player.id != entity.id)) {
                                    entity.playerdmg(player.x, player.y, player.radius, player.attack, player.direction, player.attack_radius, player.attack_arc, player.attack_arc_start);
                                }
                                break;
                            case entity instanceof resource_1.Resource:
                                if (entity.resourcedmg(player.x, player.y, player.radius, player.attack, player.direction, player.attack_radius, player.attack_arc, player.attack_arc_start)) {
                                    switch (entity.type) {
                                        case "tree":
                                        case "tree2":
                                        case "tree3":
                                            player.addItem(new inventoryitem_1.InventoryItem("wood", player.tree_dmg));
                                            break;
                                        case "rock":
                                        case "rock2":
                                        case "rock3":
                                            player.addItem(new inventoryitem_1.InventoryItem("stone", player.ore_dmg));
                                            break;
                                        case "gold":
                                            player.addItem(new inventoryitem_1.InventoryItem("gold", player.ore_dmg));
                                            break;
                                        case "crystal":
                                            player.addItem(new inventoryitem_1.InventoryItem("crystal", player.ore_dmg));
                                            break;
                                        default:
                                    }
                                }
                                break;
                            case entity instanceof building_1.Building:
                                if (entity.buildingdmg(player.x, player.y, player.radius, player.attack, player.direction, player.attack_radius, player.attack_arc, player.attack_arc_start)) {
                                    // If building was destroyed (health == 0)
                                    if (entity.health <= 0) {
                                        // Drop resources
                                        this.buildingHandler.dropBuildingResources(entity.type, entity.x, entity.y);
                                        // Remove the building
                                        entity.deleteme(this.state.Hash);
                                        this.state.buildings.delete(entity.id);
                                    }
                                }
                            default:
                            // do nothing
                        }
                    });
                }
                if (player.ruse && player.ruse_t <= 0) {
                    player.ruse_t = player.use_speed;
                }
                //end player hit detection
            }
        });
    }
    // Handle player disconnect
    handlePlayerDeath(client) {
        const player = this.state.players.get(client.sessionId);
        if (!player)
            return;
        player.inventory.slots.forEach((item, slotKey) => {
            // Create the item
            this.utility.createItemAtValidPosition(player.x, player.y, this.state.Hash, item.name, {
                exactQuantity: item.quantity,
                dropChance: 1
            });
        });
        // Drop equipment items
        player.equipment.slots.forEach((item, slotKey) => {
            this.utility.createItemAtValidPosition(player.x, player.y, this.state.Hash, item.name, {
                exactQuantity: 1,
                dropChance: 1
            });
        });
        // Clear inventory and equipment
        player.inventory.slots.clear();
        player.equipment.slots.clear();
        // Send death message to client
        client.send("playerDeath", {
            x: player.x,
            y: player.y
        });
        // If the player is in a team, handle leaving the team
        if (player.team !== "") {
            this.teamHandlers.handleLeaveTeam(client);
        }
        // Release the player's passkey
        if (player.passkey !== "squishbugs") {
            this.state.keys[player.passkey] = null;
        }
        // Remove player from spatial hash and state
        player.deleteme(this.state.Hash);
        this.state.players.delete(client.sessionId);
        // Disconnect the client (with delay to ensure messages are sent)
        setTimeout(() => {
            client.leave();
        }, 100);
    }
}
gameServer.define('Map', Map);
// For hosting (on port 80 for http) (443 for https) , "0.0.0.0"
server.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port ${port}`);
});
