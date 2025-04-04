
export class SpatialHashing {
    cellSize: number;
    hashTable: { [key: string]: Set<any>}; 
    constructor(cellSize: number){
        this.cellSize = cellSize
        this.hashTable = {}; 
    }

    getCellKey(x: number, y: number): string{
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`
    }
    addEntity(entity:any): void{
        const key = this.getCellKey(entity.x, entity.y)
        if (!this.hashTable[key]){
            this.hashTable[key] = new Set();
        }
        this.hashTable[key].add(entity);
    }
    removeEntity(entity: any): void{
        const key = this.getCellKey(entity.x, entity.y);
        const cellEntities = this.hashTable[key];
        if (cellEntities){
            cellEntities.delete(entity);
            if (cellEntities.size === 0){
                delete this.hashTable[key];
                if (cellEntities.size === 0){
                    delete this.hashTable[key];
                }
            }
        }
    }
    

    getNearbyEntities(x: number, y:number): Set<any> {
        const NearbyEntities = new Set<any>();
        const cellKey = this.getCellKey(x,y);

        for(let offsetX = -1; offsetX <= 1; offsetX++){
            for (let offsetY = -1; offsetY <= 1; offsetY++){
                const neighborKey = this.getCellKey(x + offsetX * this.cellSize, y + offsetY * this.cellSize);
                const cellEntities = this.hashTable[neighborKey];
                if (cellEntities){
                    cellEntities.forEach(entity => NearbyEntities.add(entity));
                }
            }
        }
        return NearbyEntities;
    }
}