// Planet Objects Management System
class PlanetObjectManager {
    constructor() {
        this.objects = []; // All spawned objects on current planet
        this.objectTypes = new Map(); // Object type definitions
        this.collisionRadius = 3; // Base collision radius for rover interaction
        this.setupObjectTypes();
    }

    // Define the universal object types that can appear on any planet
    setupObjectTypes() {
        this.objectTypes.set('boulder', {
            name: 'Boulder',
            description: 'Large rock formation',
            geometry: () => this.createBoulderGeometry(),
            material: (planetMaterial) => this.createBoulderMaterial(planetMaterial),
            sizeRange: { min: 1.5, max: 4.0 },
            collisionRadius: (size) => size * 0.8,
            canCollect: false,
            glowing: false
        });

        this.objectTypes.set('crystal', {
            name: 'Energy Crystal',
            description: 'Glowing crystalline formation',
            geometry: () => this.createCrystalGeometry(),
            material: (planetMaterial) => this.createCrystalMaterial(planetMaterial),
            sizeRange: { min: 0.8, max: 2.5 },
            collisionRadius: (size) => size * 0.6,
            canCollect: true,
            glowing: true
        });

        this.objectTypes.set('metal', {
            name: 'Metal Deposit',
            description: 'Metallic ore outcrop',
            geometry: () => this.createMetalGeometry(),
            material: (planetMaterial) => this.createMetalMaterial(planetMaterial),
            sizeRange: { min: 1.0, max: 3.0 },
            collisionRadius: (size) => size * 0.7,
            canCollect: true,
            glowing: false
        });

        this.objectTypes.set('marker', {
            name: 'Ancient Marker',
            description: 'Stone pillar or cairn',
            geometry: () => this.createMarkerGeometry(),
            material: (planetMaterial) => this.createMarkerMaterial(planetMaterial),
            sizeRange: { min: 1.5, max: 3.5 },
            collisionRadius: (size) => size * 0.5,
            canCollect: false,
            glowing: false
        });

        this.objectTypes.set('debris', {
            name: 'Expedition Debris',
            description: 'Remnants from previous expeditions',
            geometry: () => this.createDebrisGeometry(),
            material: (planetMaterial) => this.createDebrisMaterial(planetMaterial),
            sizeRange: { min: 0.5, max: 2.0 },
            collisionRadius: (size) => size * 0.8,
            canCollect: true,
            glowing: false
        });
    }

    // Create object geometries
    createBoulderGeometry() {
        // Irregular rock shape using slightly deformed sphere
        const geometry = new THREE.SphereGeometry(1, 8, 6);
        const vertices = geometry.attributes.position.array;
        
        // Add some randomness to vertices for irregular shape
        for (let i = 0; i < vertices.length; i += 3) {
            const noise = (Math.random() - 0.5) * 0.3;
            vertices[i] += noise;
            vertices[i + 1] += noise;
            vertices[i + 2] += noise;
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        return geometry;
    }

    createCrystalGeometry() {
        // Sharp crystal using octahedron
        return new THREE.OctahedronGeometry(1, 1);
    }

    createMetalGeometry() {
        // Chunky metallic formation
        return new THREE.DodecahedronGeometry(1, 0);
    }

    createMarkerGeometry() {
        // Simple pillar using cylinder
        return new THREE.CylinderGeometry(0.3, 0.5, 2, 6);
    }

    createDebrisGeometry() {
        // Irregular debris using box with random scaling
        const geometry = new THREE.BoxGeometry(1, 0.5, 1.5);
        return geometry;
    }

    // Create object materials
    createBoulderMaterial(planetMaterial) {
        // Darken planet color for boulder
        const planetColor = planetMaterial.color;
        const r = Math.max(0, ((planetColor >> 16) & 0xFF) - 40);
        const g = Math.max(0, ((planetColor >> 8) & 0xFF) - 40);
        const b = Math.max(0, (planetColor & 0xFF) - 40);
        const boulderColor = (r << 16) | (g << 8) | b;
        
        return new THREE.MeshLambertMaterial({
            color: boulderColor,
            flatShading: true
        });
    }

    createCrystalMaterial(planetMaterial) {
        // Glowing crystal with emission
        const crystalColors = [0x00FFFF, 0xFF00FF, 0x00FF00, 0xFFFF00, 0xFF8000];
        const color = crystalColors[Math.floor(Math.random() * crystalColors.length)];
        
        return new THREE.MeshLambertMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.8
        });
    }

    createMetalMaterial(planetMaterial) {
        // Metallic appearance with some shine
        return new THREE.MeshLambertMaterial({
            color: 0x888888,
            flatShading: false
        });
    }

    createMarkerMaterial(planetMaterial) {
        // Stone-like material, lighter than planet
        const planetColor = planetMaterial.color;
        const r = Math.min(255, ((planetColor >> 16) & 0xFF) + 30);
        const g = Math.min(255, ((planetColor >> 8) & 0xFF) + 30);
        const b = Math.min(255, (planetColor & 0xFF) + 30);
        const stoneColor = (r << 16) | (g << 8) | b;
        
        return new THREE.MeshLambertMaterial({
            color: stoneColor,
            flatShading: true
        });
    }

    createDebrisMaterial(planetMaterial) {
        // Metallic debris with wear
        return new THREE.MeshLambertMaterial({
            color: 0x444444,
            flatShading: true
        });
    }

    // Generate objects for a planet based on configuration
    generateObjects(planetConfig, rng, planetMesh) {
        this.clearObjects(planetMesh);
        
        const planetRadius = planetConfig.radius || 80;
        const materialProps = planetTypeManager.getMaterialProperties();
        
        // Get object densities from config, fallback to default if not present
        const objectDensities = planetConfig.objects || {
            boulder: 0.3,    // Default fallback densities
            crystal: 0.2,
            metal: 0.15,
            marker: 0.1,
            debris: 0.15
        };
        
        // Generate each object type based on density settings
        for (const [objectType, density] of Object.entries(objectDensities)) {
            if (density <= 0) continue;
            
            const objectDef = this.objectTypes.get(objectType);
            if (!objectDef) {
                console.warn(`Unknown object type: ${objectType}`);
                continue;
            }
            
            const maxObjects = this.getMaxObjectsForType(objectType);
            const numObjects = Math.floor(maxObjects * density);
            
            console.log(`Generating ${numObjects} ${objectType} objects (density: ${density})`);
            
            for (let i = 0; i < numObjects; i++) {
                this.spawnObject(objectType, objectDef, materialProps, planetRadius, rng, planetMesh);
            }
        }
        
        console.log(`Generated ${this.objects.length} total objects on planet`);
    }

    // Get maximum number of objects for each type
    getMaxObjectsForType(objectType) {
        const maxCounts = {
            boulder: 100,
            crystal: 30,
            metal: 25,
            marker: 15,
            debris: 40
        };
        return maxCounts[objectType] || 20;
    }

    // Spawn a single object on the planet surface
    spawnObject(objectType, objectDef, planetMaterial, planetRadius, rng, planetMesh) {
        try {
            // Generate random position on sphere
            const lat = (rng.next() - 0.5) * Math.PI; // -π/2 to π/2
            const lon = rng.next() * Math.PI * 2;     // 0 to 2π
            
            // Convert to Cartesian coordinates on planet surface
            const x = Math.cos(lat) * Math.cos(lon);
            const y = Math.sin(lat);
            const z = Math.cos(lat) * Math.sin(lon);
            
            // Get terrain height at this position (simplified - using base radius for now)
            const surfaceHeight = planetRadius;
            
            // Random size within range
            const size = rng.range(objectDef.sizeRange.min, objectDef.sizeRange.max);
            
            // Create geometry and material
            const geometry = objectDef.geometry();
            const material = objectDef.material(planetMaterial);
            
            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position on planet surface
            const position = new THREE.Vector3(x, y, z).multiplyScalar(surfaceHeight + size * 0.5);
            mesh.position.copy(position);
            
            // Orient to planet surface (point "up" away from center)
            mesh.lookAt(position.clone().multiplyScalar(2));
            
            // Random rotation around surface normal
            const randomRotation = rng.next() * Math.PI * 2;
            mesh.rotateZ(randomRotation);
            
            // Scale the mesh
            mesh.scale.setScalar(size);
            
            // Add to planet so it rotates with the planet
            planetMesh.add(mesh);
            
            // Store object data
            const objectData = {
                id: `${objectType}_${this.objects.length}`,
                type: objectType,
                mesh: mesh,
                position: position.clone(),
                size: size,
                collisionRadius: objectDef.collisionRadius(size),
                canCollect: objectDef.canCollect,
                glowing: objectDef.glowing,
                discovered: false,
                definition: objectDef
            };
            
            this.objects.push(objectData);
            
        } catch (error) {
            console.error(`Error spawning ${objectType}:`, error);
        }
    }

    // Clear all objects from planet
    clearObjects(planetMesh) {
        this.objects.forEach(obj => {
            if (obj.mesh) {
                // Remove from planet (or scene as fallback)
                if (obj.mesh.parent) {
                    obj.mesh.parent.remove(obj.mesh);
                }
                // Clean up geometry and materials
                if (obj.mesh.geometry) obj.mesh.geometry.dispose();
                if (obj.mesh.material) obj.mesh.material.dispose();
            }
        });
        this.objects = [];
    }

    // Check for collisions between rover and objects
    checkCollisions(roverPosition) {
        const collisions = [];
        
        for (const obj of this.objects) {
            // Get object's world position (since it's a child of the planet)
            const objectWorldPos = new THREE.Vector3();
            obj.mesh.getWorldPosition(objectWorldPos);
            
            const distance = roverPosition.distanceTo(objectWorldPos);
            
            if (distance < obj.collisionRadius + this.collisionRadius) {
                collisions.push({
                    object: obj,
                    distance: distance,
                    type: obj.type,
                    worldPosition: objectWorldPos
                });
            }
        }
        
        return collisions;
    }

    // Get objects within discovery range
    getObjectsInRange(roverPosition, range = 10) {
        return this.objects.filter(obj => {
            const objectWorldPos = new THREE.Vector3();
            obj.mesh.getWorldPosition(objectWorldPos);
            const distance = roverPosition.distanceTo(objectWorldPos);
            return distance <= range;
        }).sort((a, b) => {
            const objWorldPosA = new THREE.Vector3();
            const objWorldPosB = new THREE.Vector3();
            a.mesh.getWorldPosition(objWorldPosA);
            b.mesh.getWorldPosition(objWorldPosB);
            const distA = roverPosition.distanceTo(objWorldPosA);
            const distB = roverPosition.distanceTo(objWorldPosB);
            return distA - distB;
        });
    }

    // Mark object as discovered
    discoverObject(objectId) {
        const obj = this.objects.find(o => o.id === objectId);
        if (obj && !obj.discovered) {
            obj.discovered = true;
            console.log(`Discovered ${obj.definition.name}: ${obj.definition.description}`);
            return obj;
        }
        return null;
    }

    // Get object statistics
    getObjectStats() {
        const stats = {};
        
        for (const obj of this.objects) {
            if (!stats[obj.type]) {
                stats[obj.type] = { total: 0, discovered: 0 };
            }
            stats[obj.type].total++;
            if (obj.discovered) stats[obj.type].discovered++;
        }
        
        return stats;
    }

    // Create seeded RNG helper (for consistency with planet generator)
    createSeededRNG(seed) {
        let currentSeed = seed;
        return {
            next() {
                currentSeed = (currentSeed * 1664525 + 1013904223) % Math.pow(2, 32);
                return currentSeed / Math.pow(2, 32);
            },
            range(min, max) {
                return min + (max - min) * this.next();
            }
        };
    }
}

// Export singleton instance
const planetObjectManager = new PlanetObjectManager();
window.planetObjectManager = planetObjectManager; // Make globally accessible for debugging