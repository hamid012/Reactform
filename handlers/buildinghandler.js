"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildingHandler = void 0;
const getuniqueid_1 = require("../utils/getuniqueid"); // Import the getUniqueId function to generate unique IDs for buildings
const building_1 = require("../types/building"); // Import the Building class for building entities
const utilityhandlers_1 = require("./utilityhandlers");
const resource_1 = require("../types/resource"); // Import the Resource class for resources like trees, ores, etc.
class buildingHandler extends utilityhandlers_1.utility {
    constructor(room) {
        // Call the parent constructor with the room parameter
        super(room);
        // Any additional initialization specific to buildingHandler goes here
    }
    handlePlaceBuilding(client, message) {
        const player = this.state.players.get(client.sessionId);
        if (!player)
            return;
        // Check if player has the required materials
        if (!this.playerHasRequiredMaterials(player, message.type)) {
            // Send error message to client
            client.send("buildingError", { message: "You don't have the required materials!" });
            return;
        }
        // Check if position is valid
        if (!this.isValidBuildingPosition(message.x, message.y, message.type)) {
            // Send error message to client
            client.send("buildingError", { message: "Invalid building position!" });
            return;
        }
        // Deduct materials
        this.deductBuildingMaterials(player, message.type);
        // Create building
        const buildingId = (0, getuniqueid_1.getUniqueId)();
        const building = new building_1.Building(buildingId, message.type, message.x, message.y, message.rotation, client.sessionId, this.state.Hash);
        // Add to state
        this.state.buildings.set(buildingId, building);
        // Set a timer to complete construction
        building.buildTimer = setTimeout(() => {
            // Safety check - make sure building still exists
            const existingBuilding = this.state.buildings.get(buildingId);
            if (existingBuilding) {
                existingBuilding.completeConstruction();
            }
        }, building.buildTime * 1000);
        // Acknowledge successful placement to client
    }
    playerHasRequiredMaterials(player, buildingType) {
        // Get building requirements
        const requirements = this.getBuildingRequirements(buildingType);
        // Check if player has all required materials
        for (const req of requirements) {
            const playerHas = player.getQuantity(req.material);
            if (playerHas < req.amount) {
                return false;
            }
        }
        return true;
    }
    isValidBuildingPosition(x, y, buildingType) {
        // Get building dimensions
        const buildingDetails = this.getBuildingDetails(buildingType);
        // Check for collisions with other buildings or entities
        const nearbyEntities = this.state.Hash.getNearbyEntities(x, y);
        for (const entity of nearbyEntities) {
            // Skip entities without collision properties
            if (!entity.radius && !(entity instanceof building_1.Building))
                continue;
            if (entity instanceof building_1.Building) {
                // Building-to-building collision
                if (entity.collisionShape === "circle" && buildingDetails.collisionShape === "circle") {
                    // Circle-to-circle
                    const distance = Math.sqrt((x - entity.x) ** 2 + (y - entity.y) ** 2);
                    if (distance < entity.radius + buildingDetails.radius) {
                        return false;
                    }
                }
                else if (entity.collisionShape === "rectangle" && buildingDetails.collisionShape === "rectangle") {
                    // Rectangle-to-rectangle (AABB)
                    if (Math.abs(x - entity.x) < (entity.width + buildingDetails.width) / 2 &&
                        Math.abs(y - entity.y) < (entity.height + buildingDetails.height) / 2) {
                        return false;
                    }
                }
                else {
                    // One is circle, one is rectangle
                    if (buildingDetails.collisionShape === "circle") {
                        // Building being placed is circle, entity is rectangle
                        if (entity.checkRectangleCircleCollision(x, y, buildingDetails.radius)) {
                            return false;
                        }
                    }
                    else {
                        // Building being placed is rectangle, entity is circle
                        // Create a temporary building for collision check
                        const tempBuilding = {
                            x: x,
                            y: y,
                            width: buildingDetails.width,
                            height: buildingDetails.height,
                            checkRectangleCircleCollision: function (cx, cy, cr) {
                                const halfWidth = this.width / 2;
                                const halfHeight = this.height / 2;
                                const closestX = Math.max(this.x - halfWidth, Math.min(cx, this.x + halfWidth));
                                const closestY = Math.max(this.y - halfHeight, Math.min(cy, this.y + halfHeight));
                                const distanceX = cx - closestX;
                                const distanceY = cy - closestY;
                                return (distanceX * distanceX + distanceY * distanceY) <= cr * cr;
                            }
                        };
                        if (tempBuilding.checkRectangleCircleCollision(entity.x, entity.y, entity.radius)) {
                            return false;
                        }
                    }
                }
            }
            else if (entity instanceof resource_1.Resource) {
                // Resource collision (assuming resources have circular collision)
                if (buildingDetails.collisionShape === "circle") {
                    // Circle-to-circle
                    const distance = Math.sqrt((x - entity.x) ** 2 + (y - entity.y) ** 2);
                    if (distance < entity.radius + buildingDetails.radius) {
                        return false;
                    }
                }
                else {
                    // Rectangle-to-circle
                    const tempBuilding = {
                        x: x,
                        y: y,
                        width: buildingDetails.width,
                        height: buildingDetails.height,
                        checkRectangleCircleCollision: function (cx, cy, cr) {
                            const halfWidth = this.width / 2;
                            const halfHeight = this.height / 2;
                            const closestX = Math.max(this.x - halfWidth, Math.min(cx, this.x + halfWidth));
                            const closestY = Math.max(this.y - halfHeight, Math.min(cy, this.y + halfHeight));
                            const distanceX = cx - closestX;
                            const distanceY = cy - closestY;
                            return (distanceX * distanceX + distanceY * distanceY) <= cr * cr;
                        }
                    };
                    if (tempBuilding.checkRectangleCircleCollision(entity.x, entity.y, entity.radius)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    getBuildingDetails(buildingType) {
        const GRID_SIZE = 64;
        switch (buildingType) {
            case "wood_wall":
            case "stone_wall":
                return {
                    collisionShape: "rectangle",
                    width: GRID_SIZE,
                    height: GRID_SIZE,
                    radius: GRID_SIZE / 2
                };
            case "campfire":
                return {
                    collisionShape: "circle",
                    radius: GRID_SIZE / 2,
                    width: GRID_SIZE,
                    height: GRID_SIZE
                };
            case "lookout_tower":
                return {
                    collisionShape: "circle",
                    radius: GRID_SIZE,
                    width: GRID_SIZE * 2,
                    height: GRID_SIZE * 2
                };
            case "barricade":
                return {
                    collisionShape: "rectangle",
                    width: GRID_SIZE * 2,
                    height: GRID_SIZE / 2,
                    radius: GRID_SIZE / 2
                };
            default:
                return {
                    collisionShape: "circle",
                    radius: GRID_SIZE / 2,
                    width: GRID_SIZE,
                    height: GRID_SIZE
                };
        }
    }
    getBuildingRequirements(buildingType) {
        // This should match the requirements in your client-side BUILDINGS array
        switch (buildingType) {
            case "wood_wall":
                return [{ material: "wood", amount: 10 }];
            case "stone_wall":
                return [
                    { material: "stone", amount: 15 },
                    { material: "wood", amount: 5 }
                ];
            case "wooden_door":
                return [{ material: "wood", amount: 12 }];
            case "wooden_chest":
                return [{ material: "wood", amount: 25 }];
            case "campfire":
                return [
                    { material: "wood", amount: 8 },
                    { material: "stone", amount: 4 }
                ];
            // Add other building types
            default:
                return [{ material: "wood", amount: 5 }];
        }
    }
    deductBuildingMaterials(player, buildingType) {
        const requirements = this.getBuildingRequirements(buildingType);
        for (const req of requirements) {
            player.removeInventoryItem(req.material, req.amount);
        }
    }
    updateBuildings(deltaTime) {
        this.state.buildings.forEach((building, id) => {
            // Update building construction progress
            if (building.isBuilding) {
                building.updateConstruction(deltaTime);
            }
        });
    }
    dropBuildingResources(buildingType, x, y) {
        // Determine what resources to drop based on building type
        let resources = [];
        switch (buildingType) {
            case "wood_wall":
                resources.push({ name: "wood", quantity: Math.floor(Math.random() * 3) + 2 }); // 2-4 wood
                break;
            case "stone_wall":
                resources.push({ name: "stone", quantity: Math.floor(Math.random() * 3) + 2 });
                resources.push({ name: "wood", quantity: Math.floor(Math.random() * 2) + 1 });
                break;
            case "wooden_door":
                resources.push({ name: "wood", quantity: Math.floor(Math.random() * 4) + 3 });
                break;
            // Add other building types
            default:
                resources.push({ name: "wood", quantity: 1 });
        }
        // Create items for each resource drop
        resources.forEach(resource => {
            // Use your existing createItemAtValidPosition function
            this.createItemAtValidPosition(x, y, this.state.Hash, resource.name, {
                exactQuantity: resource.quantity
            });
        });
    }
}
exports.buildingHandler = buildingHandler;
