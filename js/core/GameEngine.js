// GameEngine.js - Core game engine that coordinates all systems
class GameEngine {
    constructor() {
        // Core Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.planet = null;
        this.rover = null;

        // Game state
        this.planetRadius = 80;
        this.roverPosition = { lat: 0, lon: 0 };
        this.roverHeading = Math.PI / 2; // rover's facing direction in radians (start facing north)
        this.planetQuaternion = new THREE.Quaternion(); // Use quaternion instead of Euler rotations
        this.keys = {};

        // System modules
        this.terrainGenerator = new TerrainGenerator();
        this.roverPhysics = new RoverPhysics();
        this.particleSystem = new ParticleSystem();
        this.renderingEngine = new RenderingEngine();
        this.biomeManager = new BiomeManager();

        // Animation frame tracking
        this.animationId = null;
        this.lastUpdateTime = 0;

        // Mobile input handler
        this.mobileInputHandler = null;
    }

    async initialize() {
        // Load planet configurations first
        await planetTypeManager.loadPlanetConfigs();

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);

        // Create camera - positioned to look at rover from behind/above
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.lookAt(0, 0, 0);

        // Create renderer with pixel-art settings
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('container').appendChild(this.renderer.domElement);

        // Initialize all systems with references
        this.renderingEngine.setReferences(this.renderer, this.camera, this.scene, this.rover, this.planetRadius);
        this.roverPhysics.setReferences(this.terrainGenerator, this.planet, this.planetRadius);
        this.particleSystem.setReferences(this.scene, this.planetQuaternion, this.planetRadius);

        // Setup rendering
        this.renderingEngine.setupPixelArtRendering();

        // Create planet using current planet type
        this.createPlanet();

        // Create planet objects using new object system
        this.createPlanetObjects();

        // Create rover
        this.createRover();

        // Add lighting
        this.renderingEngine.addLighting();

        // Apply atmospheric effects
        this.renderingEngine.applyAtmosphericFog();

        // Create particle systems
        this.particleSystem.createDustParticleSystem();
        this.particleSystem.createAmbientParticleSystem();

        // Set up controls
        this.setupControls();

        // Start render loop
        this.startAnimationLoop();

        console.log('Game Engine initialized successfully');
    }

    createPlanet(planetType = null) {
        // Get planet configuration
        const materialProps = planetTypeManager.getMaterialProperties(planetType);
        const terrainProps = planetTypeManager.getTerrainProperties(planetType);
        const configuredRadius = planetTypeManager.getPlanetRadius(planetType);
        const planetConfig = planetTypeManager.getPlanetConfig(planetType);

        // Update global planetRadius with configured value
        this.planetRadius = configuredRadius;

        // Update all systems with new planet radius
        this.roverPhysics.setReferences(this.terrainGenerator, this.planet, this.planetRadius);
        this.particleSystem.setReferences(this.scene, this.planetQuaternion, this.planetRadius);
        this.renderingEngine.setReferences(this.renderer, this.camera, this.scene, this.rover, this.planetRadius);

        // Reset rover physics position to start above the new planet surface
        this.roverPhysics.roverPhysicsPosition.set(0, this.planetRadius + 20, 0);

        // Check if this planet has biome mixing
        const hasBiomeMixing = planetConfig && planetConfig.biomeMix;
        let biomeRegionData = null;

        console.log('Creating planet with biome mixing:', hasBiomeMixing);
        if (planetConfig) {
            console.log('Planet config biomeMix:', planetConfig.biomeMix);
        }

        if (hasBiomeMixing) {
            // Initialize biome region generation
            biomeRegionData = this.biomeManager.initializeBiomeRegions(planetConfig.biomeMix, planetConfig.seed || 12345);
            console.log('Initialized biome regions:', biomeRegionData);
        }

        // Use fallback values if configuration isn't loaded
        const planetColor = materialProps ? materialProps.color : 0x8B4513;
        const flatShading = materialProps ? materialProps.flatShading : true;
        const noiseScale = terrainProps ? terrainProps.noiseScale : 0.1;
        const heightVariation = terrainProps ? terrainProps.heightVariation : 3;

        // Create higher quality planet sphere with subdivision level scaled to radius
        const baseRadius = 80; // Reference radius for subdivision calibration
        const baseSubdivisions = 12; // Base subdivision level for radius 80
        const subdivisions = Math.round(baseSubdivisions * Math.sqrt(this.planetRadius / baseRadius));
        const geometry = new THREE.IcosahedronGeometry(this.planetRadius, subdivisions);

        // Add structured terrain variation using multiple noise algorithms
        const vertices = geometry.attributes.position.array;
        const uniqueVertices = new Map();
        const vertexBiomes = new Map(); // Store biome data per vertex for coloring

        // First pass: identify unique vertices and apply layered noise (NO biome sampling yet)
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const z = vertices[i + 2];
            const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

            if (!uniqueVertices.has(key)) {
                const vertex = new THREE.Vector3(x, y, z);
                const distance = vertex.length();

                // Apply standard terrain generation without biome influence for now
                let baseNoise = this.terrainGenerator.generateLayeredNoise(x, y, z, noiseScale, heightVariation);

                // Add mountain and hill formations
                const mountainNoise = this.terrainGenerator.generateMountains(x, y, z, this.planetRadius, terrainProps);
                baseNoise += mountainNoise;

                // Add valleys and canyons
                const valleyNoise = this.terrainGenerator.generateValleys(x, y, z, this.planetRadius, terrainProps);
                baseNoise += valleyNoise;

                // Add cliff faces and steep terrain
                const cliffNoise = this.terrainGenerator.generateCliffs(x, y, z, this.planetRadius, terrainProps);
                baseNoise += cliffNoise;

                // Add mesa and plateau formations
                const mesaNoise = this.terrainGenerator.generateMesas(x, y, z, this.planetRadius, terrainProps);
                baseNoise += mesaNoise;

                // Add crater features
                const craterNoise = this.terrainGenerator.generateCraters(x, y, z, this.planetRadius, terrainProps);
                baseNoise += craterNoise;

                const newDistance = distance + baseNoise;

                vertex.normalize().multiplyScalar(newDistance);
                uniqueVertices.set(key, vertex);
            }

            // Apply the consistent vertex position
            const modifiedVertex = uniqueVertices.get(key);
            vertices[i] = modifiedVertex.x;
            vertices[i + 1] = modifiedVertex.y;
            vertices[i + 2] = modifiedVertex.z;
        }

        // Second pass: NOW assign biomes based on the FINAL vertex positions
        if (hasBiomeMixing) {
            for (let i = 0; i < vertices.length; i += 3) {
                const x = vertices[i];
                const y = vertices[i + 1];
                const z = vertices[i + 2];
                const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

                // Sample biome at the final vertex position
                const biome = this.biomeManager.sampleBiomeAtPosition(x, y, z, biomeRegionData);
                if (biome) {
                    const biomeRanges = planetGenerator.getBiomeGenerationRanges()[biome];
                    if (biomeRanges) {
                        const biomeProps = {
                            biome: biome,
                            color: biomeRanges.material.color[0]
                        };
                        vertexBiomes.set(key, biomeProps);
                    }
                }
            }
        }

        geometry.attributes.position.needsUpdate = true;

        // Store biome region data for face-based coloring
        this.biomeManager.setCurrentBiomeRegionData(biomeRegionData);

        // Add vertex colors for biome regions if biome mixing is enabled
        if (hasBiomeMixing && biomeRegionData) {
            this.biomeManager.addVertexColorsForBiomes(geometry, uniqueVertices, vertexBiomes);
        }

        geometry.computeVertexNormals();

        // Planet material using configuration - enable vertex colors if biome mixing
        const material = new THREE.MeshLambertMaterial({
            color: hasBiomeMixing ? 0xffffff : planetColor, // White base for vertex colors, or normal color
            vertexColors: hasBiomeMixing, // Enable vertex colors for biome mixing (boolean in r128)
            flatShading: true // Force flat shading to prevent color interpolation between vertices
        });

        console.log('Created material with vertex colors:', hasBiomeMixing);
        console.log('Material properties:', {
            color: material.color.getHex(),
            vertexColors: material.vertexColors,
            flatShading: material.flatShading
        });

        this.planet = new THREE.Mesh(geometry, material);
        this.planet.receiveShadow = true;
        this.scene.add(this.planet);

        // Update rover physics reference to new planet
        this.roverPhysics.setReferences(this.terrainGenerator, this.planet, this.planetRadius);
    }

    createPlanetObjects() {
        // Get current planet configuration
        const currentConfig = planetTypeManager.getCurrentPlanetConfig();
        if (!currentConfig) {
            console.warn('No planet configuration available for object generation');
            return;
        }

        // Create seeded RNG for consistent object placement
        const seed = currentConfig.seed || Date.now() % 1000000;
        const rng = planetObjectManager.createSeededRNG(seed);

        // Generate objects using the new system
        planetObjectManager.generateObjects(currentConfig, rng, this.planet);
    }

    createRover() {
        const roverGroup = new THREE.Group();

        // Main body - a box
        const bodyGeometry = new THREE.BoxGeometry(4, 2, 6);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x666666,
            emissive: 0x444444, // Strong emissive to resist ambient lighting
            shininess: 30
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.castShadow = true;
        roverGroup.add(body);

        // Wheels - 4 cylinders
        const wheelGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 8);
        const wheelMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
            emissive: 0x222222, // Strong emissive to resist ambient lighting
            shininess: 10
        });

        const wheelPositions = [
            [-2.5, 0, 2], [2.5, 0, 2], [-2.5, 0, -2], [2.5, 0, -2]
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            roverGroup.add(wheel);
        });

        // Solar panel - thin box on top
        const panelGeometry = new THREE.BoxGeometry(3, 0.1, 4);
        const panelMaterial = new THREE.MeshPhongMaterial({
            color: 0x0000AA,
            emissive: 0x000066, // Strong blue emissive to maintain blue color
            shininess: 50
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.y = 2.5;
        panel.castShadow = true;
        roverGroup.add(panel);

        // Headlight to show front direction
        const headlightGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const headlightMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            emissive: 0x666600 // Strong yellow emissive like before
        });
        const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlight.position.set(0, 1, 3.2); // Front of rover (positive Z)
        headlight.castShadow = true;
        roverGroup.add(headlight);

        // Front indicator bar for even clearer direction
        const frontBarGeometry = new THREE.BoxGeometry(2, 0.3, 0.3);
        const frontBarMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0x660000 // Strong red emissive to maintain red color
        });
        const frontBar = new THREE.Mesh(frontBarGeometry, frontBarMaterial);
        frontBar.position.set(0, 1.5, 3); // Front of rover
        frontBar.castShadow = true;
        roverGroup.add(frontBar);

        this.rover = roverGroup;

        this.positionRoverOnPlanet();
        this.scene.add(this.rover);

        // Update rendering engine reference to rover
        this.renderingEngine.setReferences(this.renderer, this.camera, this.scene, this.rover, this.planetRadius);
    }

    positionRoverOnPlanet() {
        // Apply quaternion rotation to planet first
        this.planet.quaternion.copy(this.planetQuaternion);

        // Update rover physics heading
        this.roverPhysics.updateHeading(this.roverHeading);

        // Update position display with wheel contact info
        const contactResults = this.roverPhysics.calculateGroundContact();
        const groundStatus = this.roverPhysics.isGrounded ? `Grounded (${contactResults.groundedCount}/4 wheels)` : "Airborne";
        // Position display removed for cleaner UI
    }

    setupControls() {
        // Initialize mobile input handler if on mobile device (or for testing)
        if (typeof MobileInputHandler !== 'undefined' && MobileInputHandler.isMobileDevice()) {
            this.mobileInputHandler = new MobileInputHandler();
            console.log('Mobile device detected - touch controls enabled');
        } else {
            console.log('Desktop device detected - keyboard/mouse controls enabled');
            // Temporarily create joystick for testing on desktop
            // Remove this after confirming visuals work
            this.mobileInputHandler = new MobileInputHandler();
            console.log('DEBUG: Creating joystick on desktop for testing');
        }

        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;

            // Handle pixel size controls
            if (this.renderingEngine.handlePixelSizeControls(this.keys)) {
                // Pixel size was changed, prevent further processing
                this.keys[event.code] = false;
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        // Setup camera and mouse controls
        this.renderingEngine.setupControls();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.renderingEngine.handleWindowResize();
        });
    }

    handleRoverMovement() {
        // Merge keyboard and touch inputs
        let inputKeys = { ...this.keys };

        // Add touch input if mobile handler is active
        if (this.mobileInputHandler) {
            const touchKeys = this.mobileInputHandler.getTouchAsKeyboardInput();
            inputKeys = { ...inputKeys, ...touchKeys };
        }

        const movementResult = this.roverPhysics.handleMovement(
            inputKeys,
            this.roverHeading,
            this.planetQuaternion,
            this.planetRadius
        );

        if (movementResult.moved) {
            // Spawn dust particles when rover moves on ground
            if (movementResult.forwardMovement) {
                this.particleSystem.spawnMovementDust(
                    this.roverPhysics.roverPhysicsPosition,
                    this.roverPhysics.roverRotation,
                    this.roverHeading,
                    this.roverPhysics.isGrounded
                );
            }

            // Update rover heading from physics
            this.roverHeading = -this.roverPhysics.roverRotation.yaw;

            // Wrap longitude for display purposes only
            if (this.roverPosition.lon > 180) this.roverPosition.lon -= 360;
            if (this.roverPosition.lon < -180) this.roverPosition.lon += 360;

            this.positionRoverOnPlanet();
        }
    }

    checkObjectCollisions() {
        // Get rover position in world coordinates
        const roverWorldPos = this.rover.position.clone();

        // Check for collisions with objects
        const collisions = planetObjectManager.checkCollisions(roverWorldPos);

        if (collisions.length > 0) {
            // Handle collision response
            for (const collision of collisions) {
                this.handleObjectCollision(collision);
            }
        }

        // Check for objects in discovery range
        const nearbyObjects = planetObjectManager.getObjectsInRange(roverWorldPos, 8);

        for (const obj of nearbyObjects) {
            if (!obj.discovered && obj.canCollect) {
                // Auto-discover collectible objects when close
                const objectWorldPos = new THREE.Vector3();
                obj.mesh.getWorldPosition(objectWorldPos);
                const distance = roverWorldPos.distanceTo(objectWorldPos);
                if (distance < 4) {
                    planetObjectManager.discoverObject(obj.id);
                    console.log(`🎯 Discovered ${obj.definition.name}! ${obj.definition.description}`);
                }
            }
        }
    }

    handleObjectCollision(collision) {
        // Simple collision response - prevent rover from passing through objects
        const objectPos = collision.worldPosition || collision.object.position;
        const direction = this.rover.position.clone().sub(objectPos).normalize();
        const pushDistance = collision.object.collisionRadius + planetObjectManager.collisionRadius - collision.distance + 0.5;

        if (pushDistance > 0) {
            // Push rover away from object
            const pushVector = direction.multiplyScalar(pushDistance);
            this.rover.position.add(pushVector);
            this.roverPhysics.roverPhysicsPosition.add(pushVector);

            // Add more noticeable visual feedback
            if (this.roverPhysics.roverAngularVelocity) {
                this.roverPhysics.roverAngularVelocity.x += (Math.random() - 0.5) * 0.05;
                this.roverPhysics.roverAngularVelocity.z += (Math.random() - 0.5) * 0.05;
            }

            // Add velocity dampening for impact feel
            if (this.roverPhysics.roverVelocity) {
                this.roverPhysics.roverVelocity.multiplyScalar(0.7); // Slow down on impact
            }

            console.log(`💥 Collision with ${collision.object.definition.name}!`);
        }
    }

    // Planet switching function
    switchPlanet(planetType) {
        if (planetTypeManager.setPlanetType(planetType)) {
            // Remove existing planet
            if (this.planet) {
                this.scene.remove(this.planet);
            }

            // Remove existing rover and recreate it with updated materials
            if (this.rover) {
                this.scene.remove(this.rover);
            }

            // Clean up particle systems
            this.particleSystem.cleanupParticles();

            // Create new planet with the selected type
            this.createPlanet(planetType);

            // Recreate objects
            this.createPlanetObjects();

            // Recreate rover with updated materials
            this.createRover();

            // Recreate particle systems
            this.particleSystem.createDustParticleSystem();
            this.particleSystem.createAmbientParticleSystem();

            // Update lighting for the new planet type
            this.renderingEngine.addLighting();

            // Update atmospheric effects for the new planet type
            this.renderingEngine.applyAtmosphericFog();

            // Reset rover position on new planet
            this.positionRoverOnPlanet();

            console.log('Switched to planet:', planetType);
            return true;
        }
        return false;
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);

            this.handleRoverMovement();

            // Update rover physics
            const physicsResult = this.roverPhysics.updatePhysics();

            // Handle landing dust particles
            if (!physicsResult.wasGrounded && physicsResult.isGrounded && physicsResult.landingImpact > 0) {
                this.particleSystem.spawnLandingDust(
                    this.roverPhysics.roverPhysicsPosition,
                    physicsResult.landingImpact
                );
            }

            // Update rover visual position to match physics
            this.rover.position.copy(this.roverPhysics.roverPhysicsPosition);

            // Apply rover rotation
            if (physicsResult.isGrounded) {
                this.rover.rotation.set(
                    this.roverPhysics.roverRotation.pitch,
                    this.roverPhysics.roverRotation.yaw,
                    this.roverPhysics.roverRotation.roll
                );
            }

            // Update particle systems
            this.particleSystem.update();

            // Check for object collisions
            this.checkObjectCollisions();

            // Update camera to continuously follow rover
            this.renderingEngine.updateCameraPosition();

            // Render with pixel art effect
            this.renderingEngine.renderPixelArt();
        };

        animate();
    }

    stopAnimationLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Public API for accessing game state
    getRoverState() {
        return this.roverPhysics.getRoverState();
    }

    getPlanetState() {
        return {
            radius: this.planetRadius,
            quaternion: this.planetQuaternion.clone(),
            position: this.roverPosition
        };
    }
}

// Export for global use
window.GameEngine = GameEngine;