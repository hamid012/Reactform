import { Schema, type, MapSchema} from '@colyseus/schema';
import { SpatialHashing } from './spatialhashing';
import { Player } from './player';
import { Building } from './building';
import { Projectile } from './projectiles';
import { Item } from './item'; 
import { Resource } from './resource'; // Import the Resource class for resources like trees, ores, etc.
import { Mob } from './mob'; // Import the Mob class for AI entities like animals or enemies
import { Team } from './team'; // Import the Team class for team management
import authkeys from '../data/keys.json' 
 // Ensure you import the Item class

export class GameState extends Schema {
    @type({ map: Player }) players: MapSchema<Player> = new MapSchema<Player>();
    @type({ map: Resource }) resources: MapSchema<Resource> = new MapSchema<Resource>();
    @type({ map: Mob }) mobs: MapSchema<Mob> = new MapSchema<Mob>();
    @type({ map: Item }) items: MapSchema<Item> = new MapSchema<Item>();
    @type({ map: Team }) teams: MapSchema<Team> = new MapSchema<Team>();
    @type({ map: Projectile }) projectiles: MapSchema<Projectile> = new MapSchema<Projectile>();
    @type({ map: Building }) buildings: MapSchema<Building> = new MapSchema<Building>();

    Hash: SpatialHashing;
    keys: any;

    constructor(){
        super();
        this.Hash = new SpatialHashing(1000);
        this.keys = authkeys
    }
}