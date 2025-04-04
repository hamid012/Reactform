import { Room } from 'colyseus';
import { GameState } from '../types/gamestate';
import { SpatialHashing } from '../types/spatialhashing';
import { Resource } from '../types/resource'; // Import the Resource class for resources like trees, ores, etc.
import { Item } from '../types/item'; // Import the Item class for items
//importing utility datams
import MOBS from '../data/mobs.json'; // Importing mob data for reference

export class utility {
    protected room: Room<GameState>;
    protected state: GameState;
    
    constructor(room: Room<GameState>) {
      this.room = room;
      this.state = room.state;
    }
    isPositionValid(x: number, y: number, hash: SpatialHashing): boolean {
    const nearbyEntities = hash.getNearbyEntities(x, y);
    
    for (const entity of nearbyEntities) {
      // Get the entity's radius or use a default
      let entityRadius = 12; // Default radius
      let minDistance = 24;
      
      if (entity instanceof Resource) {
        entityRadius = entity.radius;
        // Allow items to be placed near resources, just not directly on top
        minDistance = 12 + entityRadius * 0.7;
      } else if (entity instanceof Item) {
         // Item radius
        // Strict overlap check for other items
        minDistance = 24;
      } 
      
      // Calculate actual distance
      const distance = Math.sqrt((x - entity.x) ** 2 + (y - entity.y) ** 2);
      
      // Position is invalid if too close to any entity
      if (distance < minDistance) {
        return false;
      }
    }
    
    // If we got here, the position is valid
    return true;
    }
    findValidItemPosition(x: number, y: number, hash: SpatialHashing): { x: number, y: number } {
        // Start with the original position
        let validPosition = { x, y };
        
        // Check if the original position is valid
        if (!this.isPositionValid(validPosition.x, validPosition.y, hash,)) {
          // Use a spiral pattern to find a valid position
          const spiralStep = 16; // Distance between checks
          let currentRadius = spiralStep;
          let found = false;
          
          // Try increasingly larger circles until we find a valid position
          // Limit to reasonable distance to avoid infinite loops
          while (!found && currentRadius < 400) {
            // Try positions in a circle
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
              const testX = x + Math.cos(angle) * currentRadius;
              const testY = y + Math.sin(angle) * currentRadius;
              
              if (this.isPositionValid(testX, testY, hash)) {
                validPosition = { x: testX, y: testY };
                found = true;
                break;
              }
            }
            
            // Increase radius for the next loop if no valid position was found
            currentRadius += spiralStep;
          }
        }
        
        return validPosition;
    }
    createItemAtValidPosition(
        x: number, 
        y: number, 
        hash: any, 
        itemName: string, 
        options: {
          minQuantity?: number,
          maxQuantity?: number,
          exactQuantity?: number,
          dropChance?: number  // 0 to 1, represents percentage chance
        } = {}
      ): Item | null {
        // Apply default values if not specified
        const {
          minQuantity = 1,
          maxQuantity = 5,
          exactQuantity,
          dropChance = 1  // 100% chance by default
        } = options;
        
        // Check drop chance
        if (dropChance < 1 && Math.random() > dropChance) {
          return null; // Item doesn't drop
        }
        
        // Find a valid position
        const position = this.findValidItemPosition(x, y, hash);
        
        // Determine quantity
        let quantity;
        if (exactQuantity !== undefined) {
          quantity = exactQuantity;
        } else {
          quantity = Math.floor(Math.random() * (maxQuantity - minQuantity + 1)) + minQuantity;
        }
        
        // Create and add the item
        const item = new Item(
          Math.random().toString(),
          position.x,
          position.y,
          hash,
          itemName,
          quantity,
          0, 0, 999
        );
        
        this.state.items.set(item.id, item);
        return item;
    }
    drops(type: string, x: number, y: number, hash: any): void{
        const mobConfig = MOBS.find(mob => mob.type === type);
        if (!mobConfig || !mobConfig.drops) return;
        
        // Process each drop in the configuration
        mobConfig.drops.forEach(drop => {
            const options: {
                minQuantity?: number;
                maxQuantity?: number;
                exactQuantity?: number;
                dropChance?: number;
              } = {
                // Set dropChance with a fallback
                dropChance: drop.chance
              };
              
              // Check if properties exist before assigning them
              if ('minQuantity' in drop) options.minQuantity = drop.minQuantity;
              if ('maxQuantity' in drop) options.maxQuantity = drop.maxQuantity;
              if ('exactQuantity' in drop) options.exactQuantity = drop.exactQuantity;
              
              this.createItemAtValidPosition(
                x,
                y,
                hash,
                drop.item,
                options
              );
        });
    }
}