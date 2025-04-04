// https or http
import * as http from 'http';
import express from 'express';
import { Server } from 'colyseus';
import { Room  } from 'colyseus';
// import * as fs from 'fs';       // Import fs to read SSL certificate files DEPLOY ONLY
import { Schema, type, StateView} from '@colyseus/schema';

// importing the classes for the game logic
import { Player } from './types/player';
import { InventoryItem } from './types/inventoryitem';
import { Building } from './types/building';
import { Projectile } from './types/projectiles';
import { SpatialHashing} from './types/spatialhashing';
import { Item } from './types/item'; 
import { Resource } from './types/resource'; // Import the Resource class for resources like trees, ores, etc.
import { Mob } from './types/mob'; // Import the Mob class for AI entities like animals or enemies
import { Team } from './types/team'; // Import the Team class for team management
import { GameState } from './types/gamestate';
// importing utility functions
import { filterBadWords } from './utils/textfilters'; // Import the filter function for bad words
import { shorten } from './utils/textfilters';
import { getUniqueId } from './utils/getuniqueid'; // Import the unique ID generator function
// import handlers
import { TeamHandlers } from './handlers/teamhandlers';
import { buildingHandler } from './handlers/buildinghandler';
import { utility } from './handlers/utilityhandlers'; // Import the utility class for position validation and finding valid positions
//import data files for replacements and other configurations
import replacmentsData from './data/replacements.json'; // Load the replacements data from JSON file.
const replacements: { [badWord: string]: string } = replacmentsData
const app = express();
const port = 3000; // testing
//const port = 80; //(http)
//const port = 443; // https:

// Load SSL certificates (update file paths to match where Certbot saved them) DEPLOY ONLY
//const privateKey = fs.readFileSync('/etc/letsencrypt/live/jagar.io/privkey.pem', 'utf8');
//const certificate = fs.readFileSync('/etc/letsencrypt/live/jagar.io/cert.pem', 'utf8');
//const ca = fs.readFileSync('/etc/letsencrypt/live/jagar.io/chain.pem', 'utf8');

// Express setup to serve static files
app.use(express.static('public'));
// deploy use only
/*
const server = http.createServer({
    key: privateKey,
    cert: certificate,
    ca: ca,
  },app);
*/

const server = http.createServer(app);
const gameServer = new Server({
    server: server,
});

// Create a simple Colyseus Room
class Map extends Room<GameState> {
  private teamHandlers!: TeamHandlers;
  private buildingHandler!: buildingHandler;
  private utility!: utility;
  state = new GameState();
    onCreate(options: any): void {
        this.teamHandlers = new TeamHandlers(this); // Initialize team handlers
        this.buildingHandler = new buildingHandler(this); // Initialize building handler
        this.utility = new utility(this); // Initialize utility functions
        const resource = new Resource("0", 0, 0, this.state.Hash, "tree");
        const mob = new Mob("0",90,0, "pig", this.state.Hash);
        this.state.resources.set("0", resource)
        this.state.mobs.set("0", mob)

        let resource2 = new Resource("1", 180, 50, this.state.Hash,"tree");
        this.state.resources.set(resource2.id, resource2)

        resource2 = new Resource("2", 250, 250, this.state.Hash,"tree2");
        this.state.resources.set(resource2.id, resource2)

        resource2 = new Resource("3", 100, 270, this.state.Hash,"tree3");
        this.state.resources.set(resource2.id, resource2)

        resource2 = new Resource("4", -100, -270, this.state.Hash,"rock");
        this.state.resources.set(resource2.id, resource2)

        resource2 = new Resource("5", 100, -260, this.state.Hash,"rock2");
        this.state.resources.set(resource2.id, resource2)
        
        resource2 = new Resource("6", -600, -760, this.state.Hash,"rock3");
        this.state.resources.set(resource2.id, resource2)

        resource2 = new Resource("7", -400, -400, this.state.Hash,"gold");
        this.state.resources.set(resource2.id, resource2)

        resource2 = new Resource("8", -40, -200, this.state.Hash,"crystal");
        this.state.resources.set(resource2.id, resource2)

        let mob2 = new Mob("1",110,8, "pig", this.state.Hash);
        this.state.mobs.set("1",mob2)

        mob2 = new Mob("2",110,4, "spider", this.state.Hash);
        this.state.mobs.set("2",mob2)

        mob2 = new Mob("3",300,300, "redspider", this.state.Hash);
        this.state.mobs.set(mob2.id,mob2)
        mob2 = new Mob("4",-300,-300, "bear", this.state.Hash);
        this.state.mobs.set(mob2.id,mob2)
        mob2 = new Mob("5",-300,300, "polarbear", this.state.Hash);
        this.state.mobs.set(mob2.id,mob2)

        
        this.clock.start();
        this.clock.setInterval(() => {
            this.onTick();
        }, 1000 / 60);

        this.onMessage("move",(client, message: {move: number; direction: number; ruse: boolean}) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.move = message.move;
                player.direction = message.direction;
                player.ruse = message.ruse;
            }
            // Ensure the player exists in the state
            
        });
        this.onMessage("select",(client, select) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.select = select;
                player.updateStats();
            }
            // Ensure the player exists in the state
            
        });
        this.onMessage("chat",(client, chat) => {
          const player = this.state.players.get(client.sessionId);
          if (player) {
              player.chat = shorten(filterBadWords(chat,replacements),120);
              player.chatdisplay = true;
              player.chat_timer = 150;
          }
          // Ensure the player exists in the state
          
      });
      this.onMessage("interact",(client) => {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.interact_ticker = !player.interact_ticker
            switch(true){
              case player.interact instanceof Item:
                const item = player.interact
                //addItem(new InventoryItem("goldensword",1, 75,100, 0))
                const result = player.addItem(new InventoryItem(item.name, item.quantity, item.durability, item.maxDurability, item.maxStack, item.equipSlot))
                if( result === item.quantity){
                const flooritem = this.state.items.get(item.id)
                if(flooritem){
                  flooritem.deleteme(this.state.Hash)
                  this.state.items.delete(item.id)
                }
                }else{
                  const flooritem = this.state.items.get(item.id)
                  if(flooritem){
                    flooritem.quantity -= result
                    if(flooritem.quantity <= 0){
                      flooritem.deleteme(this.state.Hash)
                      this.state.items.delete(item.id)
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
      if (!player) return;
      
      // Helper function to create floor item at valid position
      const createFloorItem = (itemObj: any) => {
        const position = this.utility.findValidItemPosition(
          player.x + player.radius * Math.cos(player.direction - Math.PI/2) * 1.5, 
          player.y + player.radius * Math.sin(player.direction - Math.PI/2) * 1.5, 
          this.state.Hash
        );
        
        const floorItem = new Item(
          Math.random().toString(),
          position.x,
          position.y, 
          this.state.Hash,
          itemObj.name,
          itemObj.quantity,
          itemObj.durability,
          itemObj.maxDurability,
          itemObj.maxStack, 
          itemObj.equipSlot
        );
        
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
            player.inventory.Version();
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
  this.onMessage("moveItem",(client, message: {from: string; to: string; fromslot: number, toslot: number}) => {
    const player = this.state.players.get(client.sessionId);
    if (player) {
        // Special case for picking up an item without placing it yet
        if (message.toslot === -1) {
            //console.log(`Player ${client.sessionId} picked up item from slot ${message.fromslot}`);
            return;
        }
        
        // Regular item movement between inventory slots
        if (message.from === "inv" && message.to === "inv") {
          console.log("inv movement")
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
        console.log("cya")
          console.log(equipSlot)
          console.log(invSlot)
      } else if (message.from === "inv" && message.to === "equip") {
        const invSlot = parseInt(message.fromslot.toString());
        
        player.equipItemFromInventory(invSlot);
        console.log("hi")
        console.log(invSlot)
        player.updateStats();
    }
    player.inventory.Version();
    }
    
    // Ensure the player exists in the state
    
});
this.onMessage("splitStack", (client, message: {fromSlot: number, quantity: number}) => {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;

  const fromSlotKey = message.fromSlot.toString();
  const item = player.inventory.slots.get(fromSlotKey);
  
  if (!item || item.quantity <= 1 || item.quantity < message.quantity) {
    return; // Invalid request
  }
  
  // Reduce quantity in original slot
  item.quantity -= message.quantity;
  
  // Create a new item with the split quantity
  const splitItem = new InventoryItem(
    item.name,
    message.quantity,
    item.durability,
    item.maxDurability,
    item.maxStack,
    item.equipSlot
  );
  
  // Give the split item to the player's mouse
  const freeSlot = player.inventory.getFreeSlot();
  if (freeSlot !== null) {
    player.inventory.slots.set(freeSlot.toString(), splitItem);
    player.inventory.Version();
  } else {
    // If no free slot, drop it on the ground
    const position = this.utility.findValidItemPosition(
      player.x + player.radius * Math.cos(player.direction - Math.PI/2) * 1.5, 
      player.y + player.radius * Math.sin(player.direction - Math.PI/2) * 1.5, 
      this.state.Hash
    );
    
    const floorItem = new Item(
      Math.random().toString(), 
      position.x, 
      position.y, 
      this.state.Hash,
      splitItem.name,
      splitItem.quantity,
      splitItem.durability,
      splitItem.maxDurability,
      splitItem.maxStack
    );
    
    this.state.items.set(floorItem.id, floorItem);
  }
});
this.onMessage("craft", (client, message: {recipie: string, quantity: number}) => {
  console.log(message.recipie)
  const player = this.state.players.get(client.sessionId);
  if(player){
    switch(message.recipie){
      case "goldensword":
        if(player.getQuantity("wood") >= 2 && player.getQuantity("gold") >= 5){
          player.removeInventoryItem("wood",2)
          player.removeInventoryItem("gold",5)
          const result = player.addItem(new InventoryItem("goldensword",1,100,100,0))
          if(result < 1){
            // If the inventory is full, drop the item on the ground
            const position = this.utility.findValidItemPosition(
              player.x + player.radius * Math.cos(player.direction - Math.PI/2) * 1.5, 
              player.y + player.radius * Math.sin(player.direction - Math.PI/2) * 1.5, 
              this.state.Hash
            );
            
            const floorItem = new Item(
              Math.random().toString(), 
              position.x, 
              position.y, 
              this.state.Hash,
              "goldensword",
              1,
              100,
              100,
              0
            );
            
            this.state.items.set(floorItem.id, floorItem);
          }
        }
      break;
      case "woodenshield":
        if(player.getQuantity("wood") >= 2 ){
          player.removeInventoryItem("wood",2)
          player.removeInventoryItem("gold",5)
          const result = player.addItem(new InventoryItem("woodenshield",1,0,0,0,"shield"))
          if(result < 1){
            // If the inventory is full, drop the item on the ground
            const position = this.utility.findValidItemPosition(
              player.x + player.radius * Math.cos(player.direction - Math.PI/2) * 1.5, 
              player.y + player.radius * Math.sin(player.direction - Math.PI/2) * 1.5, 
              this.state.Hash
            );
            
            const floorItem = new Item(
              Math.random().toString(), 
              position.x, 
              position.y, 
              this.state.Hash,
              "woodenshield",
              1,
              0,
              0,
              0
            );
            
            this.state.items.set(floorItem.id, floorItem);
          }
        }
        break;
    }

  }
}); 
//building events

//Team Events
this.onMessage("createTeam", (client, message: { teamName: string }) => {
  this.teamHandlers.handleCreateTeam(client, message.teamName);
});
this.onMessage("placeBuilding", (client, message) => {
  this.buildingHandler.handlePlaceBuilding(client, message);
});
this.onMessage("joinTeam", (client, message: { teamId: string }) => {
  this.teamHandlers.handleJoinTeam(client, message.teamId);
});

this.onMessage("leaveTeam", (client) => {
  this.teamHandlers.handleLeaveTeam(client);
});

this.onMessage("transferLeadership", (client, message: { newLeaderId: string }) => {
  this.teamHandlers.handleTransferLeadership(client, message.newLeaderId);
});

this.onMessage("kickMember", (client, message: { memberId: string }) => {
  this.teamHandlers.handleKickMember(client, message.memberId);
});
this.onMessage("requestJoinTeam", (client, message: { teamId: string }) => {
  this.teamHandlers.handleTeamJoinRequest(client, message.teamId);
});

this.onMessage("responseJoinTeam", (client, message: { playerId: string, teamId: string, accepted: boolean, timeout?: boolean }) => {
  this.teamHandlers.handleTeamJoinResponse(client, message.playerId, message.teamId, message.accepted, message.timeout);
});
this.onMessage("teamChat", (client, message: { message: string }) => {
  this.teamHandlers.handleTeamChatMessage(client, message.message);
});
this.onMessage("*", (client, type, message) => {
console.log("Unkonwn message received");
console.log("received message:", type, message);
});

    }

    async onAuth(client: any, options: any){
      const { nickname, passkey} = options;
      if(passkey !== "squishbugs"){
      if(!this.state.keys.hasOwnProperty(passkey)){
        throw new Error("Invalid passkey!")
      }

      if(this.state.keys[passkey] !== null){
        throw new Error("Passkey already in use!")
      }
      this.state.keys[passkey] = client.sessionId;
      }
      console.log(`${nickname} authenticated with passkey: ${passkey}`);
      return { nickname, passkey };
    }
    

    onJoin(client: any, options: any, auth: any): void {
        console.log(`${client.sessionId} joined the room`);
        const player = new Player(client.sessionId,this.state.Hash,shorten(filterBadWords(auth.nickname,replacements),25), auth.passkey);
        this.state.players.set(client.sessionId, player);
        client.view = new StateView();
        client.view.add(player);
        //client.view.add(player.inventory);
        //client.view.add(player.inventory.slots);
        
    }
    onLeave(client: any): void {
        console.log(`${client.sessionId} left the room`);
        const player = this.state.players.get(client.sessionId)
        if (player){
          if(player.team !== ""){
            this.teamHandlers.handleLeaveTeam(client)
          }
          if(player.passkey !== "squishbugs"){
          this.state.keys[player.passkey] = null;
          console.log(this.state.keys)
        }
        player.deleteme(this.state.Hash);
        this.state.players.delete(client.sessionId);
      }
        
    }
    onTick(): void {
        // Collision check  with hashing
        const hash = this.state.Hash
        //update projectiles
        this.buildingHandler.updateBuildings(1/60);
        this.state.projectiles.forEach((projectile: Projectile, id: string) => {
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
          
          nearby.forEach((entity: any) => {
            // Skip if already collided or if hitting owner
            if (hasCollided || entity.id === projectile.ownerId) return;
            
            // Calculate distance
            const distance = Math.sqrt(
              (projectile.x - entity.x) ** 2 + 
              (projectile.y - entity.y) ** 2
            );
            
            switch (true) {
              case entity instanceof Player:
                // Skip if on same team (for team projectiles)
                const owner = this.state.players.get(projectile.ownerId) || 
                             this.state.mobs.get(projectile.ownerId);
                             
                if (owner instanceof Player && 
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
                
              case entity instanceof Mob:
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
                }else{
                  if (distance < projectile.radius + entity.radius) {
                    // Deal damage to mob
                    entity.health -= projectile.damage;
                    entity.hit_time = 300;
                    
                    // Mark for deletion
                    hasCollided = true;
                  }
                }
                break;
                
              case entity instanceof Resource:
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


        this.state.mobs.forEach((mob: Mob, id: string) => {
          if (mob.isBeingRemoved || mob.health < 1) {
            this.utility.drops(mob.type, mob.x, mob.y, hash);
            mob.deleteme(this.state.Hash);
            this.state.mobs.delete(id);
        } else {
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
              const projectile = new Projectile(
                projectileId,
                mob.id,
                mob.x + mob.radius * Math.cos(mob.direction),
                mob.y + mob.radius * Math.sin(mob.direction),
                velX,
                velY,
                mob.projectileDamage,
                mob.projectileType,
                mob.projectileRadius,
                mob.projectileLifetime,
                hash
              );
              
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
        this.state.players.forEach((player: Player) => {
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
            if(player){
            player.interact = null;
            player.interact_distance = 180;
            player.updateHashing(hash)
            const nearby = hash.getNearbyEntities(player.x, player.y)
            nearby.forEach((entity: any) => {
                // collision detection
                switch (true) {
                    case entity instanceof Player:
                        if(player.id !== entity.id){
                            player.updateColl(entity.x, entity.y, entity.radius, true);
                        }
                        break;  
                    case entity instanceof Mob:
                        //Mob Collision
                        ({ x: entity.x, y: entity.y} = player.updateColl(entity.x,entity.y,entity.radius,true))
                        //Mobs are only updated when near another player to reduce server computations
                        //update mob
                        if(!entity.updated){
                        if(entity.health < 1){
                          ///mobs dying
                            entity.updated = true;
                            entity.isBeingRemoved = true;
                            this.utility.drops(entity.type, entity.x, entity.y, hash);
                            entity.deleteme(hash);
                            this.state.mobs.delete(entity.id);
                            return;
                        }else{
                        entity.updated = true;
                        entity.updateHashing(hash)
                        if (entity.action === 2){
                            entity.time --;
                            if(entity.time === 0){
                                const mobTarget = this.state.players.get(entity.target)
                                if(mobTarget){
                                if(Math.sqrt((entity.y-mobTarget.y)**2+(entity.x-mobTarget.x)**2)<entity.radius+mobTarget.radius+entity.attack_radius/3 && Math.abs(Math.atan2(entity.y - mobTarget.y, entity.x - mobTarget.x)+ Math.PI-entity.direction)<entity.attack_arc/2){
                                  entity.time = entity.aspeed;
                                }else{
                                  entity.action = 1;
                                }
                                }else{
                                  entity.action = 1;
                                }
                            }
                        }else if (entity.action === 1){
                          const aplayer = this.state.players.get(entity.target)
                          if(aplayer){
                            entity.mobact(aplayer.x,aplayer.y,aplayer.radius);
                          }else{
                            entity.action = -1
                            entity.time = 20;
                          }
                        }else{
                            entity.mobidle();
                            if(Math.sqrt((player.x-entity.x)**2+(player.y-entity.y)**2)<150+entity.radius && !entity.passive){
                               entity.action = 1;
                               entity.target = player.id;
                            }
                        }
                        //Mob collisions and attacks
                            const mnearby = hash.getNearbyEntities(entity.x, entity.y)
                            mnearby.forEach((oentity: any) => {
                                switch (true){
                                    case oentity instanceof Resource:
                                        entity.updateColl(oentity.x,oentity.y,oentity.radius, false)
                                        break;
                                    case oentity instanceof Mob:
                                        if(entity.id !== oentity.id){
                                            ({ x: oentity.x, y: oentity.y} = entity.updateColl(oentity.x,oentity.y,oentity.radius,true))
                                        }
                                        break;
                                    case oentity instanceof Building:
                                      const newMobPosition = oentity.resolveCollision(entity);
                                      entity.x = newMobPosition.x;
                                      entity.y = newMobPosition.y;
                                      break;
                                    case oentity instanceof Player:
                                        if(entity.action === 2 && entity.time === entity.strike_time){
                                        //hits the player
                                        
                                        if(oentity && entity){
                                        oentity.playerdmg(entity.x,entity.y,entity.radius, entity.attack,entity.direction + Math.PI/2,entity.attack_radius,entity.attack_arc,entity.attack_arc_displacment);
                                        }

                                        }
                                        break;
                                    default:
                                        //do nothing
                                }

                            });
                            // end Mob collisions
                        }}else{
                            if(Math.sqrt((player.x-entity.x)**2+(player.y-entity.y)**2)<150+entity.radius && !entity.passive && (entity.action === 0 || entity.action === -1)){
                                entity.action = 1;
                                entity.target = player.id;
                             }
                        }
                        //end mob updates

                        break;
                    case entity instanceof Resource:
                        if(player){
                        player.updateColl(entity.x,entity.y,entity.radius,false)
                        }
                        break;
                    case entity instanceof Item:
                      const distance = Math.sqrt((player.x-entity.x)**2+(player.y-entity.y)**2)
                      if(distance<player.interact_distance){
                        player.interact_distance = distance
                        player.interact = entity
                      }
                      break;
                    case entity instanceof Building:
                        // Handle building collision
                        const newPosition = entity.resolveCollision(player);
                        if (newPosition) {
                            player.x = newPosition.x;
                            player.y = newPosition.y;
                        }
                        break;
                }          
            })
            //player hit detection
            if(player.ruse_t === player.strike_time){
              const itemheld = player.inventory.slots.get(player.select.toString())
              if(itemheld){
                if(itemheld.maxDurability>0){
                itemheld.durability --;
                if(itemheld.durability<1){
                  player.inventory.removeSlot(player.select)
                  player.right = "hand"
                  player.updateStats();
                }else{
                player.inventory.Version();
                }
              }
              }
              player.stamina += player.stam_cost;
              player.stamina_recovery = player.stam_recov;
              nearby.forEach((entity: any) => {
                  switch (true){
                      case entity instanceof Mob:
                          entity.mobdmg(player.x,player.y,player.radius, player.attack,player.id,player.direction,player.attack_radius,player.attack_arc,player.attack_arc_start);
                          break;
                      case entity instanceof Player:
                          if(player.team != entity.team || (entity.team === "" && player.id != entity.id)){
                          entity.playerdmg(player.x,player.y,player.radius, player.attack,player.direction,player.attack_radius,player.attack_arc,player.attack_arc_start);
                          }
                          break;
                      case entity instanceof Resource:
                        if(entity.resourcedmg(player.x,player.y,player.radius, player.attack,player.direction,player.attack_radius,player.attack_arc,player.attack_arc_start)){
                          switch(entity.type){
                            case "tree":
                            case "tree2":
                            case "tree3":
                              player.addItem(new InventoryItem("wood",player.tree_dmg))
                              break;
                            case "rock":
                            case "rock2":
                            case "rock3":
                              player.addItem(new InventoryItem("stone",player.ore_dmg))
                              break;
                            case "gold":
                              player.addItem(new InventoryItem("gold",player.ore_dmg))
                              break;
                            case "crystal":
                              player.addItem(new InventoryItem("crystal",player.ore_dmg))
                              break;
                            default:

                          }
                        }
                        break;
                      case entity instanceof Building:
                        if(entity.buildingdmg(player.x, player.y, player.radius, player.attack, 
                          player.direction, player.attack_radius, player.attack_arc, player.attack_arc_start)) {
                          
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
              })
            }    
            if(player.ruse && player.ruse_t <= 0 ){
              player.ruse_t = player.use_speed;
                }
            //end player hit detection
     } });

    }
      // Handle player disconnect
      
private handlePlayerDeath(client: any): void {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  
  player.inventory.slots.forEach((item, slotKey) => {
    
    // Create the item
    this.utility.createItemAtValidPosition(
      player.x, 
      player.y,
      this.state.Hash,
      item.name,
      {
        exactQuantity: item.quantity,
        dropChance: 1
      }
    );
  });
  
  // Drop equipment items
  player.equipment.slots.forEach((item, slotKey) => {
    this.utility.createItemAtValidPosition(
      player.x,
      player.y,
      this.state.Hash,
      item.name,
      {
        exactQuantity: 1,
        dropChance: 1
      }
    );
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

