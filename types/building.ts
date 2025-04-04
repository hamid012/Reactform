import { Schema, type} from '@colyseus/schema';
import type { SpatialHashing } from './spatialhashing';

export class Building extends Schema {
  @type("string") id: string;
  @type("string") type: string;
  @type("number") x: number;
  @type("number") y: number;
  @type("number") rotation: number;
  @type("number") health: number;
  @type("number") maxHealth: number;
  @type("number") buildProgress: number;
  @type("number") buildTime: number;
  @type("boolean") isBuilding: boolean;
  @type("string") owner: string;
  @type("string") collisionShape: string; // New: "circle" or "rectangle"
  
  // Collision properties
  radius: number;
  width: number;  // New: for rectangular collision
  height: number; // New: for rectangular collision
  
  buildStartTime: number;
  buildTimer: any;

  constructor(
      id: string,
      type: string,
      x: number,
      y: number,
      rotation: number,
      owner: string,
      hash: SpatialHashing
  ) {
      super();
      this.id = id;
      this.type = type;
      this.x = x;
      this.y = y;
      this.rotation = rotation || 0;
      this.owner = owner;
      this.buildProgress = 0;
      this.isBuilding = true;
      
      // Set properties based on building type
      const GRID_SIZE = 64;
      switch (type) {
          case "wood_wall":
              this.maxHealth = 100;
              this.buildTime = 10;
              this.collisionShape = "rectangle";
              this.width = GRID_SIZE;
              this.height = GRID_SIZE;
              this.radius = GRID_SIZE / 2; // Keep for compatibility
              break;
          case "stone_wall":
              this.maxHealth = 250;
              this.buildTime = 15;
              this.collisionShape = "rectangle";
              this.width = GRID_SIZE;
              this.height = GRID_SIZE;
              this.radius = GRID_SIZE / 2;
              break;
          case "campfire":
              this.maxHealth = 75;
              this.buildTime = 5;
              this.collisionShape = "circle";
              this.radius = GRID_SIZE / 2;
              this.width = GRID_SIZE; // For compatibility
              this.height = GRID_SIZE;
              break;
          case "lookout_tower":  // Example of a larger building
              this.maxHealth = 150;
              this.buildTime = 15;
              this.collisionShape = "circle";
              this.radius = GRID_SIZE; // Twice as big
              this.width = GRID_SIZE * 2;
              this.height = GRID_SIZE * 2;
              break;
          case "barricade":  // Example of a wide building
              this.maxHealth = 120;
              this.buildTime = 10;
              this.collisionShape = "rectangle";
              this.width = GRID_SIZE * 2; // Twice as wide
              this.height = GRID_SIZE / 2; // Half as tall
              this.radius = GRID_SIZE / 2; // Keep for compatibility
              break;
          default:
              this.maxHealth = 100;
              this.buildTime = 10;
              this.collisionShape = "circle";
              this.radius = GRID_SIZE / 2;
              this.width = GRID_SIZE;
              this.height = GRID_SIZE;
      }
      
      this.health = this.isBuilding ? 10 : this.maxHealth;
      this.buildStartTime = Date.now();
      
      // Add to spatial hash
      hash.addEntity(this);
  }

  // Update the damage method to handle different collision shapes
  buildingdmg(x: number, y: number, radius: number, dmg: number, direction: number, 
    attackradius: number = 40, attackarc: number = 2.2, attackarc_start: number = -0.5): boolean {

    // Check collision based on shape
    let collision = false;
    
    if (this.collisionShape === "circle") {
      // Circle collision check (original method)
      const distance = Math.sqrt((x - this.x)**2 + (y - this.y)**2);
      collision = distance <= radius + this.radius + attackradius;
    } else {
      // Rectangle collision check
      collision = this.checkRectangleCircleCollision(x, y, radius + attackradius);
    }
    
    if (!collision) return false;

    // Angle check for attack arc
    let attackDirection = direction < 0 ? direction + 2 * Math.PI : direction;
    attackDirection -= Math.PI/2;
    if (attackDirection >= 2 * Math.PI) attackDirection -= 2 * Math.PI;

    let targetAngle = Math.atan2(this.y - y, this.x - x);
    if (targetAngle < 0) targetAngle += 2 * Math.PI;

    let angleDiff = Math.abs(targetAngle - attackDirection);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

    // Check if within attack arc
    if (angleDiff <= attackarc / 2 + attackarc_start) {
      // Apply damage
      const actualDamage = this.isBuilding ? dmg * 5 : dmg;
      this.health -= actualDamage;

      // Check if destroyed
      if (this.health <= 0) {
        this.health = 0;
        return true; // Building destroyed
      }
      return true; // Building hit but not destroyed
    }

    return false; // No hit
  }

  // New method to check collision between rectangle and circle
  checkRectangleCircleCollision(circleX: number, circleY: number, circleRadius: number): boolean {
    // Find the closest point on the rectangle to the circle
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    
    // Calculate closest point (handles rotation=0 case)
    const closestX = Math.max(this.x - halfWidth, Math.min(circleX, this.x + halfWidth));
    const closestY = Math.max(this.y - halfHeight, Math.min(circleY, this.y + halfHeight));
    
    // Calculate distance from closest point to circle center
    const distanceX = circleX - closestX;
    const distanceY = circleY - closestY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;
    
    // Check if the distance is less than the circle's radius squared
    return distanceSquared <= circleRadius * circleRadius;
  }

  // New method to handle entity collision
  resolveCollision(entity: any): {x: number, y: number} {
    const radius = entity.radius || 0;
    let newX = entity.x;
    let newY = entity.y;
    
    if (this.collisionShape === "circle") {
      // Circle collision resolution (similar to existing updateColl)
      const distance = Math.sqrt((entity.x - this.x)**2 + (entity.y - this.y)**2);
      if (distance < this.radius + radius) {
        const angle = Math.atan2(entity.y - this.y, entity.x - this.x);
        const pushDistance = this.radius + radius - distance;
        newX = entity.x + Math.cos(angle) * pushDistance;
        newY = entity.y + Math.sin(angle) * pushDistance;
      }
    } else {
      // Rectangle collision resolution
      if (this.checkRectangleCircleCollision(entity.x, entity.y, radius)) {
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        
        // Find closest point on rectangle to circle
        const closestX = Math.max(this.x - halfWidth, Math.min(entity.x, this.x + halfWidth));
        const closestY = Math.max(this.y - halfHeight, Math.min(entity.y, this.y + halfHeight));
        
        // Calculate vector from closest point to circle center
        const vX = entity.x - closestX;
        const vY = entity.y - closestY;
        const length = Math.sqrt(vX * vX + vY * vY);
        
        if (length > 0) {
          // Calculate penetration depth
          const penetration = radius - length;
          
          if (penetration > 0) {
            // Push entity out along the vector
            const normX = vX / length;
            const normY = vY / length;
            newX = entity.x + normX * penetration;
            newY = entity.y + normY * penetration;
          }
        }
      }
    }
    
    return { x: newX, y: newY };
  }

  // Rest of Building class methods remain the same
  updateConstruction(delta: number) {
    // Existing method
    if (!this.isBuilding) return;
    
    const elapsed = (Date.now() - this.buildStartTime) / 1000;
    this.buildProgress = Math.min(elapsed / this.buildTime, 1);
    
    if (this.buildProgress >= 1) {
        this.completeConstruction();
    }
  }

  completeConstruction() {
    // Existing method
    this.isBuilding = false;
    this.buildProgress = 1;
    this.health = this.maxHealth;
    
    if (this.buildTimer) {
        clearTimeout(this.buildTimer);
        this.buildTimer = null;
    }
  }

  updateHashing(hash: SpatialHashing) {
    // Existing method
    hash.removeEntity(this);
    hash.addEntity(this);
  }

  deleteme(hash: SpatialHashing) {
    // Existing method
    hash.removeEntity(this);
    
    if (this.buildTimer) {
        clearTimeout(this.buildTimer);
        this.buildTimer = null;
    }
  }
}
