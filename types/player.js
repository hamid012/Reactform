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
exports.Player = void 0;
const schema_1 = require("@colyseus/schema");
const Inventory_1 = require("./Inventory");
const equipment_1 = require("./equipment");
const item_1 = require("./item"); // Ensure you import the Item class
const hotbar_items_json_1 = __importDefault(require("../data/items/hotbar_items.json"));
class Player extends schema_1.Schema {
    constructor(id, spatialHash, nickname = "Unkown", passkey = "") {
        super();
        this.inventory = new Inventory_1.Inventory();
        //@view() @type({ map: Inventory }) inventory = new MapSchema<Inventory>();
        this.equipment = new equipment_1.Equipment();
        this.id = id;
        this.nickname = nickname;
        this.team = "";
        this.x = Math.random() * 800 - 600;
        this.y = Math.random() * 800 - 600;
        this.xvel = 0;
        this.yvel = 0;
        this.health = 100;
        this.max_health = 100;
        this.stamina = 100;
        this.max_stamina = 100;
        this.stamina_recovery = 0;
        this.health_t = 0;
        this.health_t_tot = 300;
        this.move = -1;
        this.direction = 0;
        this.speed = 11;
        this.radius = 25;
        this.ruse = false;
        this.ruse_t = 0;
        this.select = 0;
        this.passkey = passkey;
        this.chat = "";
        this.chatdisplay = false;
        this.chat_timer = 0;
        //hereeeee
        this.attack = 6;
        this.attack_arc = 2.2;
        this.attack_arc_start = -0.5;
        this.attack_radius = 35;
        this.strike_time = 2;
        this.use_speed = 10;
        this.stam_cost = 0;
        this.stam_recov = 80;
        this.right = "hand";
        this.interact = null;
        this.interact_distance = 100;
        this.interact_ticker = false;
        this.tree_dmg = 1;
        this.ore_dmg = 1;
        this.lastItemAdded = null;
        spatialHash.addEntity(this);
    }
    updateMovement() {
        if (this.move !== -1) {
            if (0 < this.stamina) {
                this.xvel += this.speed * Math.cos(this.move);
                this.yvel += this.speed * -Math.sin(this.move);
            }
            else {
                this.xvel += this.speed * Math.cos(this.move) / 2;
                this.yvel += this.speed * -Math.sin(this.move) / 2;
            }
        }
        this.x += this.xvel;
        this.y += this.yvel;
        this.xvel = this.xvel * 0.1;
        this.yvel = this.yvel * 0.1;
        if (this.ruse_t > 0) {
            this.ruse_t--;
        }
        if (this.health_t === 0 && this.health < this.max_health) {
            this.health++;
        }
        else {
            this.health_t--;
        }
        if (this.stamina_recovery === 0 && this.stamina < this.max_stamina) {
            this.stamina++;
        }
        else {
            this.stamina_recovery--;
        }
        if (this.chat_timer < 1) {
            this.chatdisplay = false;
        }
        else {
            this.chat_timer--;
        }
    }
    deleteme(spatialHash) {
        spatialHash.removeEntity(this);
    }
    updateHashing(spatialHash) {
        spatialHash.removeEntity(this);
        this.updateMovement();
        spatialHash.addEntity(this);
    }
    playerdmg(x, y, radius, dmg, direction, attackradius = 10, attackarc = 0.2, attackarc_start = 0) {
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
            this.health_t = this.health_t_tot;
        }
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
    checkDeath() {
        return this.health <= 0;
    }
    dropAllItems(spatialHash) {
        const droppedItems = [];
        // Get all inventory slots
        this.inventory.slots.forEach((item, key) => {
            if (item) {
                // Calculate a random position near the player
                const angle = Math.random() * Math.PI * 2;
                const distance = this.radius + 10 + Math.random() * 30;
                const position = {
                    x: this.x + Math.cos(angle) * distance,
                    y: this.y + Math.sin(angle) * distance
                };
                // Create a floor item
                const floorItem = new item_1.Item(Math.random().toString(), position.x, position.y, spatialHash, item.name, item.quantity, item.durability, item.maxDurability, item.maxStack);
                // Add to dropped items array
                droppedItems.push(floorItem);
            }
        });
        // Also drop equipped items
        this.equipment.slots.forEach((item, key) => {
            if (item) {
                const angle = Math.random() * Math.PI * 2;
                const distance = this.radius + 10 + Math.random() * 30;
                const position = {
                    x: this.x + Math.cos(angle) * distance,
                    y: this.y + Math.sin(angle) * distance
                };
                const floorItem = new item_1.Item(Math.random().toString(), position.x, position.y, spatialHash, item.name, item.quantity, item.durability, item.maxDurability, item.maxStack);
                droppedItems.push(floorItem);
            }
        });
        // Clear inventory and equipment
        this.inventory = new Inventory_1.Inventory();
        this.equipment = new equipment_1.Equipment();
        return droppedItems;
    }
    addItem(newItem, targetSlot) {
        const initialQuantity = this.getQuantity(newItem.name);
        if (newItem.equipSlot && newItem.equipSlot !== "") {
            if (!this.equipment.slots.get(newItem.equipSlot)) {
                this.equipment.slots.set(newItem.equipSlot, newItem);
                console.log(`Auto-equipped ${newItem.name} into slot ${newItem.equipSlot}`);
                this.inventory.Version();
                return 1; // Return 1 to indicate that the item was added and equipped
            }
        }
        this.inventory.addItem(newItem, targetSlot);
        const newQuantity = this.getQuantity(newItem.name);
        const addedQuantity = newQuantity - initialQuantity;
        if (addedQuantity > 0) {
            this.lastItemAdded = {
                itemName: newItem.name,
                quantity: addedQuantity
            };
        }
        this.updateStats();
        this.inventory.Version();
        return addedQuantity;
    }
    equipItemFromInventory(inventorySlot) {
        const slotKey = inventorySlot.toString();
        const item = this.inventory.slots.get(slotKey);
        if (!item) {
            console.log(`No item in inventory slot ${inventorySlot}`);
            return;
        }
        if (item.equipSlot && item.equipSlot !== "") {
            // If an item is already equipped in that slot, swap it.
            if (this.equipment.slots.get(item.equipSlot)) {
                const currentlyEquipped = this.equipment.slots.get(item.equipSlot);
                // Try to put the currently equipped item back into inventory.
                const freeSlot = this.inventory.getFreeSlot();
                if (freeSlot !== null && currentlyEquipped) {
                    this.inventory.slots.set(freeSlot.toString(), currentlyEquipped);
                    console.log(`Swapped out ${currentlyEquipped.name} from ${item.equipSlot}`);
                }
                else {
                    console.log("No free inventory slot available for the currently equipped item.");
                    return;
                }
            }
            // Equip the new item.
            this.equipment.slots.set(item.equipSlot, item);
            this.inventory.slots.delete(slotKey);
            console.log(`Equipped ${item.name} into slot ${item.equipSlot}`);
        }
        else {
            console.log(`Item in inventory slot ${inventorySlot} is not equippable.`);
        }
        this.updateStats();
    }
    unequipItem(equipSlot, targetSlot) {
        const item = this.equipment.slots.get(equipSlot);
        if (!item) {
            console.log(`No item equipped in slot ${equipSlot}`);
            return;
        }
        // Try to put the item in a specific inventory slot if provided.
        if (targetSlot !== undefined) {
            const key = targetSlot.toString();
            if (this.inventory.slots.get(key)) {
                console.log(`Inventory slot ${targetSlot} is already occupied.`);
                return;
            }
            this.inventory.slots.set(key, item);
        }
        else {
            // Otherwise, find the first free slot.
            const freeSlot = this.inventory.getFreeSlot();
            if (freeSlot !== null) {
                this.inventory.slots.set(freeSlot.toString(), item);
            }
            else {
                console.log("No free inventory slot available.");
                return;
            }
        }
        this.equipment.slots.delete(equipSlot);
        console.log(`Unequipped ${item.name} from slot ${equipSlot}`);
        this.updateStats();
    }
    moveInventoryItem(fromSlot, toSlot) {
        this.inventory.moveItem(fromSlot, toSlot);
        this.updateStats;
    }
    removeInventoryItem(item, quantity) {
        const temp = this.inventory.removeItem(item, quantity);
        this.updateStats;
        return temp;
    }
    getQuantity(item) {
        return this.inventory.getTotalQuantity(item);
    }
    updateStats() {
        const selectedKey = this.select.toString();
        //const selectedItem: InventoryItem = (this.inventory.slots as any)[selectedKey];
        const selectedItem = this.inventory.slots.get(selectedKey);
        if (selectedItem) {
            let selectedItemconfig = hotbar_items_json_1.default.find(weapon => weapon.type === selectedItem.name); // Find the weapon config based on the item name
            if (!selectedItemconfig) {
                selectedItemconfig = hotbar_items_json_1.default.find(weapon => weapon.type === "hand");
            }
            if (selectedItemconfig) {
                this.right = selectedItemconfig.type; // e.g., "hand" or "off-hand"
                this.stam_cost = selectedItemconfig.stam_cost || 0;
                this.attack_arc = selectedItemconfig.attack_arc || 0.5;
                this.attack_arc_start = selectedItemconfig.attack_arc_start || 0;
                this.attack_radius = selectedItemconfig.attack_radius || 20;
                this.strike_time = selectedItemconfig.strike_time || 2;
                this.use_speed = selectedItemconfig.use_speed || 10;
                this.tree_dmg = selectedItemconfig.tree_dmg || 1;
                this.ore_dmg = selectedItemconfig.ore_dmg || 1;
                this.attack = selectedItemconfig.attack;
            }
        }
        else {
            const selectedItemconfig = hotbar_items_json_1.default.find(weapon => weapon.type === "hand");
            if (selectedItemconfig) {
                this.right = selectedItemconfig.type; // e.g., "hand" or "off-hand"
                this.stam_cost = selectedItemconfig.stam_cost || 0;
                this.attack_arc = selectedItemconfig.attack_arc || 0.5;
                this.attack_arc_start = selectedItemconfig.attack_arc_start || 0;
                this.attack_radius = selectedItemconfig.attack_radius || 20;
                this.strike_time = selectedItemconfig.strike_time || 2;
                this.use_speed = selectedItemconfig.use_speed || 10;
                this.tree_dmg = selectedItemconfig.tree_dmg || 1;
                this.ore_dmg = selectedItemconfig.ore_dmg || 1;
                this.attack = selectedItemconfig.attack;
            }
            else {
                this.right = "hand";
                this.stam_cost = 0;
                this.attack_arc = 0.5;
                this.attack_arc_start = 0;
                this.attack_radius = 20;
                this.strike_time = 4;
                this.use_speed = 7;
                this.tree_dmg = 1;
                this.ore_dmg = 1;
                this.attack = 6;
            }
        }
    }
}
exports.Player = Player;
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "nickname", void 0);
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "team", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "move", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "direction", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "health", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "max_health", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "stamina", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "max_stamina", void 0);
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "right", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Player.prototype, "ruse", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "ruse_t", void 0);
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "chat", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Player.prototype, "chatdisplay", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Player.prototype, "interact_ticker", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "use_speed", void 0);
__decorate([
    (0, schema_1.type)(Inventory_1.Inventory)
], Player.prototype, "inventory", void 0);
__decorate([
    (0, schema_1.type)(equipment_1.Equipment)
], Player.prototype, "equipment", void 0);
