

//const { default: firebase } = require("firebase/compat/app");
//import { initializeApp } from 'firebase/app';
//this is for testing only connecting to localhost
const client = new Colyseus.Client("ws://localhost:3000");
// try to connect to the actual server
//const client = new Colyseus.Client("ws://3.146.214.240:80");
const expected_interval = 1000 / 200 ; // 60 FPS

disableZoom();

//init Map
async function initializeMap(mapLayer) {
    try {
        console.log("Starting map initialization");
        
        // First ensure the map JSON is loaded as an asset
        // In PIXI v8, this properly caches the asset under the specified alias
        console.log("Loading map JSON file");
        await PIXI.Assets.load({
            src: '/img/dmap/map.json',
            alias: 'mapData'
        });
        
        console.log("Creating TiledMap instance");
        const tiledMap = new TiledMap();
        
        // Initialize with the alias we just created
        console.log("Initializing TiledMap with 'mapData' alias");
        const success = await tiledMap.initialize('mapData');
        
        if (!success) {
            throw new Error("TiledMap initialization failed");
        }
        
        // Add the map container to the map layer
        console.log("Adding TiledMap container to map layer");
        mapLayer.addChild(tiledMap.container);

        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force initial visibility update with window dimensions
        tiledMap.lastCameraX = -99999;
        tiledMap.lastCameraY = -99999;
        tiledMap.updateVisibleChunks(0, 0, window.innerWidth, window.innerHeight);
        
        console.log("Map initialization complete");
        return tiledMap;
    } catch (error) {
        console.error('Failed to initialize map:', error);
        
        // Return null to indicate failure
        return null;
    }
}
//code for map
class TiledMap {
    constructor() {
        this.container = new PIXI.Container();
        this.chunks = new Map();
        this.visibleChunks = new Set();
        this.chunkSize = 16; // 16x16 tiles per chunk
        this.tileTextures = new Map();
        this.lastCameraX = 0;
        this.lastCameraY = 0;
        this.cullingThreshold = 50; // Only update chunks when camera moves this much
        this._mapData = null; // Store map data as private property
    }
    
    // Safely get mapData with error handling
    get mapData() {
        if (!this._mapData) {
            console.warn('TiledMap: Attempted to access mapData but it is null');
        }
        return this._mapData;
    }
    
    // Safely set mapData
    set mapData(data) {
        this._mapData = data;
        console.log(`TiledMap: mapData ${data ? 'set' : 'cleared'}`);
    }
    
    async initialize(mapDataAlias = 'mapData') {
        try {
            console.log('TiledMap: Starting initialization with alias:', mapDataAlias);
            
            // Load map data and store locally
            const loadedData = await PIXI.Assets.get(mapDataAlias);
            if (!loadedData) {
                throw new Error(`Map data not found for alias: ${mapDataAlias}`);
            }
            
            // Store reference to the map data
            this.mapData = loadedData;
            
            // Log successful loading
            console.log(`TiledMap initialized with data: ${this.mapData.width}x${this.mapData.height} tiles`);
            
            // Important: Make a local properties to avoid dependency on mapData
            this.tileWidth = this.mapData.tilewidth;
            this.tileHeight = this.mapData.tileheight;
            this.mapWidth = this.mapData.width * this.tileWidth;
            this.mapHeight = this.mapData.height * this.tileHeight;
            
            // Process tilesets
            await this.processTilesets();
            
            // Create layer containers
            this.layers = new Map();
            for (const layer of this.mapData.layers) {
                if (layer.type === 'tilelayer') {
                    const layerContainer = new PIXI.Container();
                    layerContainer.name = layer.name;
                    layerContainer.cullable = true; // Enable automatic culling
                    this.container.addChild(layerContainer);
                    
                    // Store layer data locally to reduce dependencies on this.mapData
                    this.layers.set(layer.name, { 
                        container: layerContainer, 
                        data: {
                            width: layer.width,
                            height: layer.height,
                            data: [...layer.data] // Make a copy of the data array
                        }
                    });
                }
            }
            
            // Center the map (0,0 at center of map)
            this.container.position.x = -this.mapWidth / 2;
            this.container.position.y = -this.mapHeight / 2;
            
            return true;
        } catch (error) {
            console.error('Failed to initialize TiledMap:', error);
            return false;
        }
    }
    
    async processTilesets() {
        try {
            // Safety check
            if (!this.mapData || !this.mapData.tilesets || !this.mapData.tilesets.length) {
                throw new Error('No tilesets found in map data');
            }

            for (const tileset of this.mapData.tilesets) {
                // Get full path
                const imagePath = tileset.image.startsWith('/') 
                    ? tileset.image.substring(1) // Remove leading slash
                    : `img/dmap/${tileset.image}`; // Adjust path format
                
                console.log(`Loading tileset image: ${imagePath}`);
                
                // Load the tileset texture if not already loaded
                let tilesetTexture;
                try {
                    tilesetTexture = await PIXI.Assets.load(imagePath);
                } catch (error) {
                    console.error(`Failed to load tileset: ${imagePath}`, error);
                    continue;
                }
                
                // Store tileset information
                const columns = Math.floor(tileset.imagewidth / this.tileWidth);
                const rows = Math.floor(tileset.imageheight / this.tileHeight);
                
                // Pre-create all tile textures for this tileset
                for (let id = 0; id < columns * rows; id++) {
                    const gid = tileset.firstgid + id;
                    const col = id % columns;
                    const row = Math.floor(id / columns);
                    
                    const x = col * this.tileWidth;
                    const y = row * this.tileHeight;
                    
                    // V8 way of creating a texture from another texture
                    const tileTexture = new PIXI.Texture({
                        source: tilesetTexture.source,
                        frame: new PIXI.Rectangle(x, y, this.tileWidth, this.tileHeight)
                    });
                    
                    this.tileTextures.set(gid, tileTexture);
                }
            }
            
            console.log(`Processed ${this.tileTextures.size} individual tile textures`);
        } catch (error) {
            console.error('Error processing tilesets:', error);
            throw error;
        }
    }
    
    // Get the chunk coordinate for a given tile position
    getChunkCoordForTile(tileX, tileY) {
        return {
            chunkX: Math.floor(tileX / this.chunkSize),
            chunkY: Math.floor(tileY / this.chunkSize)
        };
    }
    
    // Get a unique key for a chunk
    getChunkKey(layerName, chunkX, chunkY) {
        return `${layerName}_${chunkX}_${chunkY}`;
    }
    
    // Create a chunk of tiles
    // Create a chunk of tiles
createChunk(layerName, chunkX, chunkY) {
    const layer = this.layers.get(layerName);
    if (!layer) {
        console.warn(`Layer ${layerName} not found when creating chunk`);
        return null;
    }
    
    // Create a single container for all tiles in this chunk
    const chunk = new PIXI.Container();
    chunk.x = chunkX * this.chunkSize * this.tileWidth;
    chunk.y = chunkY * this.chunkSize * this.tileHeight;
    chunk.cullable = true; // Enable culling on this chunk
    
    let tileCount = 0;
    
    // Add all tiles in this chunk
    for (let y = 0; y < this.chunkSize; y++) {
        const tileY = chunkY * this.chunkSize + y;
        if (tileY >= layer.data.height) continue;
        
        for (let x = 0; x < this.chunkSize; x++) {
            const tileX = chunkX * this.chunkSize + x;
            if (tileX >= layer.data.width) continue;
            
            const tileIndex = tileY * layer.data.width + tileX;
            const gid = layer.data.data[tileIndex];
            
            if (gid === 0) continue; // Empty tile
            
            // Get tile texture
            const texture = this.tileTextures.get(gid);
            if (!texture) continue;
            
            // Create sprite for this tile
            const sprite = new PIXI.Sprite(texture);
            sprite.x = x * this.tileWidth;
            sprite.y = y * this.tileHeight;
            
            chunk.addChild(sprite);
            tileCount++;
        }
    }
    
    // Optimize the chunk for static content 
    if (tileCount > 0) {
        // Set properties for better performance
        chunk.interactiveChildren = false; // Disables interactivity on all children
        chunk._staticBounds = true; // Hint that bounds won't change
        
        // Cache the bounds once calculated
        chunk.getBounds(); // Force bounds calculation once
        
        // Try to ensure this chunk stays in GPU memory since it's static
        chunk.cacheAsBitmap = true; // This is a simpler alternative to RenderTexture
    }
    
    // Add chunk to layer and track it
    layer.container.addChild(chunk);
    const chunkKey = this.getChunkKey(layerName, chunkX, chunkY);
    this.chunks.set(chunkKey, { chunk, layerName, chunkX, chunkY });
    
    return chunk;
}
    
    // Update visible chunks based on camera position
    updateVisibleChunks(cameraX, cameraY, viewWidth, viewHeight) {
        try {
            // Skip updates if camera hasn't moved much
            if (Math.abs(cameraX - this.lastCameraX) < this.cullingThreshold && 
                Math.abs(cameraY - this.lastCameraY) < this.cullingThreshold) {
                return;
            }
            
            // Safety check for required properties
            if (!this.tileWidth || !this.tileHeight || !this.layers) {
                console.warn('TiledMap not properly initialized for culling');
                console.log(this.tileWidth)
                console.log(this.tileHeight)
                console.log(this.layers)
                return;
            }
            
            this.lastCameraX = cameraX;
            this.lastCameraY = cameraY;
            
            // Calculate visible area in world coordinates
            const worldX = -cameraX;
            const worldY = -cameraY;
            
            // Account for the map position offset
            const adjustedWorldX = worldX - this.container.position.x;
            const adjustedWorldY = worldY - this.container.position.y;
            
            // Safety checks for view dimensions
            if (!viewWidth || !viewHeight) {
                console.warn('Invalid view dimensions for culling:', viewWidth, viewHeight);
                viewWidth = window.innerWidth || 800;
                viewHeight = window.innerHeight || 600;
            }
            
            // Convert to tile coordinates with buffer
            const tileStartX = Math.max(0, Math.floor(adjustedWorldX / this.tileWidth) - 2);
            const tileStartY = Math.max(0, Math.floor(adjustedWorldY / this.tileHeight) - 2);
            
            // We need the map dimensions which should have been cached during initialization
            const mapWidth = this.mapWidth / this.tileWidth;
            const mapHeight = this.mapHeight / this.tileHeight;
            
            const tileEndX = Math.min(mapWidth, 
                              Math.ceil((adjustedWorldX + viewWidth) / this.tileWidth) + 2);
            const tileEndY = Math.min(mapHeight, 
                              Math.ceil((adjustedWorldY + viewHeight) / this.tileHeight) + 2);
            
            // Convert to chunk coordinates
            const chunkStartX = Math.floor(tileStartX / this.chunkSize);
            const chunkStartY = Math.floor(tileStartY / this.chunkSize);
            const chunkEndX = Math.ceil(tileEndX / this.chunkSize);
            const chunkEndY = Math.ceil(tileEndY / this.chunkSize);
            
            // Track which chunks should be visible
            const newVisibleChunks = new Set();
            
            // For each layer
            for (const [layerName, layer] of this.layers.entries()) {
                // For each chunk in the visible area
                for (let chunkY = chunkStartY; chunkY < chunkEndY; chunkY++) {
                    for (let chunkX = chunkStartX; chunkX < chunkEndX; chunkX++) {
                        const chunkKey = this.getChunkKey(layerName, chunkX, chunkY);
                        newVisibleChunks.add(chunkKey);
                        
                        // If chunk doesn't exist yet, create it
                        if (!this.chunks.has(chunkKey)) {
                            this.createChunk(layerName, chunkX, chunkY);
                        }
                    }
                }
            }
            
            // Show newly visible chunks
            for (const chunkKey of newVisibleChunks) {
                const chunkData = this.chunks.get(chunkKey);
                if (chunkData) {
                    chunkData.chunk.visible = true;
                }
            }
            
            // Hide chunks that are no longer visible
            for (const [chunkKey, chunkData] of this.chunks.entries()) {
                if (!newVisibleChunks.has(chunkKey)) {
                    chunkData.chunk.visible = false;
                }
            }
            
            this.visibleChunks = newVisibleChunks;
        } catch (error) {
            console.error('Error in updateVisibleChunks:', error);
        }
    }
}
//end code for map
// Color handling
const GAME_COLORS = {
    darkGray: 0x636663,
    lightGray: 0x87857c,
    tan: 0xbcad9f,
    lightOrange: 0xf2b888,
    orange: 0xeb9661,
    red: 0xb55945,
    darkRed: 0x734c44,
    brown: 0x3d3333,
    burgundy: 0x593e47,
    reddishBrown: 0x7a5859,
    copper: 0xa57855,
    gold: 0xde9f47,
    lightGold: 0xfdd179,
    cream: 0xfee1b8,
    lightOlive: 0xd4c692,
    olive: 0xa6b04f,
    lightGreen: 0x819447,
    green: 0x44702d,
    darkGreen: 0x2f4d2f,
    forestGreen: 0x546756,
    mintGreen: 0x89a477,
    teal: 0xa4c5af,
    lightTeal: 0xcae6d9,
    offWhite: 0xf1f6f0,
    lightBlue: 0xd5d6db,
    skyBlue: 0xbbc3d0,
    blue: 0x96a9c1,
    mediumBlue: 0x6c81a1,
    darkBlue: 0x405273,
    navy: 0x303843,
    darkNavy: 0x14233a
};

// Array of distinct colors to use for team members
const TEAM_MEMBER_COLORS = [
    GAME_COLORS.lightGold,  // Primary gold
    GAME_COLORS.teal,       // Teal
    GAME_COLORS.orange,     // Orange
    GAME_COLORS.mediumBlue, // Medium blue
    GAME_COLORS.mintGreen,  // Mint green
    GAME_COLORS.lightOrange, // Light orange
    GAME_COLORS.blue,       // Blue
    GAME_COLORS.olive,      // Olive
    GAME_COLORS.skyBlue,    // Sky blue
    GAME_COLORS.copper      // Copper
];
const teamMemberColors = new Map();


//asset pre-loader (WORK IN PROGRESS)
async function assetPreloader() {
    // Hide main container and show loading screen initially
    document.getElementById("main-container").style.display = "none";
    document.getElementById("discord").style.display = "none";
    document.getElementById("loading-screen").style.display = "flex";
    
    // The loading bar and progress text elements
    const loadingBar = document.getElementById("loading-bar");
    const loadingProgress = document.getElementById("loading-progress");
    
    try {

    // Initialize PixiJS Assets system
    await PIXI.Assets.init();
    
    // Define asset bundles for better organization
    const assetBundles = {
        resources: [
            { alias: 'TREE', src: 'img/resources/tree.png' },
            { alias: 'TREE2', src: 'img/resources/tree2.png' },
            { alias: 'TREE3', src: 'img/resources/tree3.png' },
            { alias: 'ROCK', src: 'img/resources/rock.png' },
            { alias: 'ROCK2', src: 'img/resources/rock2.png' },
            { alias: 'ROCK3', src: 'img/resources/rock3.png' },
            { alias: 'CRYSTAL', src: 'img/resources/crystal.png' },
            { alias: 'GOLD', src: 'img/resources/gold.png' },
        ],
        map: [
            { alias: 'tiles', src: '/img/dmap/tiles.jpg' },
            { alias: 'mapData', src: '/img/dmap/map.json', loadParser: 'json' },
        ],
        mobs: [
            { alias: 'blackspider', src: "/img/mobs/blackspider/blackspider.json" },
            { alias: 'redspider', src: "/img/mobs/redspider/redspider.json" },
            { alias: 'brownbear', src: "/img/mobs/brownbear/brownbear.json" },
            { alias: 'whitebear', src: "/img/mobs/whitebear/whitebear.json" },
        ],
        character: [
            { alias: 'leftFoot', src: '/img/knight-1/knight-1-left-foot.png' },
            { alias: 'rightFoot', src: '/img/knight-1/knight-1-right-foot.png' },
            { alias: 'body', src: '/img/knight-1/knight-1-body.png' },
            { alias: 'leftHand', src: '/img/lefthold/hand.png' },
            { alias: 'rightHand', src: '/img/righthold/hand.png' },
            { alias: 'leftArm', src: '/img/knight-1/knight-1-left-arm.png' },
            { alias: 'rightArm', src: '/img/knight-1/knight-1-right-arm.png' },
            { alias: 'leftShoulder', src: '/img/knight-1/knight-1-left-shoulder.png' },
            { alias: 'rightShoulder', src: '/img/knight-1/knight-1-right-shoulder.png' },
            { alias: 'cape', src: '/img/knight-1/knight-1-cape.png' },
            { alias: 'head', src: '/img/knight-1/knight-1-head.png' },
            { alias: 'rwwoodenshieldtest', src: '/img/lefthold/woodenshield.png' },
        ],
        items: [
            { alias: 'goldensword', src: '/img/items/goldensword.png' },
            { alias: 'wood', src: '/img/items/wood.png' },
            { alias: 'fur', src: '/img/items/fur.png' },
            { alias: 'gold', src: '/img/items/gold.png' },
            { alias: 'stone', src: '/img/items/stone.png' },
            { alias: 'dust', src: '/img/items/dust.png' },
            { alias: 'crystal', src: '/img/items/crystal.png' },
            { alias: 'copper', src: '/img/items/copper.png' },
            { alias: 'web', src: '/img/items/web.png' },
            { alias: 'woodenshield', src: '/img/items/woodenshield.png' },
        ],
        weapons: [
            { alias: 'righthand', src: '/img/righthold/hand.png' },
            { alias: 'rightgoldensword', src: '/img/righthold/goldensword.png' },
        ],
        gui: [
            { alias: 'hotbarBoxHat', src: '/img/GUI/Hotbarbox-hat.png' },
            { alias: 'hotbarBoxShield', src: '/img/GUI/Hotbarbox-shield.png' },
            { alias: 'hotbarBox', src: '/img/GUI/Hotbarbox.png' },
            { alias: 'hotbarBoxSelect', src: '/img/GUI/Hotbarbox-select.png' },
            { alias: 'inGameMenu', src: '/img/GUI/ingamemenu.png' },
            { alias: 'inventory', src: '/img/GUI/inventory.png' },
            { alias: 'title', src: 'img/title.png' },
        ],
    };
    
    // Register all bundles
    Object.entries(assetBundles).forEach(([bundleName, assets]) => {
        PIXI.Assets.addBundle(bundleName, assets);
    });
    
    // Load all bundles with progress tracking
    const bundleNames = Object.keys(assetBundles);
    PIXI.Assets.loadBundle(bundleNames, (progress) => {
        const percentage = Math.round(progress * 100);
        loadingBar.style.width = percentage + '%';
        loadingProgress.textContent = percentage + '%';
    });
    setTimeout(() => {
        // Fade out loading screen
        const loadingScreen = document.getElementById("loading-screen");
        loadingScreen.style.opacity = "0";
        loadingScreen.style.transition = "opacity 0.5s ease";
        
        // After fade out completes, show the main container
        setTimeout(() => {
            loadingScreen.style.display = "none";
            document.getElementById("main-container").style.display = "flex";
            document.getElementById("discord").style.display = "block";

            //Signal assets are ready to use
            document.dispatchEvent(new Event('assetsLoaded'))
        }, 500);
    }, 500); // 500ms delay before starting the fade
} catch (err) {
    console.error('Error in asset loading:', err);
    // Show some error message to the user
    loadingProgress.textContent = "Error loading assets. Please refresh.";
    loadingProgress.style.color = "#ff6b6b";
}
}


const RECIPES = [
    {
        id: "goldensword",
        name: "Golden Sword",
        description: "A magnificent sword forged from pure gold. Deals increased damage to enemies.",
        category: "weapons",
        image: "goldensword",
        requirements: [
            { material: "gold", amount: 5 },
            { material: "wood", amount: 2 }
        ],
        stats: {
            damage: 20,
            durability: 100
        }
    },
    {
        id: "goldpickaxe",
        name: "Gold Pickaxe",
        description: "A sturdy pickaxe that can mine ore faster than your bare hands.",
        category: "tools",
        image: "goldensword", // Using goldensword as placeholder since we don't have a specific pickaxe image
        requirements: [
            { material: "gold", amount: 3 },
            { material: "wood", amount: 2 },
            { material: "stone", amount: 1 }
        ],
        stats: {
            mining: 15,
            durability: 80
        }
    },
    {
        id: "crystalstaff",
        name: "Crystal Staff",
        description: "A magical staff imbued with crystal energy. Has special powers against certain enemies.",
        category: "weapons",
        image: "crystal", // Using crystal as placeholder
        requirements: [
            { material: "crystal", amount: 5 },
            { material: "wood", amount: 1 }
        ],
        stats: {
            magicDamage: 25,
            durability: 60
        }
    },
    {
        id: "furarmor",
        name: "Fur Armor",
        description: "Warm and durable armor made from animal furs. Provides decent protection.",
        category: "armor",
        image: "fur", // Using fur as placeholder
        requirements: [
            { material: "fur", amount: 12 }
        ],
        stats: {
            defense: 10,
            durability: 70
        }
    },
    {
        id: "webpotion",
        name: "Web Potion",
        description: "A sticky concoction that can slow down enemies when thrown.",
        category: "special",
        image: "web", // Using web as placeholder
        requirements: [
            { material: "web", amount: 8 },
            { material: "crystal", amount: 1 }
        ],
        stats: {
            slowEffect: 30,
            duration: 10
        }
    },
    {
        id: "woodenshield",
        name: "Wooden Shield",
        description: "A basic level of protection.",
        category: "offhands",
        image: "woodenshield",
        requirements: [
            { material: "wood", amount: 2 },
        ],
        stats: {
            defense: 10,
        }
    }
];
const itemDescriptions = {
    "wood": "Common material used for crafting basic tools and structures.",
    "stone": "Hard material used for crafting durable tools and buildings.",
    "gold": "Valuable material that can be crafted into powerful weapons.",
    "crystal": "Rare material with mystical properties.",
    "fur": "Warm material dropped from bears, used for crafting warm clothing.",
    "web": "Sticky material from spiders, used in special potions.",
    "dust": "Mysterious powder with alchemical uses.",
    "goldensword": "A magnificent sword forged from pure gold. Deals increased damage to enemies.",
    // Add more descriptions as needed
  };
  const BUILDINGS = [
    {
        id: "wood_wall",
        name: "Wooden Wall",
        description: "A simple wooden wall that provides basic protection. Can be upgraded.",
        category: "defense",
        image: "wood",
        requirements: [
            { material: "wood", amount: 10 }
        ],
        stats: {
            health: 100,
            buildTime: 2
        },
        collisionShape: "rectangle",
        width: 64,
        height: 64
    },
    {
        id: "stone_wall",
        name: "Stone Wall",
        description: "A sturdy wall made of stone. Provides enhanced protection against attacks.",
        category: "defense",
        image: "stone",
        requirements: [
            { material: "stone", amount: 15 },
            { material: "wood", amount: 5 }
        ],
        stats: {
            health: 250,
            buildTime: 4
        },
        collisionShape: "rectangle",
        width: 64,
        height: 64
    },
    {
        id: "campfire",
        name: "Campfire",
        description: "Provides light and warmth. Can be used for cooking.",
        category: "production",
        image: "wood",
        requirements: [
            { material: "wood", amount: 8 },
            { material: "stone", amount: 4 }
        ],
        stats: {
            lightRadius: 10,
            heatRadius: 5,
            buildTime: 1
        },
        collisionShape: "circle",
        radius: 32,
        width: 64,
        height: 64
    },
    {
        id: "lookout_tower",
        name: "Lookout Tower",
        description: "A tall tower that provides visibility over a large area.",
        category: "defense",
        image: "wood",
        requirements: [
            { material: "wood", amount: 25 },
            { material: "stone", amount: 10 }
        ],
        stats: {
            health: 150,
            buildTime: 6
        },
        collisionShape: "circle",
        radius: 64,
        width: 128,
        height: 128
    },
    {
        id: "barricade",
        name: "Barricade",
        description: "A wide defensive barrier that slows down enemies.",
        category: "defense",
        image: "wood",
        requirements: [
            { material: "wood", amount: 15 }
        ],
        stats: {
            health: 120,
            buildTime: 3
        },
        collisionShape: "rectangle",
        width: 128,
        height: 32
    }
]

  const eventHandlerTracker = {
    handlers: [],
    
    // Add a handler to the tracking system
    add: function(element, type, handler, options) {
        element.addEventListener(type, handler, options);
        this.handlers.push({ element, type, handler });
        return handler; // Return the handler for reference
    },
    
    // Remove a specific handler
    remove: function(element, type, handler) {
        element.removeEventListener(type, handler);
        this.handlers = this.handlers.filter(h => 
            !(h.element === element && h.type === type && h.handler === handler)
        );
    },
    
    // Remove all handlers
    removeAll: function() {
        this.handlers.forEach(h => {
            h.element.removeEventListener(h.type, h.handler);
        });
        this.handlers = [];
    }
};

// Apply these changes to document.addEventListener('DOMContentLoaded')
// Replace the existing function with this updated version
document.addEventListener('DOMContentLoaded', function() {
    // Start the asset preloader immediately
    assetPreloader().catch(err => {
        console.log("Asset preloader failed:", err);
    });
    
        // Firebase is loaded, initialize it

    
    document.getElementById("play").addEventListener("click", async() => {
        const nickname = document.getElementById("nickname").value;
        const passkey = document.getElementById("passkey").value;

        if (!nickname || !passkey) {
            alert("Please fill in both fields!");
            return;
        }
        
        try {
            document.getElementById("main-container").style.display = "none";
            document.getElementById("discord").style.display = "none";
            document.removeEventListener("keydown", handlefirstenter);
            joinRoom(nickname, passkey);
        } catch (err) {
            console.error("Failed to join the game:", err);
            alert("Failed to join the game: " + err.message);
        }
    });
    
    
    
    document.addEventListener("keydown", handlefirstenter);

    document.addEventListener('assetsLoaded', function() {
        console.log("All assets loaded successfully!");
    });
});

function handlefirstenter(e) {
    if (e.key === "Enter") {
        document.getElementById("play").click();
    }
}


// Chat toggle
let chatMode = 'normal';
function setupChatToggle() {
    const toggleButton = document.getElementById('chat-toggle-button');
    const chatInput = document.getElementById('chat-input');
    
    if (!toggleButton || !chatInput) return;
    
    // Set up toggle click event
    eventHandlerTracker.add(toggleButton,'click', function() {
        if (chatMode === 'normal') {
            chatMode = 'team';
            toggleButton.textContent = '👥';
            toggleButton.classList.add('team-mode');
            chatInput.placeholder = 'Team chat: Message your team only...';
        } else {
            chatMode = 'normal';
            toggleButton.textContent = '🌐';
            toggleButton.classList.remove('team-mode');
            chatInput.placeholder = 'Press Enter to chat...';
        }
    });
}



        
async function joinRoom(nickname, passkey) {
    try {
        const room = await client.joinOrCreate("Map",{nickname, passkey});
        const $ = Colyseus.getStateCallbacks(room);
        console.log("Joined room:", room.name);
        const id = room.sessionId
        //Graphics(room,id,nickname);
        room.onStateChange.once((state) => {
            console.log("Initial state received");
            
            // Initialize graphics with the synchronized state
            if (state) {
                Graphics(room, $, id, nickname).catch(err => {
                    console.error("Error during graphics initialization:", err);
                });
                
                // Set up state change listeners here after we're sure state exists
            } else {
                console.error("Room state is undefined after sync");
            }

        });
        

    } catch (e) {
        console.error("Failed to join room:", e);
        throw e;
    }
}
function Interpolate(a, b, t) {
    const diff = Math.abs(a - b);
    
    // For very small differences, just snap to target
    if (diff < 0.5) return b;
    
    // For very large jumps, just teleport
    if (diff > 100) return b;
    
    // Use a slower, more consistent approach
    // This ensures the position never quite reaches its target
    // before the next update, creating continuous motion
    const speed = 0.8;
    return a + (b - a) * Math.min(speed, t * 2);
}


async function Graphics(room,$,id_me,nickname_me) {
    const app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
        resizeTo: window,
        preference: 'webgl2',
        batching: true,
        eventMode: 'passive',
        eventFeatures: {
            move: true, // find out what this does
            globalMove: false,
            click: true,
            wheel: true,
        }
    });

    await app.init();
    app.stage.eventMode = 'passive';
    let winx = window.innerWidth;
    let winy = window.innerHeight;
    let ruse = false;
    createUIScalingSystem();

    //
    eventHandlerTracker.add(document,'contextmenu', (event) => {
        event.preventDefault();
      });

    document.body.appendChild(app.canvas);
    const camera = new PIXI.Container();
    camera.eventMode = 'passive'
    //app.stage.eventMode = 'static';
    
    const hitArea = new PIXI.Graphics(); // Using Graphics instead of Sprite
    hitArea.drawRect(0, 0, window.innerWidth, window.innerHeight);
    hitArea.fill({color: 0x000000, alpha: 0.5}); // Completely transparent but still interactive
    hitArea.hitArea = new PIXI.Rectangle(0, 0, window.innerWidth, window.innerHeight);
    hitArea.eventMode = 'static';


    

   
    app.stage.addChild(camera);
    app.stage.addChild(hitArea);
    app.canvas.style.pointerEvents = "auto";
 
    
    const gameLayer = new PIXI.Container();
    gameLayer.eventMode = 'passive'
    gameLayer.interactiveChildren = false;
    
    //in progress
    const treeLayer = new PIXI.Container();

    const treeLayer2 = new PIXI.Container();
    const treeLayer3 = new PIXI.Container();
    const rockLayer = new PIXI.Container();
    const rockLayer2 = new PIXI.Container();
    const rockLayer3 = new PIXI.Container();
    const goldLayer = new PIXI.Container();
    const crystalLayer = new PIXI.Container();
    const itemLayer = new PIXI.Container();
    const mobLayer = new PIXI.Container();
    const playerLayer = new PIXI.Container();
    const mapLayer = new PIXI.Container();
    const projectileLayer = new PIXI.Container();

    const GRID_SIZE = 64; // Size of each grid cell in pixels
    const MAX_PLACEMENT_RANGE = 300; // Maximum distance from player that buildings can be placed

    // Building state constants
    const BUILDING_STATES = {
        PREVIEW: 0,      // Ghost preview during placement
        BUILDING: 1,     // Under construction
        COMPLETE: 2      // Fully built
    };

    // Current building placement state
    let buildingPlacementActive = false;
    let currentBuildingPreview = null;
    let currentBuildingType = null;
    const buildingLayer = new PIXI.Container(); // Layer for building objects

    //init culling ...
    function setupCulling() {
        // Get all layers that need culling
        const layers = [
             treeLayer2, treeLayer3,
            rockLayer, rockLayer2, rockLayer3,
            goldLayer, crystalLayer,
            itemLayer, mobLayer, playerLayer, projectileLayer, buildingLayer
        ];
        
        // Enable culling for all layers
        layers.forEach(layer => {
            // Enable culling
            layer.cullable = true;
            
            // Set initial cull area with padding
            updateLayerCullArea(layer);
        });
        
        // Add resize handler to update cull areas when window size changes
        const reizeHandler = eventHandlerTracker.add(window,'resize', () => {
            layers.forEach(updateLayerCullArea);
        });
    }
    
    // Function to update a layer's cull area based on current viewport
    function updateLayerCullArea(layer) {
        // Add generous padding around viewport for smooth scrolling/zooming
        const padding = 300;
        
        // Create rectangle slightly larger than viewport
        // This is in screen space, will be transformed to world space by PixiJS
        layer.cullArea = new PIXI.Rectangle(
            -padding,
            -padding,
            window.innerWidth + padding * 2,
            window.innerHeight + padding * 2
        );
    }
    
    // In your camera update function, sync the cull area with camera position
    function updateCullAreas(cameraX, cameraY) {
        try {
            const layers = [
                treeLayer, treeLayer2, treeLayer3,
                rockLayer, rockLayer2, rockLayer3,
                goldLayer, crystalLayer,
                itemLayer, mobLayer, playerLayer, projectileLayer, buildingLayer
            ];
            
            // Only process layers that exist and have valid properties
            layers.forEach(layer => {
                if (!layer) return;
                
                // Make sure layer is visible
                layer.visible = true;
                
                if (!layer.cullable) {
                    layer.cullable = true;
                }
                
                // Move the cull area with the camera
                // This creates a "window" in world space where objects are visible
                const padding = 300; // Increased padding for better visibility
                
                // Create a new Rectangle each time to avoid reference issues
                layer.cullArea = new PIXI.Rectangle(
                    -cameraX - padding,
                    -cameraY - padding,
                    winx + padding * 2,
                    winy + padding * 2
                );
            });
        } catch (error) {
            console.error("Error updating cull areas:", error);
        }
    }
    
    //setup culling ...
    setupCulling();



    gameLayer.addChild(mapLayer);
    gameLayer.addChild(itemLayer);
    
    gameLayer.addChild(rockLayer2);
    gameLayer.addChild(rockLayer);
    gameLayer.addChild(rockLayer3);
    gameLayer.addChild(goldLayer);
    
    gameLayer.addChild(playerLayer);
    gameLayer.addChild(mobLayer);
    gameLayer.addChild(projectileLayer);
    //resource layers
    gameLayer.addChild(buildingLayer)
    gameLayer.addChild(crystalLayer);
    gameLayer.addChild(treeLayer3);
    gameLayer.addChild(treeLayer2);
    gameLayer.addChild(treeLayer);
    //resource layers

    let tiledMap;
    PIXI.Assets.load('/img/dmap/map.json')
        .then(mapData => {
            tiledMap = new TiledMap(mapData, PIXI.Assets.cache);
            mapLayer.addChild(tiledMap.container);
        })
        .catch(error => console.error('Error loading map:', error));


    // add gamelayer to the camera

    //Frustum Culling (detects if the sprite is offscreen)
    function isInViewMap(x,y){
        return(
            Math.abs(playa.x-x) < 4000 &&
            Math.abs(playa.y-y) < 4000
            
        );
            
        
    }

    
    camera.addChild(gameLayer);

    const reizeHandlermain = eventHandlerTracker.add(window,"resize", () => {
        winx = window.innerWidth;
        winy = window.innerHeight;
        app.renderer.resize(winx, winy); // Resize the renderer to match the new window size
        hitArea.clear();
        hitArea.drawRect(0, 0, window.innerWidth, window.innerHeight);
        hitArea.fill({color: 0x000000, alpha:0.0001}); // Completely transparent but still 
        hitArea.hitArea = new PIXI.Rectangle(0, 0, window.innerWidth, window.innerHeight);

        //const hotbar = app.stage.getChildByName("hotbar")
        //hotbar.x = winx/2+130;
        //hotbar.y = winy-75;

        //map update
        if(tiledMap){
        
        // Force an immediate update by resetting the last camera position
        // This ensures chunks are recalculated even if camera hasn't moved
        tiledMap.lastCameraX = -99999;
        tiledMap.lastCameraY = -99999;
        }
    });


    const keyStates = {
        'ArrowUp': false,
        'ArrowDown': false,
        'ArrowLeft': false,
        'ArrowRight': false,
        'w': false,
        'a': false,
        's': false,
        'd': false,
        '1': false,
        '2': false,
        '3': false,
        '4': false,
        '5': false,
        '6': false,
        '7': false,
        '8': false,
        '9': false,
        '0': false,
        'Enter': false,
        'e': false,
        't': false,
        "o": false,
        "i": false,
        "c": false,
        "b": false,
        'Escape': false,
        "Shift": false,
    };

    let direction = -1;
    let pressed = {};
    let cboxopen = false;
    let oldselect = 0;
    let select = 0;

    hitArea.on("wheel", (event) => {
        if (event.ctrlKey) {
            event.preventDefault();  // Prevent zooming when Ctrl + Scroll is used
          }
        if(event.deltaY > 0){
            select = (select + 1) % 9;
            room.send("select",select);
        }else{
            select = (select  + 8) % 9;
            room.send("select",select);
        }


    }, { passive: false });
    eventHandlerTracker.add(document,"keydown", (e) => {

        if(window.inputFocused){
            return;
        }

        if (keyStates.hasOwnProperty(e.key)) {
            keyStates[e.key] = true;
        }
        if(keyStates[e.key] === true){
            if (!pressed[e.key]) {  // Only log when it's pressed for the first time
                pressed[e.key] = true;  // Mark enter as "pressed"
            }
        }
        if(!cboxopen){
        if ('1' <= e.key && e.key <= '9') {
            if (!pressed[e.key]) {  // Only log when it's pressed for the first time
                pressed[e.key] = true;  // Mark this number as "pressed"
            }
        }
        


        const up = keyStates['ArrowUp'] || keyStates['w'];
        const down = keyStates['ArrowDown'] || keyStates['s'];
        const left = keyStates['ArrowLeft'] || keyStates['a'];
        const right = keyStates['ArrowRight'] || keyStates['d'];
        switch(true) {
            case up && !down && !left && !right:
                direction = Math.PI/2; //up
                break;
            case !up && down && !left && !right:
                direction = 3*Math.PI/2; //down
                break;
            case !up && !down && left && !right:
                direction = Math.PI; //left
                break;
            case !up && !down && !left && right:
                direction = 0; //right
                break;
            case up && !down && left && !right:
                direction = 3*Math.PI/4; //up-left
                break;
            case up && !down && !left && right:
                direction = Math.PI/4; // up-right
                break;
            case !up && down && left && !right:
                direction = 5*Math.PI/4; // down-left
                break;
            case !up && down && !left && right:
                direction = 7*Math.PI/4; // down-right
                break;
            default:
                direction = -1;
        }
    }
        room.send("move",{move:direction, direction: rotation, ruse: ruse});
    });
    eventHandlerTracker.add(document, "keyup", (event) => {
        if(window.inputFocused){
            return;
        }

        if (keyStates.hasOwnProperty(event.key)) {
            keyStates[event.key] = false; 
        }

        if(keyStates["Enter"] === false && event.key === "Enter"){
            if (pressed[event.key]) {  // Only log when it's pressed for the first time
                pressed[event.key] = false;  // Mark enter as "pressed"
                if(cboxopen){
                    cboxopen = false;
                    const chatter = document.getElementById("chat-input").value.trim();
                    if(chatter.length > 0){
                    if(chatMode === 'team'){
                        room.send("teamChat",{ message: chatter});
                    }else{
                    if(chatter.trim().startsWith('/team ')){
                        room.send("teamChat",{ message: chatter.substring(6).trim()});
                    }else{
                    room.send("chat",chatter);
                    }
                    }
                    
                    }
                    document.getElementById("chat-container").style.display = "none";
                    document.getElementById("chat-input").value = "";
                }
                else{
                    cboxopen = true;
                    document.getElementById("chat-container").style.display = "flex";
                    document.getElementById("chat-input").focus();
                }
            }
        }
        if(!cboxopen){
        if(pressed[event.key]){
        switch(event.key.toLowerCase()){
            case 'e':
                room.send("interact")
                pressed[event.key] = false;
                break;
            case 'i':
                const isopen = app.stage.getChildByName("inventory").visible
                app.stage.getChildByName("inventory").visible = !isopen
                if(isopen){
                    // If player has an item in hand, put it back
                if (MouseItem !== "none" && MouseItemName !== "none") {
                    // Only if it's an inventory slot (number)
                    if (!isNaN(parseInt(MouseItemName))) {
                        const originalSlot = parseInt(MouseItemName);
                        
                        // Find first empty slot to put it back if original slot now has an item
                        const player = room.state.players.get(id_me);
                        let targetSlot = originalSlot;
                        
                        // Check if original slot is now occupied
                        if (player.inventory.slots.get(originalSlot.toString())) {
                            // Find first empty slot
                            for (let i = 0; i < player.inventory.MAX_SLOTS; i++) {
                                if (!player.inventory.slots.get(i.toString())) {
                                    targetSlot = i;
                                    break;
                                }
                            }
                        }
                        
                        // Send to server
                        room.send("moveItem", {
                            from: "inv",
                            to: "inv",
                            fromslot: originalSlot,
                            toslot: targetSlot
                        });
                        
                        // Clear mouse item
                        MouseItem = "none";
                        MouseItemName = "none";
                        updateMouseItem();
                    }
                }
                }
                pressed[event.key] = false;
                const craftingContainer4 = document.getElementById('crafting-container');
                if (craftingContainer4 && craftingContainer4.style.display === 'block') {
                    toggleCraftingUI(false);
                }
                const teamContainer4 = document.getElementById('team-container');
                if (teamContainer4 && teamContainer4.style.display === 'block') {
                    toggleTeamUI(false);
                }
                const buildingContainer2 = document.getElementById('building-container');
                if (buildingContainer2 && buildingContainer2.style.display === 'block') {
                    toggleBuildingUI(false);
                }
                updateInventory(room.state.players.get(id_me).inventory)
                break;
            case 'b':
                const buildingContainer = document.getElementById('building-container');
                const isShowings = buildingContainer && buildingContainer.style.display === 'block';
                toggleBuildingUI(!isShowings);
                const teamContainer5 = document.getElementById('team-container');
                if (teamContainer5 && teamContainer5.style.display === 'block') {
                    toggleTeamUI(false);
                }
                const craftingContainer5 = document.getElementById('crafting-container');
                if (craftingContainer5 && craftingContainer5.style.display === 'block') {
                    toggleCraftingUI(false);
                }
                app.stage.getChildByName("inventory").visible = false;
                // If player has an item in hand, put it back
                if (MouseItem !== "none" && MouseItemName !== "none") {
                    // Only if it's an inventory slot (number)
                    if (!isNaN(parseInt(MouseItemName))) {
                        const originalSlot = parseInt(MouseItemName);
                        
                        // Find first empty slot to put it back if original slot now has an item
                        const player = room.state.players.get(id_me);
                        let targetSlot = originalSlot;
                        
                        // Check if original slot is now occupied
                        if (player.inventory.slots.get(originalSlot.toString())) {
                            // Find first empty slot
                            for (let i = 0; i < player.inventory.MAX_SLOTS; i++) {
                                if (!player.inventory.slots.get(i.toString())) {
                                    targetSlot = i;
                                    break;
                                }
                            }
                        }
                        
                        // Send to server
                        room.send("moveItem", {
                            from: "inv",
                            to: "inv",
                            fromslot: originalSlot,
                            toslot: targetSlot
                        });
                        
                        // Clear mouse item
                        MouseItem = "none";
                        MouseItemName = "none";
                        updateMouseItem();
                    }
                }
                break;          
            case 'o':
                pressed[event.key] = false;
                const teamContainer = document.getElementById('team-container');
                const isShowing2 = teamContainer && teamContainer.style.display === 'block';
                toggleTeamUI(!isShowing2);
                const craftingContainer3 = document.getElementById('crafting-container');
                if (craftingContainer3 && craftingContainer3.style.display === 'block') {
                    toggleCraftingUI(false);
                }
                app.stage.getChildByName("inventory").visible = false;
                // If player has an item in hand, put it back
                if (MouseItem !== "none" && MouseItemName !== "none") {
                    // Only if it's an inventory slot (number)
                    if (!isNaN(parseInt(MouseItemName))) {
                        const originalSlot = parseInt(MouseItemName);
                        
                        // Find first empty slot to put it back if original slot now has an item
                        const player = room.state.players.get(id_me);
                        let targetSlot = originalSlot;
                        
                        // Check if original slot is now occupied
                        if (player.inventory.slots.get(originalSlot.toString())) {
                            // Find first empty slot
                            for (let i = 0; i < player.inventory.MAX_SLOTS; i++) {
                                if (!player.inventory.slots.get(i.toString())) {
                                    targetSlot = i;
                                    break;
                                }
                            }
                        }
                        
                        // Send to server
                        room.send("moveItem", {
                            from: "inv",
                            to: "inv",
                            fromslot: originalSlot,
                            toslot: targetSlot
                        });
                        
                        // Clear mouse item
                        MouseItem = "none";
                        MouseItemName = "none";
                        updateMouseItem();
                    }
                }
                const buildingContainer3 = document.getElementById('building-container');
                if (buildingContainer3 && buildingContainer3.style.display === 'block') {
                    toggleBuildingUI(false);
                }
                break;
            case 't':
                room.send("toss")
                pressed[event.key] = false;
                break;
            case 'c':
                const craftingContainer = document.getElementById('crafting-container');
                const isShowing = craftingContainer && craftingContainer.style.display === 'block';
                toggleCraftingUI(!isShowing);
                const teamContainer3 = document.getElementById('team-container');
                if (teamContainer3 && teamContainer3.style.display === 'block') {
                    toggleTeamUI(false);
                }
                app.stage.getChildByName("inventory").visible = false;
                // If player has an item in hand, put it back
                if (MouseItem !== "none" && MouseItemName !== "none") {
                    // Only if it's an inventory slot (number)
                    if (!isNaN(parseInt(MouseItemName))) {
                        const originalSlot = parseInt(MouseItemName);
                        
                        // Find first empty slot to put it back if original slot now has an item
                        const player = room.state.players.get(id_me);
                        let targetSlot = originalSlot;
                        
                        // Check if original slot is now occupied
                        if (player.inventory.slots.get(originalSlot.toString())) {
                            // Find first empty slot
                            for (let i = 0; i < player.inventory.MAX_SLOTS; i++) {
                                if (!player.inventory.slots.get(i.toString())) {
                                    targetSlot = i;
                                    break;
                                }
                            }
                        }
                        
                        // Send to server
                        room.send("moveItem", {
                            from: "inv",
                            to: "inv",
                            fromslot: originalSlot,
                            toslot: targetSlot
                        });
                        
                        // Clear mouse item
                        MouseItem = "none";
                        MouseItemName = "none";
                        updateMouseItem();
                    }
                }
                const buildingContainer4 = document.getElementById('building-container');
                if (buildingContainer4 && buildingContainer4.style.display === 'block') {
                    toggleBuildingUI(false);
                }
                break;
            case 'Escape':
                const craftingContainer2 = document.getElementById('crafting-container');
                if (craftingContainer2 && craftingContainer2.style.display === 'block') {
                    toggleCraftingUI(false);
                }
                const teamContainer2 = document.getElementById('team-container');
                if (teamContainer2 && teamContainer2.style.display === 'block') {
                    toggleTeamUI(false);
                }
                app.stage.getChildByName("inventory").visible = false;

                // If player has an item in hand, put it back
                if (MouseItem !== "none" && MouseItemName !== "none") {
                    // Only if it's an inventory slot (number)
                    if (!isNaN(parseInt(MouseItemName))) {
                        const originalSlot = parseInt(MouseItemName);
                        
                        // Find first empty slot to put it back if original slot now has an item
                        const player = room.state.players.get(id_me);
                        let targetSlot = originalSlot;
                        
                        // Check if original slot is now occupied
                        if (player.inventory.slots.get(originalSlot.toString())) {
                            // Find first empty slot
                            for (let i = 0; i < player.inventory.MAX_SLOTS; i++) {
                                if (!player.inventory.slots.get(i.toString())) {
                                    targetSlot = i;
                                    break;
                                }
                            }
                        }
                        
                        // Send to server
                        room.send("moveItem", {
                            from: "inv",
                            to: "inv",
                            fromslot: originalSlot,
                            toslot: targetSlot
                        });
                        
                        // Clear mouse item
                        MouseItem = "none";
                        MouseItemName = "none";
                        updateMouseItem();
                    }
                }
                const buildingContainer5 = document.getElementById('building-container');
                if (buildingContainer5 && buildingContainer5.style.display === 'block') {
                    toggleBuildingUI(false);
                }
                break;


        }
        }
        if ('1' <= event.key && event.key <= '9') {
            if (pressed[event.key]) {  // Only log when the key is released after being pressed
                select = Number(event.key) - 1
                pressed[event.key] = false;  // Mark this number as "released"
                room.send("select",select)
            }
        }
        

        const up = keyStates['ArrowUp'] || keyStates['w'];
        const down = keyStates['ArrowDown'] || keyStates['s'];
        const left = keyStates['ArrowLeft'] || keyStates['a'];
        const right = keyStates['ArrowRight'] || keyStates['d'];
        switch(true) {
            case up && !down && !left && !right:
                direction = Math.PI/2; //up
                break;
            case !up && down && !left && !right:
                direction = 3*Math.PI/2; //down
                break;
            case !up && !down && left && !right:
                direction = Math.PI; //left
                break;
            case !up && !down && !left && right:
                direction = 0; //right
                break;
            case up && !down && left && !right:
                direction = 3*Math.PI/4; //up-left
                break;
            case up && !down && !left && right:
                direction = Math.PI/4; // up-right
                break;
            case !up && down && left && !right:
                direction = 5*Math.PI/4; // down-left
                break;
            case !up && down && !left && right:
                direction = 7*Math.PI/4; // down-right
                break;
            default:
                direction = -1;
        }
    }
    
        room.send("move",{move:direction, direction: rotation, ruse: ruse});
    });
    let mouseX;
    let mouseY;
    //mouseObject = makeMouseItem();
    const pointerMoveHandler = eventHandlerTracker.add(document, 'pointermove', (event) => {
        mouseX = event.x
        mouseY = event.y
        mouseObject.x = mouseX;
        mouseObject.y = mouseY;
        const mouseAngle = Math.atan2(mouseY -  winy / 2, mouseX -  winx / 2);
        rotation = mouseAngle+Math.PI/2
        room.send("move",{move:direction, direction: rotation, ruse: ruse});
    
    })
    
    hitArea.on('pointerdown', (event) => {
        if(MouseItem === "none"){
        ruse = true;
        room.send("move",{move:direction, direction: rotation, ruse: ruse});
        }else{
        room.send("toss",MouseItemName);
        MouseItem = "none";
        MouseItemName = "none";
        updateMouseItem();
        }
    });
    hitArea.on('pointerup', () => {
        ruse = false;
        room.send("move",{move:direction, direction: rotation, ruse: ruse});
    });

   // projectile effects
// Create a trail effect for fireballs
function createFireballTrail(x, y) {
    // Container for all particles
    const particles = new PIXI.Container();
    particles.x = x;
    particles.y = y;
    
    // Create 3-5 particles
    const particleCount = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < particleCount; i++) {
        const particle = new PIXI.Graphics();
        particle.circle(0, 0, 2 + Math.random() * 3);
        
        // Orange-red gradient color
        const colors = [0xEB7D60, 0xeb9661, 0xf2b888];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        particle.fill({color, alpha: 0.7});
        
        // Position and velocity
        particle.x = (Math.random() * 10) - 5;
        particle.y = (Math.random() * 10) - 5;
        particle.vx = (Math.random() * 2) - 1;
        particle.vy = (Math.random() * 2) - 1;
        particle.alpha = 0.7;
        particle.lifespan = 0.7; // Store original alpha as lifespan
        
        particles.addChild(particle);
    }
    
    // Add to projectile layer
    projectileLayer.addChild(particles);
    
    // Animate particles - STORE THE REFERENCE to remove it properly later
    let elapsed = 0;
    const tickerCallback = (delta) => {
        elapsed += delta;
        
        // Use a reverse loop for safe removal during iteration
        for (let i = particles.children.length - 1; i >= 0; i--) {
            const p = particles.children[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.06;
            
            if (p.alpha <= 0) {
                particles.removeChild(p);
                p.destroy({children: true, texture: true, baseTexture: true});
            }
        }
        
        // Clean up properly when done
        if (particles.children.length === 0 || elapsed > 30) {
            projectileLayer.removeChild(particles);
            particles.destroy({children: true, texture: true, baseTexture: true});
            app.ticker.remove(tickerCallback);
        }
    };
    
    // Add the properly referenced callback
    app.ticker.add(tickerCallback);
}
  
  // Create impact effects when projectiles are destroyed     
  function createImpactEffect(x, y, type) {
    if (type === "fireball") {
        // Track all particles in an array
        const particles = [];
        
        // Create explosion particles
        for (let i = 0; i < 12; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 2 + Math.random() * 3);
            
            // Orange-red color
            const colors = [0xEB7D60, 0xeb9661, 0xf2b888];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.fill({color});
            
            // Position and velocity
            particle.x = x;
            particle.y = y;
            particle.vx = (Math.random() - 0.5) * 15;
            particle.vy = (Math.random() - 0.5) * 15;
            particle.alpha = 1;
            particle.lifetime = 20;
            
            projectileLayer.addChild(particle);
            particles.push(particle);
        }
        
        // Create a properly referenced ticker callback
        const tickerCallback = (delta) => {
            let allDone = true;
            
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                
                // Safety check - improved with existence check
                if (!p || !p.parent) {
                    particles.splice(i, 1);
                    continue;
                }
                
                // Update particle
                p.lifetime--;
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.95;
                p.vy *= 0.95;
                p.alpha = p.lifetime / 20;
                
                if (p.lifetime <= 0) {
                    if (p.parent) {
                        p.parent.removeChild(p);
                    }
                    // More thorough destruction
                    p.destroy({children: true, texture: true, baseTexture: true});
                    particles.splice(i, 1);
                } else {
                    allDone = false;
                }
            }
            
            // Remove ticker when all particles are done
            if (allDone || particles.length === 0) {
                app.ticker.remove(tickerCallback);
                // Clear the array reference when done
                particles.length = 0;
            }
        };
        
        app.ticker.add(tickerCallback);
    }
}

    //animation testing
    function createProjectileSprite(id, type, x, y, velX, velY) {
        let sprite;
        
        switch (type) {
          case "fireball":
            // Create a container for the fireball
            sprite = new PIXI.Container();
            sprite.name = id;
            sprite.type = type;
            
            // Create the core of the fireball
            const core = new PIXI.Graphics();
            core.name = "core";
            core.circle(0, 0, 5);
            core.fill({color: 0xEB7D60}); // Bright red-orange
            
            // Add outer glow
            const glow = new PIXI.Graphics();
            glow.name = "glow";
            glow.circle(0, 0, 10);
            glow.fill({color: 0xeb9661, alpha: 0.5});
            
            // Stack them in the right order
            sprite.addChild(glow);
            sprite.addChild(core);
            
            // Add animation properties
            sprite.animationTime = 0;
            
            break;
            
          // Add more projectile types here as needed
          default:
            // Default fallback sprite
            sprite = new PIXI.Graphics();
            sprite.name = id;
            sprite.type = type;
            sprite.circle(0, 0, 5);
            sprite.fill({color: 0xFFFFFF});
        }
        
        // Set position and rotation
        sprite.x = x;
        sprite.y = y;
        sprite.rotation = Math.atan2(velY, velX);
        
        // Add to projectile layer
        projectileLayer.addChild(sprite);
        
        return sprite;
      }
      function updateProjectileSprite(dt, id, x, y, velX, velY) {
        const projectile = projectileLayer.getChildByName(id);
        
        if (projectile) {
          // Check if in view first
          if (!isInViewMap(x, y)) {
            projectile.visible = false;
            return;
          }
          
          // Make visible and update position with interpolation
          projectile.visible = true;
          projectile.x = Interpolate(projectile.x, x, dt);
          projectile.y = Interpolate(projectile.y, y, dt);
          
          // Update rotation to match velocity
          projectile.rotation = Math.atan2(velY, velX);
          
          // Type-specific animations
          if (projectile.type === "fireball") {
            // Pulsate the glow
            projectile.animationTime += 0.1;
            const glow = projectile.getChildByName("glow");
            if (glow) {
              glow.scale.set(1 + Math.sin(projectile.animationTime) * 0.2);
            }
            
            // Add a trail particle
            if (Math.random() < 0.5) {
              createFireballTrail(projectile.x, projectile.y);
            }
          }
        }
      }
      function removeProjectileSprite(id) {
        const sprite = projectileLayer.getChildByName(id);
        if (sprite) {
          // Create an impact effect based on projectile type
          createImpactEffect(sprite.x, sprite.y, sprite.type);
          
          // Remove the sprite
          projectileLayer.removeChild(sprite);
          sprite.destroy();
        }
      }
    
    function createMobSprite(id, x, y, type){
        const mobContainer = new PIXI.Container();
        let body;
        // Control the mob's healthbar y location with MobContainer.rradius @Rembo
        if(type === "spider"){
            const spritesheet = PIXI.Assets.get("blackspider")
            //const Frames = spritesheet.animations["idle"];
            mobContainer.spritesheet = spritesheet;
            mobContainer.rradius = 10;
            if (spritesheet.animations && spritesheet.animations.idle) {
                body = new PIXI.AnimatedSprite(spritesheet.animations.idle);
            } else if (spritesheet.textures) {
                // If you need to manually create an animation array from the textures
                const idleTextures = Object.keys(spritesheet.textures)
                    .filter(name => name.includes("idle"))
                    .sort()
                    .map(name => spritesheet.textures[name]);
                
                body = new PIXI.AnimatedSprite(idleTextures);
            } else {
                console.error("Could not locate animation frames");
                body = new PIXI.Sprite(PIXI.Texture.WHITE);
            }
            
            body.animationSpeed = 0.3;
            body.play();
           
        body.anchor.set(0.5);
        body.x = 0;
        body.y = 0;
        body.rotation = 0;
        body.name = "body"
        body.scale.set(1.5);
        }else if(type === "redspider"){
            const spritesheet = PIXI.Assets.get("redspider")
            mobContainer.spritesheet = spritesheet;
            mobContainer.rradius = 5;
            if (spritesheet.animations && spritesheet.animations.idle) {
                body = new PIXI.AnimatedSprite(spritesheet.animations.idle);
            } else if (spritesheet.textures) {
                // If you need to manually create an animation array from the textures
                const idleTextures = Object.keys(spritesheet.textures)
                    .filter(name => name.includes("idle"))
                    .sort()
                    .map(name => spritesheet.textures[name]);
                
                body = new PIXI.AnimatedSprite(idleTextures);
            } else {
                console.error("Could not locate animation frames");
                body = new PIXI.Sprite(PIXI.Texture.WHITE);
            }
            
            body.animationSpeed = 0.3;
            body.play();

        body.anchor.set(0.5);
        body.x = 0;
        body.y = 0;
        body.rotation = 0;
        body.name = "body"
        body.scale.set(1.5);

        }else if(type === "bear"){
            const spritesheet = PIXI.Assets.get("brownbear")
            mobContainer.spritesheet = spritesheet;
            mobContainer.rradius = 30;
            if (spritesheet.animations && spritesheet.animations.idle) {
                body = new PIXI.AnimatedSprite(spritesheet.animations.idle);
            } else if (spritesheet.textures) {
                // If you need to manually create an animation array from the textures
                const idleTextures = Object.keys(spritesheet.textures)
                    .filter(name => name.includes("idle"))
                    .sort()
                    .map(name => spritesheet.textures[name]);
                
                body = new PIXI.AnimatedSprite(idleTextures);
            } else {
                console.error("Could not locate animation frames");
                body = new PIXI.Sprite(PIXI.Texture.WHITE);
            }
            
            body.animationSpeed = 0.3;
            body.play();
       
        // Create an AnimatedSprite
        
        body.anchor.set(0.5);
        body.x = 0;
        body.y = 0;
        body.rotation = 0;
        body.name = "body"
        body.scale.set(1.5);

        }else if(type === "polarbear"){
            const spritesheet = PIXI.Assets.get("whitebear")
            mobContainer.spritesheet = spritesheet;
            mobContainer.rradius = 30;
            if (spritesheet.animations && spritesheet.animations.idle) {
                body = new PIXI.AnimatedSprite(spritesheet.animations.idle);
            } else if (spritesheet.textures) {
                // If you need to manually create an animation array from the textures
                const idleTextures = Object.keys(spritesheet.textures)
                    .filter(name => name.includes("idle"))
                    .sort()
                    .map(name => spritesheet.textures[name]);
                
                body = new PIXI.AnimatedSprite(idleTextures);
            } else {
                console.error("Could not locate animation frames");
                body = new PIXI.Sprite(PIXI.Texture.WHITE);
            }
            
            body.animationSpeed = 0.3;
            body.play();
        body.anchor.set(0.5);
        body.x = 0;
        body.y = 0;
        body.rotation = 0;
        body.name = "body"
        body.scale.set(1.5);

        }
            
        else{
            
        body = new PIXI.Graphics()
        body.circle(0,0,40)
        body.fill({color:0xbcad9f})
        body.name = 'body';
        //body.anchor.set (0.5);
        body.x = 0;
        body.y = 0;
        //body.scale.set(1.5);
        mobContainer.rradius = 5;
        mobContainer.currentAction = -1;
        }
        mobContainer.type = type;


        const hbackground = new PIXI.Graphics();
        hbackground.roundRect(-75, 80 + mobContainer.rradius, 150, 22, 16);  // Draw rounded rectangle
        hbackground.fill({color:0x303843});  // Black background 
        mobContainer.addChild(hbackground)

        margin = 10;
        const hbar = new PIXI.Graphics();
        hbar.roundRect(-75+margin/2, 80+margin/2 + mobContainer.rradius, 150-margin, 22-margin, 8);  // Draw rounded rectangle
        hbar.fill({color:0xb55945});
        hbar.name = "hbar"
        mobContainer.addChild(hbar)

        mobContainer.addChild(body);
        mobContainer.name = id;
        mobContainer.rotation = 0
        if(Number.isNaN(x)){
            mobContainer.x = x
            mobContainer.y = y;
            mobContainer.xsmooth = x;
            mobContainer.ysmooth = y;
        }else{
            mobContainer.x = 1
            mobContainer.y = 1;
            mobContainer.xsmooth = 1;
            mobContainer.ysmooth = 1;
        }
        mobContainer.scale.set(0.5)

        mobLayer.addChild(mobContainer)
    }
    function updateMobSprite(dt, id, x, y, rotation, action,health,max_health){
        const mob = mobLayer.getChildByName(id)
        if(mob){
            if(!isInViewMap(x,y)){
                mob.visible = false;
                return;
            }
            mob.visible = true;
            mappy.circle((x-playa.x)*0.0225+110,(y-playa.y)*0.0225+110,3)
            mappy.fill({color:0x8B4435});
            mob.x = Interpolate(mob.x, x, dt);
            mob.y = Interpolate(mob.y, y, dt);
            const hbar = mob.getChildByName("hbar")
            const margin = 12
            hbar.clear()
            hbar.roundRect(-75+margin/2, 80+margin/2 +mob.rradius  , 138-138*(max_health-health)/max_health, 22-margin, 8);
            hbar.fill({color:0xb55945});
            
            body = mob.getChildByName("body")
            if(body){
            body.rotation = rotation + Math.PI/2
            if(mob.currentAction !== action && mob.spritesheet){
                mob.currentAction = action;
                const spritesheet = mob.spritesheet;
                // Control Animation speed based on mob type and animation @Rembo -P.S. switch statments are significantly faster than if else, and only speed up the more options there are.
                switch(action){
                    case 0:
                        body.textures = spritesheet.animations["walk"];
                        switch(mob.type){
                            case "spider":
                                body.animationSpeed = 0.15
                                break;
                            case "redspider":
                                body.animationSpeed = 0.15
                                break;
                            case "bear":
                                body.animationSpeed = 0.15
                                break;
                            case "polarbear":
                                body.animationSpeed = 0.15
                                break;
                            default:
                                body.animationSpeed = 0.15
                        }
                        break;
                    case 1:
                        body.textures = spritesheet.animations["walk"];
                        switch(mob.type){
                            case "spider":
                                body.animationSpeed = 0.3
                                break;
                            case "redspider":
                                body.animationSpeed = 0.3
                                break;
                            case "bear":
                                body.animationSpeed = 0.3
                                break;
                            case "polarbear":
                                body.animationSpeed = 0.3
                                break;
                            default:
                                body.animationSpeed = 0.3
                        }
                        break;
                    case 2:
                        body.textures = spritesheet.animations["attack"];
                        switch(mob.type){
                            case "spider":
                                body.animationSpeed = 0.15
                                break;
                            case "redspider":
                                body.animationSpeed = 0.35
                                break;
                            case "bear":
                                body.animationSpeed = 0.15
                                break;
                            case "polarbear":
                                body.animationSpeed = 0.15
                                break;
                            default:
                                body.animationSpeed = 0.15
                        }
                        break;
                    default:
                        body.textures = spritesheet.animations["idle"];
                        switch(mob.type){
                            case "spider":
                                body.animationSpeed = 0.3
                                break;
                            case "redspider":
                                body.animationSpeed = 0.3
                                break;
                            case "bear":
                                body.animationSpeed = 0.3
                                break;
                            case "polarbear":
                                body.animationSpeed = 0.3
                                break;
                            default:
                                body.animationSpeed = 0.3
                        }
                           }
                     body.play();
                      }
            
                 }
             }
        }
    


    let playerSprites = {};
    function createPlayerSprite(PlayerId, x, y, me, nickname){
        // container for the player character

        const chatBg = new PIXI.Graphics();
        chatBg.roundRect(-75, -20, 150, 40, 10); // Default size (will be resized)
        chatBg.fill({color:0x303843}); // Black background with transparency
        chatBg.clear();

        const chatBubble = new PIXI.Text({
        text: "",
        style:{    
        fontFamily: "Roboto",
        fontSize: 32,
        fill: 0xf1f6f0,
        fontWeight: 'bolder',
        align: 'center',
        stroke: 0xf1f6f0, // Outline color (black in this case)
        strokeThickness: 1
        }
        })
        chatBubble.anchor.set(0.5);
        chatBubble.x = 0;
        chatBubble.y = -130; // Above the player's head
        chatBubble.visible = false; // Start hidden
        chatBg.x = 0;
        chatBg.y = -130;

        const charachterContainer = new PIXI.Container();
        charachterContainer.xsmooth = x;
        charachterContainer.ysmooth = y;
        charachterContainer.rseed = Math.random()*2
        charachterContainer.atime = 0;
        charachterContainer.interact_tick = false;
        charachterContainer.interact_t = 0;

        const bodyContainer = new PIXI.Container();
        bodyContainer.name = "cbody";
        bodyContainer.rightt = "hand"

        const left_foot = PIXI.Sprite.from(PIXI.Assets.get('leftFoot'));
        const right_foot = PIXI.Sprite.from(PIXI.Assets.get('rightFoot'));
        const body = PIXI.Sprite.from(PIXI.Assets.get('body'));
        const left = PIXI.Sprite.from(PIXI.Assets.get('leftHand'))
        const right = PIXI.Sprite.from(PIXI.Assets.get('rightHand'))
        const left_arm = PIXI.Sprite.from(PIXI.Assets.get('leftArm'));
        const right_arm = PIXI.Sprite.from(PIXI.Assets.get('rightArm'));
        const left_shoulder = PIXI.Sprite.from(PIXI.Assets.get('leftShoulder'));
        const right_shoulder = PIXI.Sprite.from(PIXI.Assets.get('rightShoulder'));
        const cape = PIXI.Sprite.from(PIXI.Assets.get('cape'));
        const head = PIXI.Sprite.from(PIXI.Assets.get('head'));

        left_foot.name = 'left_foot';
        right_foot.name = 'right_foot';
        body.name = 'body';
        left.name = 'left'
        right.name = 'right';
        left_arm.name = 'left_arm';
        right_arm.name = 'right_arm';
        left_shoulder.name = 'left_shoulder';
        right_shoulder.name = 'right_shoulder';
        cape.name = 'cape';
        head.name = 'head';

        left_foot.anchor.set(0.5);
        right_foot.anchor.set(0.5);
        body.anchor.set(0.5);
        left.anchor.set(0.5,0.5);
        right.anchor.set(0.5,0.5);
        left_arm.anchor.set(0.5);
        right_arm.anchor.set(0.5);
        left_shoulder.anchor.set(0.5);
        right_shoulder.anchor.set(0.5);
        cape.anchor.set(0.5);
        head.anchor.set(0.5);

        left_foot.x = 4;
        left_foot.y = 3;
        right_foot.x = -4;
        right_foot.y = 3;
        body.x = 0;
        body.y = 0;
        left.x = -49;
        left.y = -20;
        right.x = 49;
        right.y = -20;
        left_arm.x = 0;
        left_arm.y =-1;
        right_arm.x = 0;
        right_arm.y = -1;
        left_shoulder.x = 0;
        left_shoulder.y = -1;
        right_shoulder.x = 0;
        right_shoulder.y = -1;
        cape.x = 0;
        cape.y = 1;
        head.x = 0;
        head.y = 1;

        //right.anchor.set(0,0)

        bodyContainer.addChild(left_foot);
        bodyContainer.addChild(right_foot);
        bodyContainer.addChild(body);
        bodyContainer.addChild(left);
        bodyContainer.addChild(right);
        bodyContainer.addChild(left_arm);
        bodyContainer.addChild(right_arm);
        bodyContainer.addChild(left_shoulder);
        bodyContainer.addChild(right_shoulder);
        bodyContainer.addChild(cape);
        bodyContainer.addChild(head);

        charachterContainer.addChild(bodyContainer)
        bodyContainer.pivot.set(0,5)
        //Add name
        const nameText = new PIXI.Text({
            text: nickname.toString(),
            style:{
            fontFamily: 'Roboto',
            fontSize: 32,
            fontWeight: 'bold',
            fill: 0xf1f6f0, // White text
            align: 'center',
            stroke: 0x303843, // Outline color (black in this case)
            strokeThickness: 8 // Thickness of the outline
            }
        });
        nameText.anchor.set(0.5);
        nameText.x = charachterContainer.x;
        nameText.y = charachterContainer.y - 85; // Position it above the player
        charachterContainer.addChild(nameText);
        //team text
        const teamText = new PIXI.Text({
            text: "",
            style:{
            fontFamily: 'Roboto',
            fontSize: 32,
            fontWeight: 'bold',
            fill: 0xfee1b8, // White text
            align: 'center',
            stroke: 0x303843, // Outline color (black in this case)
            strokeThickness: 8 // Thickness of the outline
            }
        });
        teamText.anchor.set(0.5);
        teamText.x = charachterContainer.x;
        teamText.y = charachterContainer.y - 125; // Position it above the player
        
        charachterContainer.addChild(teamText);
        charachterContainer.team = "";
        charachterContainer.teamn = teamText;
        
        //health bar implemtation
        const hbackground = new PIXI.Graphics();
        hbackground.roundRect(-75, 90 , 150, 22, 16);  // Draw rounded rectangle
        hbackground.fill({color:0x303843});  // Black background with transparency
        charachterContainer.addChild(hbackground)

        margin = 12;
        const hbar = new PIXI.Graphics();
        hbar.roundRect(-75+margin/2, 90+margin/2 , 150-margin, 22-margin, 8);  // Draw rounded rectangle
        hbar.fill({color:0x6c81a1});
        hbar.name = "hbar"
        charachterContainer.addChild(hbar)

        //healthbar implementation
        if(me){
            const sbackground = new PIXI.Graphics();
            sbackground.roundRect(-65, 112 , 130, 20, 16);  // Draw rounded rectangle
            sbackground.fill({color:0x4D4D4D, alpha:0.5});  // Black background with transparency
            sbackground.name = "sbackground"
            charachterContainer.addChild(sbackground)
            const sbar = new PIXI.Graphics();
            sbar.roundRect(-65+margin/2, 112+margin/2 , 130-margin, 20-margin, 8);  // Draw rounded rectangle
            sbar.fill({color:0x96a9c1});
            sbar.name = "sbar"
            charachterContainer.addChild(sbar)
        }

        charachterContainer.addChild(chatBg);
        charachterContainer.chatBg = chatBg; 
        charachterContainer.addChild(chatBubble);
        charachterContainer.chatBubble = chatBubble; 

        charachterContainer.name = PlayerId;
        charachterContainer.x = x;
        charachterContainer.y = y;
        charachterContainer.rotation = 0;
        charachterContainer.scale.set(0.5);
        playerLayer.addChild(charachterContainer);

        
        
        return charachterContainer;
    }
    function updatePlayerSprite(dt, playerId, x, y, rotation,move,ruse,dtime,ruse_t,health,max_health, me, stamina, max_stamina,team, chat, chatdisplay, righthold, interact_ticker, use_speed = 10, teamName){
        const playerSprite = playerLayer.getChildByName(playerId);
 
        if(playerSprite){
            if(!isInViewMap(x,y)){
                playerSprite.visible = false;
                return;
            }
            if(!team){
            mappy.circle((x-playa.x)*0.0225+110,(y-playa.y)*0.0225+110,3)
            mappy.fill({color:0xB55945});
            }else if(!me){
            mappy.circle((x-playa.x)*0.0225+110,(y-playa.y)*0.0225+110,3)
            mappy.fill({color:0x667A98});
            }

            
            playerSprite.chatBg.clear();
            if(chatdisplay){
                playerSprite.chatBubble.text = chat;
                playerSprite.chatBubble.visible = true;
                const textWidth = playerSprite.chatBubble.width + 24
                const textHeight = 55
                playerSprite.chatBg.clear();
                playerSprite.chatBg.lineStyle(7, 0x303843);
                playerSprite.chatBg.beginFill(0x405273);
                playerSprite.chatBg.roundRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 10);
                playerSprite.chatBg.endFill();
                //playerSprite.chatBg.lineStyle(10, 0x303843)
                //playerSprite.chatBg.fill({color:0xf1f6f0});
                
            }else{
                playerSprite.chatBubble.visible = false;
            }
            if (playerSprite.team != teamName){
                if(teamName !== ""){
                    playerSprite.teamn.text = "["+teamName+"]" 
                }else{
                    playerSprite.teamn.text = ""  
                }
                playerSprite.team = teamName
            }
            
                
            playerSprite.visible = true;

            playerSprite.x = Interpolate(playerSprite.x, x, dt);
            playerSprite.y = Interpolate(playerSprite.y, y, dt);
            const hbar = playerSprite.getChildByName("hbar")
            const margin = 12
            hbar.clear()
            hbar.roundRect(-75+margin/2, 90+margin/2 , 138-138*(max_health-health)/max_health, 22-margin, 8);
            if(team){
            hbar.fill({color:0x6c81a1});
            }else{
            hbar.fill({color:0xb55945});  
            }
            if(me){
                const sbackground = playerSprite.getChildByName("sbackground");
                const sbar = playerSprite.getChildByName("sbar");
                sbackground.clear();
                sbar.clear();
                if(stamina<max_stamina){
                sbackground.roundRect(-65, 112 , 130, 20, 16);  // Draw rounded rectangle
                sbackground.fill({color:0x303843});  // Black background with transparency
                
                sbar.roundRect(-65+margin/2, 112+margin/2 , 130-margin-122*(max_stamina-stamina)/max_stamina, 20-margin, 8);  // Draw rounded rectangle
                sbar.fill({color:0x96a9c1});
               
                }
                updateDirectionalArrows(dt,playerSprite.x,playerSprite.y)
            }

            
            const body = playerSprite.getChildByName("cbody")
            
            
            body.rotation = rotation;
            if(move === -1){
                playeridle(body,playerSprite.rseed,ruse);
            }else{
                playerWalk(body,ruse);
            }
            //itemIcon.texture = PIXI.Texture.from(`/img/items/${item.name}.png`)
            if(body.rightt !== righthold){
                body.getChildByName("right").texture = PIXI.Texture.from(`right${righthold}`)
                body.rightt = righthold;
            }
            if(ruse){
                if(playerSprite.atime<=-6 || ruse_t < 2){
                    playerSprite.atime=30;
                }
            }else if(playerSprite.interact_tick !== interact_ticker){
                playerSprite.interact_tick = interact_ticker
                playerSprite.interact_t = 30;

            }
           
            if(playerSprite.atime>0){
                playerSprite.interact_t = 0;
                switch(body.rightt){
                    case "hand":
                    playerhit(body,playerSprite.atime)
                    break;
                    case "goldensword" || "stonesword":
                    playerSwing(body,playerSprite.atime);
                    break;
                    default:
                    playerhit(body,playerSprite.atime)
                    
                }
            }else if(playerSprite.interact_t>0){
                playerSprite.interact_t -= dtime * 2
                playerpickup(body,playerSprite.interact_t);
            }else if(playerSprite.atime<-0.5){
                if(move === -1){
                    playeridle(body,playerSprite.rseed,false);
                }else{
                    playerWalk(body,false);
                }
            }
            if(playerSprite.atime>-6){
                playerSprite.atime -= dtime*10/use_speed
            }
        
        }
    }
    function createResourceSprite(id, type, x, y){
        const sprite = PIXI.Sprite.from(type.toUpperCase());
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.name = id
        sprite.rotation = Math.random() * Math.PI * 2;
        // @Rembo here you can find the code to change how large resource sprites are
        switch(type){
            case "tree":
                sprite.scale.set(1);
                treeLayer.addChild(sprite);
                break;
            case "tree2":
                sprite.scale.set(1);
                treeLayer2.addChild(sprite);
                break;
            case "tree3":
                sprite.scale.set(1);
                treeLayer3.addChild(sprite);
                break;
            case "rock":
                sprite.scale.set(1);
                rockLayer.addChild(sprite);
                break;
            case "rock2":
                sprite.scale.set(1);
                rockLayer2.addChild(sprite);
                break;
            case "rock3":
                sprite.scale.set(1.5);
                rockLayer3.addChild(sprite);
                break;
            case "gold":
                sprite.scale.set(1);
                goldLayer.addChild(sprite);
                break;
            case "crystal":
                sprite.scale.set(1);
                crystalLayer.addChild(sprite);
                break;
            default:
        }
        return sprite;
        
    }
    function createItemSprite(id, type, x, y){
        const sprite = PIXI.Sprite.from(type)
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.scale.set(0.8);
        sprite.name = id
        itemLayer.addChild(sprite);
        return sprite;
        
    }
    function removeItemSprite(id) {
        const sprite = itemLayer.getChildByName(id);
        if (sprite) {
            itemLayer.removeChild(sprite);
            sprite.destroy(); // Clean up the sprite resources if needed
        }
    }
    function removeMobSprite(id){
        const sprite = mobLayer.getChildByName(id);
        
    if (!sprite) return;
    console.log(sprite.type)
    
    // Check if the mob has a death animation
    if (sprite.type === "spider" || sprite.type === "redspider") {
        const hbar = sprite.getChildByName("hbar");
        if (hbar) hbar.visible = false;
        // Get the body (the animated sprite)
        const body = sprite.getChildByName("body");
        if (body) {
            // Set a flag on the sprite to indicate it's dying
            sprite.isDying = true;
            
            // Switch to death animation
            body.textures = sprite.spritesheet.animations["dead"];
            body.loop = false;
            body.animationSpeed = 0.3; // Adjust as needed
            
            // Set up an event for when the animation completes
            body.onComplete = function() {
                // Remove the sprite after the animation completes
                mobLayer.removeChild(sprite);
                sprite.destroy();
            };
            
            body.play();
            
            // Hide the health bar
            
        } else {
            // No body found, remove immediately
            mobLayer.removeChild(sprite);
            sprite.destroy();
        }
    } else {
        // No death animation, remove immediately
        mobLayer.removeChild(sprite);
        sprite.destroy();
    }
    }
    
    // all of the players own data gets defined here
    const playa = room.state.players.get(id_me);
    



    $(room.state).players.onAdd((player, sessionId) => {
        if(sessionId !== room.sessionId) {
        playerSprites[sessionId] = createPlayerSprite(sessionId, player.x, player.y, false, player.nickname);
        }
    });
        $(room.state).resources.onAdd((resource, id) => {
        createResourceSprite(id,resource.type,resource.x,resource.y)
        
    });
    $(room.state).items.onAdd((resource, id) => {
        createItemSprite(id,resource.name,resource.x,resource.y)
        
    });
    $(room.state).items.onRemove ((resource, id) => {
        removeItemSprite(id);
      });

        $(room.state).mobs.onAdd ((mob, id) => {
            createMobSprite(id,mob.x,mob.y, mob.type)
        });
        $(room.state).mobs.onRemove ((mob, id) => {
            removeMobSprite(id)
        });
        $(room.state).projectiles.onAdd((projectile, id) => {
            createProjectileSprite(id, projectile.type, projectile.x, projectile.y, 
                                projectile.velocityX, projectile.velocityY);
          });
          
          $(room.state).projectiles.onRemove((projectile, id) => {
            removeProjectileSprite(id);
          });
    
        //setup(spritesheet); // Pass the loaded spritesheet to your setup function
        room.onMessage("teamUpdate", (message) => {
            if (message.accepted) {
                // Player joined a team successfully
                currentTeam = message.team;
                switchToTeamDetails();
                showTeamActionFeedback(`You joined ${message.team.name}`);
            } else {
                // Player left a team
                currentTeam = null;
                switchToTeamList();
                clearAllArrows();
                
                // Show kicked message if applicable
                if (message.kicked) {
                    showTeamActionFeedback(`You were kicked from the team by ${message.kickedBy}`);
                } else {
                    showTeamActionFeedback("You left the team");
                }
            }
        });
        room.onMessage("playerDeath", (message) => {
            // Create a death effect at the death position if desired
            createDeathEffect(message.x, message.y);
            
            // Return to landing page
            returnToLandingPage(room);
        });
        // Listen for team errors
        room.onMessage("teamError", (message) => {
            showTeamActionFeedback(message.message);
        });
        room.onMessage("teamChatMessage", (message) => {
            addTeamChatMessage(message.sender, message.message, message.senderId === room.sessionId);
        });
        room.onMessage("itemAdded", (message) => {
            const { itemName, quantity } = message;
            
            // Get the texture for the item
            const itemTexture = PIXI.Assets.get(`/img/items/${itemName}.png`);
            
            // Show notification
            window.addItemNotification(itemName, quantity, itemTexture);
        });
    
    $(room.state).players.onRemove((player, sessionId) => {
        const sprite = playerSprites[sessionId];
        if(sprite){
            playerLayer.removeChild(sprite);
            delete playerSprites[sessionId];
        }
    });

    $(room.state).teams.onAdd((team, teamId) => {
        // If this is the player's current team, update the details view
        $(team).onChange(() =>{
            //const player = room.state.players.get(id_me);
        if (playa && playa.team === teamId && 
            document.getElementById('team-details-state').style.display === 'block') {
            refreshTeamDetails();
        }

        })
        
        // Also update the teams list if it's showing
        if (document.getElementById('team-list-state').style.display === 'block') {
            refreshTeamsList();
        }
    });
    $(room.state).teams.onRemove((team, teamId) => {
        if (document.getElementById('team-list-state').style.display === 'block') {
            refreshTeamsList();
        }
    });
    const buildingVisuals = new Map();
    $(room.state).buildings.onAdd((building, id) => {
        console.log(`Building added: ${id}, type: ${building.type}`);
        
        // Create building in scene and store in our map
        const clientBuilding = createPlacedBuilding(
            building.type, 
            building.x, 
            building.y, 
            building.rotation, 
            id, 
            building.isBuilding ? BUILDING_STATES.BUILDING : BUILDING_STATES.COMPLETE
        );
        
        // Store in our lookup map
        buildingVisuals.set(id, clientBuilding);
        
        // Set up onChange for this specific building
        $(building).onChange(() => {
            // Retrieve the building visual from our map
            const Building = buildingVisuals.get(id);
            if (!Building) return;
            
            // Update position
            if (Building.x !== building.x || Building.y !== building.y) {
                Building.position.set(building.x, building.y);
            }
            
            // Update rotation
            if (Building.rotation !== building.rotation) {
                Building.rotation = building.rotation;
            }
            
            // Update health
            if (Building.buildingData.health !== building.health) {
                // Update stored health value
                Building.buildingData.health = building.health;
                Building.buildingData.maxHealth = building.maxHealth || Building.buildingData.maxHealth;
                
                // Update health bar
                const healthBar = Building.getChildByName("healthBar");
                if (healthBar) {
                    const healthPercent = building.health / Building.buildingData.maxHealth;
                    
                    // Only show health bar if damaged
                    healthBar.visible = healthPercent < 1;
                    
                    // Update health bar appearance - adjust for shape and size
                    healthBar.clear();
                    healthBar.beginFill(healthPercent > 0.5 ? 0x00FF00 : healthPercent > 0.25 ? 0xFFFF00 : 0xFF0000);
                    
                    if (building.collisionShape === "circle") {
                        const radius = building.radius || GRID_SIZE/2;
                        healthBar.drawRect(-radius, -radius - 10, radius * 2 * healthPercent, 5);
                    } else {
                        const width = building.width || GRID_SIZE;
                        healthBar.drawRect(-width/2, -building.height/2 - 10, width * healthPercent, 5);
                    }
                    
                    healthBar.endFill();
                }
                
                // Visual feedback for damage
                if (Building.lastHealth && Building.lastHealth > building.health) {
                    // Create damage effect
                    createDamageEffect(Building);
                }
                
                // Store last health for comparison
                Building.lastHealth = building.health;
            }
            
            // Update building state
            const isCurrentlyBuilding = Building.buildingData.state === BUILDING_STATES.BUILDING;
            if (building.isBuilding !== isCurrentlyBuilding) {
                if (building.isBuilding) {
                    // Building was reverted to construction state
                    if (!isCurrentlyBuilding) {
                        // Add construction overlay
                        const constructionOverlay = new PIXI.Graphics();
                        constructionOverlay.beginFill(0xFFFFFF, 0.3);
                        
                        if (building.collisionShape === "circle") {
                            const radius = building.radius || GRID_SIZE/2;
                            constructionOverlay.drawCircle(0, 0, radius);
                        } else {
                            const width = building.width || GRID_SIZE;
                            const height = building.height || GRID_SIZE;
                            constructionOverlay.drawRect(-width/2, -height/2, width, height);
                        }
                        
                        constructionOverlay.endFill();
                        constructionOverlay.name = "constructionOverlay";
                        Building.addChild(constructionOverlay);
                        
                        // Add progress bar - position based on shape and size
                        const progressBar = new PIXI.Graphics();
                        progressBar.beginFill(0x00FF00);
                        
                        if (building.collisionShape === "circle") {
                            const radius = building.radius || GRID_SIZE/2;
                            progressBar.drawRect(-radius, radius + 5, 0, 5);
                        } else {
                            const width = building.width || GRID_SIZE;
                            const height = building.height || GRID_SIZE;
                            progressBar.drawRect(-width/2, height/2 + 5, 0, 5);
                        }
                        
                        progressBar.endFill();
                        progressBar.name = "progressBar";
                        Building.addChild(progressBar);
                        
                        // Start construction animation
                        animateBuildingConstruction(Building);
                        
                        // Update state
                        Building.buildingData.state = BUILDING_STATES.BUILDING;
                    }
                } else {
                    // Building was completed
                    if (isCurrentlyBuilding) {
                        // Update building state
                        Building.buildingData.state = BUILDING_STATES.COMPLETE;
                        
                        // Remove construction visuals
                        const overlay = Building.getChildByName("constructionOverlay");
                        const progressBar = Building.getChildByName("progressBar");
                        const particles = Building.getChildByName("constructionParticles");
                        
                        if (overlay) Building.removeChild(overlay);
                        if (progressBar) Building.removeChild(progressBar);
                        if (particles) Building.removeChild(particles);
                        
                        // Update appearance for completed building
                        const base = Building.getChildAt(0);
                        if (base instanceof PIXI.Graphics) {
                            base.clear();
                            base.beginFill(0x6c81a1);
                            base.lineStyle(3, 0xFFFFFF, 1);
                            
                            // Draw appropriate shape for completed building
                            if (building.collisionShape === "circle") {
                                const radius = building.radius || GRID_SIZE/2;
                                base.drawCircle(0, 0, radius);
                            } else {
                                const width = building.width || GRID_SIZE;
                                const height = building.height || GRID_SIZE;
                                base.drawRect(-width/2, -height/2, width, height);
                            }
                            
                            base.endFill();
                        }
                        
                        // Add completion effect
                        createCompletionEffect(Building);
                    }
                }
            }
            
            // Update construction progress if building
            if (building.isBuilding) {
                const progressBar = Building.getChildByName("progressBar");
                if (progressBar) {
                    // Update progress bar width
                    progressBar.clear();
                    progressBar.beginFill(0x00FF00);
                    
                    // Adjust progress bar based on shape and size
                    if (building.collisionShape === "circle") {
                        const radius = building.radius || GRID_SIZE/2;
                        progressBar.drawRect(-radius, radius + 5, radius * 2 * building.buildProgress, 5);
                    } else {
                        const width = building.width || GRID_SIZE;
                        const height = building.height || GRID_SIZE;
                        progressBar.drawRect(-width/2, height/2 + 5, width * building.buildProgress, 5);
                    }
                    
                    progressBar.endFill();
                }
            }
        });
    });
    $(room.state).buildings.onRemove((building, id) => {
        const Building = buildingVisuals.get(id);
        if (Building) {
            createDestructionEffect(Building.x, Building.y);
            buildingLayer.removeChild(Building);
            Building.destroy(); 
            buildingVisuals.delete(id);
        }
    });

    // Update loop

    
    let MouseItem = "none";
    let MouseItemName = "none";

    //make you
    let camcamx = 0;
    let camcamy = 0;
    const smoothSpeed = 0.1; // Control the speed of the camera movement
    let x = 0;
    let y = 0;
    let rotation = 0;
    createPlayerSprite("you", 0, 0,true, nickname_me);


    let lastMoveTime = 0;
    const MOVE_COOLDOWN = 150; // 150ms cooldown between moves

    function makehotbar(){
    const hotbar = new PIXI.Container();
    hotbar.name = "hotbar"

    const hat = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox-hat.png'));
    const sheild = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox-shield.png'));
    const zero = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox-select.png'));
    const one = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    const two = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    const three = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    const four = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    const five = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    const six = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    const seven = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    const eight = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/Hotbarbox.png'));
    

    hat.name = "hat";
    sheild.name = "shield";
    zero.name = "0";
    one.name = "1";
    two.name = "2";
    three.name = "3";
    four.name = "4";
    five.name = "5";
    six.name = "6";
    seven.name = "7";
    eight.name = "8";
    

    hat.x = -640
    sheild.x = -550
    zero.x = -440
    one.x = -360
    two.x = -280
    three.x = -200
    four.x = -120
    five.x = -40
    six.x = 40
    seven.x = 120
    eight.x = 200
    

    const slots = [hat, sheild, zero, one, two, three, four, five, six, seven, eight];

    // Loop through each slot, enable interactivity, and add event listeners.
    slots.forEach(slot => {
        slot.eventMode = 'static';
    slot.buttonMode = true;
    
    eventHandlerTracker.add(slot,'pointerdown', (event) => {
        event.stopPropagation();
    
        const currentTime = Date.now();
        if(currentTime - lastMoveTime < MOVE_COOLDOWN) {
            return;
        }
        lastMoveTime = currentTime;
        
        // Determine slot type and value
        const slotName = slot.name;
        const slotNumber = parseInt(slotName);
        const isEquipment = slotName === "hat" || slotName === "shield";
        
        // Convert slot number to equipment type if needed
        const slotType = isEquipment ? "equip" : "inv";
        const slotValue = isEquipment ? slotName : parseInt(slotName);
        
        // Case 1: No item in hand, clicking on a slot with an item
        if(MouseItem === "none") {
            const itemIcon = slot.getChildByName("itemIcon");
            if(itemIcon) {
                // Handle shift-clicking for splitting stacks (only for inventory)
                if(keyStates["Shift"] && !isEquipment) {
                    const item = playa.inventory.slots.get(slotName);
                    const halfQuantity = Math.ceil(item.quantity / 2);
                    const remainingQuantity = item.quantity - halfQuantity;
                    
                    MouseItem = itemIcon.texture;
                    MouseItemName = "split_" + slotName;
                    
                    updateMouseItem();
                    
                    room.send("splitStack", {
                        fromSlot: slotNumber,
                        quantity: halfQuantity
                    });
                    
                    if(slot.getChildByName("stack")) {
                        slot.getChildByName("stack").text = remainingQuantity.toString();
                    }
                } else {
                    // Pick up the item
                    MouseItem = itemIcon.texture;
                    
                    // Store where we picked it from and what type it is
                    if(isEquipment) {
                        MouseItemName = `equip_${slotName}`;
                    } else {
                        MouseItemName = slotName;
                    }
                    
                    updateMouseItem();
                    clearSlotContents(slot);
                    
                    // Inform the server - picking up only, actual move happens on drop
                    room.send("moveItem", {
                        from: slotType,
                        to: slotType,
                        fromslot: slotValue,
                        toslot: -1 // "picked up"
                    });
                }
            }
        } 
        // Case 2: Item in hand, dropping on a slot
        else {
            const targetItemIcon = slot.getChildByName("itemIcon");
            
            // Parse what type of item we're holding
            let fromType = "inv";
            let fromSlot = parseInt(MouseItemName);
            
            if(MouseItemName.startsWith("equip_")) {
                fromType = "equip";
                fromSlot = MouseItemName.substring(6); // Remove "equip_" prefix
            } else if(MouseItemName.startsWith("split_")) {
                fromType = "inv"; // Split items are still inventory items
                fromSlot = parseInt(MouseItemName.substring(6)); // Remove "split_" prefix
            }
            
            // Case 2a: Dropping on an empty slot
            if(!targetItemIcon) {
                // Send move message to server
                room.send("moveItem", {
                    from: fromType,
                    to: slotType,
                    fromslot: fromSlot,
                    toslot: slotValue
                });
                
                // Clear the mouse item
                MouseItem = "none";
                MouseItemName = "none";
                updateMouseItem();
            } 
            // Case 2b: Dropping on a slot with an item (swap)
            else {
                // Save the texture of the item being replaced
                const replacedTexture = targetItemIcon.texture;
                // Send swap message to server
                room.send("moveItem", {
                    from: fromType,
                    to: slotType,
                    fromslot: fromSlot,
                    toslot: slotValue
                });
                
                // Clear the slot visually
                clearSlotContents(slot);
                
                // Force update
                pinventory = -1;
                
                // Update the mouse to hold the replaced item
                if(false) {
                MouseItem = replacedTexture; //I'm trying to fix right here and right here only
                }
                
                // Update MouseItemName based on slot type
                if (isEquipment) {
                    MouseItemName = `equip_${slotValue}`;
                } else {
                    MouseItemName = slotName;
                }
                
                //updateMouseItem();
            }
        }
    });
    
    eventHandlerTracker.add(slot,'pointerup', (event) => {
        event.stopPropagation();
    });

    });
    

    hotbar.addChild(hat)
    hotbar.addChild(sheild)
    hotbar.addChild(zero)
    hotbar.addChild(one)
    hotbar.addChild(two)
    hotbar.addChild(three)
    hotbar.addChild(four)
    hotbar.addChild(five)
    hotbar.addChild(six)
    hotbar.addChild(seven)
    hotbar.addChild(eight)
    


    hotbar.x = winx/2+130;
    hotbar.y = winy-75;
    app.stage.addChild(hotbar)
    }
    let pinventory = 0
    let pgear = []

    function lerpColor(color1, color2, t) {
        // Extract RGB components from the hex colors.
        let r1 = (color1 >> 16) & 0xFF;
        let g1 = (color1 >> 8) & 0xFF;
        let b1 = color1 & 0xFF;
        let r2 = (color2 >> 16) & 0xFF;
        let g2 = (color2 >> 8) & 0xFF;
        let b2 = color2 & 0xFF;
        
        // Interpolate each channel.
        let r = Math.round(r1 + (r2 - r1) * t);
        let g = Math.round(g1 + (g2 - g1) * t);
        let b = Math.round(b1 + (b2 - b1) * t);
        
        // Reassemble into a single hex color.
        return (r << 16) | (g << 8) | b;
      }

      function getDurabilityColor(percentage) {
        // Clamp the percentage to ensure it's between 0 and 1.
        
        if (percentage >= 0.5) {
          // For durability 50% to 100%, interpolate from yellow to green.
          let t = (percentage - 0.5) / 0.5; // t=0 at 50%, t=1 at 100%
          return lerpColor(0xfdd179, 0xa4c5af, t);
        } else {
          // For durability 0% to 50%, interpolate from red to yellow.
          let t = percentage / 0.5; // t=0 at 0%, t=1 at 50%
          return lerpColor(0xb55945, 0xfdd179, t);
        }
      }
      function makeInventory(){
        const inventory = new PIXI.Container()
        inventory.name = "inventory"
        inventory.visible = false
        const inventorybackground = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/inventory.png'));
        inventorybackground.y = 215
        inventorybackground.x =  10
        inventory.addChild(inventorybackground)
        app.stage.addChild(inventory)
        
        
      }
      function makeMinimap(){
        const miniMap = new PIXI.Container();
        miniMap.name = "miniMap"
        const miniMapBackground = new PIXI.Graphics();
        const mappy = new PIXI.Graphics();
        mappy.name = "mappy"
        miniMapBackground.name = "miniMapBackground";
        //miniMapBackground.fill({color: 0x1e242b, alpha:0.95});
        miniMapBackground.roundRect(10, 10, 200, 200, 25);
        miniMapBackground.fill({color: 0x1e242b, alpha:0.95});
        miniMapBackground.circle(110,110,3)
        miniMapBackground.fill({color:0x6c81a1});
        miniMap.addChild(miniMapBackground)
        miniMap.addChild(mappy);
        app.stage.addChild(miniMap)
      }
      function clearSlotContents(slot) {
        // Find and remove all relevant child elements
        ['itemIcon', 'durabilityBar', 'stack'].forEach(childName => {
            const child = slot.getChildByName(childName);
            if (child) {
                slot.removeChild(child);
                child.destroy({ children: true }); // Make sure to destroy children too
            }
        });
    }

      function updatehotbar(inventory, gear) {
        if(select != oldselect || pinventory !== inventory.version || pinventory === -1){
            //check and update anything related to the inventory if it's open

            const craftingContainer = document.getElementById('crafting-container')
            if(craftingContainer && craftingContainer.style.display === 'block'){
                const selectedRecipe = document.querySelector('.recipes-list li.active');
            if (selectedRecipe) {
                const recipeId = selectedRecipe.getAttribute('data-recipe-id');
                showRecipeDetails(recipeId)
            }
            }

            oldselect = select;
            pinventory = inventory.version;
            
            const hotbar = app.stage.getChildByName("hotbar");

            updateEquipmentSlot(hotbar, gear, "hat", "hat");
            updateEquipmentSlot(hotbar, gear, "shield", "shield");
            
            const slotNames = ["0", "1", "2", "3", "4", "5", "6", "7", "8"];
            const hotbar_texture = PIXI.Texture.from('hotbarBox');
            
            slotNames.forEach(slotName => { 
                const slot = hotbar.getChildByName(slotName);
                if (!slot) {
                    console.error(`Slot ${slotName} not found in hotbar!`);
                    return; // Skip this iteration
                }
                
                // Update slot background based on selection
                if(Number(slotName) === select){
                    slot.texture = PIXI.Texture.from('hotbarBoxSelect'); 
                } else if(slot.texture !== hotbar_texture){
                    slot.texture = hotbar_texture;
                }
                
                // Skip updating slots that have an item being dragged
                if (MouseItemName !== slotName) {
                    const item = inventory.slots.get(slotName);
                    
                    // ALWAYS clean up existing UI elements first
                    clearSlotContents(slot);
                    
                    // If there's an item in this slot, create its UI elements
                    if(item && item.name){
                        try {
                            // Create item icon
                            const itemIcon = new PIXI.Sprite(PIXI.Assets.get(`/img/items/${item.name}.png`));
                            itemIcon.name = "itemIcon";
                            itemIcon.scale.set(1);
                            itemIcon.anchor.set(0.5);
                            itemIcon.x = 33;
                            itemIcon.y = 37;
                            slot.addChild(itemIcon);
                            
                            // Add durability bar if needed
                            if(item.maxDurability > 0){
                                const percentage = Math.max(0, Math.min(1, item.durability / item.maxDurability));
                                const barColor = getDurabilityColor(percentage);
                                
                                const durabilityBar = new PIXI.Container();
                                durabilityBar.name = "durabilityBar";
                                durabilityBar.x = 50;
                                slot.addChild(durabilityBar);
                                
                                const durabilityBackground = new PIXI.Graphics();
                                durabilityBackground.name = "durabilityBackground";
                                durabilityBackground.roundRect(-42, 56, 54, 10, 5);
                                durabilityBackground.fill({color: 0x3d3333});
                                durabilityBar.addChild(durabilityBackground);
                                
                                const durability = new PIXI.Graphics();
                                durability.name = "durability";
                                durability.roundRect(-40, 58, 50*percentage, 6, 4);
                                durability.fill({color:barColor});
                                durabilityBar.addChild(durability);
                            }
                            
                            // Add stack count if needed
                            if(item.quantity > 1){
                                const stack = new PIXI.Text({
                                    text: item.quantity.toString(),
                                    style:{
                                    fontFamily: 'Roboto',
                                    fontSize: 16,
                                    fontWeight: 'bold',
                                    fill: 0xf1f6f0,
                                    align: 'center',
                                    stroke: 0x1e242b,
                                    strokeThickness: 6
                                    }
                                });
                                stack.anchor.set(0.5);
                                stack.x = 47;
                                stack.y = 17;
                                stack.name = "stack";
                                slot.addChild(stack);
                            }
                        } catch (e) {
                            console.error(`Error creating item icon for ${item.name}:`, e);
                        }
                    }
                }
            });
            // update inventory
            const inventoryContainer = app.stage.getChildByName("inventory");
            if (inventoryContainer && inventoryContainer.visible) {
            updateInventory(inventory);
                }


        }
    }
    function updateEquipmentSlot(hotbar, gear, equipType, slotName) {
        const slot = hotbar.getChildByName(slotName);
        if (!slot) return;
        
        // Skip if this slot is being held by mouse
        if (MouseItemName === `equip_${equipType}`) return;
        // Clear existing contents
        
        // Get the equipped item
        console.log(slotName)
        const item = gear.slots.get(slotName.toString());
        console.log(gear.slots)
        console.log(item)
        //console.log("Equipment items:");
gear.slots.forEach((item, key) => {
   console.log(`Slot ${key}:`, item);
});
        //console.log(item)
        if (item && item.name) {
            console.log("named")
            console.log(item.name)
            try {
                // Create item icon
                console.log("item made")
                const itemIcon = new PIXI.Sprite(PIXI.Assets.get(`/img/items/woodenshield.png`));  //${item.name}
                itemIcon.name = "itemIcon";
                itemIcon.scale.set(1);
                itemIcon.anchor.set(0.5);
                itemIcon.x = 33;
                itemIcon.y = 37;
                slot.addChild(itemIcon);
                console.log("made it")
                // Add durability bar if needed
                if(item.maxDurability > 0){
                    const percentage = Math.max(0, Math.min(1, item.durability / item.maxDurability));
                    const barColor = getDurabilityColor(percentage);
                    
                    const durabilityBar = new PIXI.Container();
                    durabilityBar.name = "durabilityBar";
                    durabilityBar.x = 50;
                    slot.addChild(durabilityBar);
                    
                    const durabilityBackground = new PIXI.Graphics();
                    durabilityBackground.name = "durabilityBackground";
                    durabilityBackground.roundRect(-42, 56, 54, 10, 5);
                    durabilityBackground.fill({color: 0x3d3333});
                    durabilityBar.addChild(durabilityBackground);
                    
                    const durability = new PIXI.Graphics();
                    durability.name = "durability";
                    durability.roundRect(-40, 58, 50*percentage, 6, 4);
                    durability.fill({color:barColor});
                    durabilityBar.addChild(durability);
                }
            } catch (e) {
                console.error(`Error creating item icon for ${item.name} in equipment slot:`, e);
            }
        }
    }


    let last_MouseItem = "none";
    function makeMouseItem(){
        const mouseItem = new PIXI.Container();
        const itemIcon = new PIXI.Sprite();
        itemIcon.name = "item";
        itemIcon.anchor.set(0.5);
        itemIcon.scale.set(1);
        itemIcon.x = 0;
        itemIcon.y = 0;
        mouseItem.addChild(itemIcon);
        app.stage.addChild(mouseItem);
        return mouseItem;
    }
    function updateMouseItem() {
        // Make sure the mouseObject exists
    if (!mouseObject || !mouseObject.getChildByName("item")) {
        console.error("Mouse object or its item child not found!");
        return;
    }
    
    const itemSprite = mouseObject.getChildByName("item");
    
    // Always update the position
    mouseObject.x = mouseX || 0;
    mouseObject.y = mouseY || 0;
    
    if (MouseItem === "none") {
        // No item - clear the texture
        itemSprite.texture = PIXI.Texture.EMPTY;
        last_MouseItem = "none";
    } else {
        // We have an item - set the texture
        try {
            itemSprite.texture = MouseItem;
            itemSprite.visible = true;
            last_MouseItem = MouseItem;
        } catch (e) {
            console.error("Failed to set mouse item texture:", e);
        }
    }
    }
    // IMPLEMENT GUI STUFF
    initCraftingSystem();
    initBuildingSystem();
    initBuildingPlacementSystem();
    initTeamSystem();
    setupChatToggle();
    const notificationSystem = createInventoryNotificationSystem();

    /*
    const menu = PIXI.Sprite.from(PIXI.Assets.get("/img/GUI/ingamemenu.png"))
    menu.scale.set(0.9)
    menu.y = -100;
    app.stage.addChild(menu)
    */
    makehotbar();
    makeInventory();
    setupItemTooltips();

    mouseObject = makeMouseItem();
    makeMinimap();
    const mappy = app.stage.getChildByName("miniMap").getChildByName("mappy")
    function waitForPlayerPosition() {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                let player = room.state.players.get(room.sessionId);
                if (player && player.x !== undefined && player.y !== undefined) {
                    clearInterval(interval);  // Stop checking
                    resolve(player);  // Resolve the promise with the player
                }
            }, 100);  // Check every 100ms until the player's position is available
        });
    }

    
    async function renderloop(){
        try{
        const player = await Promise.race([
            waitForPlayerPosition(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for player")), 10000))
        ]);

        // Initialize the map
        let tiledMap = await initializeMap(mapLayer);
        
        if (!tiledMap) {
            console.error("Map initialization failed");
        }else {
            console.log("Map initialized successfully");
            window.dispatchEvent(new Event('resize'))
        }
       mouseX = 150
       mouseY = 150

    app.ticker.add((ticker) => {
        x = player.x;
        y = player.y;
        camcamx += (x - winx / 2 - camcamx) * smoothSpeed;
        camcamy += (y - winy / 2 - camcamy) * smoothSpeed;        
        camera.x = -camcamx - (mouseX-winx/2)/10;
        camera.y = -camcamy - (mouseY-winy/2)/10;
        const t0 = Math.min(Math.max(ticker.deltaTime *0.3, 0), 1) || 0.1;
        //updateMouseItem();

        if (tiledMap) {
            try {
            tiledMap.updateVisibleChunks(camera.x, camera.y, winx, winy);
            } catch(e){
                console.error("Error updating tiledMap chunks: ",e)
            }
        }
        
        updateCullAreas(camera.x,camera.y)

        mappy.clear();

        
        const playa = room.state.players.get(id_me);
        updatehotbar(playa.inventory, playa.equipment);
        
        room.state.players.forEach((player, sessionId) => {
            if(!isInViewMap(player.x,player.y)){
                const sprite = playerLayer.getChildByName(sessionId);
                if (sprite) sprite.visible = false;
                return;
            }
            let dteam =  room.state.teams.get(player.team)
            if(dteam){
                dteam = dteam.name
            }else{
                dteam = ""
            }
            if(player.team !== "" && playa.team === player.team){
                updatePlayerSprite(t0, sessionId, player.x, player.y, player.direction, player.move, player.ruse,ticker.deltaTime,player.ruse_t,player.health,player.max_health, false, 0, 0, true, player.chat, player.chatdisplay, player.right, player.interact_ticker, player.use_speed, dteam);
            }else{
                updatePlayerSprite(t0, sessionId, player.x, player.y, player.direction, player.move, player.ruse,ticker.deltaTime,player.ruse_t,player.health,player.max_health, false, 0, 0, false, player.chat, player.chatdisplay, player.right, player.interact_ticker, player.use_speed, dteam);
            }
        });

        //update team arrows

        //update mobs
        //const visibleMobs = mobgrid.query(viewport.x, viewport.y, viewport.width, viewport.width, viewport.height)
        room.state.mobs.forEach((mob, id) => {
            if(!isInViewMap(x,y)){
                const sprite = mobLayer.getChildByName(id);
                if (sprite) sprite.visible = false;
                return;
            }
            updateMobSprite(t0, id, mob.x, mob.y, mob.direction, mob.action, mob.health, mob.max_health);
         });
        
         //update projectiles
         room.state.projectiles.forEach((projectile, id) => {
            updateProjectileSprite(t0, id, projectile.x, projectile.y, 
                                 projectile.velocityX, projectile.velocityY);
          });
       
        //Clent loop stuff goes here
        if(playa.team !== ""){
        updatePlayerSprite(t0,"you", camcamx + winx/2, camcamy + winy/2, rotation, direction, ruse,ticker.deltaTime, 4,playa.health,playa.max_health, true, playa.stamina, playa.max_stamina, true, playa.chat, playa.chatdisplay, playa.right, playa.interact_ticker, playa.use_speed, room.state.teams.get(playa.team).name);
        }else{
            updatePlayerSprite(t0,"you", camcamx + winx/2, camcamy + winy/2, rotation, direction, ruse,ticker.deltaTime, 4,playa.health,playa.max_health, true, playa.stamina, playa.max_stamina, true, playa.chat, playa.chatdisplay, playa.right, playa.interact_ticker, playa.use_speed, "");  
        }
    });
    }
    catch(e){
        console.error("Critical error in render loop:", e);
        // Show a visible error message to the user
        const errorText = new PIXI.Text({
            text: "Error: " + e.message,
            style: {
                fill: 0xFF0000,
                fontSize: 24,
                fontWeight: 'bold'
            }
        });
        errorText.position.set(100, 100);
        app.stage.addChild(errorText);
    }
    }

    //intialize the promise wait for server response then begin the render loop
    renderloop();
    //critical render functions
    // Crafting UI
    function initCraftingUI() {
        // Check if the crafting UI already exists
        let craftingContainer = document.getElementById('crafting-container');
        
        // If it doesn't exist, create it
        if (!craftingContainer) {
            // Create a new container
            
            // HTML structure
            craftingContainer.innerHTML = `
                <!-- Close button in top-right corner -->
                
            `;
            
            // Append the crafting UI to the body
            document.body.appendChild(craftingContainer);
        }
        
        // Add a style element for tab hover effects
        //addTabHoverStyles();
        
        // Set up event listeners
        //setupCraftingEventListeners();
        
        // Populate the recipes list
        populateRecipesList();
    }
    function setupCraftingEventListeners() {
        // Close button
        const closeButton = document.getElementById('close-crafting');
        if (closeButton) {
            eventHandlerTracker.add(closeButton,'click', () => {
                toggleCraftingUI(false);
            });
        }
        
        // Tab selection
        const tabs = document.querySelectorAll('.tabs .tab');
        tabs.forEach(tab => {
            eventHandlerTracker.add(tab,'click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.borderBottom = 'none';
                    t.style.color = '#f1f6f0';
                });
                
                // Add active class to clicked tab
                tab.classList.add('active');
                tab.style.borderBottom = '2px solid #6c81a1';
                tab.style.color = '#6c81a1';
                
                // Filter recipes by category
                filterRecipesByCategory(tab.getAttribute('data-category'));
            });
        });
        
        // Craft button
        const craftButton = document.getElementById('craft-button');
        if (craftButton) {
            eventHandlerTracker.add(craftButton,'pointerdown', () => {
                if(!craftButton.disabled){
                const selectedRecipe = document.querySelector('.recipes-list li.active');
                if (selectedRecipe) {
                    const recipeId = selectedRecipe.getAttribute('data-recipe-id');
                    craftItem(recipeId);
                }
            }
            });
        }
        
        // Escape key to close crafting UI
    }
    // Populate the recipes list
    function populateRecipesList() {
        const recipesList = document.getElementById('recipes-list-container');
        recipesList.innerHTML = ''; // Clear existing recipes
        
        RECIPES.forEach(recipe => {
            const li = document.createElement('li');
            li.setAttribute('data-recipe-id', recipe.id);
            li.setAttribute('data-category', recipe.category);
            
            // Create recipe item HTML
            li.innerHTML = `
                <img src="img/items/${recipe.image}.png" alt="${recipe.name}">
                <span class="item-name">${recipe.name}</span>
            `;
            
            // Add click event to show recipe details
            eventHandlerTracker.add(li,'click', () => {
                // Remove active class from all recipes
                document.querySelectorAll('.recipes-list li').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Add active class to clicked recipe
                li.classList.add('active');
                
                // Show recipe details
                showRecipeDetails(recipe.id);
            });
            
            recipesList.appendChild(li);
        });
    }
    // Filter recipes by category
    function filterRecipesByCategory(category) {
        const recipeItems = document.querySelectorAll('.recipes-list li');
        
        recipeItems.forEach(item => {
            if (category === 'all' || item.getAttribute('data-category') === category) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    // Show details for a selected recipe
    function showRecipeDetails(recipeId) {
        const recipe = RECIPES.find(r => r.id === recipeId);
        if (!recipe) return;
        
        // Update recipe details
        document.getElementById('selected-item-image').src = `img/items/${recipe.image}.png`;
        document.getElementById('selected-item-name').textContent = recipe.name;
        document.getElementById('selected-item-description').textContent = recipe.description;
        
        // Update requirements
        const requirementsContainer = document.getElementById('crafting-requirements');
        requirementsContainer.innerHTML = '';
        
        let canCraft = true;
        const playerInventory = getPlayerInventory();
        
        recipe.requirements.forEach(req => {
            const playerHas = getInventoryItemCount(playerInventory, req.material);
            const hasEnough = playerHas >= req.amount;
            if (!hasEnough) canCraft = false;
            
            const reqElement = document.createElement('div');
            reqElement.className = `requirement ${hasEnough ? 'sufficient' : 'insufficient'}`;
            
            // Set the data-count attribute for the CSS :after pseudo-element to use
            reqElement.setAttribute('data-count', `${playerHas}/${req.amount}`);
            
            // Create only the image element (no spans)
            reqElement.innerHTML = `<img src="img/items/${req.material}.png" alt="${req.material}">`;
            
            requirementsContainer.appendChild(reqElement);
        });
        
        // Enable/disable craft button
        const craftButton = document.getElementById('craft-button');
        if (craftButton) {
            craftButton.disabled = !canCraft;
            
            // Update button styling based on craftability
        }
    }
    // Helper function to get player inventory from the game state
    function getPlayerInventory() {
        // In a real implementation, this would get the current player's inventory from your game state
        if (room && room.state && room.state.players) {
            const player = room.state.players.get(room.sessionId);
            if (player && player.inventory) {
                return player.inventory;
            }
        }
        return { slots: new Map() }; // Return empty inventory if not found
    }
    // Helper function to count specific item in inventory
    function getInventoryItemCount(inventory, itemName) {
        if (!inventory || !inventory.slots) return 0;
        
        let count = 0;
        inventory.slots.forEach((item) => {
            if (item && item.name === itemName) {
                count += item.quantity;
            }
        });
        
        return count;
    }
    // Craft an item
    function craftItem(recipeId) {
        const recipe = RECIPES.find(r => r.id === recipeId);
        if (!recipe) return;
        
        // sendcraft
        room.send("craft",{recipie:recipeId.toString(), quantity: 1});
        
        
        // Simulate crafting success for now
        onItemCrafted("goldensword",true)
        
        // Refresh the recipe details to update material counts
        showRecipeDetails(recipeId);
    }
    // Show crafting result message
    
    // Toggle crafting UI visibility
    function toggleCraftingUI(show) {
        const craftingContainer = document.getElementById('crafting-container');
        if (!craftingContainer) {
            if (show) //initCraftingUI();
            return;
        }
        
        craftingContainer.style.display = show ? 'block' : 'none';
        
        // Refresh recipe details when showing UI
        if (show) {
            const selectedRecipe = document.querySelector('.recipes-list li.active');
            if (selectedRecipe) {
                const recipeId = selectedRecipe.getAttribute('data-recipe-id');
                showRecipeDetails(recipeId);
            }
        }
    }
    
    // Initialize crafting system
    function initCraftingSystem() {
        initCraftingUI();
        setupCraftingEventListeners();
        filterRecipesByCategory("weapons")
        // Hide the UI initially
        toggleCraftingUI(false);
    }
    
    function createCraftParticles(x, y) {
        const particles = new PIXI.Container();
        particles.x = x;
        particles.y = y;
        
        for (let i = 0; i < 20; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 3 + Math.random() * 3);
            particle.fill({color:0xfdd179});
            // Random position and velocity
            particle.x = (Math.random() * 40) - 20;
            particle.y = (Math.random() * 40) - 20;
            particle.vx = (Math.random() * 4) - 2;
            particle.vy = -2 - Math.random() * 3;
            particle.alpha = 0.8;
            
            particles.addChild(particle);
        }
        
        playerLayer.addChild(particles);
        
        // Animate particles
        let elapsed = 0;
        // Store a proper reference to the ticker callback
        const tickerCallback = (delta) => {
            elapsed += delta;
            
            // Use a reverse loop for safe removal
            for (let i = particles.children.length - 1; i >= 0; i--) {
                const p = particles.children[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.01;
                p.vy += 0.1; // Gravity
                
                if (p.alpha <= 0) {
                    particles.removeChild(p);
                    // Properly destroy the particle
                    p.destroy({children: true, texture: true, baseTexture: true});
                }
            }
            
            if (particles.children.length === 0 || elapsed > 120) {
                playerLayer.removeChild(particles);
                // Destroy the container
                particles.destroy({children: true, texture: true, baseTexture: true});
                // Remove the correct callback reference
                app.ticker.remove(tickerCallback);
            }
        };
        
        // Add the ticker with proper reference
        app.ticker.add(tickerCallback);
    }
    
    function onItemCrafted(itemId, success) {
        if (success) {
            // Play sound effect
            // playSound('craft_success');
            
            // Add visual effect
            const player = playerLayer.getChildByName("you");
            if (player) {
                // Create particle effect at player position
                createCraftParticles(player.x, player.y);
            }
            
        } else {
            //console.log(`Failed to craft ${itemId}.`);
        }
    }

    //Team Managment UI
    // Team Management UI Functions

// Initialize the team management system
function initTeamSystem() {
    // Create and append the team container to the body if it doesn't exist
    if (!document.getElementById('team-container')) {
        const teamContainerHTML = `
        <!-- Team Management UI -->
        <div id="team-container">
          <div class="team-header">
            <h2>Teams 👥</h2>
            <button id="close-team" class="close-button">×</button>
          </div>
          
          <!-- Team List View (when not in a team) -->
          <div id="team-list-state">
            <div class="teams-list">
              <ul id="teams-list-container">
                <!-- Teams will be populated dynamically -->
              </ul>
            </div>
            <div class="create-team">
              <input type="text" id="team-name-input" placeholder="Enter team name" maxlength="20"/>
              <button id="create-team-button">Create Team</button>
            </div>
          </div>
          
          <!-- Team Details View (when in a team) -->
          <div id="team-details-state" style="display: none;">
            <div class="team-info">
              <h3 id="current-team-name">Team Name</h3>
            </div>
            <div class="members-list">
              <ul id="members-list-container">
                <!-- Members will be populated dynamically -->
              </ul>
            </div>
            <div class="team-actions">
              <button id="leave-team-button">Leave</button>
            </div>
          </div>
        </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = teamContainerHTML;
        document.body.appendChild(container.firstElementChild);
        
        // Set up event listeners
    }
    if (!document.getElementById('team-chat-container')) {
        const teamChatContainer = document.createElement('div');
        teamChatContainer.id = 'team-chat-container';
        document.body.appendChild(teamChatContainer);
    }
    // Initialize with dummy data for demonstration
    setupTeamEventListeners();
    createJoinRequestUI()
    
    
}

function refreshTeamDetails(){
    // Make sure we have the current player ID
    const playerId = room.sessionId;
    
    // Get fresh team data from state if possible
    if (room && room.state && room.state.players) {
        const player = room.state.players.get(playerId);
        
        if (player && player.team && room.state.teams) {
            const serverTeam = room.state.teams.get(player.team);
            
            if (serverTeam) {
                // Convert the server team format to our UI format
                const teamData = {
                    id: serverTeam.id,
                    name: serverTeam.name,
                    leaderId: serverTeam.leaderId,
                    members: []
                };
                
                // Add all team members with their data
                serverTeam.members.forEach((member, memberId) => {
                    const memberPlayer = room.state.players.get(memberId);
                    teamData.members.push({
                        id: memberId,
                        name: memberPlayer ? memberPlayer.nickname : "Unknown",
                        isLeader: member.isLeader
                    });
                });
                
                // Update the currentTeam with fresh data
                currentTeam = teamData;
                updateTeamDetails(teamData);
                return;
            }
        }
    }
    
    // Fallback to using the cached currentTeam
    if (currentTeam) {
        updateTeamDetails(currentTeam);
    } else {
        // Handle case where team data isn't available
        console.warn("Team data not available");
        // Maybe switch back to team list
        switchToTeamList();
    }
}

function refreshTeamsList(){
    if (room && room.state && room.state.teams) {
        // Convert the MapSchema to array for the UI
        const teamsList = Array.from(room.state.teams.values()).map(team => ({
            id: team.id,
            name: team.name
        }));
        updateTeamsList(teamsList);
    } else {
        // Handle case where teams aren't loaded yet
        updateTeamsList([]);
    }
}

// Current player state
let currentTeam = null;
let arrowToggles = new Map(); // To track which members have arrows toggled
const arrowedPlayers = new Map();
let arrowContainer = null;

// Set up event listeners for the team management UI
function setupTeamEventListeners() {
    // Close button
    const closeButton = document.getElementById('close-team');
    if (closeButton) {
        eventHandlerTracker.add(closeButton,'click', () => {
            toggleTeamUI(false);
        });
    }
    
    // Create team button
    const createTeamButton = document.getElementById('create-team-button');
    if (createTeamButton) {
        eventHandlerTracker.add(createTeamButton,'click', createTeam);
    }
    
    // Leave team button
    const leaveTeamButton = document.getElementById('leave-team-button');
    if (leaveTeamButton) {
        eventHandlerTracker.add(leaveTeamButton,'click', leaveTeam);
    }

    // Prevent key propagation in team name input
    const teamNameInput = document.getElementById('team-name-input');
    if (teamNameInput) {
        eventHandlerTracker.add(teamNameInput,'keydown', function(e) {
            // Stop keydown event from propagating when typing in team input
            e.stopPropagation();
        });
        
        // Add focus/blur listeners to prevent all keyboard events while focused
        eventHandlerTracker.add(teamNameInput,'focus', function() {
            // Flag to indicate an input is focused
            window.inputFocused = true;
        });
        
        eventHandlerTracker.add(teamNameInput,'blur', function() {
            // Clear flag when input loses focus
            window.inputFocused = false;
        });
    }



    
}

// Toggle the team UI visibility
function toggleTeamUI(show) {
    const teamContainer = document.getElementById('team-container');
    if (!teamContainer) return;
    
    // If show is not specified, toggle the current state
    if (show === undefined) {
        show = teamContainer.style.display !== 'block';
    }
    
    teamContainer.style.display = show ? 'block' : 'none';
    
    // If showing, update the team list or team details
    if (show) {
        if (playa.team != "") {
            switchToTeamDetails();
        } else {
            switchToTeamList();
        }
    }
}

// Switch UI to team list view (when not in a team)
function switchToTeamList() {
    document.getElementById('team-list-state').style.display = 'block';
    document.getElementById('team-details-state').style.display = 'none';
    
    // Get teams from the room state instead of dummy data
    if (room && room.state && room.state.teams) {
        // Convert the MapSchema to array for the UI
        const teamsList = Array.from(room.state.teams.values()).map(team => ({
            id: team.id,
            name: team.name
        }));
        updateTeamsList(teamsList);
    } else {
        // Handle case where teams aren't loaded yet
        updateTeamsList([]);
    }
}

// Switch UI to team details view (when in a team)
function switchToTeamDetails() {
    document.getElementById('team-list-state').style.display = 'none';
    document.getElementById('team-details-state').style.display = 'block';
    
    // Make sure we have the current player ID
    const playerId = room.sessionId;
    
    // Get fresh team data from state if possible
    if (room && room.state && room.state.players) {
        const player = room.state.players.get(playerId);
        
        if (player && player.team && room.state.teams) {
            const serverTeam = room.state.teams.get(player.team);
            
            if (serverTeam) {
                // Convert the server team format to our UI format
                const teamData = {
                    id: serverTeam.id,
                    name: serverTeam.name,
                    leaderId: serverTeam.leaderId,
                    members: []
                };
                
                // Add all team members with their data
                serverTeam.members.forEach((member, memberId) => {
                    const memberPlayer = room.state.players.get(memberId);
                    teamData.members.push({
                        id: memberId,
                        name: memberPlayer ? memberPlayer.nickname : "Unknown",
                        isLeader: member.isLeader
                    });
                });
                
                // Update the currentTeam with fresh data
                currentTeam = teamData;
                updateTeamDetails(teamData);
                return;
            }
        }
    }
    
    // Fallback to using the cached currentTeam
    if (currentTeam) {
        updateTeamDetails(currentTeam);
    } else {
        // Handle case where team data isn't available
        console.warn("Team data not available");
        // Maybe switch back to team list
        switchToTeamList();
    }
}

// Update the list of teams in the UI
function updateTeamsList(teams) {
    const teamsListContainer = document.getElementById('teams-list-container');
    if (!teamsListContainer) return;
    
    teamsListContainer.innerHTML = '';
    
    if (teams.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.textContent = 'No teams available';
        emptyMessage.style.justifyContent = 'center';
        emptyMessage.style.color = '#8a9199';
        teamsListContainer.appendChild(emptyMessage);
        return;
    }
    
    teams.forEach(team => {
        const teamItem = document.createElement('li');
        
        const teamName = document.createElement('span');
        teamName.className = 'team-name';
        teamName.textContent = team.name;
        teamItem.appendChild(teamName);
        
        const joinButton = document.createElement('button');
        joinButton.className = 'join-button';
        joinButton.textContent = 'Join';
        eventHandlerTracker.add(joinButton,'click', () => joinTeam(team.id));
        teamItem.appendChild(joinButton);
        
        teamsListContainer.appendChild(teamItem);
    });
}

// Update the team details view with current team members
function updateTeamDetails(team) {
    if (!team) return;
    
    // Update team name
    document.getElementById('current-team-name').textContent = team.name;
    
    // Update members list
    const membersListContainer = document.getElementById('members-list-container');
    membersListContainer.innerHTML = '';
    
    team.members.forEach(member => {
        const memberItem = document.createElement('li');
        
        const memberColor = getTeamMemberColor(member.id);
        const hexColor = "#" + memberColor.toString(16).padStart(6, '0')

        // Arrow indicator (toggled by arrow button)
        const arrowIndicator = document.createElement('span');
        arrowIndicator.className = 'arrow-indicator';
        arrowIndicator.textContent = '➤';
        arrowIndicator.style.color = hexColor
        memberItem.appendChild(arrowIndicator);
        
        // Member name with crown for leader
        const memberName = document.createElement('span');
        memberName.className = 'member-name';
        
        if (member.isLeader) {
            memberName.innerHTML = `<span class="crown">👑</span>${member.name}`;
        } else {
            memberName.textContent = member.name;
        }
        memberItem.appendChild(memberName);
        
        // Button group for actions
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        
        // Arrow toggle button for all members
        if(member.id !== id_me){
        const arrowButton = document.createElement('button');
        arrowButton.className = 'arrow-button';
        arrowButton.textContent = '➤';
        eventHandlerTracker.add(arrowButton,'click', () => toggleArrow(member.id, memberItem));
        buttonGroup.appendChild(arrowButton);
        }
        
        // If current player is leader and this is not them, add transfer and kick buttons
     
        if (id_me === team.leaderId && member.id !== id_me) {
            const transferButton = document.createElement('button');
            transferButton.className = 'transfer-button';
            transferButton.textContent = '👑';
            eventHandlerTracker.add(transferButton,'click', () => transferLeadership(member.id));
            buttonGroup.appendChild(transferButton);
            
            const kickButton = document.createElement('button');
            kickButton.className = 'kick-button';
            kickButton.textContent = '🚫';
            eventHandlerTracker.add(kickButton,'click', () => kickMember(member.id));
            buttonGroup.appendChild(kickButton);
        }
        
        memberItem.appendChild(buttonGroup);
        membersListContainer.appendChild(memberItem);
        
        // Set initial arrow state if needed
        if (arrowToggles.get(member.id)) {
            memberItem.classList.add('arrow-active');
        }
    });
}
// Join a team
function joinTeam(teamId) {
    // Send join request to server instead of direct join
    room.send("requestJoinTeam", { teamId: teamId });
    
    // Show feedback to player
    showTeamActionFeedback("Join request sent to team leader");
    
    // Disable all join buttons temporarily to prevent spam
    const joinButtons = document.querySelectorAll('.join-button');
    joinButtons.forEach(button => {
        button.disabled = true;
    });
    
    // Re-enable after a delay
    setTimeout(() => {
        joinButtons.forEach(button => {
            button.disabled = false;
        });
    }, 5000); // 5 second cooldown
}

// Create a new team
function createTeam() {
    const teamName = document.getElementById('team-name-input').value.trim();
    if (teamName === '') return;
    
    room.send("createTeam", { teamName: teamName });
    document.getElementById('team-name-input').value = '';
}

// Leave the current team
function leaveTeam() {
    room.send("leaveTeam");
}


// Toggle the arrow indicator for a team member

// Transfer leadership to another team member
function transferLeadership(newLeaderId) {
    console.log("Transferring leadership to:", newLeaderId);
    room.send("transferLeadership", { newLeaderId: newLeaderId });
}
function kickMember(memberId) {
    console.log("Kicking member:", memberId);
    room.send("kickMember", { memberId: memberId });;
}
function showTeamActionFeedback(message) {
    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'team-action-feedback';
    feedbackElement.textContent = message;
    
    // Add to the document
    document.body.appendChild(feedbackElement);
    
    // Fade in
    setTimeout(() => {
        feedbackElement.classList.add('visible');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        feedbackElement.classList.remove('visible');
        setTimeout(() => {
            document.body.removeChild(feedbackElement);
        }, 500);
    }, 3000);
}
//Join requeste manangment
function createJoinRequestUI() {
    // Check if container already exists
    if (document.getElementById('join-request-container')) {
        return;
    }
    
    // Create join request container
    const requestContainer = document.createElement('div');
    requestContainer.id = 'join-request-container';
    requestContainer.className = 'join-request-container';
    
    // Add to body
    document.body.appendChild(requestContainer);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
    .join-request-container {
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(210px);
        width: auto;
        max-width: 300px;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .join-request {
        background: #303843;
        border: 1px solid #6c81a1;
        border-radius: 8px;
        padding: 15px;
        color: #f1f6f0;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
        animation: fadeIn 0.3s ease;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .join-request-title {
        font-weight: bold;
        font-size: 16px;
        color: #fdd179;
        margin-bottom: 5px;
    }
    
    .join-request-message {
        margin-bottom: 10px;
    }
    
    .join-request-buttons {
        display: flex;
        justify-content: center;
        gap: 10px;
    }
    
    .join-request-accept {
        padding: 6px 12px;
        background: linear-gradient(to bottom, #a4c5af, #84a58f);
        color: #f1f6f0;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }
    
    .join-request-reject {
        padding: 6px 12px;
        background: linear-gradient(to bottom, #b55945, #954835);
        color: #f1f6f0;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    `;
    document.head.appendChild(style);

    setupTeamJoinRequestHandlers();
}

function showJoinRequest(requesterId, requesterName, teamId) {
    // Make sure the UI is created
    createJoinRequestUI();
    
    // Create a request element
    const requestElement = document.createElement('div');
    requestElement.className = 'join-request';
    requestElement.dataset.requesterId = requesterId;
    
    // Set content
    requestElement.innerHTML = `
        <div class="join-request-title">Team Join Request</div>
        <div class="join-request-message">${requesterName} wants to join your team</div>
        <div class="join-request-buttons">
            <button class="join-request-accept">Accept</button>
            <button class="join-request-reject">Reject</button>
        </div>
    `;
    
    // Add to container
    const container = document.getElementById('join-request-container');
    container.appendChild(requestElement);
    
    // Add event listeners
    const acceptButton = requestElement.querySelector('.join-request-accept');
    const rejectButton = requestElement.querySelector('.join-request-reject');
    
    eventHandlerTracker.add(acceptButton,'click', () => {
        room.send("responseJoinTeam", { 
            playerId: requesterId,
            teamId: teamId,
            accepted: true
        });
        container.removeChild(requestElement);
    });
    
    eventHandlerTracker.add(rejectButton,'click', () => {
        room.send("responseJoinTeam", { 
            playerId: requesterId,
            teamId: teamId,
            accepted: false
        });
        container.removeChild(requestElement);
    });
    
    // Auto-remove after 30 seconds if no action taken
    setTimeout(() => {
        if (container.contains(requestElement)) {
            container.removeChild(requestElement);
            room.send("responseJoinTeam", { 
                playerId: requesterId,
                teamId: teamId,
                accepted: false,
                timeout: true
            });
        }
    }, 30000);
    
    // Play sound if available
    if (window.playSound) {
        window.playSound('notification');
    }
}
function setupTeamJoinRequestHandlers() {
    // Handle incoming join requests (for team leaders)
    room.onMessage("teamJoinRequest", (message) => {
        showJoinRequest(message.playerId, message.playerName, message.teamId);
    });
    
    // Handle responses to our join requests
    room.onMessage("teamJoinResponse", (message) => {
        if (message.accepted) {
            showTeamActionFeedback("Your team join request was accepted");
        } else {
            if (message.timeout) {
                showTeamActionFeedback("Your team join request timed out");
            } else {
                showTeamActionFeedback("Your team join request was rejected");
            }
        }
    });
}
// handle team arrow functions
function createArrowContainer() {
    if (arrowContainer) return arrowContainer;
    
    // Create a container for the arrows that will follow the player
    arrowContainer = new PIXI.Container();
    arrowContainer.name = "teamArrowContainer";
    arrowContainer.zIndex = 1000; // Make sure it appears above other elements
    
    // Add to the game layer (assume playerLayer is the layer where the player is)
    playerLayer.addChild(arrowContainer);
    
    return arrowContainer;
}
function toggleArrow(memberId, memberItem) {
    if (memberId === room.sessionId) return; // Don't track self
    
    const isTracking = arrowedPlayers.get(memberId);
    
    if (isTracking) {
        // Remove tracking
        arrowedPlayers.delete(memberId);
        memberItem.classList.remove('arrow-active');
        
        // Remove any existing arrow sprite for this member
        const arrow = arrowContainer?.getChildByName(`arrow_${memberId}`);
        if (arrow) {
            arrowContainer.removeChild(arrow);
        }
    } else {
        // Start tracking
        arrowedPlayers.set(memberId, true);
        memberItem.classList.add('arrow-active');
        
        // Create arrow container if it doesn't exist
        if (!arrowContainer) {
            createArrowContainer();
        }
        
        // Create an arrow sprite if it doesn't exist
        let arrow = arrowContainer.getChildByName(`arrow_${memberId}`);
        if (!arrow) {
            arrow = createArrowSprite(memberId);
            arrowContainer.addChild(arrow);
        }
    }
}
function createArrowSprite(memberId, memberColor) {
    // Create a triangle arrow pointing up
    const arrow = new PIXI.Graphics();
    arrow.name = `arrow_${memberId}`;
    
    const color = memberColor || getTeamMemberColor(memberId) || GAME_COLORS.lightGold
// Add a colored circle background for visibility
    arrow.circle(0, -3, 16);
    arrow.fill({color: 0xf1f6f0, alpha: 0.9})
    // Draw a triangle
    arrow.lineStyle(2, 0xf1f6f0, 1);
    arrow.moveTo(0, -15);
    arrow.lineTo(10, 5);
    arrow.lineTo(0,-1)
    arrow.lineTo(-10, 5);
    arrow.lineTo(0, -15);
    arrow.fill({color: getDarkerShade(color) })
    
    // Add a colored circle background for visibility
   // arrow.circle(0, 0, 20);
    //arrow.fill({color: 0xf1f6f0, alpha: 0.7})
    
    // Position at edge of screen initially
    arrow.x = 100;
    arrow.y = 0;
    arrow.visible = true;
    
    
    // Store the target player ID so we can track them
    arrow.targetId = memberId;
    
    return arrow;
}
function updateDirectionalArrows(dt,x,y) {
    if (!arrowContainer || arrowedPlayers.size === 0) return;
    
    // Position the arrow container at the player's position
    
    if (!playa) return;
    
    // Position the arrow container at the player's position (center of screen)
    arrowContainer.x = x;
    arrowContainer.y = y;
    
    // Update each arrow
    arrowContainer.children.forEach(arrow => {
        const targetId = arrow.targetId;
        if (!targetId) return;
        
        // Check if we're still tracking this player
        if (!arrowedPlayers.has(targetId)) {
            arrow.visible = false;
            return;
        }
        
        // Get target player
        const targetPlayer = room.state.players.get(targetId);
        if (!targetPlayer) {
            arrow.visible = false;
            return;
        }
        
        // Make sure arrow is visible
        arrow.visible = true;
        
        // Calculate direction to target
        const dx = targetPlayer.x - playa.x;
        const dy = targetPlayer.y - playa.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If player is close enough, pulse the arrow
        if (distance < 1800) {
            // Pulse effect when nearby
            arrow.alpha = 0.6 + 0.4 * Math.sin(Date.now() / 200);
            
            // Make the arrow closer to the player when nearby
            const radius = 80 + 20 * Math.sin(Date.now() / 400);
            
            // Calculate position on circle around player
            const angle = Math.atan2(dy, dx);
            arrow.x = Math.cos(angle) * radius;
            arrow.y = Math.sin(angle) * radius;
            
            // Point toward target
            arrow.rotation = angle + Math.PI/2; // +90 degrees to point correctly
        } else {
            // Normal display for distant players
            
            arrow.alpha = 1;
            // Fixed radius from player
            const radius = 100;
            
            // Calculate position on circle around player
            const angle = Math.atan2(dy, dx);
            arrow.x = Math.cos(angle) * radius;
            arrow.y = Math.sin(angle) * radius;
            
            // Point toward target
            arrow.rotation = angle + Math.PI/2; // +90 degrees to point correctly
        }
        
        // If we're very close, make the arrow smaller
        if (distance < 300) {
            arrow.scale.set(-0.2 + 1.2 * distance / 300);
        } else {
            arrow.scale.set(1);
        }
    });
}

function clearAllArrows() {
    arrowedPlayers.clear();
    
    if (arrowContainer) {
        arrowContainer.removeChildren();
    }
}
function getTeamMemberColor(memberId) {
    // If we already assigned a color, return it
    if (teamMemberColors.has(memberId)) {
        return teamMemberColors.get(memberId);
    }
    
    // Otherwise, assign a new color
    const colorIndex = teamMemberColors.size % TEAM_MEMBER_COLORS.length;
    const color = TEAM_MEMBER_COLORS[colorIndex];
    
    // Store for future use
    teamMemberColors.set(memberId, color);
    
    return color;
}
function clearTeamMemberColors(){
    teamMemberColors.clear()
}
function getDarkerShade(hexColor) {
    // Remove 0x if present
    return hexColor
    console.log(hexColor)
    hexColor = (hexColor.toString()).replace('0x', '');
    
    // Parse the hex color
    let r = parseInt(hexColor.slice(0, 2), 16);
    let g = parseInt(hexColor.slice(2, 4), 16);
    let b = parseInt(hexColor.slice(4, 6), 16);
    
    // Darken by 20%
    r = Math.max(0, Math.floor(r * 0.9));
    g = Math.max(0, Math.floor(g * 0.9));
    b = Math.max(0, Math.floor(b * 0.9));
    
    // Convert back to hex
    console.log('0x' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''))
    return '0x' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
//Team Chat
function addTeamChatMessage(sender, message, isLocal = false) {
    const container = document.getElementById('team-chat-container');
    if (!container) return;
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = 'team-chat-message';
    
    // Add sender and message
    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = sender + ':';
    
    messageElement.appendChild(senderSpan);
    messageElement.appendChild(document.createTextNode(' ' + message));
    
    // Add to container
    container.appendChild(messageElement);
    
    // Auto-scroll
    //messageElement.scrollIntoView({ behavior: 'smooth' });
    
    // Limit the number of messages
    while (container.children.length > 10) {
        container.removeChild(container.firstChild);
    }
    
    // Set up auto-fade
    setTimeout(() => {
        messageElement.classList.add('fading');
        
        // Remove after fade completes
        setTimeout(() => {
            if (container.contains(messageElement)) {
                container.removeChild(messageElement);
            }
        }, 800); // Match the CSS transition time
    }, 8000); // 8 seconds display time
    
    // Play notification sound if not local message
    if (!isLocal && window.playSound) {
        //window.playSound('teamchat');
    }
}

    //end Team Managment UI
//Inventory notification system
function createInventoryNotificationSystem() {
    // Create notification container
    const notificationContainer = new PIXI.Container();
    notificationContainer.name = "notificationContainer";
    notificationContainer.x = window.innerWidth - 20;
    notificationContainer.y = window.innerHeight - 100;
    app.stage.addChild(notificationContainer);
    
    // Track active notifications
    const activeNotifications = [];
    
    // Function to add a new notification
    window.addItemNotification = function(itemName, quantity, iconTexture) {
        // Create notification
        const notification = new PIXI.Container();
        
        // Background
        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, 210, 50, 10);
        bg.fill({color: 0x303843, alpha: 0.85});
        notification.addChild(bg);
        
        // Item icon
        const icon = new PIXI.Sprite(iconTexture || PIXI.Assets.get(itemName));
        icon.anchor.set(0.5);
        icon.scale.set(0.8);
        icon.x = 30;
        icon.y = 25;
        notification.addChild(icon);
        
        // Plus sign and quantity
        const text = new PIXI.Text({
            text: `+${quantity}`,
            style: {
                fontFamily: 'Roboto',
                fontSize: 18,
                fontWeight: 'bold',
                fill: 0xfdd179
            }
        });
        text.anchor.set(0, 0.5);
        text.x = 60;
        text.y = 25;
        notification.addChild(text);
        
        // Item name
        const nameText = new PIXI.Text({
            text: itemName,
            style: {
                fontFamily: 'Roboto',
                fontSize: 16,
                fill: 0xf1f6f0
            }
        });
        nameText.anchor.set(0, 0.5);
        nameText.x = 100;
        nameText.y = 25;
        notification.addChild(nameText);
        
        // Position and anchor
        notification.alpha = 0;
        notification.x = notification.width;
        notification.y = 10;
        
        // Add to container and list
        notificationContainer.addChild(notification);
        activeNotifications.push({
            element: notification,
            createdAt: Date.now(),
            lifetime: 3000, // 3 seconds
            state: 'new'
        });
        
        // Reposition all notifications
        repositionNotifications();
    };
    
    function repositionNotifications() {
        let yOffset = 0;
        for (let i = activeNotifications.length - 1; i >= 0; i--) {
            const notification = activeNotifications[i];
            const element = notification.element;
            
            // Set target y position
            element.targetY = yOffset+ 10;
            
            // Increase offset for next notification
            yOffset -= element.height;
        }
    }
    
    // Update notifications animation
    app.ticker.add(() => {
        const now = Date.now();
        
        // Process each notification
        for (let i = activeNotifications.length - 1; i >= 0; i--) {
            const notification = activeNotifications[i];
            const element = notification.element;
            const age = now - notification.createdAt;
            
            // Handle different animation states
            if (notification.state === 'new' && age < 300) {
                // Slide in animation
                element.alpha = Math.min(1, age / 200);
                element.x = Math.max(-180, element.x - 30);
            } else if (age < notification.lifetime - 500) {
                // Stable display
                notification.state = 'display';
                element.alpha = 1;
                element.x = -180;
                
                // Animate toward target Y position
                element.y += (element.targetY - element.y) * 0.2;
            } else if (age < notification.lifetime) {
                // Fade out
                notification.state = 'fadeout';
                element.alpha = Math.max(0, 1 - (age - (notification.lifetime - 500)) / 500);
                
                // Continue moving to target Y
                element.y += (element.targetY - element.y) * 0.2;
            } else {
                // Remove notification
                notificationContainer.removeChild(element);
                activeNotifications.splice(i, 1);
                
                // Reposition remaining notifications
                repositionNotifications();
            }
        }
    });
    
    // Reposition on window resize
    const reizeHandler3 = eventHandlerTracker.add(window,'resize', () => {
        notificationContainer.x = window.innerWidth - 20;
        notificationContainer.y = window.innerHeight - 100;
        repositionNotifications();
    });
    
    return notificationContainer;
}

//UI scaling system
function createUIScalingSystem() {
    // Base dimensions (what the UI was designed for)
    const BASE_WIDTH = 1920;
    const BASE_HEIGHT = 910;
    console.log(window.innerHeight)
    console.log(window.innerWidth)
    
    // Calculate scale factors
    window.uiScaleX = window.innerWidth / BASE_WIDTH;
    window.uiScaleY = window.innerHeight / BASE_HEIGHT;
    window.uiScale = Math.min(window.uiScaleX, window.uiScaleY);
    
    // Update scale on window resize
    const reizeHandler = eventHandlerTracker.add(window,'resize', () => {
        window.uiScaleX = (1+window.innerWidth / BASE_WIDTH)/2;
        window.uiScaleY = (1+window.innerHeight / BASE_HEIGHT)/2;
        window.uiScale =  window.uiScaleY;
        console.log(window.uiScale)
        // Update UI element sizes
        updateUIElementSizes();
    });
}

function updateUIElementSizes() {
    const hotbar = app.stage.getChildByName("hotbar");
    if (hotbar) {
        hotbar.scale.set(window.uiScale);
        hotbar.x = window.innerWidth/2 + 130 * window.uiScale;
        hotbar.y = window.innerHeight - 75 * window.uiScale;
    }
    
    // Scale mouse item
    if (mouseObject) {
        mouseObject.scale.set(window.uiScale);
    }
    
    // Scale any other UI elements
    const miniMap = app.stage.getChildByName("miniMap");
    if (miniMap) {
        miniMap.scale.set(window.uiScale);
    }
    const inventory = app.stage.getChildByName("inventory")
    if (inventory){
        inventory.scale.set(window.uiScale)
    }



}
//inventory managment
function makeInventory() {
    const inventory = new PIXI.Container();
    inventory.name = "inventory";
    inventory.visible = false;
    
    // Create inventory background
    const inventoryBackground = PIXI.Sprite.from(PIXI.Assets.get('/img/GUI/inventory.png'));
    inventoryBackground.y = 215;
    inventoryBackground.x = 10;
    inventory.addChild(inventoryBackground);
    
    // Create a separate container for all interactive elements
    const slotContainer = new PIXI.Container();
    slotContainer.name = "slotContainer";
    
    // Position the slot container within inventory
    slotContainer.x = 17; // Adjust based on your inventory background
    slotContainer.y = 262; // Adjust based on your inventory background
    
    // Grid configuration - store this on the container for easier reference
    slotContainer.gridConfig = {
      slotSize: 68,      // Size of each slot
      paddingx: 11.5,
      paddingy: 15,       // Padding between slots
      columns: 8,        // Number of columns
      rows: 4,           // Number of rows
      startIndex: 9      // Start index (after hotbar slots 0-8)
    };
    
    // Create a single interactive area for the entire grid
    const interactiveArea = new PIXI.Graphics();
    interactiveArea.name = "interactiveArea";
    
    // Calculate total dimensions
    const totalWidth = slotContainer.gridConfig.columns * (slotContainer.gridConfig.slotSize + slotContainer.gridConfig.paddingx);
    const totalHeight = slotContainer.gridConfig.rows * (slotContainer.gridConfig.slotSize + slotContainer.gridConfig.paddingy)
    
    // Draw the interactive area
    interactiveArea.rect(0, 0, totalWidth, totalHeight);
    interactiveArea.fill({color: 0xFFFFFF, alpha: 0.001}); // Very faint to be effectively invisible
    
    // Make it interactive
    interactiveArea.eventMode = 'static';
    
    // Add pointer down handler for the entire grid
    interactiveArea.on('pointerdown', (event) => {
      event.stopPropagation();
      
      // Cooldown check
      const currentTime = Date.now();
      if (currentTime - lastMoveTime < MOVE_COOLDOWN) {
        return;
      }
      lastMoveTime = currentTime;
      
      // Get local click position
      const localPos = event.getLocalPosition(interactiveArea);
      
      // Calculate which slot was clicked
      const gridConfig = slotContainer.gridConfig;
      const col = Math.floor(localPos.x / (gridConfig.slotSize + gridConfig.paddingx));
      const row = Math.floor(localPos.y / (gridConfig.slotSize + gridConfig.paddingy));
      
      // Validate we're within grid bounds
      if (col >= 0 && col < gridConfig.columns && row >= 0 && row < gridConfig.rows) {
        // Calculate the slot index
        const slotIndex = gridConfig.startIndex + (row * gridConfig.columns) + col;
        const slotName = slotIndex.toString();
        
        
        // Get player data
        const player = room.state.players.get(id_me);
        if (!player) return;
        
        // Handle item interaction based on whether mouse has an item
        if (MouseItem === "none") {
          // Case 1: Try to pick up an item
          const item = player.inventory.slots.get(slotName);
          if (item) {
            
            // Get the item's sprite from our itemsContainer
            const itemsContainer = slotContainer.getChildByName("itemsContainer");
            if (itemsContainer) {
              const itemSprite = itemsContainer.getChildByName(`item_${slotName}`);
              if (itemSprite) {
                // Get the icon
                const icon = itemSprite.getChildByName("icon");
                if (icon) {
                  // Store texture for mouse
                  MouseItem = icon.texture;
                  MouseItemName = slotName;
                  
                  // Update mouse cursor
                  updateMouseItem();
                  
                  // Remove visual
                  itemsContainer.removeChild(itemSprite);
                  
                  // Tell server
                  room.send("moveItem", {
                    from: "inv", 
                    to: "inv", 
                    fromslot: parseInt(slotName), 
                    toslot: -1
                  });
                } else {
                  console.warn("Icon not found in item sprite");
                }
              } else {
                console.warn("Visual not found for item in slot:", slotName);
                
                // Try to get texture directly and create mouse item
                try {
                  const texturePath = `/img/items/${item.name}.png`;
                  MouseItem = PIXI.Texture.from(texturePath);
                  MouseItemName = slotName;
                  updateMouseItem();
                  
                  // Tell server even without visual
                  room.send("moveItem", {
                    from: "inv", 
                    to: "inv", 
                    fromslot: parseInt(slotName), 
                    toslot: -1
                  });
                } catch (e) {
                  console.error("Failed to create mouse item:", e);
                }
              }
            }
          }
        } else {
          // Case 2: We have an item, try to place it
          const originalMouseItemSlot = MouseItemName;
          
          // Check if target slot has an item
          const existingItem = player.inventory.slots.get(slotName);
          
          if (!existingItem) {
            
            // Tell server
            room.send("moveItem", {
              from: "inv", 
              to: "inv", 
              fromslot: parseInt(originalMouseItemSlot), 
              toslot: parseInt(slotName)
            });
            
            // Clear mouse
            MouseItem = "none";
            MouseItemName = "none";
            updateMouseItem();
          } else {
            
            // Get existing item visual
            const itemsContainer = slotContainer.getChildByName("itemsContainer");
            let replacedTexture = null;
            
            if (itemsContainer) {
              const existingItemSprite = itemsContainer.getChildByName(`item_${slotName}`);
              if (existingItemSprite) {
                const icon = existingItemSprite.getChildByName("icon");
                if (icon) {
                  replacedTexture = icon.texture;
                }
                itemsContainer.removeChild(existingItemSprite);
              }
            }
            
            // Tell server to swap
            room.send("moveItem", {
              from: "inv", 
              to: "inv", 
              fromslot: parseInt(originalMouseItemSlot), 
              toslot: parseInt(slotName)
            });
            
            // Force UI update
            pinventory = -1;
            
            // Update mouse with swapped item
            if (replacedTexture) {
              MouseItem = replacedTexture;
              MouseItemName = originalMouseItemSlot;
              updateMouseItem();
            } else {
              // Try to get texture directly
              try {
                const texturePath = `/img/items/${existingItem.name}.png`;
                MouseItem = PIXI.Texture.from(texturePath);
                MouseItemName = originalMouseItemSlot;
                updateMouseItem();
              } catch (e) {
                console.error("Failed to create mouse item for swap:", e);
                MouseItem = "none";
                MouseItemName = "none";
                updateMouseItem();
              }
            }
          }
        }
      }
    });

    
    // Create a dedicated container for item sprites
    const itemsContainer = new PIXI.Container();
    itemsContainer.name = "itemsContainer";
    slotContainer.addChild(itemsContainer);
    
    // Add interactive area on top
    slotContainer.addChild(interactiveArea);
    
    // Add slot container to inventory
    inventory.addChild(slotContainer);
    
    // Add inventory to stage
    app.stage.addChild(inventory);
    
    return inventory;
  }
  function updateInventory(playerInventory) {
  
  // Get inventory container
  const inventory = app.stage.getChildByName("inventory");
  if (!inventory || !inventory.visible) return;
  
  // Get the slot container
  const slotContainer = inventory.getChildByName("slotContainer");
 
  
  // Get the grid configuration
  const gridConfig = slotContainer.gridConfig;

  
  // Get or create items container
  let itemsContainer = slotContainer.getChildByName("itemsContainer");
  if (!itemsContainer) {
    itemsContainer = new PIXI.Container();
    itemsContainer.name = "itemsContainer";
    slotContainer.addChild(itemsContainer);
  }
  
  // Clear all existing items first
  while (itemsContainer.children.length > 0) {
    itemsContainer.removeChildAt(0);
  }
  
  // Show debug information

  
  
  // Loop through all inventory slots to create visuals
  for (let i = gridConfig.startIndex; i < 50; i++) { // Use a safe maximum (e.g., 50)
    const slotName = i.toString();
    
    // Skip if this slot is being held by mouse
    if (MouseItemName === slotName) {
      continue;
    }
    
    // Get item from this slot
    const item = playerInventory.slots.get(slotName);
    if (!item || !item.name) {
      continue; // Skip empty slots
    }
    
    // Calculate grid position
    const relativeIndex = i - gridConfig.startIndex;
    const row = Math.floor(relativeIndex / gridConfig.columns);
    const col = relativeIndex % gridConfig.columns;

    
    // Calculate pixel position
    const x = col * (gridConfig.slotSize + gridConfig.paddingx) + gridConfig.slotSize/2;
    const y = row * (gridConfig.slotSize + gridConfig.paddingy) + gridConfig.slotSize/2;

    
    // Create container for this item
    const itemContainer = new PIXI.Container();
    itemContainer.name = `item_${slotName}`;
    itemContainer.x = x;
    itemContainer.y = y;
    
    // Create visual representation guaranteed to work
    let icon;
    try {
      // Try multiple loading approaches
      let texture;
      
      // Approach 1: Get from cache
      texture = PIXI.Assets.get(`/img/items/${item.name}.png`);
      
      // Approach 2: Load directly if not in cache
      if (!texture) {
        console.log(`Texture for ${item.name} not in cache, loading directly`);
        texture = PIXI.Texture.from(`/img/items/${item.name}.png`);
      }
      
      // Create icon with texture
      icon = new PIXI.Sprite(texture);
      icon.name = "icon";
      icon.anchor.set(0.5); // Center anchor
      icon.scale.set(1); // Slightly smaller than the slot
      
    } catch (e) {
      console.warn(`Failed to load texture for ${item.name}, creating placeholder`);
      
      // Create a placeholder graphic
      icon = new PIXI.Graphics();
      icon.name = "icon";
      
      // Draw a colored rectangle with item name
      icon.beginFill(0xb55945);
      icon.drawRect(-20, -20, 40, 40);
      icon.endFill();
      
      // Add text label
      const label = new PIXI.Text({
        text: item.name.substring(0, 3),
        style: {
          fontFamily: 'Roboto',
          fontSize: 12,
          fill: 0xFFFFFF,
          align: 'center'
        }
      });
      label.anchor.set(0.5);
      icon.addChild(label);
    }
    
    // Add icon to container
    itemContainer.addChild(icon);
    
    // Add durability bar if needed
    if (item.maxDurability > 0) {
      const percentage = Math.max(0, Math.min(1, item.durability / item.maxDurability));
      const barColor = getDurabilityColor(percentage);
      
      // Create durability bar background
      const durabilityBg = new PIXI.Graphics();
      durabilityBg.beginFill(0x3d3333);
      durabilityBg.drawRoundedRect(-20, 15, 40, 6, 3);
      durabilityBg.endFill();
      durabilityBg.scale.set(1.5)
      itemContainer.addChild(durabilityBg);
      
      // Create durability fill
      const durabilityFill = new PIXI.Graphics();
      durabilityFill.beginFill(barColor);
      durabilityFill.drawRoundedRect(-19, 16, 38 * percentage, 4, 2);
      durabilityFill.endFill();
      durabilityFill.scale.set(1.5)
      itemContainer.addChild(durabilityFill);
    }
    
    if (item.quantity > 1) {
 
      
      const quantityText = new PIXI.Text({
        text: item.quantity.toString(),
        style: {
          fontFamily: 'Roboto',
          fontSize: 16,
          fontWeight: 'bold',
          stroke: 0x1e242b,
          fill: 0xFFFFFF,
          align: 'center',
          strokeThickness: 6,
        }
      });
      quantityText.anchor.set(0.5);
      quantityText.x = 20;
      quantityText.y = -15;
      itemContainer.addChild(quantityText);
    }
    
    // Add to items container
    itemsContainer.addChild(itemContainer);
  }
  
  }
// tooltip implementation
function setupItemTooltips() {
    // Create tooltip container
    const tooltip = new PIXI.Container();
    tooltip.name = "tooltip";
    tooltip.visible = false;
    tooltip.zIndex = 9999; // Make sure it's on top
    
    // Create tooltip background
    const tooltipBg = new PIXI.Graphics();
    tooltipBg.name = "tooltipBg";
    tooltip.addChild(tooltipBg);
    
    // Create tooltip text
    const tooltipText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: 'Roboto',
        fontSize: 14,
        fill: 0xf1f6f0,
        align: 'left',
        wordWrap: true,
        wordWrapWidth: 200,
        fontWeight: 'bold',
        stroke: 0x1e242b,
        strokeThickness: 4

      }
    });
    tooltipText.name = "tooltipText";
    tooltipText.x = 10;
    tooltipText.y = 10;
    tooltip.addChild(tooltipText);
    
    // Add to stage (make sure it's added after other UI)
    app.stage.addChild(tooltip);
function getItemDescription(item) {
    let desc = itemDescriptions[item.name] || "No description available.";
    let text = `${item.name.charAt(0).toUpperCase() + item.name.slice(1)}\n\n${desc}\n`;
    
    // Add stats information
    if (item.maxDurability > 0) {
      const percent = Math.floor((item.durability / item.maxDurability) * 100);
      text += `\nDurability: ${item.durability}/${item.maxDurability} (${percent}%)`;
    }
    
    if (item.dmgmod > 0) {
      text += `\nDamage: +${item.dmgmod}`;
    }
    
    if (item.quantity > 1) {
      text += `\nQuantity: ${item.quantity}`;
    }
    
    return text;
  }
  function showTooltip(item, x, y) {
    if (!item) {
      tooltip.visible = false;
      return;
    }
    
    // Set tooltip text based on item properties
    tooltipText.text = getItemDescription(item);
    
    // Update background
    tooltipBg.clear();
    tooltipBg.roundRect(0, 0, tooltipText.width + 20, tooltipText.height + 20, 8);
    tooltipBg.fill({color: 0x303843, alpha: 0.9});
    
    // Position tooltip
    tooltip.x = x;
    tooltip.y = y - tooltip.height - 10;
    
    // Keep tooltip on screen
    if (tooltip.x + tooltip.width > winx) {
      tooltip.x = winx - tooltip.width - 10;
    }
    if (tooltip.y < 10) {
      tooltip.y = y + 10;
    }
    
    // Show tooltip
    tooltip.visible = true;
  }
  app.ticker.add(() => {
    // Hide tooltip if mouse is holding an item
    if (MouseItem !== "none") {
      tooltip.visible = false;
      return;
    }
    
    let foundHover = false;
    
    // Check hotbar slots
    const hotbar = app.stage.getChildByName("hotbar");
    if (hotbar) {
      for (let i = 0; i <= 8; i++) {
        const slot = hotbar.getChildByName(i.toString());
        if (slot) {
          const bounds = slot.getBounds();
          const mouseInBounds = mouseX >= bounds.x && mouseX <= bounds.x + bounds.width && 
                               mouseY >= bounds.y && mouseY <= bounds.y + bounds.height;
          
          if (mouseInBounds) {
            foundHover = true;
            const player = room.state.players.get(id_me);
            const item = player.inventory.slots.get(i.toString());
            if (item) {
              showTooltip(item, mouseX, mouseY);
            }
            break;
          }
        }
      }
    }
    
    // Check inventory slots if inventory is open
    if (!foundHover && app.stage.getChildByName("inventory") && app.stage.getChildByName("inventory").visible) {
      const slotContainer = app.stage.getChildByName("inventory").getChildByName("slotContainer");
      
      if (slotContainer && slotContainer.gridConfig) {
        const gridConfig = slotContainer.gridConfig;
        const itemsContainer = slotContainer.getChildByName("itemsContainer");
        
        if (itemsContainer) {
          // Convert mouse position to local coordinates
          const localPos = itemsContainer.toLocal(new PIXI.Point(mouseX, mouseY));
          
          // Calculate which slot is under the mouse
          const col = Math.floor(localPos.x / (gridConfig.slotSize + gridConfig.paddingx));
          const row = Math.floor(localPos.y / (gridConfig.slotSize + gridConfig.paddingy));
          
          // Valid slot position check
          if (col >= 0 && col < gridConfig.columns && row >= 0 && row < gridConfig.rows) {
            const slotIndex = gridConfig.startIndex + (row * gridConfig.columns) + col;
            const player = room.state.players.get(id_me);
            const item = player.inventory.slots.get(slotIndex.toString());
            
            if (item) {
              foundHover = true;
              showTooltip(item, mouseX, mouseY);
            }
          }
        }
      }
    }
    
    // Hide tooltip if no slot is hovered
    if (!foundHover) {
      tooltip.visible = false;
    }
  });
  
  return tooltip;
}
function createDeathEffect(x, y) {
    const deathEffect = new PIXI.Container();
    deathEffect.x = x;
    deathEffect.y = y;
    
    // Create particles or other death effects
    for (let i = 0; i < 30; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(0xb55945);
        particle.drawCircle(0, 0, 3 + Math.random() * 3);
        particle.endFill();
        
        // Random position and velocity
        particle.x = (Math.random() * 40) - 20;
        particle.y = (Math.random() * 40) - 20;
        particle.vx = (Math.random() * 4) - 2;
        particle.vy = -2 - Math.random() * 3;
        particle.alpha = 0.8;
        
        deathEffect.addChild(particle);
    }
    
    gameLayer.addChild(deathEffect);
    
    // Animate and remove after some time
    let elapsed = 0;
    app.ticker.add(function animateParticles(delta) {
        elapsed += delta;
        
        for (let i = 0; i < deathEffect.children.length; i++) {
            const p = deathEffect.children[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.01;
            p.vy += 0.1; // Gravity
            
            if (p.alpha <= 0) {
                deathEffect.removeChild(p);
                i--;
            }
        }
        
        if (deathEffect.children.length === 0 || elapsed > 120) {
            gameLayer.removeChild(deathEffect);
            app.ticker.remove(animateParticles);
        }
    });
}
function returnToLandingPage(room) {
    eventHandlerTracker.removeAll();
    if(room){
        room.removeAllListeners();
        console.log("event listerners removed")
        try {
            room.leave();
        } catch (e) {
            console.log("Room already left or connection closed");
        }
        
        // Disconnect from server
        if (room.connection && room.connection.isOpen) {
            room.connection.close();
        }
    }
    // Clean up game resources
    app.ticker.remove()
    app.destroy(true, { children: true, texture: true, baseTexture: true });
    
    // Show landing page
    document.getElementById("main-container").style.display = "flex";
    document.getElementById("discord").style.display = "block";
    
    // Display death message
    const nickname = document.getElementById("nickname");
    if (nickname) {
        nickname.value = nickname_me; // Keep the previous nickname
    }
    
    const craftingContainer = document.getElementById('crafting-container');
    if (craftingContainer) craftingContainer.style.display = 'none';
    
    const teamContainer = document.getElementById('team-container');
    if (teamContainer) teamContainer.style.display = 'none';
    
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) chatContainer.style.display = 'none';


    // Show death message
    showDeathMessage();
    
    document.addEventListener("keydown", handlefirstenter);
}
// Building UI and system functions
// Initialize building system
function initBuildingSystem() {
    initBuildingUI();
    setupBuildingEventListeners();
    filterBuildingsByCategory("shelter"); // Default category
    
    // Hide the UI initially
    toggleBuildingUI(false);
}

// Initialize building UI
function initBuildingUI() {
    // Check if the building UI already exists
    let buildingContainer = document.getElementById('building-container');
    
    // If it doesn't exist, create it (this should not happen if you added the HTML)
    if (!buildingContainer) {
        console.error("Building container element not found in the DOM!");
    }
}

// Set up event listeners for the building UI
function setupBuildingEventListeners() {
    // Close button
    const closeButton = document.getElementById('close-building');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            toggleBuildingUI(false);
        });
    }
    
    // Tab selection
    const tabs = document.querySelectorAll('#building-container .tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottom = 'none';
                t.style.color = '#f1f6f0';
            });
            
            // Add active class to clicked tab
            tab.classList.add('active');
            tab.style.borderBottom = '2px solid #6c81a1';
            tab.style.color = '#6c81a1';
            
            // Filter buildings by category
            filterBuildingsByCategory(tab.getAttribute('data-category'));
        });
    });
    
    // Build button
    const buildButton = document.getElementById('build-button');
    if (buildButton) {
        buildButton.addEventListener('pointerdown', () => {
            if (!buildButton.disabled) {
                const selectedBuilding = document.querySelector('.buildings-list li.active');
                if (selectedBuilding) {
                    const buildingId = selectedBuilding.getAttribute('data-building-id');
                    buildItem(buildingId);
                }
            }
        });
    }
    
    // Escape key to close building UI
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const buildingContainer = document.getElementById('building-container');
            if (buildingContainer && buildingContainer.style.display === 'block') {
                toggleBuildingUI(false);
            }
        }
    });
}

// Populate the buildings list
function populateBuildingsList() {
    const buildingsList = document.getElementById('buildings-list-container');
    if (!buildingsList) return;
    
    buildingsList.innerHTML = ''; // Clear existing buildings
    
    BUILDINGS.forEach(building => {
        const li = document.createElement('li');
        li.setAttribute('data-building-id', building.id);
        li.setAttribute('data-category', building.category);
        
        // Create building item HTML
        li.innerHTML = `
            <img src="img/items/${building.image}.png" alt="${building.name}">
            <span class="item-name">${building.name}</span>
        `;
        
        // Add click event to show building details
        li.addEventListener('click', () => {
            // Remove active class from all buildings
            document.querySelectorAll('.buildings-list li').forEach(item => {
                item.classList.remove('active');
            });
            
            // Add active class to clicked building
            li.classList.add('active');
            
            // Show building details
            showBuildingDetails(building.id);
        });
        
        buildingsList.appendChild(li);
    });
}

// Filter buildings by category
function filterBuildingsByCategory(category) {
    // Make sure the buildings list is populated
    populateBuildingsList();
    
    const buildingItems = document.querySelectorAll('.buildings-list li');
    
    buildingItems.forEach(item => {
        if (category === 'all' || item.getAttribute('data-category') === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
    
    // Select the first visible building
    const firstVisible = document.querySelector(`.buildings-list li[data-category="${category}"]`);
    if (firstVisible) {
        firstVisible.classList.add('active');
        const buildingId = firstVisible.getAttribute('data-building-id');
        showBuildingDetails(buildingId);
    } else {
        // Reset details if no buildings in this category
        resetBuildingDetails();
    }
}

// Show details for a selected building
function showBuildingDetails(buildingId) {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) {
        resetBuildingDetails();
        return;
    }
    
    // Update building details
    document.getElementById('selected-building-image').src = `img/items/${building.image}.png`;
    document.getElementById('selected-building-name').textContent = building.name;
    document.getElementById('selected-building-description').textContent = building.description;
    
    // Update requirements
    const requirementsContainer = document.getElementById('building-requirements');
    requirementsContainer.innerHTML = '';
    
    let canBuild = true;
    const playerInventory = getPlayerInventory();
    
    building.requirements.forEach(req => {
        const playerHas = getInventoryItemCount(playerInventory, req.material);
        const hasEnough = playerHas >= req.amount;
        if (!hasEnough) canBuild = false;
        
        const reqElement = document.createElement('div');
        reqElement.className = `requirement ${hasEnough ? 'sufficient' : 'insufficient'}`;
        
        // Set the data-count attribute for the CSS :after pseudo-element to use
        reqElement.setAttribute('data-count', `${playerHas}/${req.amount}`);
        
        // Create only the image element
        reqElement.innerHTML = `<img src="img/items/${req.material}.png" alt="${req.material}">`;
        
        requirementsContainer.appendChild(reqElement);
    });
    
    // Enable/disable build button
    const buildButton = document.getElementById('build-button');
    if (buildButton) {
        buildButton.disabled = !canBuild;
    }
}

// Reset building details to default state
function resetBuildingDetails() {
    document.getElementById('selected-building-image').src = '';
    document.getElementById('selected-building-name').textContent = 'Select a building';
    document.getElementById('selected-building-description').textContent = 'Select a building to see details.';
    document.getElementById('building-requirements').innerHTML = '';
    document.getElementById('build-button').disabled = true;
}

// Toggle building UI visibility
function toggleBuildingUI(show) {
    const buildingContainer = document.getElementById('building-container');
    if (!buildingContainer) {
        console.error('Building container not found');
        return;
    }
    
    buildingContainer.style.display = show ? 'block' : 'none';
    
    // Refresh building details when showing UI
    if (show) {
        const selectedBuilding = document.querySelector('.buildings-list li.active');
        if (selectedBuilding) {
            const buildingId = selectedBuilding.getAttribute('data-building-id');
            showBuildingDetails(buildingId);
        } else {
            // Select first building if none is selected
            filterBuildingsByCategory(document.querySelector('#building-container .tabs .tab.active').getAttribute('data-category'));
        }
        
        // Close other UIs
        const craftingContainer = document.getElementById('crafting-container');
        if (craftingContainer && craftingContainer.style.display === 'block') {
            toggleCraftingUI(false);
        }
        
        const inventoryContainer = app.stage.getChildByName("inventory");
        if (inventoryContainer) {
            inventoryContainer.visible = false;
        }
        
        const teamContainer = document.getElementById('team-container');
        if (teamContainer && teamContainer.style.display === 'block') {
            toggleTeamUI(false);
        }
        
        // Deal with any held items
        if (MouseItem !== "none" && MouseItemName !== "none") {
            // Only if it's an inventory slot (number)
            if (!isNaN(parseInt(MouseItemName))) {
                const originalSlot = parseInt(MouseItemName);
                
                // Find first empty slot to put it back if original slot now has an item
                const player = room.state.players.get(id_me);
                let targetSlot = originalSlot;
                
                // Check if original slot is now occupied
                if (player.inventory.slots.get(originalSlot.toString())) {
                    // Find first empty slot
                    for (let i = 0; i < player.inventory.MAX_SLOTS; i++) {
                        if (!player.inventory.slots.get(i.toString())) {
                            targetSlot = i;
                            break;
                        }
                    }
                }
                
                // Send to server
                room.send("moveItem", {
                    from: "inv",
                    to: "inv",
                    fromslot: originalSlot,
                    toslot: targetSlot
                });
                
                // Clear mouse item
                MouseItem = "none";
                MouseItemName = "none";
                updateMouseItem();
            }
        }
    }
}

// Build the selected item
function buildItem(buildingId) {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return;
    
    // Close the building UI
    toggleBuildingUI(false);
    
    // The building process would go here in a real implementation
    // For now, just log a message and deduct resources
    console.log(`Building ${building.name}...`);
    
    // Deduct materials from inventory
    const player = room.state.players.get(id_me);
    if (player) {
        building.requirements.forEach(req => {
            player.removeInventoryItem(req.material, req.amount);
        });
    }
    
    // Placeholder for building placement logic
    // In a real implementation, you might:
    // 1. Enter a "building placement mode"
    // 2. Show a ghost/preview of the building at the cursor position
    // 3. Let the player click to place the building
    // 4. Send the building placement to the server
    
    // For now, just show a notification that building mode is active
    window.addItemNotification(building.name, 1, PIXI.Assets.get(building.image));
    
    // Show a building placement indicator (this would need to be implemented)
    // activateBuildingPlacement(building);
}
// Building placements
// Initialize the building placement system
function initBuildingPlacementSystem() {
    // Create a dedicated layer for buildings if it doesn't exist
    if (!buildingLayer) {
        buildingLayer = new PIXI.Container();
        buildingLayer.name = "buildingLayer";
        buildingLayer.zIndex = 5; // Adjust based on your layer ordering
        gameLayer.addChild(buildingLayer);
    }
    
    // Set up event listeners for placement
    hitArea.on('pointermove', updateBuildingPreview);
    hitArea.on('pointerdown', attemptBuildingPlacement);
    
    // Add key listener for canceling building mode
    document.addEventListener('keydown', cancelBuildingPlacement);
}

// Activate building placement mode
function activateBuildingPlacement(building) {
    // Exit if already in placement mode
    if (buildingPlacementActive) return;
    
    buildingPlacementActive = true;
    currentBuildingType = building;
    
    // Create the preview object
    currentBuildingPreview = createBuildingPreview(building);
    buildingLayer.addChild(currentBuildingPreview);
    
    // Show instruction to the player
    const instructionText = new PIXI.Text({
        text: "Click to place building. ESC to cancel.",
        style: {
            fontFamily: 'Roboto',
            fontSize: 16,
            fill: 0xFFFFFF,
            align: 'center',
            stroke: 0x000000,
            strokeThickness: 4
        }
    });
    instructionText.anchor.set(0.5);
    instructionText.position.set(window.innerWidth / 2, 40);
    instructionText.name = "buildingInstruction";
    app.stage.addChild(instructionText);
    
    // Change cursor style
    document.body.style.cursor = "crosshair";
}

// Create a visual preview of the building
function createBuildingPreview(building) {
    const container = new PIXI.Container();
    
    // Determine building shape and size
    let isCircular = false;
    let width = GRID_SIZE;
    let height = GRID_SIZE;
    let radius = GRID_SIZE / 2;
    
    switch (building.id) {
        case "wood_wall":
        case "stone_wall":
            // Standard rectangular buildings
            isCircular = false;
            width = GRID_SIZE;
            height = GRID_SIZE;
            break;
        case "campfire":
            // Small circular building
            isCircular = true;
            radius = GRID_SIZE / 2;
            width = GRID_SIZE;  // Keep for compatibility
            height = GRID_SIZE;
            break;
        case "lookout_tower":
            // Larger circular building
            isCircular = true;
            radius = GRID_SIZE;
            width = GRID_SIZE * 2;
            height = GRID_SIZE * 2;
            break;
        case "barricade":
            // Wide rectangular building
            isCircular = false;
            width = GRID_SIZE * 2;
            height = GRID_SIZE / 2;
            break;
        default:
            // Default to square building
            isCircular = false;
            width = GRID_SIZE;
            height = GRID_SIZE;
    }
    
    // Create a rectangle or circle for the building base
    const base = new PIXI.Graphics();
    base.beginFill(0x6c81a1, 0.5); // Semi-transparent blue
    base.lineStyle(2, 0xFFFFFF, 0.8);
    
    if (isCircular) {
        base.drawCircle(0, 0, radius);
    } else {
        base.drawRect(-width/2, -height/2, width, height);
    }
    
    base.endFill();
    container.addChild(base);
    
    // Add building icon
    const icon = new PIXI.Sprite(PIXI.Assets.get(building.image)); 
    icon.anchor.set(0.5);
    icon.scale.set(0.6); // Adjust scale to fit within grid
    container.addChild(icon);
    
    // Store building data
    container.buildingData = {
        id: building.id,
        name: building.name,
        requirements: building.requirements,
        state: BUILDING_STATES.PREVIEW,
        isCircular: isCircular,
        radius: radius,
        width: width,
        height: height
    };
    
    return container;
}

// Update building preview position based on mouse position
function updateBuildingPreview(event) {
    if (!buildingPlacementActive || !currentBuildingPreview) return;
    
    // Get mouse position in world coordinates
    const mouseWorldPos = event.getLocalPosition(gameLayer);
    
    // Get player position
    const player = room.state.players.get(id_me);
    if (!player) return;
    
    // Calculate distance from player
    const distanceFromPlayer = Math.sqrt(
        Math.pow(mouseWorldPos.x - player.x, 2) + 
        Math.pow(mouseWorldPos.y - player.y, 2)
    );
    
    // Check if position is out of range
    if (distanceFromPlayer > MAX_PLACEMENT_RANGE) {
        currentBuildingPreview.getChildAt(0).tint = 0xFF0000; // Red tint indicates invalid
        return;
    }
    
    // Get building data from preview
    const buildingData = currentBuildingPreview.buildingData;
    
    // Snap to grid based on building shape and size
    let snappedX, snappedY;
    
    if (buildingData.isCircular) {
        // For circular buildings, just snap to grid
        snappedX = Math.floor(mouseWorldPos.x / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
        snappedY = Math.floor(mouseWorldPos.y / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
    } else {
        // For rectangular buildings, snap based on width and height
        const gridSizeX = buildingData.width > GRID_SIZE ? GRID_SIZE * 2 : GRID_SIZE;
        const gridSizeY = buildingData.height > GRID_SIZE ? GRID_SIZE * 2 : GRID_SIZE;
        
        snappedX = Math.floor(mouseWorldPos.x / gridSizeX) * gridSizeX + gridSizeX / 2;
        snappedY = Math.floor(mouseWorldPos.y / gridSizeY) * gridSizeY + gridSizeY / 2;
    }
    
    // Update preview position
    currentBuildingPreview.position.set(snappedX, snappedY);
    
    // Check for collision with other buildings or objects
    const isValidPlacement = checkValidPlacement(snappedX, snappedY, buildingData);
    
    // Update preview appearance based on validity
    if (isValidPlacement) {
        currentBuildingPreview.getChildAt(0).tint = 0xFFFFFF; // Normal color
    } else {
        currentBuildingPreview.getChildAt(0).tint = 0xFF0000; // Red tint
    }
}

// Check if the current position is valid for placement
function checkValidPlacement(x, y, buildingData) {
    // Get player position
    const player = room.state.players.get(id_me);
    if (!player) return false;
    
    // Get building dimensions
    const isCircular = buildingData.isCircular;
    const radius = isCircular ? buildingData.radius || GRID_SIZE/2 : null;
    const width = isCircular ? null : buildingData.width || GRID_SIZE;
    const height = isCircular ? null : buildingData.height || GRID_SIZE;
    
    // Don't allow building directly on the player
    const distanceFromPlayer = Math.sqrt(
        Math.pow(x - player.x, 2) + 
        Math.pow(y - player.y, 2)
    );
    
    if (isCircular) {
        if (distanceFromPlayer < player.radius + radius) {
            return false;
        }
    } else {
        // For rectangular buildings, use a rough approximation with the player
        const playerCollisionRadius = player.radius + Math.sqrt(width * width + height * height) / 2;
        if (distanceFromPlayer < playerCollisionRadius) {
            return false;
        }
    }
    
    // Check for existing buildings at this grid position using the findBuildingAt function
    const existingBuilding = findBuildingAt(x, y, buildingData);
    if (existingBuilding) {
        return false;
    }
    
    // Add checks for resources, mobs, or other entities here
    // ...
    
    return true;
}

// Find if there's a building at the specified grid position
function findBuildingAt(x, y, newBuildingData) {
    if (!buildingLayer) return null;
    
    // Check each building in the layer
    for (let i = 0; i < buildingLayer.children.length; i++) {
        const building = buildingLayer.children[i];
        
        // Skip the preview building
        if (building === currentBuildingPreview) continue;
        
        // Get building data
        const buildingData = building.buildingData;
        if (!buildingData) continue;
        
        // Check collision based on shapes
        const isNewCircular = newBuildingData.isCircular;
        const isExistingCircular = buildingData.isCircular;
        
        if (isNewCircular && isExistingCircular) {
            // Circle to circle collision
            const combinedRadius = (newBuildingData.radius || GRID_SIZE/2) + (buildingData.radius || GRID_SIZE/2);
            const distance = Math.sqrt(Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2));
            
            if (distance < combinedRadius) {
                return building;
            }
        } else if (!isNewCircular && !isExistingCircular) {
            // Rectangle to rectangle collision (AABB)
            const newWidth = newBuildingData.width || GRID_SIZE;
            const newHeight = newBuildingData.height || GRID_SIZE;
            const existingWidth = buildingData.width || GRID_SIZE;
            const existingHeight = buildingData.height || GRID_SIZE;
            
            // Calculate half-dimensions
            const newHalfWidth = newWidth / 2;
            const newHalfHeight = newHeight / 2;
            const existingHalfWidth = existingWidth / 2;
            const existingHalfHeight = existingHeight / 2;
            
            // Check for overlap
            if (Math.abs(x - building.x) < newHalfWidth + existingHalfWidth &&
                Math.abs(y - building.y) < newHalfHeight + existingHalfHeight) {
                return building;
            }
        } else {
            // Rectangle to circle collision
            let circleX, circleY, circleRadius;
            let rectX, rectY, rectWidth, rectHeight;
            
            if (isNewCircular) {
                // New building is circular, existing is rectangular
                circleX = x;
                circleY = y;
                circleRadius = newBuildingData.radius || GRID_SIZE/2;
                rectX = building.x;
                rectY = building.y;
                rectWidth = buildingData.width || GRID_SIZE;
                rectHeight = buildingData.height || GRID_SIZE;
            } else {
                // New building is rectangular, existing is circular
                circleX = building.x;
                circleY = building.y;
                circleRadius = buildingData.radius || GRID_SIZE/2;
                rectX = x;
                rectY = y;
                rectWidth = newBuildingData.width || GRID_SIZE;
                rectHeight = newBuildingData.height || GRID_SIZE;
            }
            
            // Check rectangle-circle collision
            const halfWidth = rectWidth / 2;
            const halfHeight = rectHeight / 2;
            
            // Find closest point on rectangle to circle
            const closestX = Math.max(rectX - halfWidth, Math.min(circleX, rectX + halfWidth));
            const closestY = Math.max(rectY - halfHeight, Math.min(circleY, rectY + halfHeight));
            
            // Calculate distance from closest point to circle center
            const distance = Math.sqrt(
                Math.pow(circleX - closestX, 2) + 
                Math.pow(circleY - closestY, 2)
            );
            
            // Collision if distance is less than circle radius
            if (distance < circleRadius) {
                return building;
            }
        }
    }
    
    return null;
}

// Attempt to place the building when clicking
function attemptBuildingPlacement(event) {
    if (!buildingPlacementActive || !currentBuildingPreview) return;
    
    // Only process left clicks for building placement
    if (event.data.button !== 0) return;
    
    // Get building data from preview
    const buildingData = currentBuildingPreview.buildingData;
    
    // Check if the current position is valid
    const isValidPlacement = checkValidPlacement(
        currentBuildingPreview.x, 
        currentBuildingPreview.y,
        buildingData
    );
    
    if (!isValidPlacement) {
        // Play error sound or visual feedback
        return;
    }
    
    // Send request to server with shape and size info
    room.send("placeBuilding", {
        type: buildingData.id,
        x: currentBuildingPreview.x,
        y: currentBuildingPreview.y,
        rotation: 0, // Could add rotation later
        isCircular: buildingData.isCircular,
        width: buildingData.width,
        height: buildingData.height,
        radius: buildingData.radius
    });
    
    // Exit placement mode
    exitBuildingPlacementMode();
}

// Cancel building placement with ESC key
function cancelBuildingPlacement(e) {
    if (e.key === "Escape" && buildingPlacementActive) {
        exitBuildingPlacementMode();
    }
}

// Exit building placement mode
function exitBuildingPlacementMode() {
    if (!buildingPlacementActive) return;
    
    // Remove the preview
    if (currentBuildingPreview) {
        buildingLayer.removeChild(currentBuildingPreview);
        currentBuildingPreview = null;
    }
    
    // Remove instruction text
    const instructionText = app.stage.getChildByName("buildingInstruction");
    if (instructionText) {
        app.stage.removeChild(instructionText);
    }
    
    // Reset state
    buildingPlacementActive = false;
    currentBuildingType = null;
    
    // Reset cursor
    document.body.style.cursor = "auto";
}

// Create a placed building (called when server confirms placement)
function createPlacedBuilding(type, x, y, rotation, buildingId, state = BUILDING_STATES.BUILDING) {
      // Find the building data
  const buildingData = BUILDINGS.find(b => b.id === type);
  if (!buildingData) return null;
  
  // Create container
  const container = new PIXI.Container();
  container.position.set(x, y);
  container.rotation = rotation || 0;
  
  // Determine shape and size based on type
  let baseGraphic;
  let width = GRID_SIZE;
  let height = GRID_SIZE;
  let isCircular = false;
  
  switch (type) {
    case "wood_wall":
    case "stone_wall":
      // Rectangular building
      width = GRID_SIZE;
      height = GRID_SIZE;
      isCircular = false;
      break;
    case "campfire":
      // Circular building
      width = GRID_SIZE;
      height = GRID_SIZE;
      isCircular = true;
      break;
    case "lookout_tower":
      // Large circular building
      width = GRID_SIZE * 2;
      height = GRID_SIZE * 2;
      isCircular = true;
      break;
    case "barricade":
      // Wide rectangular building
      width = GRID_SIZE * 2;
      height = GRID_SIZE / 2;
      isCircular = false;
      break;
    default:
      width = GRID_SIZE;
      height = GRID_SIZE;
      isCircular = false;
  }
  
  // Create the building base visual
  baseGraphic = new PIXI.Graphics();
  if (isCircular) {
    const radius = Math.max(width, height) / 2;
    baseGraphic.beginFill(0x6c81a1);
    baseGraphic.lineStyle(2, 0xFFFFFF, 0.8);
    baseGraphic.drawCircle(0, 0, radius);
    baseGraphic.endFill();
  } else {
    baseGraphic.beginFill(0x6c81a1);
    baseGraphic.lineStyle(2, 0xFFFFFF, 0.8);
    baseGraphic.drawRect(-width/2, -height/2, width, height);
    baseGraphic.endFill();
  }
  
  container.addChild(baseGraphic);
  
  // Add building icon
  const icon = new PIXI.Sprite(PIXI.Assets.get(buildingData.image));
  icon.anchor.set(0.5);
  icon.scale.set(0.6 * (Math.max(width, height) / GRID_SIZE)); // Scale based on size
  container.addChild(icon);
  
  // Add building data
  container.buildingData = {
    id: buildingData.id,
    name: buildingData.name,
    buildingId: buildingId,
    state: state,
    health: 100,
    maxHealth: 100,
    isCircular: isCircular,
    width: width,
    height: height
  };
    
    // If building is in construction state, add visual effects
    if (state === BUILDING_STATES.BUILDING) {
        // Add construction overlay
        const constructionOverlay = new PIXI.Graphics();
        constructionOverlay.beginFill(0xFFFFFF, 0.3);
        constructionOverlay.drawRect(-GRID_SIZE/2, -GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
        constructionOverlay.endFill();
        constructionOverlay.name = "constructionOverlay";
        container.addChild(constructionOverlay);
        
        // Add progress bar
        const progressBar = new PIXI.Graphics();
        progressBar.beginFill(0x00FF00);
        progressBar.drawRect(-GRID_SIZE/2, GRID_SIZE/2 + 5, 0, 5); // Start with 0 width
        progressBar.endFill();
        progressBar.name = "progressBar";
        container.addChild(progressBar);
        
        // Add building animation
        animateBuildingConstruction(container);
    }
    
    // Add health bar (only visible when damaged)
    const healthBar = new PIXI.Graphics();
    if (isCircular) {
      const radius = Math.max(width, height) / 2;
      healthBar.beginFill(0xFF0000);
      healthBar.drawRect(-radius, -radius - 10, radius * 2, 5);
    } else {
      healthBar.beginFill(0xFF0000);
      healthBar.drawRect(-width/2, -height/2 - 10, width, 5);
    }
    healthBar.endFill();
    healthBar.visible = false;
    healthBar.name = "healthBar";
    container.addChild(healthBar);
    
    buildingVisuals.set(buildingId, container);
    // Add to building layer
    buildingLayer.addChild(container);
    
    return container;
}

// Animate building construction
function animateBuildingConstruction(buildingContainer) {
    // Create construction particles
    const particles = new PIXI.Container();
    particles.name = "constructionParticles";
    
    // Create 5 floating particles
    for (let i = 0; i < 5; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(0xFFD700);
        particle.drawCircle(0, 0, 2);
        particle.endFill();
        
        // Random starting position within building
        particle.x = (Math.random() - 0.5) * GRID_SIZE;
        particle.y = (Math.random() - 0.5) * GRID_SIZE;
        
        // Animation properties
        particle.vx = (Math.random() - 0.5) * 2;
        particle.vy = -Math.random() * 2 - 1;
        particle.alpha = 0.7 + Math.random() * 0.3;
        
        particles.addChild(particle);
    }
    
    buildingContainer.addChild(particles);
    
    // Setup animation on ticker
    const animate = (delta) => {
        if (!buildingContainer || buildingContainer.buildingData.state !== BUILDING_STATES.BUILDING) {
            // Remove animation if building no longer exists or is completed
            app.ticker.remove(animate);
            return;
        }
        
        // Animate each particle
        for (let i = 0; i < particles.children.length; i++) {
            const particle = particles.children[i];
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha -= 0.01;
            
            // Reset particle if it fades out or moves too far
            if (particle.alpha <= 0 || 
                Math.abs(particle.x) > GRID_SIZE/2 || 
                Math.abs(particle.y) > GRID_SIZE/2) {
                
                particle.x = (Math.random() - 0.5) * GRID_SIZE * 0.8;
                particle.y = (Math.random() - 0.5) * GRID_SIZE * 0.8;
                particle.alpha = 0.7 + Math.random() * 0.3;
            }
        }
        
        // Pulse the overlay for construction effect
        const overlay = buildingContainer.getChildByName("constructionOverlay");
        if (overlay) {
            overlay.alpha = 0.3 + Math.sin(Date.now() / 200) * 0.1;
        }
    };
    
    app.ticker.add(animate);
}

// Update building construction progress
function updateBuildingProgress(buildingId, progress) {
    const building = findBuildingById(buildingId);
    if (!building) return;
    
    const progressBar = building.getChildByName("progressBar");
    if (progressBar) {
        // Update progress bar width
        progressBar.clear();
        progressBar.beginFill(0x00FF00);
        progressBar.drawRect(-GRID_SIZE/2, GRID_SIZE/2 + 5, GRID_SIZE * progress, 5);
        progressBar.endFill();
    }
    
    // If construction is complete
    if (progress >= 1) {
        completeBuildingConstruction(building);
    }
}

// Complete building construction
function completeBuildingConstruction(building) {
    if (!building || building.buildingData.state !== BUILDING_STATES.BUILDING) return;
    
    // Update building state
    building.buildingData.state = BUILDING_STATES.COMPLETE;
    
    // Remove construction visuals
    const overlay = building.getChildByName("constructionOverlay");
    const progressBar = building.getChildByName("progressBar");
    const particles = building.getChildByName("constructionParticles");
    
    if (overlay) building.removeChild(overlay);
    if (progressBar) building.removeChild(progressBar);
    if (particles) building.removeChild(particles);
    
    // Update appearance for completed building
    const base = building.getChildAt(0);
    if (base) {
        base.clear();
        base.beginFill(0x6c81a1);
        base.lineStyle(3, 0xFFFFFF, 1);
        base.drawRect(-GRID_SIZE/2, -GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
        base.endFill();
    }
    
    // Add completion effect
    createCompletionEffect(building);
}

// Create a visual effect when building is completed
function createCompletionEffect(building) {
    // Create a flash effect
    const flash = new PIXI.Graphics();
    flash.beginFill(0xFFFFFF);
    flash.drawRect(-GRID_SIZE/2, -GRID_SIZE/2, GRID_SIZE, GRID_SIZE);
    flash.endFill();
    flash.alpha = 0.8;
    building.addChild(flash);
    
    // Animate the flash to fade out
    let fadeOut = (delta) => {
        flash.alpha -= 0.05;
        if (flash.alpha <= 0) {
            flash.alpha = 0;
            building.removeChild(flash);
            app.ticker.remove(fadeOut);
        }
    };
    
    app.ticker.add(fadeOut);
}

// Find a building by its server ID
function findBuildingById(buildingId) {
    return buildingVisuals.get(buildingId) || null;
}

// Update building health (when damaged)
function updateBuildingHealth(buildingId, health, maxHealth) {
    const building = findBuildingById(buildingId);
    if (!building) return;
    
    // Update stored health value
    building.buildingData.health = health;
    building.buildingData.maxHealth = maxHealth || building.buildingData.maxHealth;
    
    // Update health bar
    const healthBar = building.getChildByName("healthBar");
    if (healthBar) {
        const healthPercent = health / building.buildingData.maxHealth;
        
        // Only show health bar if damaged
        healthBar.visible = healthPercent < 1;
        
        // Update health bar appearance
        healthBar.clear();
        healthBar.beginFill(healthPercent > 0.5 ? 0x00FF00 : healthPercent > 0.25 ? 0xFFFF00 : 0xFF0000);
        healthBar.drawRect(-GRID_SIZE/2, -GRID_SIZE/2 - 10, GRID_SIZE * healthPercent, 5);
        healthBar.endFill();
    }
    
    // Visual feedback for damage
    if (building.lastHealth && building.lastHealth > health) {
        // Create damage effect
        createDamageEffect(building);
    }
    
    // Store last health for comparison
    building.lastHealth = health;
    
    // Check if building is destroyed
    if (health <= 0) {
        destroyBuilding(building);
    }
}

// Create visual effect for building damage
function createDamageEffect(building) {
    // Flash red
    building.getChildAt(0).tint = 0xFF0000;
    
    // Reset tint after a short delay
    setTimeout(() => {
        if (building && building.getChildAt(0)) {
            building.getChildAt(0).tint = 0xFFFFFF;
        }
    }, 100);
    
    // Add debris particles
    const particles = new PIXI.Container();
    
    for (let i = 0; i < 5; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(0x808080);
        particle.drawRect(-2, -2, 4, 4);
        particle.endFill();
        
        // Random position, velocity, and rotation
        particle.x = (Math.random() - 0.5) * GRID_SIZE;
        particle.y = (Math.random() - 0.5) * GRID_SIZE;
        particle.vx = (Math.random() - 0.5) * 5;
        particle.vy = (Math.random() - 0.5) * 5;
        particle.rotation = Math.random() * Math.PI * 2;
        particle.rotationSpeed = (Math.random() - 0.5) * 0.2;
        
        particles.addChild(particle);
    }
    
    building.addChild(particles);
    
    // Animate particles
    let animateDebris = (delta) => {
        particles.children.forEach((particle, i) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.rotation += particle.rotationSpeed;
            particle.alpha -= 0.02;
            
            if (particle.alpha <= 0) {
                particles.removeChildAt(i);
            }
        });
        
        if (particles.children.length === 0) {
            building.removeChild(particles);
            app.ticker.remove(animateDebris);
        }
    };
    
    app.ticker.add(animateDebris);
}

// Destroy a building
function destroyBuilding(building) {
    if (!building) return;
    
    // Create destruction effect
    createDestructionEffect(building.x, building.y);
    
    // Remove from scene
    if (buildingLayer.contains(building)) {
        buildingLayer.removeChild(building);
    }
}

// Create destruction effect when building is destroyed
function createDestructionEffect(x, y) {
    // Create explosion container
    const explosion = new PIXI.Container();
    explosion.position.set(x, y);
    buildingLayer.addChild(explosion);
    
    // Create flash
    const flash = new PIXI.Graphics();
    flash.beginFill(0xFFFFFF);
    flash.drawCircle(0, 0, GRID_SIZE);
    flash.endFill();
    flash.alpha = 0.8;
    explosion.addChild(flash);
    
    // Create debris particles
    for (let i = 0; i < 20; i++) {
        const debris = new PIXI.Graphics();
        debris.beginFill(0x808080);
        
        // Random shape for each debris
        if (Math.random() > 0.5) {
            debris.drawRect(-3, -3, 6, 6);
        } else {
            debris.drawCircle(0, 0, 3);
        }
        
        debris.endFill();
        
        // Random position, velocity and rotation
        debris.x = (Math.random() - 0.5) * 20;
        debris.y = (Math.random() - 0.5) * 20;
        debris.vx = (Math.random() - 0.5) * 10;
        debris.vy = (Math.random() - 0.5) * 10 - 5; // Upward bias
        debris.rotation = Math.random() * Math.PI * 2;
        debris.rotationSpeed = (Math.random() - 0.5) * 0.3;
        debris.alpha = 0.9;
        
        explosion.addChild(debris);
    }
    
    // Animate explosion
    let animateExplosion = (delta) => {
        // Flash fading
        if (flash) {
            flash.alpha -= 0.1;
            if (flash.alpha <= 0) {
                explosion.removeChild(flash);
                flash.destroy();
            }
        }
        
        // Animate each debris
        explosion.children.forEach((debris, i) => {
            if (i === 0 && debris === flash) return; // Skip flash
            
            debris.x += debris.vx;
            debris.y += debris.vy;
            debris.vy += 0.2; // Gravity
            debris.rotation += debris.rotationSpeed;
            debris.alpha -= 0.01;
            
            // Remove faded debris
            if (debris.alpha <= 0) {
                explosion.removeChildAt(i);
            }
        });
        
        // Remove explosion when all particles are gone
        if (explosion.children.length === 0) {
            buildingLayer.removeChild(explosion);
            app.ticker.remove(animateExplosion);
        }
    };
    
    app.ticker.add(animateExplosion);
}

// Modify the build function to start building placement
function buildItem(buildingId) {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return;
    
    // Close the building UI
    toggleBuildingUI(false);
    
    // Activate building placement mode
    activateBuildingPlacement(building);
}
    //critical render functions
}

//some animation

//idle animation
function playeridle(playerContainer,seed,ruse){
    const speed = 7;
    const maxAngle = 0.02;
    const time = performance.now() / 1000; // Get time in seconds
    const angle = maxAngle * Math.sin(time * speed+seed); 
    if(!ruse){
    const left_shoulder = playerContainer.getChildByName('left_shoulder')
    left_shoulder.rotation += (angle-left_shoulder.rotation)*0.2;
    const left_arm = playerContainer.getChildByName('left_arm')
    left_arm.rotation += (angle-left_arm.rotation)*0.2;
    const right_shoulder = playerContainer.getChildByName('right_shoulder')
    right_shoulder.rotation += (-angle-right_shoulder.rotation)*0.2;
    const right_arm = playerContainer.getChildByName('right_arm')
    right_arm.rotation += (angle-right_arm.rotation)*0.2;
    right_arm.x += -right_arm.x*0.2;
   // playerContainer.getChildByName('right').anchor.set(0,0);
    const right = playerContainer.getChildByName('right')
    right.rotation += (-angle-right.rotation)*0.2;
    right.y += (-20 - Math.sin(time * speed)-right.y)*0.2
    right.x += (49-right.x)*0.2
    const left = playerContainer.getChildByName('left')
    left.rotation += (-angle-left.rotation)*0.2;
    left.y += (-20 - Math.sin(time * speed)-left.y)*0.2
    left.x += (-49 - left.x)*0.2
    const cape = playerContainer.getChildByName('cape')
    cape.y += (1+Math.sin(time*speed)/2-cape.y)*0.2;
    cape.rotation += -cape.rotation*0.2
    }
    playerContainer.getChildByName('left_foot').y += (3 - playerContainer.getChildByName('left_foot').y)*0.1;
    playerContainer.getChildByName('right_foot').y += (3 - playerContainer.getChildByName('right_foot').y)*0.1;
        

}

//idle animation
function playerWalk(playerContainer,ruse){
    const speed = 8;
    const maxAngle = 0.08;
    const time = performance.now() / 1000; // Get time in seconds
    const angle = maxAngle * Math.sin(time * speed); 
    playerContainer.getChildByName('left_foot').y = 13+Math.sin(time*speed)*18;
    playerContainer.getChildByName('right_foot').y = 13-Math.sin(time*speed)*18;
    if(!ruse){
    playerContainer.getChildByName('left_shoulder').rotation = angle;
    playerContainer.getChildByName('left_arm').rotation = angle;
    playerContainer.getChildByName('right_shoulder').rotation = angle;
    playerContainer.getChildByName('right_arm').rotation = angle;
    const right_arm = playerContainer.getChildByName('right_arm');
    right_arm.rotation += (angle-right_arm.rotation)*0.2 ;
    right_arm.x -= right_arm.x*0.2;
    playerContainer.getChildByName('cape').rotation = -angle/4;
    const right = playerContainer.getChildByName('right');
    right.x += (49-right.x)*0.2;
    right.rotation += (-angle+0.1-right.rotation)*0.2;
    right.y += (-20 + Math.sin(time * speed)*4- right.y)*0.2;
    const left = playerContainer.getChildByName('left');
    left.rotation += (angle-left.rotation)*0.2;
    left.y = -20 - Math.sin(time * speed)*4;
    left.x = -49
    }       
}
function playerSwing(playerContainer,atime){
    
    let time = ((30 - atime)/30)**(0.9);
    if(time<0.3){
        const right_shoulder =  playerContainer.getChildByName('right_shoulder')
        right_shoulder.rotation += (0.6-right_shoulder.rotation)*0.4
        const left_shoulder = playerContainer.getChildByName('left_shoulder')
        left_shoulder.rotation += (0.75 - left_shoulder.rotation)*0.4
        const left_arm = playerContainer.getChildByName('left_arm')
        left_arm.rotation += (0.6 - left_arm.rotation)*0.4
        const cape = playerContainer.getChildByName('cape')
        cape.rotation += (0.3 - cape.rotation)*0.4
        const r_arm =playerContainer.getChildByName('right_arm');
        r_arm.x += (20-r_arm.x)*0.4
        r_arm.rotation += (0.75-r_arm.rotation)*0.4
        const right = playerContainer.getChildByName('right');
        right.y += (22-right.y)*0.4
        right.x += (74-right.x)*0.4
        right.rotation += (3-right.rotation)*0.7
        const left = playerContainer.getChildByName('left');
        left.rotation += (0.4-left.rotation)*0.4
        left.y += (-44 - left.y)*0.4
        left.x += (-36 - left.x)*0.4
    }else{
        
    time = (time-0.3)*1.42857142857
    playerContainer.getChildByName('right_shoulder').rotation = 0.6-time*0.6*1.8;
    playerContainer.getChildByName('left_shoulder').rotation = 0.75-time*0.75*1.8;
    playerContainer.getChildByName('left_arm').rotation = 0.6-time*0.6*1.7;
    playerContainer.getChildByName('cape').rotation = 0.3-time*0.3*1.7;
    const r_arm =playerContainer.getChildByName('right_arm');
    r_arm.x = 20-time*20*1.7;
    r_arm.rotation = 0.75-time*0.75*1.7;
    const right = playerContainer.getChildByName('right');
    right.y = 22-42*time*1.6;
    right.x = 74-25*time*2.0;
    right.rotation = 2.8-3.2*time;
    const left = playerContainer.getChildByName('left');
    left.rotation = 0.4-0.4*time*1.8
    left.y = -44+24*time*2
    left.x = -36-13*time*1.8
    
    }
}
function playerhit(playerContainer,atime){
    let time = ((30 - atime)/30)**(2)
    if(time>0.3){
    const r_shoulder = playerContainer.getChildByName('right_shoulder')
    r_shoulder.rotation = 0.4-time*0.4*1.4;
    const l_shoulder = playerContainer.getChildByName('left_shoulder')
    l_shoulder.rotation = 0.45-time*0.45*1.4;
    const l_arm = playerContainer.getChildByName('left_arm')
    l_arm.rotation = 0.4-time*0.6*1.3;
    const cape = playerContainer.getChildByName('cape')
    cape.rotation = 0.2-time*0.2*1.3;
    const r_arm =playerContainer.getChildByName('right_arm');
    r_arm.x = 5-time*5*1.7;
    r_arm.rotation = 0.75-time*0.75*1.7;
    const right = playerContainer.getChildByName('right');
    right.y = 22-42*time*1.8;
    right.x = 59-10*time*2.0;
    right.rotation = -0.1+0.2*time;
    const left = playerContainer.getChildByName('left');
    left.rotation = 0.4-0.4*time*1.8
    left.y = -44+24*time*2
    left.x = -36-13*time*1.8
    }else{
        time = (time-0.3)*1.42857142857
        const r_shoulder = playerContainer.getChildByName('right_shoulder')
    r_shoulder.rotation = 0.4-time*0.4*1.4;
    const l_shoulder = playerContainer.getChildByName('left_shoulder')
    l_shoulder.rotation = 0.45-time*0.45*1.4;
    const l_arm = playerContainer.getChildByName('left_arm')
    l_arm.rotation = 0.4-time*0.6*1.3;
    const cape = playerContainer.getChildByName('cape')
    cape.rotation = 0.2-time*0.2*1.3;
    const r_arm =playerContainer.getChildByName('right_arm');
    r_arm.x = 5-time*5*1.7;
    r_arm.rotation = 0.75-time*0.75*1.7;
    const right = playerContainer.getChildByName('right');
    right.y = 22-42*time*1.0;
    right.x = 59-10*time*0.5;
    right.rotation = -0.1+0.2*time;
    const left = playerContainer.getChildByName('left');
    left.rotation = 0.4-0.4*time*1.8
    left.y = -40+24*time*1.25
    left.x = -36-13*time*1.8
    
    }

}
function playerpickup(playerContainer,atime){
    let time = ((30 - atime)/30)**(2)
    playerContainer.getChildByName('left_shoulder').rotation = 0.45-time*0.45*1.4;
    playerContainer.getChildByName('left_arm').rotation = 0.4-time*0.6*1.3;
    playerContainer.getChildByName('cape').rotation = 0.2-time*0.2*1.3;
    const left = playerContainer.getChildByName('left');
    left.rotation = 0.4-0.4*time*1.8
    left.y = -44+24*time*2
    left.x = -36-13*time*1.8

}
function waitForPlayerPosition() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds max at 100ms intervals
        
        const interval = setInterval(() => {
            attempts++;
            let player = room.state.players.get(room.sessionId);
            
            if (player && player.x !== undefined && player.y !== undefined) {
                clearInterval(interval);  // Stop checking
                console.log("Found player position:", player.x, player.y);
                resolve(player);  // Resolve the promise with the player
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error("Timeout waiting for player position"));
            }
        }, 100);  // Check every 100ms until the player's position is available
    });
}

function disableZoom() {
    // Prevent pinch zoom
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    // Prevent ctrl+wheel zoom
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Prevent ctrl+plus/minus zoom
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
            e.preventDefault();
        }
    });
}



// Add death message function
function showDeathMessage() {
    // Create death message overlay
    const deathMessage = document.createElement("div");
    deathMessage.style.position = "absolute";
    deathMessage.style.top = "40%";
    deathMessage.style.left = "50%";
    deathMessage.style.transform = "translate(-50%, -50%)";
    deathMessage.style.padding = "20px";
    deathMessage.style.backgroundColor = "rgba(64, 82, 115, 0.85)";
    deathMessage.style.color = "#f1f6f0";
    deathMessage.style.borderRadius = "10px";
    deathMessage.style.textAlign = "center";
    deathMessage.style.fontFamily = "'Roboto', sans-serif";
    deathMessage.style.fontWeight = "bold";
    deathMessage.style.fontSize = "24px";
    deathMessage.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.5)";
    deathMessage.style.border = "5px solid rgba(253, 209, 121, 0.3)";
    deathMessage.style.zIndex = "1000";
    
    deathMessage.innerHTML = `
        <h2 style="color: #fdd179; margin-top: 0;">You Died!</h2>
        <p>Your items have been dropped at your death location.</p>
        <p>Hit play to resawn</p>
    `;
    
    document.body.appendChild(deathMessage);
    
    // Remove the message after 5 seconds
    setTimeout(() => {
        document.body.removeChild(deathMessage);
    }, 5000);
}