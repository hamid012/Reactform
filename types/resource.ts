import { Schema, type} from '@colyseus/schema';
import type { SpatialHashing } from './spatialhashing';
import RESOURCES from '../data/resources.json'; // Importing resource data for reference

export class Resource extends Schema{
    @type("string") id: string; // Player ID (can be any unique identifier)
    @type("number") x: number; // Player's X position
    @type("number") y: number; // Player's Y position
    @type("number") health: number; // resource health
    @type("string") type: string; // identiy the typing
    radius: number;
    constructor(id: string, x:number,y:number,spatialHash: SpatialHashing, type: string) {
      super();
      this.id = id;
      this.x = x
      this.y = y
      this.type = type;
      // Edit resource stats based on type here @Rembo
      const resourceConfig = RESOURCES.find(resource => resource.type === type)
      if(resourceConfig){
        this.radius = resourceConfig.radius
        this.health = resourceConfig.health
      }else{
        this.health = 100;
        this.radius = 25;
      }
      spatialHash.addEntity(this);
    }
    resourcedmg(x: number,y: number,radius: number, dmg: number,direction: number,attackradius: number = 40, attackarc: number = 2.2, attackarc_start: number = -0.5){
      const distance = Math.sqrt((x - this.x)**2 + (y - this.y)**2);
      if (distance > radius + this.radius + attackradius) return false;
      
      let attackDirection = direction < 0 ? direction + 2 * Math.PI : direction;
      attackDirection -= Math.PI/2;
      if (attackDirection >= 2 * Math.PI) attackDirection -= 2 * Math.PI;
      
      let targetAngle = Math.atan2(this.y - y, this.x - x);
      if (targetAngle < 0) targetAngle += 2 * Math.PI;
      
      let angleDiff = Math.abs(targetAngle - attackDirection);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      if (angleDiff <= attackarc / 2 + attackarc_start) {
          this.health -= dmg;
          return true;
      }
      return false;
  }
}