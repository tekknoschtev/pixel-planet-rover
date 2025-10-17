/**
 * SpatialHashGrid
 *
 * Efficient spatial partitioning system for collision detection and spatial queries.
 * Reduces O(n) collision checks to O(k) where k is number of objects in a cell.
 *
 * Usage:
 *   const grid = new SpatialHashGrid({ x: -100, y: -100, z: -100 }, { x: 100, y: 100, z: 100 }, 10);
 *   grid.insert(object, position);
 *   const nearby = grid.getNearby(position, radius);
 */

class SpatialHashGrid {
    /**
     * Create a spatial hash grid
     * @param {object} boundsMin - Minimum bounds {x, y, z}
     * @param {object} boundsMax - Maximum bounds {x, y, z}
     * @param {number} cellSize - Size of each grid cell
     */
    constructor(boundsMin, boundsMax, cellSize = 10) {
        this.boundsMin = boundsMin;
        this.boundsMax = boundsMax;
        this.cellSize = cellSize;

        // Calculate grid dimensions
        this.width = Math.ceil((boundsMax.x - boundsMin.x) / cellSize);
        this.height = Math.ceil((boundsMax.y - boundsMin.y) / cellSize);
        this.depth = Math.ceil((boundsMax.z - boundsMin.z) / cellSize);

        // Hash table for cells
        this.cells = new Map();

        // Track all objects
        this.objects = new Map(); // object -> {position, cellCoords}

        if (this.width * this.height * this.depth > 1000000) {
            console.warn(
                '[SpatialHashGrid] Grid dimensions very large:',
                this.width,
                'x',
                this.height,
                'x',
                this.depth
            );
        }
    }

    /**
     * Get hash key for cell coordinates
     * @private
     */
    _getCellKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    /**
     * Get cell coordinates for a position
     * @private
     */
    _getCellCoords(position) {
        const x = Math.floor((position.x - this.boundsMin.x) / this.cellSize);
        const y = Math.floor((position.y - this.boundsMin.y) / this.cellSize);
        const z = Math.floor((position.z - this.boundsMin.z) / this.cellSize);

        // Clamp to bounds
        return {
            x: Math.max(0, Math.min(x, this.width - 1)),
            y: Math.max(0, Math.min(y, this.height - 1)),
            z: Math.max(0, Math.min(z, this.depth - 1)),
        };
    }

    /**
     * Insert an object at a position
     * @param {object} obj - The object to insert
     * @param {object} position - Position {x, y, z}
     */
    insert(obj, position) {
        const coords = this._getCellCoords(position);
        const key = this._getCellKey(coords.x, coords.y, coords.z);

        // Create cell if needed
        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }

        // Add to cell
        this.cells.get(key).push(obj);

        // Track object
        this.objects.set(obj, { position: { ...position }, cellCoords: coords });
    }

    /**
     * Update object position (remove from old cell, insert to new)
     * @param {object} obj
     * @param {object} newPosition
     */
    update(obj, newPosition) {
        this.remove(obj);
        this.insert(obj, newPosition);
    }

    /**
     * Remove an object from the grid
     * @param {object} obj
     */
    remove(obj) {
        if (!this.objects.has(obj)) {
            return;
        }

        const { cellCoords } = this.objects.get(obj);
        const key = this._getCellKey(cellCoords.x, cellCoords.y, cellCoords.z);

        if (this.cells.has(key)) {
            const cell = this.cells.get(key);
            const index = cell.indexOf(obj);
            if (index >= 0) {
                cell.splice(index, 1);
            }

            // Remove empty cells to save memory
            if (cell.length === 0) {
                this.cells.delete(key);
            }
        }

        this.objects.delete(obj);
    }

    /**
     * Get all objects near a position within a radius
     * @param {object} position - Query position {x, y, z}
     * @param {number} radius - Search radius
     * @returns {array} Array of objects in nearby cells
     */
    getNearby(position, radius) {
        const cellRadius = Math.ceil(radius / this.cellSize);
        const centerCoords = this._getCellCoords(position);

        const nearby = [];
        const visited = new Set();

        // Check all cells within radius
        for (let x = centerCoords.x - cellRadius; x <= centerCoords.x + cellRadius; x++) {
            for (let y = centerCoords.y - cellRadius; y <= centerCoords.y + cellRadius; y++) {
                for (let z = centerCoords.z - cellRadius; z <= centerCoords.z + cellRadius; z++) {
                    // Skip out of bounds
                    if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) {
                        continue;
                    }

                    const key = this._getCellKey(x, y, z);
                    if (this.cells.has(key)) {
                        for (const obj of this.cells.get(key)) {
                            if (!visited.has(obj)) {
                                nearby.push(obj);
                                visited.add(obj);
                            }
                        }
                    }
                }
            }
        }

        return nearby;
    }

    /**
     * Get objects in a specific cell
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {array}
     */
    getCell(x, y, z) {
        const key = this._getCellKey(x, y, z);
        return this.cells.has(key) ? this.cells.get(key) : [];
    }

    /**
     * Clear all objects from the grid
     */
    clear() {
        this.cells.clear();
        this.objects.clear();
    }

    /**
     * Get statistics about the grid
     * @returns {object}
     */
    getStats() {
        let totalObjects = 0;
        let filledCells = 0;
        let maxObjectsInCell = 0;

        for (const cell of this.cells.values()) {
            totalObjects += cell.length;
            filledCells++;
            maxObjectsInCell = Math.max(maxObjectsInCell, cell.length);
        }

        return {
            totalGridCells: this.width * this.height * this.depth,
            filledCells,
            totalObjects,
            maxObjectsInCell,
            averageObjectsPerCell: filledCells > 0 ? (totalObjects / filledCells).toFixed(2) : 0,
            gridDimensions: { width: this.width, height: this.height, depth: this.depth },
            cellSize: this.cellSize,
        };
    }

    /**
     * Find objects that match a predicate within a radius
     * More efficient than filtering getNearby results
     * @param {object} position
     * @param {number} radius
     * @param {function} predicate - Function to test objects
     * @returns {array}
     */
    getNearbyFiltered(position, radius, predicate) {
        const nearby = this.getNearby(position, radius);
        return nearby.filter(predicate);
    }

    /**
     * Count objects nearby without creating array
     * @param {object} position
     * @param {number} radius
     * @returns {number}
     */
    countNearby(position, radius) {
        return this.getNearby(position, radius).length;
    }

    /**
     * Find closest object to a position within radius
     * @param {object} position
     * @param {number} radius
     * @param {function} distance - Function to calculate distance between two objects
     * @returns {object|null}
     */
    findNearest(position, radius, distance) {
        const nearby = this.getNearby(position, radius);

        let nearest = null;
        let minDistance = radius;

        for (const obj of nearby) {
            const dist = distance(obj, position);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = obj;
            }
        }

        return nearest;
    }

    /**
     * Rebuild the grid from scratch
     * Useful if many objects have moved
     * @param {array} objects - Array of {object, position} pairs
     */
    rebuild(objects) {
        this.clear();
        for (const { object, position } of objects) {
            this.insert(object, position);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpatialHashGrid;
}
