import { Schema, type} from '@colyseus/schema';
import type { SpatialHashing } from './spatialhashing';
import { Inventory } from './Inventory';
import type { InventoryItem } from './inventoryitem'; // Ensure you import the InventoryItem type for type checking
import { Equipment } from './equipment';
import { Item } from './item'; // Ensure you import the Item class
import WEAPONS from '../data/items/hotbar_items.json';
export class Player extends Schema {
    @type("string") id: string; // Player ID (can be any unique identifier)
    @type("string") nickname: string;
    @type("string") team: string;
    @type("number") x: number; // Player's X position
    @type("number") y: number; // Player's Y position
    xvel: number; // Player's X velocity
    yvel: number; // Player's Y velocity
    @type("number") move: number; // Whether the player is currently moving
    @type("number") direction: number;
    @type("number") health: number;
    @type("number") max_health: number;
    @type("number") stamina: number;
    @type("number") max_stamina: number;
    stamina_recovery: number;
    health_t: number;
    health_t_tot: number
    speed: number;
    radius: number;
    @type("string") right: string;
    @type("boolean") ruse: boolean;
    @type("number") ruse_t : number;
    @type("string") chat : string;
    @type("boolean") chatdisplay: boolean;
    @type("boolean") interact_ticker: boolean;
    chat_timer : number;
    select: number;
    state: any;
    passkey: string;
    attack: number;
    attack_radius: number;
    attack_arc: number;
    attack_arc_start: number;
    strike_time: number;
    stam_cost: number;
    stam_recov: number;
    @type("number") use_speed: number;
    interact: any;
    interact_distance: number;
    tree_dmg: number;
    ore_dmg: number;
    @type(Inventory) inventory = new Inventory();
    lastItemAdded: any;
    //@view() @type({ map: Inventory }) inventory = new MapSchema<Inventory>();
  
    @type(Equipment) equipment = new Equipment();

    constructor(id: string, spatialHash: SpatialHashing, nickname: string = "Unkown", passkey:string = "") {
      super();
      this.id = id;
      this.nickname = nickname
      this.team = "";
      this.x = Math.random() * 800-600;
      this.y = Math.random() * 800-600;
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
      this.right = "hand"
      this.interact = null
      this.interact_distance = 100;
      this.interact_ticker = false;
      this.tree_dmg = 1;
      this.ore_dmg = 1;
      this.lastItemAdded = null;
      spatialHash.addEntity(this)
    }
    updateMovement(){
        if (this.move !== -1){
            if(0<this.stamina){
            this.xvel += this.speed * Math.cos(this.move);
            this.yvel += this.speed * -Math.sin(this.move);
            }else{
            this.xvel += this.speed * Math.cos(this.move)/2;
            this.yvel += this.speed * -Math.sin(this.move)/2;
            }
        }
            this.x += this.xvel;
            this.y += this.yvel;
            this.xvel = this.xvel * 0.1;
            this.yvel = this.yvel * 0.1;
            if(this.ruse_t>0){
                this.ruse_t --;
            }
        if(this.health_t === 0 && this.health < this.max_health){
            this.health ++;
        }else{
            this.health_t --;
        }
        if(this.stamina_recovery === 0 && this.stamina < this.max_stamina){
            this.stamina ++;
        }else{
            this.stamina_recovery --;
        }
        if(this.chat_timer < 1){
          this.chatdisplay = false;
        }else{
          this.chat_timer --;
        }
    }
    deleteme(spatialHash: SpatialHashing){
        spatialHash.removeEntity(this);
    }
    updateHashing(spatialHash: SpatialHashing){
        spatialHash.removeEntity(this);

        this.updateMovement();

        spatialHash.addEntity(this);
    }
    playerdmg(x: number,y: number,radius: number, dmg: number,direction: number,attackradius: number = 10, attackarc: number = 0.2,attackarc_start: number = 0){

      const distance = Math.sqrt((x - this.x)**2 + (y - this.y)**2);
      if (distance > radius + this.radius + attackradius) return;
      
      let attackDirection = direction < 0 ? direction + 2 * Math.PI : direction;
      attackDirection -= Math.PI/2;
      if (attackDirection >= 2 * Math.PI) attackDirection -= 2 * Math.PI;
      
      let targetAngle = Math.atan2(this.y - y, this.x - x);
      if (targetAngle < 0) targetAngle += 2 * Math.PI;
      
      let angleDiff = Math.abs(targetAngle - attackDirection);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      if (angleDiff <= attackarc / 2 + attackarc_start) {
          this.health -= dmg;
          this.health_t = this.health_t_tot;
      }
    }

    updateColl(x: number,y: number,radius: number,push: boolean){
        const distance = Math.sqrt((this.x-x)**2+(this.y-y)**2);
                if(distance < this.radius + radius){
                    const angle = Math.atan2(this.y -y, this.x - x);
                    const pushs = this.radius + radius - distance
                    if(push){
                    this.x += Math.cos(angle)*pushs/2
                    this.y += Math.sin(angle)*pushs/2
                    x -= Math.cos(angle) * pushs/2
                    y -= Math.cos(angle) * pushs/2
                    }else{
                    this.x += Math.cos(angle)*pushs
                    this.y += Math.sin(angle)*pushs
                    }
            }
            return { x , y };
    }
    checkDeath(): boolean{
      return this.health <= 0;
    }
    dropAllItems(spatialHash: SpatialHashing): Item[] {
      const droppedItems: Item[] = [];
      
      // Get all inventory slots
      this.inventory.slots.forEach((item: InventoryItem, key: string) => {
        if (item) {
          // Calculate a random position near the player
          const angle = Math.random() * Math.PI * 2;
          const distance = this.radius + 10 + Math.random() * 30;
          const position = {
            x: this.x + Math.cos(angle) * distance,
            y: this.y + Math.sin(angle) * distance
          };
          
          // Create a floor item
          const floorItem = new Item(
            Math.random().toString(),
            position.x,
            position.y,
            spatialHash,
            item.name,
            item.quantity,
            item.durability,
            item.maxDurability,
            item.maxStack
          );
          
          // Add to dropped items array
          droppedItems.push(floorItem);
        }
      });
      
      // Also drop equipped items
      this.equipment.slots.forEach((item: InventoryItem, key: string) => {
        if (item) {
          const angle = Math.random() * Math.PI * 2;
          const distance = this.radius + 10 + Math.random() * 30;
          const position = {
            x: this.x + Math.cos(angle) * distance,
            y: this.y + Math.sin(angle) * distance
          };
          
          const floorItem = new Item(
            Math.random().toString(),
            position.x,
            position.y,
            spatialHash,
            item.name,
            item.quantity,
            item.durability,
            item.maxDurability,
            item.maxStack
          );
          
          droppedItems.push(floorItem);
        }
      });
      
      // Clear inventory and equipment
      this.inventory = new Inventory();
      this.equipment = new Equipment();
      
      return droppedItems;
    }
    addItem(newItem: InventoryItem, targetSlot?: number): number {
      const initialQuantity = this.getQuantity(newItem.name);
      if (newItem.equipSlot && newItem.equipSlot !== "") {
        if (!this.equipment.slots.get(newItem.equipSlot)) {
          this.equipment.slots.set(newItem.equipSlot, newItem);
          console.log(`Auto-equipped ${newItem.name} into slot ${newItem.equipSlot}`);
          this.inventory.Version()
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
      this.inventory.Version()
      return addedQuantity;
    }
    equipItemFromInventory(inventorySlot: number): void {
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
            } else {
              console.log("No free inventory slot available for the currently equipped item.");
              return;
            }
          }
          // Equip the new item.
          this.equipment.slots.set(item.equipSlot, item);
          this.inventory.slots.delete(slotKey);
          console.log(`Equipped ${item.name} into slot ${item.equipSlot}`);
        } else {
          console.log(`Item in inventory slot ${inventorySlot} is not equippable.`);
        }
        this.updateStats();
      }
      unequipItem(equipSlot: string, targetSlot?: number): void {
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
        } else {
          // Otherwise, find the first free slot.
          const freeSlot = this.inventory.getFreeSlot();
          if (freeSlot !== null) {
            this.inventory.slots.set(freeSlot.toString(), item);
          } else {
            console.log("No free inventory slot available.");
            return;
          }
        }
        this.equipment.slots.delete(equipSlot);
        console.log(`Unequipped ${item.name} from slot ${equipSlot}`);
        this.updateStats();
      }
    
      moveInventoryItem(fromSlot: number, toSlot: number): void {
        this.inventory.moveItem(fromSlot, toSlot);
        this.updateStats;
      }
      removeInventoryItem(item: string, quantity: number): boolean{
        const temp = this.inventory.removeItem(item,quantity)
        this.updateStats;
        return temp
      }
      getQuantity(item: string): number{
        return this.inventory.getTotalQuantity(item);
      }
      updateStats(): void{
        const selectedKey = this.select.toString();
        //const selectedItem: InventoryItem = (this.inventory.slots as any)[selectedKey];
        const selectedItem = this.inventory.slots.get(selectedKey);
        if(selectedItem){
          let selectedItemconfig = WEAPONS.find(weapon => weapon.type === selectedItem.name); // Find the weapon config based on the item name
          if (!selectedItemconfig) {
            selectedItemconfig = WEAPONS.find(weapon => weapon.type === "hand");
          }
          if(selectedItemconfig){
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
        else{
          const selectedItemconfig = WEAPONS.find(weapon => weapon.type === "hand");
          if(selectedItemconfig){
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
          else{
          this.right = "hand"
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