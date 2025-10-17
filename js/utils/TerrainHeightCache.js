/**
 * TerrainHeightCache
 *
 * Caches terrain height queries to avoid expensive raycasting operations.
 * Significantly improves performance for physics calculations that query terrain height repeatedly.
 *
 * Instead of raycasting every frame, we:
 * 1. Cache results in a grid-based spatial hash
 * 2. Invalidate cache entries when rover moves beyond threshold
 * 3. Only raycast for unknown terrain regions
 *
 * Usage:
 *   const cache = new TerrainHeightCache(terrainGenerator, planet, planetRadius, cacheGridSize);
 *   const height = cache.getHeightAt(x, z); // Uses cache or raycasts if needed
 *   cache.invalidateIfNeeded(roverPos); // Invalidate if rover moved far
 */

class TerrainHeightCache {
    /**
     * Create a terrain height cache
     * @param {TerrainGenerator} terrainGenerator - The terrain generator instance
     * @param {THREE.Mesh} planet - The planet mesh
     * @param {number} planetRadius - Radius of planet
     * @param {number} gridSize - Size of cache grid cells (default 5)
     * @param {number} maxCacheSize - Maximum cache entries before pruning (default 1000)
     */
    constructor(terrainGenerator, planet, planetRadius, gridSize = 5, maxCacheSize = 1000) {
        this.terrainGenerator = terrainGenerator;
        this.planet = planet;
        this.planetRadius = planetRadius;
        this.gridSize = gridSize;
        this.maxCacheSize = maxCacheSize;

        // Cache storage: key -> height value
        this.cache = new Map();

        // Track last rover position for invalidation
        this.lastValidPosition = null;
        this.validationThreshold = 10; // Distance before invalidating cache

        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            raycasts: 0,
            cacheClears: 0,
        };
    }

    /**
     * Get grid cell key for a position
     * @private
     */
    _getCellKey(x, z) {
        const cellX = Math.floor(x / this.gridSize);
        const cellZ = Math.floor(z / this.gridSize);
        return `${cellX},${cellZ}`;
    }

    /**
     * Get height at position, using cache when possible
     * @param {number} x - World X position
     * @param {number} z - World Z position
     * @returns {number} Height at position
     */
    getHeightAt(x, z) {
        const key = this._getCellKey(x, z);

        // Cache hit
        if (this.cache.has(key)) {
            this.stats.hits++;
            return this.cache.get(key);
        }

        // Cache miss - raycast and store
        this.stats.misses++;
        this.stats.raycasts++;

        const height = this.terrainGenerator.getSurfaceHeightAtPosition(
            x,
            z,
            this.planet,
            this.planetRadius
        );

        this.cache.set(key, height);

        // Prune cache if too large
        if (this.cache.size > this.maxCacheSize) {
            this._pruneCache();
        }

        return height;
    }

    /**
     * Get heights for multiple positions
     * Batch query for efficiency
     * @param {array} positions - Array of {x, z} objects
     * @returns {array} Array of heights
     */
    getHeightsBatch(positions) {
        return positions.map(pos => this.getHeightAt(pos.x, pos.z));
    }

    /**
     * Check if cache should be invalidated based on rover position
     * @param {object} roverPosition - Current rover world position {x, y, z}
     * @returns {boolean} Whether cache was invalidated
     */
    invalidateIfNeeded(roverPosition) {
        if (!this.lastValidPosition) {
            this.lastValidPosition = { ...roverPosition };
            return false;
        }

        // Calculate distance moved since last validation
        const dx = roverPosition.x - this.lastValidPosition.x;
        const dz = roverPosition.z - this.lastValidPosition.z;
        const distanceMoved = Math.sqrt(dx * dx + dz * dz);

        if (distanceMoved > this.validationThreshold) {
            this.invalidate();
            this.lastValidPosition = { ...roverPosition };
            return true;
        }

        return false;
    }

    /**
     * Manually invalidate the entire cache
     */
    invalidate() {
        this.cache.clear();
        this.stats.cacheClears++;
    }

    /**
     * Invalidate a specific region of the cache
     * Useful for when terrain changes
     * @param {object} center - Center position {x, z}
     * @param {number} radius - Radius to invalidate
     */
    invalidateRegion(center, radius) {
        const keys = Array.from(this.cache.keys());

        for (const key of keys) {
            const [x, z] = key.split(',').map(Number);
            const cellX = x * this.gridSize;
            const cellZ = z * this.gridSize;

            const dx = cellX - center.x;
            const dz = cellZ - center.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < radius) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Prune cache by removing least recently used entries
     * @private
     */
    _pruneCache() {
        // Simple LRU: keep newest 75% of entries
        const targetSize = Math.floor(this.maxCacheSize * 0.75);
        const excess = this.cache.size - targetSize;

        let removed = 0;
        for (const key of this.cache.keys()) {
            if (removed >= excess) break;
            this.cache.delete(key);
            removed++;
        }
    }

    /**
     * Preload cache for a region
     * Useful for main play area
     * @param {number} centerX
     * @param {number} centerZ
     * @param {number} radius
     * @param {number} step - Query interval (larger = fewer queries)
     */
    preloadRegion(centerX, centerZ, radius, step = this.gridSize) {
        const startX = centerX - radius;
        const startZ = centerZ - radius;
        const endX = centerX + radius;
        const endZ = centerZ + radius;

        for (let x = startX; x <= endX; x += step) {
            for (let z = startZ; z <= endZ; z += step) {
                this.getHeightAt(x, z);
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            cacheSize: this.cache.size,
            totalQueries: total,
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            raycasts: 0,
            cacheClears: 0,
        };
    }

    /**
     * Set validation threshold
     * @param {number} threshold - Distance before cache invalidation
     */
    setValidationThreshold(threshold) {
        this.validationThreshold = threshold;
    }

    /**
     * Set cache grid size
     * Smaller = more precise but more cache entries
     * Larger = fewer entries but less precise
     * @param {number} size
     */
    setGridSize(size) {
        if (size !== this.gridSize) {
            this.gridSize = size;
            this.invalidate(); // Cache keys changed, must clear
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerrainHeightCache;
}
