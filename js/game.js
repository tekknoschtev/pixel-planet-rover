// Game variables
let scene, camera, renderer, planet, rover;
let planetRadius = 80;
let roverPosition = { lat: 0, lon: 0 };
let roverHeading = Math.PI / 2; // rover's facing direction in radians (start facing north)
let planetQuaternion = new THREE.Quaternion(); // Use quaternion instead of Euler rotations
let keys = {};

// Terrain following variables
let roverRotation = { pitch: 0, roll: 0, yaw: -Math.PI / 2 }; // Initialize yaw to match north heading
let targetRotation = { pitch: 0, roll: 0, yaw: 0 };
const rotationLerpSpeed = 0.15; // How fast to interpolate (0-1, higher = faster)

// Physics variables
let roverVelocity = new THREE.Vector3(0, 0, 0); // Rover's current velocity
let roverPhysicsPosition = new THREE.Vector3(0, planetRadius + 20, 0); // Physics position (starts above surface)
let roverAngularVelocity = new THREE.Vector3(0, 0, 0); // Rover's rotational velocity
const gravity = -0.3; // Gravity acceleration (negative = downward) - reduced for better settling
const groundDamping = 0.7; // Energy loss when hitting ground (0-1) - increased for better settling
const airDamping = 0.99; // Air resistance (close to 1 = little resistance) - reduced air drag
const angularDamping = 0.95; // Rotational damping (prevents spinning)
const stabilityForce = 0.05; // How strongly rover tries to right itself
let isGrounded = false; // Is rover touching ground?

// Particle system variables
let dustParticleSystem = null;
let dustParticles = [];
const maxDustParticles = 50;
let lastRoverMovement = 0;
let lastLandingTime = 0;

// Ambient atmospheric particle system variables
let ambientParticles = [];
const maxAmbientParticles = 30;

// Boulder field system variables
let boulderField = [];
const maxBoulders = 100;


// Multi-point contact detection
const wheelOffsets = [
    { x: -2.5, z: 2, name: "front-left" },   // Front-left wheel
    { x: 2.5, z: 2, name: "front-right" },   // Front-right wheel  
    { x: -2.5, z: -2, name: "rear-left" },   // Rear-left wheel
    { x: 2.5, z: -2, name: "rear-right" }    // Rear-right wheel
];
let wheelContacts = {
    "front-left": { height: 0, grounded: false },
    "front-right": { height: 0, grounded: false },
    "rear-left": { height: 0, grounded: false },
    "rear-right": { height: 0, grounded: false }
};

// Initialize the game
async function init() {
    // Load planet configurations first
    await planetTypeManager.loadPlanetConfigs();

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    // Create camera - positioned to look at rover from behind/above
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
//    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Create planet using current planet type
    createPlanet();
    
    // Create boulder field (fixed implementation)
    createBoulderField();
    
    // Create rover
    createRover();
    
    // Add lighting
    addLighting();
    
    // Apply atmospheric effects
    applyAtmosphericFog();
    
    // Scene cleanup completed - shrub issue resolved
    
    // Create dust particle system (cleanup only - particles disabled)
    createDustParticleSystem();
    
    // Create ambient atmospheric particle system (cleanup only - particles disabled)
    createAmbientParticleSystem();
    
    // Set up controls
    setupControls();
    
    // Start render loop
    animate();
    
}

// Advanced noise generation functions for terrain
function generateLayeredNoise(x, y, z, scale, amplitude) {
    // Convert to spherical coordinates for better planet-wide noise distribution
    const radius = Math.sqrt(x*x + y*y + z*z);
    const lat = Math.asin(y / radius);
    const lon = Math.atan2(z, x);
    
    // Layer 1: Base terrain using improved Perlin-like noise
    const baseNoise = improvedNoise(lon * scale * 4, lat * scale * 4, 0) * amplitude * 3.0;
    
    // Layer 2: Mid-frequency features (hills, valleys)
    const midNoise = improvedNoise(lon * scale * 8, lat * scale * 8, 100) * amplitude * 2.0;
    
    // Layer 3: High-frequency detail (surface roughness)
    const detailNoise = improvedNoise(lon * scale * 16, lat * scale * 16, 200) * amplitude * 1.0;
    
    // Layer 4: Large-scale continental features
    const continentalNoise = improvedNoise(lon * scale * 1, lat * scale * 1, 300) * amplitude * 2.0;
    
    return baseNoise + midNoise + detailNoise + continentalNoise;
}

function improvedNoise(x, y, z) {
    // Improved noise function with better distribution than simple sin/cos
    const a = Math.sin(x * 1.2) * Math.cos(y * 0.8) * Math.sin(z * 1.5);
    const b = Math.cos(x * 2.1) * Math.sin(y * 1.7) * Math.cos(z * 0.9);
    const c = Math.sin(x * 0.5) * Math.sin(y * 2.3) * Math.cos(z * 1.8);
    
    // Combine with different weights for more natural variation
    return (a * 0.5 + b * 0.3 + c * 0.2);
}

function ridgedNoise(x, y, z) {
    // Ridged noise for mountain ranges and sharp features
    const noise = improvedNoise(x, y, z);
    return 1.0 - Math.abs(noise);
}

function turbulence(x, y, z, octaves = 4) {
    // Multi-octave turbulence for complex terrain features
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    
    for (let i = 0; i < octaves; i++) {
        value += improvedNoise(x * frequency, y * frequency, z * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value;
}

function generateMountains(x, y, z, planetRadius, terrainProps) {
    // Convert to spherical coordinates
    const radius = Math.sqrt(x*x + y*y + z*z);
    const lat = Math.asin(y / radius);
    const lon = Math.atan2(z, x);
    
    // Get mountain density from terrain properties, with fallback
    const mountainDensity = terrainProps && terrainProps.mountainDensity !== undefined ? 
        terrainProps.mountainDensity : 0.2;
    
    if (mountainDensity <= 0) return 0;
    
    let mountainEffect = 0;
    
    // Generate mountain ranges using ridged noise
    const ridgeScale = 3;
    const ridgeNoise = ridgedNoise(lon * ridgeScale, lat * ridgeScale, 0);
    
    // Only create mountains where ridge noise is high
    if (ridgeNoise > 0.6) {
        const mountainHeight = (ridgeNoise - 0.6) * 0.4 * mountainDensity;
        
        // Add jagged peaks using higher frequency noise
        const peakNoise = turbulence(lon * ridgeScale * 4, lat * ridgeScale * 4, 0, 3);
        const jaggedPeaks = peakNoise * mountainHeight * 0.3;
        
        mountainEffect += (mountainHeight * 120 + jaggedPeaks * 50); // EXTREME mountains
    }
    
    // Generate isolated hills
    const hillScale = 6;
    const hillNoise = improvedNoise(lon * hillScale + 500, lat * hillScale + 500, 0);
    
    if (hillNoise > 0.5 && Math.abs(hillNoise) < 0.8) {
        const hillHeight = (Math.abs(hillNoise) - 0.5) * 0.3 * mountainDensity;
        
        // Smooth hill profile
        const hillProfile = Math.pow(hillHeight, 2) * 80; // EXTREME hills
        mountainEffect += hillProfile;
    }
    
    // Add rolling terrain variation
    const rollingScale = 4;
    const rollingNoise = improvedNoise(lon * rollingScale, lat * rollingScale, 700);
    mountainEffect += rollingNoise * mountainDensity * 20;
    
    return mountainEffect;
}

function generateValleys(x, y, z, planetRadius, terrainProps) {
    // Convert to spherical coordinates
    const radius = Math.sqrt(x*x + y*y + z*z);
    const lat = Math.asin(y / radius);
    const lon = Math.atan2(z, x);
    
    // Get valley density from terrain properties, with fallback
    const valleyDensity = terrainProps && terrainProps.valleyDensity !== undefined ? 
        terrainProps.valleyDensity : 0.15;
    
    if (valleyDensity <= 0) return 0;
    
    let valleyEffect = 0;
    
    // Generate river valleys using inverted ridged noise
    const riverScale = 2.5;
    const riverNoise = ridgedNoise(lon * riverScale + 100, lat * riverScale + 100, 0);
    
    // Create valleys where ridge noise is low (invert the ridged effect)
    const invertedRidge = 1.0 - riverNoise;
    if (invertedRidge > 0.7) {
        const valleyDepth = (invertedRidge - 0.7) * 0.3 * valleyDensity;
        
        // Add meandering effect to valleys
        const meanderNoise = improvedNoise(lon * riverScale * 3, lat * riverScale * 3, 400);
        const meandering = meanderNoise * valleyDepth * 0.2;
        
        valleyEffect -= (valleyDepth * 100 + meandering * 40); // EXTREME valleys
    }
    
    // Generate canyon systems using layered noise
    const canyonScale = 1.8;
    const canyonNoise1 = improvedNoise(lon * canyonScale, lat * canyonScale, 600);
    const canyonNoise2 = improvedNoise(lon * canyonScale * 2, lat * canyonScale * 2, 800);
    
    // Combine noises to create canyon network
    const canyonPattern = canyonNoise1 * 0.7 + canyonNoise2 * 0.3;
    
    if (canyonPattern > 0.4 && canyonPattern < 0.6) {
        const canyonDepth = (0.6 - Math.abs(canyonPattern - 0.5) * 2) * valleyDensity;
        
        // Add canyon wall steepness
        const wallNoise = improvedNoise(lon * canyonScale * 8, lat * canyonScale * 8, 1000);
        const wallEffect = wallNoise * canyonDepth * 0.1;
        
        valleyEffect -= (canyonDepth * 90 + wallEffect * 30); // EXTREME canyons
    }
    
    // Add small gullies and erosion channels
    const gullyScale = 8;
    const gullyNoise = turbulence(lon * gullyScale, lat * gullyScale, 1200, 2);
    
    if (Math.abs(gullyNoise) > 0.6) {
        const gullyDepth = (Math.abs(gullyNoise) - 0.6) * 0.4 * valleyDensity;
        valleyEffect -= gullyDepth * 3; // Small erosion channels
    }
    
    return valleyEffect;
}

function generateCliffs(x, y, z, planetRadius, terrainProps) {
    // Convert to spherical coordinates
    const radius = Math.sqrt(x*x + y*y + z*z);
    const lat = Math.asin(y / radius);
    const lon = Math.atan2(z, x);
    
    // Get cliff density from terrain properties, with fallback
    const cliffDensity = terrainProps && terrainProps.cliffDensity !== undefined ? 
        terrainProps.cliffDensity : 0.25;
    
    if (cliffDensity <= 0) return 0;
    
    let cliffEffect = 0;
    
    // Generate cliff lines using sharp transitions in noise
    const cliffScale = 3.5;
    const cliffNoise = improvedNoise(lon * cliffScale, lat * cliffScale, 1500);
    
    // Create sharp discontinuities for cliff faces
    const cliffThreshold = 0.3;
    if (Math.abs(cliffNoise) > cliffThreshold) {
        // Determine cliff height and direction
        const cliffHeight = (Math.abs(cliffNoise) - cliffThreshold) * cliffDensity;
        const cliffDirection = cliffNoise > 0 ? 1 : -1;
        
        // Create step function for sharp cliff face
        const stepFunction = cliffDirection > 0 ? 
            Math.floor((cliffNoise + 1) * 4) / 4 : 
            Math.ceil((cliffNoise - 1) * 4) / 4;
        
        cliffEffect += stepFunction * cliffHeight * 80; // EXTREME cliffs
        
        // Add cliff face texture using high frequency noise
        const faceTexture = improvedNoise(lon * cliffScale * 8, lat * cliffScale * 8, 2000);
        cliffEffect += faceTexture * cliffHeight * 2;
    }
    
    // Generate terraced cliffs (like sedimentary layers)
    const terraceScale = 2;
    const terraceNoise = improvedNoise(lon * terraceScale, lat * terraceScale, 2500);
    
    if (Math.abs(terraceNoise) > 0.5) {
        const terraceHeight = (Math.abs(terraceNoise) - 0.5) * 2.0 * cliffDensity;
        
        // Create stepped terraces
        const stepHeight = 3;
        const numSteps = Math.floor(terraceHeight * 4) + 1;
        const steppedHeight = Math.floor(terraceHeight * stepHeight) / stepHeight * numSteps;
        
        cliffEffect += steppedHeight * 12; // More pronounced terracing
    }
    
    // Generate fault lines (linear cliff features)
    const faultScale = 1.5;
    const fault1 = improvedNoise(lon * faultScale + 0.5, lat * faultScale, 3000);
    const fault2 = improvedNoise(lon * faultScale, lat * faultScale + 0.5, 3500);
    
    // Create linear discontinuities
    const faultPattern = Math.abs(fault1 * fault2);
    if (faultPattern > 0.6) {
        const faultHeight = (faultPattern - 0.6) * 2.5 * cliffDensity;
        
        // Sharp elevation change along fault line
        const faultSign = (fault1 + fault2) > 0 ? 1 : -1;
        cliffEffect += faultSign * faultHeight * 8;
    }
    
    return cliffEffect;
}

function generateMesas(x, y, z, planetRadius, terrainProps) {
    // Convert to spherical coordinates
    const radius = Math.sqrt(x*x + y*y + z*z);
    const lat = Math.asin(y / radius);
    const lon = Math.atan2(z, x);
    
    // Get mesa density from terrain properties, with fallback
    const mesaDensity = terrainProps && terrainProps.mesaDensity !== undefined ? 
        terrainProps.mesaDensity : 0.2;
    
    if (mesaDensity <= 0) return 0;
    
    let mesaEffect = 0;
    
    // Generate large flat-topped mesas
    const mesaScale = 1.8;
    const mesaBase = improvedNoise(lon * mesaScale, lat * mesaScale, 4000);
    
    if (mesaBase > 0.4) {
        // Create flat-topped mesa with steep sides
        const mesaHeight = (mesaBase - 0.4) * 1.6 * mesaDensity;
        
        // Distance from mesa center (higher noise = closer to center)
        const distanceFromCenter = 1.0 - mesaBase;
        
        // Create flat top with steep drop-off at edges
        let mesaProfile;
        if (distanceFromCenter < 0.3) {
            // Flat top
            mesaProfile = mesaHeight;
        } else if (distanceFromCenter < 0.5) {
            // Steep sides - sharp falloff
            const sidePosition = (distanceFromCenter - 0.3) / 0.2; // 0 to 1
            mesaProfile = mesaHeight * (1.0 - Math.pow(sidePosition, 0.3)); // Sharp dropoff
        } else {
            mesaProfile = 0;
        }
        
        mesaEffect += mesaProfile * 100; // EXTREME mesas
        
        // Add mesa edge erosion details
        if (distanceFromCenter >= 0.25 && distanceFromCenter <= 0.35) {
            const erosion = improvedNoise(lon * mesaScale * 12, lat * mesaScale * 12, 4500);
            mesaEffect += erosion * mesaHeight * 3; // Edge detail
        }
    }
    
    // Generate smaller buttes (mini-mesas)
    const butteScale = 4;
    const butteNoise = improvedNoise(lon * butteScale + 200, lat * butteScale + 200, 0);
    
    if (butteNoise > 0.6) {
        const butteHeight = (butteNoise - 0.6) * 2.5 * mesaDensity;
        const butteDistanceFromCenter = 1.0 - butteNoise;
        
        // Smaller flat-topped formations
        let butteProfile;
        if (butteDistanceFromCenter < 0.2) {
            butteProfile = butteHeight;
        } else if (butteDistanceFromCenter < 0.3) {
            const sidePos = (butteDistanceFromCenter - 0.2) / 0.1;
            butteProfile = butteHeight * (1.0 - Math.pow(sidePos, 0.4));
        } else {
            butteProfile = 0;
        }
        
        mesaEffect += butteProfile * 70; // EXTREME buttes
    }
    
    // Generate plateau regions (large flat areas)
    const plateauScale = 0.8;
    const plateauNoise = improvedNoise(lon * plateauScale, lat * plateauScale, 5000);
    
    if (plateauNoise > 0.3 && plateauNoise < 0.7) {
        const plateauHeight = (0.7 - Math.abs(plateauNoise - 0.5) * 2) * mesaDensity;
        
        // Large, gently undulating flat areas
        const plateauVariation = improvedNoise(lon * plateauScale * 3, lat * plateauScale * 3, 5500);
        const flatness = plateauHeight * 8 + plateauVariation * plateauHeight * 1.5;
        
        mesaEffect += flatness;
    }
    
    return mesaEffect;
}

function generateCraters(x, y, z, planetRadius, terrainProps) {
    // Convert to spherical coordinates
    const radius = Math.sqrt(x*x + y*y + z*z);
    const lat = Math.asin(y / radius);
    const lon = Math.atan2(z, x);
    
    // Get crater density from terrain properties, with fallback
    const craterDensity = terrainProps && terrainProps.craterDensity !== undefined ? 
        terrainProps.craterDensity : 0.3;
    
    if (craterDensity <= 0) return 0;
    
    let craterEffect = 0;
    
    // Generate multiple crater sizes
    const craterSizes = [
        { scale: 2, depth: -60, density: craterDensity * 0.3 },    // EXTREME large craters
        { scale: 4, depth: -35, density: craterDensity * 0.5 },    // EXTREME medium craters  
        { scale: 8, depth: -18, density: craterDensity * 0.7 }     // EXTREME small craters
    ];
    
    craterSizes.forEach(crater => {
        // Create crater centers using noise as a pseudo-random field
        const centerNoise = improvedNoise(lon * crater.scale + 1000, lat * crater.scale + 2000, 0);
        
        if (centerNoise > (1.0 - crater.density)) {
            // Calculate distance from crater center
            const craterLat = lat + (improvedNoise(lon * crater.scale + 3000, lat * crater.scale + 4000, 0) * 0.2);
            const craterLon = lon + (improvedNoise(lon * crater.scale + 5000, lat * crater.scale + 6000, 0) * 0.2);
            
            // Calculate angular distance on sphere
            const deltaLat = lat - craterLat;
            const deltaLon = lon - craterLon;
            const distance = Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
            
            // Create crater profile (bowl shape with raised rim)
            const craterRadius = (0.15 + Math.abs(centerNoise) * 0.1) / crater.scale;
            
            if (distance < craterRadius) {
                const normalizedDist = distance / craterRadius;
                
                // Crater bowl with raised rim
                let craterProfile;
                if (normalizedDist < 0.8) {
                    // Main crater depression
                    craterProfile = Math.pow(1 - normalizedDist / 0.8, 2) * crater.depth;
                } else {
                    // Raised rim
                    const rimFactor = (normalizedDist - 0.8) / 0.2;
                    craterProfile = crater.depth * 0.1 * (1 - rimFactor) + crater.depth * 0.3 * Math.sin(rimFactor * Math.PI);
                }
                
                craterEffect += craterProfile * (1 - normalizedDist * 0.5); // Fade towards edges
            }
        }
    });
    
    return craterEffect;
}

function createBoulderField() {
    // Clear existing boulders
    boulderField.forEach(boulder => {
        if (boulder.mesh) {
            scene.remove(boulder.mesh);
        }
    });
    boulderField = [];
    
    // Get terrain configuration for boulder density
    const terrainProps = planetTypeManager.getTerrainProperties();
    const boulderDensity = terrainProps && terrainProps.boulderDensity !== undefined ? 
        terrainProps.boulderDensity : 0.3;
    
    if (boulderDensity <= 0) {
        console.log('No boulders for this planet (density = 0)');
        return;
    }
    
    const numBoulders = Math.floor(maxBoulders * boulderDensity);
    
    // Get planet-specific boulder color
    const materialProps = planetTypeManager.getMaterialProperties();
    let boulderColor = 0x8B7355; // Default rocky color
    
    if (materialProps && materialProps.boulderColor) {
        boulderColor = materialProps.boulderColor;
    } else if (materialProps && materialProps.color) {
        // Darken the planet color for boulders
        const planetColor = materialProps.color;
        const r = Math.max(0, ((planetColor >> 16) & 0xFF) - 40);
        const g = Math.max(0, ((planetColor >> 8) & 0xFF) - 40);  
        const b = Math.max(0, (planetColor & 0xFF) - 40);
        boulderColor = (r << 16) | (g << 8) | b;
    }
    
    for (let i = 0; i < numBoulders; i++) {
        // Generate random position on sphere
        const lat = (Math.random() - 0.5) * Math.PI; // -π/2 to π/2
        const lon = Math.random() * Math.PI * 2;     // 0 to 2π
        
        // Convert to Cartesian coordinates
        const x = Math.cos(lat) * Math.cos(lon);
        const y = Math.sin(lat);
        const z = Math.cos(lat) * Math.sin(lon);
        
        // Get surface height at this position
        const surfaceHeight = getSurfaceHeightAtPosition(
            x * planetRadius, 
            z * planetRadius
        );
        
        // Create boulder mesh
        const boulderSize = 0.8 + Math.random() * 2.5; // Random size 0.8-3.3
        const boulderGeometry = createBoulderGeometry(boulderSize);
        const boulderMaterial = new THREE.MeshLambertMaterial({ 
            color: boulderColor,
            flatShading: true
        });
        
        const boulderMesh = new THREE.Mesh(boulderGeometry, boulderMaterial);
        
        // Position boulder on surface
        const surfaceNormal = new THREE.Vector3(x, y, z).normalize();
        const position = surfaceNormal.multiplyScalar(surfaceHeight + boulderSize * 0.3);
        boulderMesh.position.copy(position);
        
        // Random rotation
        boulderMesh.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        // Enable shadows
        boulderMesh.castShadow = true;
        boulderMesh.receiveShadow = true;
        
        planet.add(boulderMesh); // Add to planet so they rotate with it
        
        boulderField.push({
            mesh: boulderMesh,
            position: position.clone(),
            size: boulderSize
        });
    }
    
    console.log(`Created ${numBoulders} boulders with color:`, boulderColor.toString(16));
}

function createBoulderGeometry(size) {
    // Create boulder with multiple connected sections
    const numSections = 2 + Math.floor(Math.random() * 3); // 2-4 connected sections
    const geometries = [];
    
    for (let i = 0; i < numSections; i++) {
        // Create each section with varying sizes
        const sectionSize = size * (0.4 + Math.random() * 0.4); // 40-80% of main size
        const sectionGeometry = new THREE.IcosahedronGeometry(sectionSize, 2);
        
        // Position sections to overlap/connect
        const angle = (i / numSections) * Math.PI * 2 + Math.random() * 0.5;
        const distance = size * (0.3 + Math.random() * 0.3); // Overlap for connection
        
        const offsetX = Math.cos(angle) * distance;
        const offsetY = (Math.random() - 0.5) * size * 0.4; // Vertical variation
        const offsetZ = Math.sin(angle) * distance;
        
        // Apply position offset to all vertices
        const vertices = sectionGeometry.attributes.position.array;
        for (let j = 0; j < vertices.length; j += 3) {
            vertices[j] += offsetX;     // X
            vertices[j + 1] += offsetY; // Y  
            vertices[j + 2] += offsetZ; // Z
            
            // Add slight deformation to each section
            const deformation = 0.8 + Math.random() * 0.15; // 0.8 to 0.95 scale factor
            const noise = improvedNoise(vertices[j] * 2, vertices[j + 1] * 2, vertices[j + 2] * 2) * 0.05;
            const scale = deformation + noise;
            
            vertices[j] *= scale;
            vertices[j + 1] *= scale;
            vertices[j + 2] *= scale;
        }
        
        sectionGeometry.attributes.position.needsUpdate = true;
        geometries.push(sectionGeometry);
    }
    
    // Merge all sections into one geometry properly
    const mergedGeometry = new THREE.BufferGeometry();
    const mergedVertices = [];
    const mergedIndices = [];
    let vertexOffset = 0;
    
    geometries.forEach(geo => {
        const vertices = geo.attributes.position.array;
        
        // Add vertices
        for (let i = 0; i < vertices.length; i++) {
            mergedVertices.push(vertices[i]);
        }
        
        // Handle indices - generate them if they don't exist
        let indices;
        if (geo.index) {
            indices = geo.index.array;
        } else {
            // Generate indices for non-indexed geometry
            indices = [];
            for (let i = 0; i < vertices.length / 3; i++) {
                indices.push(i);
            }
        }
        
        // Add indices with offset
        for (let i = 0; i < indices.length; i++) {
            mergedIndices.push(indices[i] + vertexOffset);
        }
        
        vertexOffset += vertices.length / 3;
    });
    
    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(mergedVertices, 3));
    mergedGeometry.setIndex(mergedIndices);
    mergedGeometry.computeVertexNormals();
    
    return mergedGeometry;
}

function createPlanet(planetType = null) {
    // Get planet configuration  
    const materialProps = planetTypeManager.getMaterialProperties(planetType);
    const terrainProps = planetTypeManager.getTerrainProperties(planetType);
    const configuredRadius = planetTypeManager.getPlanetRadius(planetType);

    // Update global planetRadius with configured value
    planetRadius = configuredRadius;
    
    // Reset rover physics position to start above the new planet surface
    roverPhysicsPosition.set(0, planetRadius + 20, 0);
    
    // Use fallback values if configuration isn't loaded
    const planetColor = materialProps ? materialProps.color : 0x8B4513;
    const flatShading = materialProps ? materialProps.flatShading : true;
    const noiseScale = terrainProps ? terrainProps.noiseScale : 0.1;
    const heightVariation = terrainProps ? terrainProps.heightVariation : 3;
    
    // Create higher quality planet sphere with subdivision level scaled to radius
    const baseRadius = 80; // Reference radius for subdivision calibration
    const baseSubdivisions = 12; // Base subdivision level for radius 80
    const subdivisions = Math.round(baseSubdivisions * Math.sqrt(planetRadius / baseRadius));
    const geometry = new THREE.IcosahedronGeometry(planetRadius, subdivisions);
    
    // Add structured terrain variation using multiple noise algorithms
    const vertices = geometry.attributes.position.array;
    const uniqueVertices = new Map();
    
    // First pass: identify unique vertices and apply layered noise
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
        
        if (!uniqueVertices.has(key)) {
            const vertex = new THREE.Vector3(x, y, z);
            const distance = vertex.length();
            
            // Apply multiple noise layers for realistic terrain
            let baseNoise = generateLayeredNoise(x, y, z, noiseScale, heightVariation);
            
            // Add mountain and hill formations
            const mountainNoise = generateMountains(x, y, z, planetRadius, terrainProps);
            baseNoise += mountainNoise;
            
            // Add valleys and canyons
            const valleyNoise = generateValleys(x, y, z, planetRadius, terrainProps);
            baseNoise += valleyNoise;
            
            // Add cliff faces and steep terrain
            const cliffNoise = generateCliffs(x, y, z, planetRadius, terrainProps);
            baseNoise += cliffNoise;
            
            // Add mesa and plateau formations
            const mesaNoise = generateMesas(x, y, z, planetRadius, terrainProps);
            baseNoise += mesaNoise;
            
            // Add crater features
            const craterNoise = generateCraters(x, y, z, planetRadius, terrainProps);
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
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Planet material using configuration
    const material = new THREE.MeshLambertMaterial({ 
        color: planetColor,
        flatShading: flatShading
    });
    
    planet = new THREE.Mesh(geometry, material);
    planet.receiveShadow = true;
    scene.add(planet);
}

function createRover() {
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
    
    rover = roverGroup;
    
    positionRoverOnPlanet();
    scene.add(rover);
}

function cleanupScene() {
    // Debug: Log all objects in the scene and remove suspicious ones
    console.log('=== SCENE CLEANUP DEBUG ===');
    console.log('Total scene children:', scene.children.length);
    
    const objectsToRemove = [];
    
    scene.children.forEach((child, index) => {
        console.log(`Child ${index}:`, child.type, child.constructor.name);
        
        // Remove any remaining particle meshes or suspicious objects
        if (child.type === 'Mesh' && child.geometry && 
            (child.geometry.type === 'SphereGeometry') && 
            child !== planet && child !== rover) {
            
            // Check if it's a small sphere (likely a particle)
            const sphereGeo = child.geometry;
            if (sphereGeo.parameters && sphereGeo.parameters.radius < 3) {
                console.log('Removing suspicious small sphere:', child);
                objectsToRemove.push(child);
            }
        }
    });
    
    // Remove suspicious objects
    objectsToRemove.forEach(obj => scene.remove(obj));
    
    console.log(`Removed ${objectsToRemove.length} suspicious objects`);
    console.log('=== END SCENE CLEANUP ===');
}

function createDustParticleSystem() {
    // Clear any existing dust particles
    dustParticles.forEach(particle => {
        if (particle.mesh) {
            scene.remove(particle.mesh);
        }
    });
    dustParticles = [];
    
    // Create particle pool
    for (let i = 0; i < maxDustParticles; i++) {
        const particleGeometry = new THREE.SphereGeometry(1.0, 6, 6); // Larger base size
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xD2B48C, // Sandy brown color like original
            transparent: true,
            opacity: 0.7
        });
        
        const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
        particleMesh.visible = false;
        scene.add(particleMesh);
        
        dustParticles.push({
            mesh: particleMesh,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            life: 0,
            maxLife: 1.0,
            size: 0.3 + Math.random() * 0.5, // Variable size 0.3-0.8
            alpha: 1.0,
            planetRotationAtSpawn: new THREE.Quaternion()
        });
    }
    
    console.log('Created dust particle system with', maxDustParticles, 'particles');
}


function spawnDustParticles(position, velocity, count = 5) {
    // Find available particles
    for (let i = 0; i < count && i < maxDustParticles; i++) {
        // Find first dead particle
        const deadParticleIndex = dustParticles.findIndex(p => p.life <= 0);
        if (deadParticleIndex === -1) break;
        
        const particle = dustParticles[deadParticleIndex];
        
        // Convert world position to planet-local coordinates
        const localPosition = position.clone();
        localPosition.x += (Math.random() - 0.5) * 4; // Spread around rover
        localPosition.z += (Math.random() - 0.5) * 4;
        
        // Convert to planet-local coordinates by applying inverse planet rotation
        const inverseQuaternion = planetQuaternion.clone().invert();
        localPosition.applyQuaternion(inverseQuaternion);
        
        // Set particle properties in planet-local space
        particle.position.copy(localPosition);
        
        // Convert velocity to planet-local space as well
        const localVelocity = velocity.clone();
        localVelocity.x += (Math.random() - 0.5) * 0.5; // More sideways spread for movement
        localVelocity.y += Math.random() * 0.8 + 0.2; // More upward motion for visible arcs
        localVelocity.z += (Math.random() - 0.5) * 0.5; // More sideways spread
        localVelocity.applyQuaternion(inverseQuaternion);
        
        particle.velocity.copy(localVelocity);
        particle.life = 0.8; // Much shorter life for more realistic dust
        particle.maxLife = 0.8; 
        particle.size = 0.3 + Math.random() * 0.5; // Much smaller size variation
        particle.alpha = 0.8;
        particle.planetRotationAtSpawn.copy(planetQuaternion); // Store current planet rotation
    }
}

function updateDustParticles() {
    let aliveParticles = 0;
    for (let i = 0; i < dustParticles.length; i++) {
        const particle = dustParticles[i];
        
        if (particle.life > 0) {
            aliveParticles++;
            
            // Update physics in planet-local space with gravitational pull toward planet center
            
            // Calculate distance from planet center
            const distanceFromCenter = particle.position.length();
            
            // Apply gentler radial gravity toward planet center (simulates planetary gravity)
            if (distanceFromCenter > planetRadius + 5) { // Only apply when significantly above surface
                const gravityDirection = particle.position.clone().normalize().multiplyScalar(-1);
                const gravityStrength = 0.02; // Much gentler gravity
                const gravityForce = gravityDirection.multiplyScalar(gravityStrength);
                particle.velocity.add(gravityForce);
            }
            
            // Apply gentler air resistance
            particle.velocity.multiplyScalar(0.96); // Less air resistance for more movement 
            
            // Update position
            particle.position.add(particle.velocity);
            
            // Gentler surface interaction - only when very close to surface
            const surfaceDistance = distanceFromCenter - planetRadius;
            if (surfaceDistance < 1) { // Within 1 unit of surface
                // Soft bounce with less energy loss
                const surfaceNormal = particle.position.clone().normalize();
                const velocityDotNormal = particle.velocity.dot(surfaceNormal);
                
                if (velocityDotNormal < 0) { // Moving toward surface
                    // Gentler reflection with less damping
                    const reflection = surfaceNormal.multiplyScalar(velocityDotNormal * 2);
                    particle.velocity.sub(reflection);
                    particle.velocity.multiplyScalar(0.7); // Less energy loss on bounce
                    
                    // Push particle slightly away from surface
                    particle.position.normalize().multiplyScalar(planetRadius + 1.5);
                }
            }
            
            // Update life
            particle.life -= 0.016; // ~60fps frame time
            
            // Calculate fade alpha
            const fadeAlpha = Math.max(0, particle.life / particle.maxLife);
            
            // Convert planet-local position to world position by applying current planet rotation
            const worldPosition = particle.position.clone();
            worldPosition.applyQuaternion(planetQuaternion);
            
            // Update mesh position and visibility
            particle.mesh.position.copy(worldPosition);
            particle.mesh.visible = true;
            particle.mesh.material.opacity = fadeAlpha * 0.8;
            
            // Scale particle as it fades - original larger scale
            const scale = particle.size * (0.5 + fadeAlpha * 0.8);
            particle.mesh.scale.setScalar(scale);
        } else {
            // Hide dead particles
            particle.mesh.visible = false;
            particle.mesh.position.set(0, -1000, 0);
        }
    }
    
    // Optional debug logging (removed for cleaner console)
}

function createAmbientParticleSystem() {
    // Clear any existing ambient particles
    ambientParticles.forEach(particle => {
        if (particle.mesh) {
            scene.remove(particle.mesh);
        }
    });
    ambientParticles = [];
    
    // Create ambient atmospheric particles
    for (let i = 0; i < maxAmbientParticles; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.8, 6, 6); // Much larger
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xE6E6FA, // Light lavender like original atmospheric particles
            transparent: true,
            opacity: 0.15
        });
        
        const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Random position around planet
        const distance = planetRadius + 20 + Math.random() * 40;
        const lat = (Math.random() - 0.5) * Math.PI;
        const lon = Math.random() * Math.PI * 2;
        
        const x = distance * Math.cos(lat) * Math.cos(lon);
        const y = distance * Math.sin(lat);
        const z = distance * Math.cos(lat) * Math.sin(lon);
        
        particleMesh.position.set(x, y, z);
        scene.add(particleMesh);
        
        ambientParticles.push({
            mesh: particleMesh,
            position: new THREE.Vector3(x, y, z),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.1
            ),
            time: Math.random() * Math.PI * 2,
            bobOffset: Math.random() * Math.PI * 2,
            bobHeight: 0.5 + Math.random() * 1.0,
            baseOpacity: 0.1 + Math.random() * 0.15 // Lower base opacity for subtlety
        });
    }
    
    console.log('Created ambient particle system with', maxAmbientParticles, 'particles');
}

function updateAmbientParticles() {
    const deltaTime = 0.016; // ~60fps
    
    for (let i = 0; i < ambientParticles.length; i++) {
        const particle = ambientParticles[i];
        particle.time += deltaTime;
        
        // Gentle horizontal drift
        particle.position.add(particle.velocity);
        
        // Vertical bobbing motion
        const bobOffset = Math.sin(particle.time * 2 + particle.bobOffset) * particle.bobHeight * deltaTime;
        particle.position.y += bobOffset;
        
        // Keep particles within bounds (sphere around planet)
        const distanceFromCenter = particle.position.length();
        const minDistance = planetRadius + 8;
        const maxDistance = planetRadius + 60;
        
        if (distanceFromCenter < minDistance) {
            particle.position.normalize().multiplyScalar(minDistance);
        } else if (distanceFromCenter > maxDistance) {
            particle.position.normalize().multiplyScalar(maxDistance);
        }
        
        // Gentle random velocity changes for organic movement
        if (Math.random() < 0.01) { // 1% chance per frame to change direction slightly
            particle.velocity.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.005,
                (Math.random() - 0.5) * 0.01
            ));
            
            // Clamp velocity to reasonable limits
            const maxVel = 0.15;
            if (particle.velocity.length() > maxVel) {
                particle.velocity.normalize().multiplyScalar(maxVel);
            }
        }
        
        // Apply planet rotation to particle position
        const worldPosition = particle.position.clone();
        worldPosition.applyQuaternion(planetQuaternion);
        particle.mesh.position.copy(worldPosition);
        
        // Keep particles at consistent opacity for better atmospheric visibility
        particle.mesh.material.opacity = particle.baseOpacity;
    }
}

function positionRoverOnPlanet() {
    // Apply quaternion rotation to planet first
    planet.quaternion.copy(planetQuaternion);
    
    // Only handle yaw rotation for heading - physics system now handles pitch/roll
    roverRotation.yaw = lerp(roverRotation.yaw, -roverHeading, rotationLerpSpeed);
    
    // Update position display with wheel contact info
    const contactResults = calculateGroundContact();
    const groundStatus = isGrounded ? `Grounded (${contactResults.groundedCount}/4 wheels)` : "Airborne";
    document.getElementById('position').textContent = 
        `Lat: ${roverPosition.lat.toFixed(1)}, Lon: ${roverPosition.lon.toFixed(1)}, Heading: ${(roverHeading * 180 / Math.PI).toFixed(1)}° | ${groundStatus}`;
}

function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

function calculateWheelBasedRotation() {
    // Calculate rover orientation from wheel contact heights
    const frontLeftHeight = wheelContacts["front-left"].height;
    const frontRightHeight = wheelContacts["front-right"].height;
    const rearLeftHeight = wheelContacts["rear-left"].height;
    const rearRightHeight = wheelContacts["rear-right"].height;
    
    // Calculate average heights for front and rear
    const frontAverage = (frontLeftHeight + frontRightHeight) / 2;
    const rearAverage = (rearLeftHeight + rearRightHeight) / 2;
    
    // Calculate average heights for left and right  
    const leftAverage = (frontLeftHeight + rearLeftHeight) / 2;
    const rightAverage = (frontRightHeight + rearRightHeight) / 2;
    
    // Calculate pitch from front-to-rear height difference
    const wheelBase = 4; // Distance between front and rear wheels (2 + 2)
    const pitch = Math.atan2(frontAverage - rearAverage, wheelBase);
    
    // Calculate roll from left-to-right height difference  
    const wheelTrack = 5; // Distance between left and right wheels (2.5 + 2.5)
    const roll = Math.atan2(rightAverage - leftAverage, wheelTrack);
    
    return {
        pitch: pitch * 0.8, // Dampen the effect for stability
        roll: roll * 0.8,   // Dampen the effect for stability
        yaw: 0
    };
}

function calculateTerrainRotation(surfaceNormal) {
    // Legacy function - kept for fallback
    // Surface normal is already in local rover space from our height sampling method
    
    // Calculate pitch (forward/backward tilt)
    // When surface slopes up toward +Z (forward), rover should pitch up (negative pitch)
    const pitch = -Math.atan2(surfaceNormal.z, surfaceNormal.y);
    
    // Calculate roll (left/right tilt)  
    // When surface slopes up toward +X (right), rover should roll right (positive roll)
    const roll = Math.atan2(surfaceNormal.x, surfaceNormal.y);
    
    return {
        pitch: pitch * 0.8, // Increase tilt intensity to make effect more visible
        roll: roll * 0.8,   // Increase tilt intensity to make effect more visible
        yaw: 0
    };
}

function getSurfaceHeightAtPosition(localX, localZ) {
    // Raycast to find surface height - start much higher for extreme terrain
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3(localX, planetRadius + 150, localZ); // Much higher start point
    const direction = new THREE.Vector3(0, -1, 0);
    
    raycaster.set(origin, direction);
    const intersects = raycaster.intersectObject(planet);
    
    if (intersects.length > 0) {
        return intersects[0].point.y;
    }
    return planetRadius; // fallback
}

function getSurfaceInfoAtPosition(localX, localZ) {
    // Get height at center position
    const centerHeight = getSurfaceHeightAtPosition(localX, localZ);
    
    // Sample nearby points to calculate surface normal
    const sampleDistance = 1.0;
    const frontHeight = getSurfaceHeightAtPosition(localX, localZ + sampleDistance);
    const backHeight = getSurfaceHeightAtPosition(localX, localZ - sampleDistance);
    const rightHeight = getSurfaceHeightAtPosition(localX + sampleDistance, localZ);
    const leftHeight = getSurfaceHeightAtPosition(localX - sampleDistance, localZ);
    
    // Calculate surface normal from height differences
    const normal = new THREE.Vector3();
    
    // X component (left-right slope)
    normal.x = (leftHeight - rightHeight) / (2 * sampleDistance);
    
    // Y component (always points up)
    normal.y = 1.0;
    
    // Z component (front-back slope)  
    normal.z = (backHeight - frontHeight) / (2 * sampleDistance);
    
    // Normalize the surface normal
    normal.normalize();
    
    return {
        height: centerHeight,
        normal: normal,
        point: new THREE.Vector3(localX, centerHeight, localZ)
    };
}

function addLighting(planetType = null) {
    // Get lighting configuration
    const lightingProps = planetTypeManager.getLightingProperties(planetType);
    
    // Use fallback values if configuration isn't loaded
    const ambientColor = lightingProps ? lightingProps.ambient.color : 0x404040;
    const ambientIntensity = lightingProps ? lightingProps.ambient.intensity : 0.3;
    const sunColor = lightingProps ? lightingProps.sun.color : 0xffffff;
    const sunIntensity = lightingProps ? lightingProps.sun.intensity : 0.8;
    const sunPosition = lightingProps ? lightingProps.sun.position : [100, 50, 50];
    
    // Remove existing lights
    const existingLights = scene.children.filter(child => 
        child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight
    );
    existingLights.forEach(light => scene.remove(light));
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(sunColor, sunIntensity);
    directionalLight.position.set(sunPosition[0], sunPosition[1], sunPosition[2]);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
}

function applyAtmosphericFog(planetType = null) {
    // Get atmosphere configuration
    const atmosphereProps = planetTypeManager.getAtmosphereProperties(planetType);
    
    // Clear existing fog
    scene.fog = null;
    
    // Apply fog if the planet has atmospheric settings
    if (atmosphereProps && atmosphereProps.fog) {
        const fogSettings = atmosphereProps.fog;
        
        // Use exponential fog for more realistic atmospheric depth
        scene.fog = new THREE.FogExp2(
            fogSettings.color,
            fogSettings.density
        );
        
        console.log('Applied atmospheric fog:', {
            color: fogSettings.color.toString(16),
            density: fogSettings.density
        });
    } else {
        console.log('No atmospheric fog (clear atmosphere or no config)');
    }
}

function setupControls() {
    // Keyboard controls
    document.addEventListener('keydown', (event) => {
        keys[event.code] = true;
    });
    
    document.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });
    
    // Mouse controls for camera - simpler rotation around rover
    let mouseDown = false;
    let mouseX = 0, mouseY = 0;
    let cameraAngle = { theta: 0, phi: 1.1};
    
    function updateCameraPosition() {
        const distance = 60;
        const x = distance * Math.sin(cameraAngle.phi) * Math.cos(cameraAngle.theta);
        const y = distance * Math.cos(cameraAngle.phi) + planetRadius;
        const z = distance * Math.sin(cameraAngle.phi) * Math.sin(cameraAngle.theta);
        
        camera.position.set(x, y, z);
        camera.lookAt(rover.position);
    }
    
    document.addEventListener('mousedown', (event) => {
        mouseDown = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
    
    document.addEventListener('mouseup', () => {
        mouseDown = false;
    });
    
    document.addEventListener('mousemove', (event) => {
        if (!mouseDown) return;
        
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;
        
        cameraAngle.theta -= deltaX * 0.01;
        cameraAngle.phi += deltaY * 0.01;
        cameraAngle.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraAngle.phi));
        
        updateCameraPosition();
        
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
    
    // Initialize camera position
    updateCameraPosition();
    
    // Make updateCameraPosition globally accessible for delayed initialization
    window.updateCameraPosition = updateCameraPosition;
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function handleRoverMovement() {
    // Scale movement speed inversely with planet radius for consistent surface speed
    const baseRadius = 80; // Reference radius for speed calibration
    const moveSpeed = 0.02 * (baseRadius / planetRadius);
    const turnSpeed = 0.03;
    let moved = false;
    let forwardMovement = false; // Track if rover is actually moving forward/backward
    
    // No hotkey handling needed
    
    // Simple tank controls: A/D turn, W/S move forward/backward
    if (keys['KeyA']) {
        roverHeading -= turnSpeed; // Flip sign
        moved = true;
    }
    if (keys['KeyD']) {
        roverHeading += turnSpeed; // Flip sign
        moved = true;
    }
    
    // Movement using quaternion rotation to avoid gimbal lock
    if (keys['KeyW']) {
        // Forward movement - rotation axis perpendicular to heading direction
        const rotationAxis = new THREE.Vector3(Math.cos(roverHeading), 0, Math.sin(roverHeading));
        const rotationQuaternion = new THREE.Quaternion();
        rotationQuaternion.setFromAxisAngle(rotationAxis, -moveSpeed); // Flip sign
        planetQuaternion.multiplyQuaternions(rotationQuaternion, planetQuaternion);
        moved = true;
        forwardMovement = true;
    }
    if (keys['KeyS']) {
        // Backward movement - opposite of forward
        const rotationAxis = new THREE.Vector3(Math.cos(roverHeading), 0, Math.sin(roverHeading));
        const rotationQuaternion = new THREE.Quaternion();
        rotationQuaternion.setFromAxisAngle(rotationAxis, moveSpeed); // Flip sign
        planetQuaternion.multiplyQuaternions(rotationQuaternion, planetQuaternion);
        moved = true;
        forwardMovement = true;
    }
    
    // Wrap longitude for display purposes only
    if (roverPosition.lon > 180) roverPosition.lon -= 360;
    if (roverPosition.lon < -180) roverPosition.lon += 360;
    
    if (moved) {
        // Spawn dust particles when rover moves on ground
        if (forwardMovement && isGrounded && Date.now() - lastRoverMovement > 150) {
            // Spawn particles from rear wheel positions for proper trail effect
            const rearLeftWheel = new THREE.Vector3(-2.5, 0, -2); // Local wheel position
            const rearRightWheel = new THREE.Vector3(2.5, 0, -2); // Local wheel position
            
            // Transform wheel positions to world space based on rover rotation
            const cosYaw = Math.cos(roverRotation.yaw);
            const sinYaw = Math.sin(roverRotation.yaw);
            
            // Left wheel world position
            const leftWheelWorld = new THREE.Vector3(
                roverPhysicsPosition.x + rearLeftWheel.x * cosYaw - rearLeftWheel.z * sinYaw,
                roverPhysicsPosition.y - 1, // Lower to ground level
                roverPhysicsPosition.z + rearLeftWheel.x * sinYaw + rearLeftWheel.z * cosYaw
            );
            
            // Right wheel world position  
            const rightWheelWorld = new THREE.Vector3(
                roverPhysicsPosition.x + rearRightWheel.x * cosYaw - rearRightWheel.z * sinYaw,
                roverPhysicsPosition.y - 1, // Lower to ground level
                roverPhysicsPosition.z + rearRightWheel.x * sinYaw + rearRightWheel.z * cosYaw
            );
            
            const movementVelocity = new THREE.Vector3(
                Math.sin(roverHeading) * 0.15, // Reduced motion
                0.08, // Even less upward motion
                -Math.cos(roverHeading) * 0.15 // Reduced backward motion  
            );
            
            // Spawn particles from both rear wheels
            spawnDustParticles(leftWheelWorld, movementVelocity, 1);
            spawnDustParticles(rightWheelWorld, movementVelocity, 1);
            
            
            lastRoverMovement = Date.now();
        }
        
        positionRoverOnPlanet();
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    handleRoverMovement();
    updateRoverPhysics(); // New physics update
    updateDustParticles(); // Update particle system
    updateAmbientParticles(); // Update ambient atmospheric particles
    
    // Update camera to continuously follow rover
    if (window.updateCameraPosition) {
        window.updateCameraPosition();
    }
    
    // No auto-rotation - planet only moves with rover movement
    
    renderer.render(scene, camera);
}

function updateRoverPhysics() {
    // Apply gravity acceleration
    roverVelocity.y += gravity;
    
    // Apply air resistance
    roverVelocity.multiplyScalar(airDamping);
    
    // Apply settling assistance - extra downward force when close to ground
    const settlingDistance = 3.0; // Distance within which settling assistance applies
    const lowestPossibleContact = getLowestPossibleContactHeight();
    if (lowestPossibleContact !== null) {
        const distanceToGround = roverPhysicsPosition.y - lowestPossibleContact;
        if (distanceToGround > 0 && distanceToGround < settlingDistance) {
            // Apply gentle settling force
            const settlingForce = -0.1 * (1 - distanceToGround / settlingDistance);
            roverVelocity.y += settlingForce;
        }
    }
    
    // Update physics position with velocity
    roverPhysicsPosition.add(roverVelocity);
    
    // Check ground contact for each wheel and update rover orientation naturally
    updateWheelContactsAndOrientation();
    
    // Determine overall ground contact and lowest contact point
    const contactResults = calculateGroundContact();
    const wasGrounded = isGrounded;
    isGrounded = contactResults.anyGrounded;
    
    if (contactResults.lowestContactHeight !== null) {
        const groundDistance = roverPhysicsPosition.y - contactResults.lowestContactHeight;
        
        if (groundDistance <= 0.2) { // Close enough to ground to be considered "touching"
            // Landing dust particles
            const landingImpact = Math.abs(roverVelocity.y);
            if (!wasGrounded && isGrounded && landingImpact > 0.3) {
                // Rover just landed with significant impact - reduced particle count
                spawnDustParticles(
                    roverPhysicsPosition.clone(),
                    new THREE.Vector3(0, landingImpact * 0.5, 0), // Much less upward velocity
                    Math.min(Math.floor(landingImpact * 5) + 1, 4) // Fewer particles, max 4
                );
                lastLandingTime = Date.now();
            }
            
            // Settle rover onto ground
            roverPhysicsPosition.y = contactResults.lowestContactHeight;
            
            // Apply bounce/damping to vertical velocity
            if (roverVelocity.y < 0) { // Only if moving downward
                roverVelocity.y *= -groundDamping; // Reverse and reduce velocity
                
                // Stop very small bounces - be more aggressive about settling
                if (Math.abs(roverVelocity.y) < 0.05) {
                    roverVelocity.y = 0;
                }
            }
            
            // If rover is very close to settled, snap it down
            if (Math.abs(groundDistance) < 0.05 && Math.abs(roverVelocity.y) < 0.02) {
                roverPhysicsPosition.y = contactResults.lowestContactHeight;
                roverVelocity.y = 0;
            }
        }
    }
    
    // Update rover visual position to match physics
    rover.position.copy(roverPhysicsPosition);
}

function updateWheelContactsAndOrientation() {
    // Get ground heights at each wheel position (ignoring current rover rotation)
    const wheelHeights = {};
    
    wheelOffsets.forEach(wheel => {
        // Calculate wheel position relative to rover center (in local coordinates)
        const wheelWorldX = roverPhysicsPosition.x + wheel.x * Math.cos(roverRotation.yaw) - wheel.z * Math.sin(roverRotation.yaw);
        const wheelWorldZ = roverPhysicsPosition.z + wheel.x * Math.sin(roverRotation.yaw) + wheel.z * Math.cos(roverRotation.yaw);
        
        // Get ground height at this wheel position
        const groundHeight = getSurfaceHeightAtPosition(wheelWorldX, wheelWorldZ);
        wheelHeights[wheel.name] = groundHeight;
        
        // Update wheel contact info
        wheelContacts[wheel.name].height = groundHeight + 1.0; // Rover center height when wheel touches
        wheelContacts[wheel.name].grounded = roverPhysicsPosition.y <= groundHeight + 1.8; // More generous tolerance for contact detection
    });
    
    // Calculate natural rover orientation from ground heights
    const frontLeftH = wheelHeights["front-left"];
    const frontRightH = wheelHeights["front-right"];  
    const rearLeftH = wheelHeights["rear-left"];
    const rearRightH = wheelHeights["rear-right"];
    
    // Calculate pitch from front-to-rear slope
    const frontAvg = (frontLeftH + frontRightH) / 2;
    const rearAvg = (rearLeftH + rearRightH) / 2;
    const wheelBase = 4; // Distance between front and rear axles
    const targetPitch = Math.atan2(frontAvg - rearAvg, wheelBase) * 0.7; // Dampen for stability
    
    // Calculate roll from left-to-right slope  
    const leftAvg = (frontLeftH + rearLeftH) / 2;
    const rightAvg = (frontRightH + rearRightH) / 2;
    const wheelTrack = 5; // Distance between left and right wheels
    const targetRoll = Math.atan2(rightAvg - leftAvg, wheelTrack) * 0.7; // Dampen for stability
    
    // Apply gravitational torque for realistic tilting
    applyGravitationalTorque(wheelHeights);
    
    // Apply rotation smoothly but responsively
    if (isGrounded) {
        const responsiveness = 0.3; // How quickly rover follows terrain (higher = more responsive)
        roverRotation.pitch = lerp(roverRotation.pitch, targetPitch, responsiveness);
        roverRotation.roll = lerp(roverRotation.roll, targetRoll, responsiveness);
        
        // Apply the rotation to the rover
        rover.rotation.set(roverRotation.pitch, roverRotation.yaw, roverRotation.roll);
    }
}

function applyGravitationalTorque(wheelHeights) {
    // Get grounded wheel positions in world space
    const groundedWheelPositions = [];
    
    wheelOffsets.forEach(wheel => {
        if (wheelContacts[wheel.name].grounded) {
            // Transform wheel position to world coordinates
            const wheelWorldX = roverPhysicsPosition.x + wheel.x * Math.cos(roverRotation.yaw) - wheel.z * Math.sin(roverRotation.yaw);
            const wheelWorldZ = roverPhysicsPosition.z + wheel.x * Math.sin(roverRotation.yaw) + wheel.z * Math.cos(roverRotation.yaw);
            groundedWheelPositions.push({ x: wheelWorldX, z: wheelWorldZ, localX: wheel.x, localZ: wheel.z });
        }
    });
    
    // Need at least one contact point for stability analysis
    if (groundedWheelPositions.length === 0) return;
    
    // Calculate center of mass projection onto ground plane  
    const centerOfMassLocal = { x: 0, z: 0 }; // Rover center of mass is at geometric center
    
    // Check if center of mass is supported by contact points
    const isStable = isCenterOfMassSupported(centerOfMassLocal, groundedWheelPositions);
    
    if (!isStable) {
        // Calculate torque direction to tip rover toward stability
        const stabilityTorque = calculateStabilityTorque(centerOfMassLocal, groundedWheelPositions);
        
        // Apply the torque
        const torqueStrength = 0.12; // Increased for more decisive tipping
        roverAngularVelocity.x += stabilityTorque.pitch * torqueStrength;
        roverAngularVelocity.z += stabilityTorque.roll * torqueStrength;
    }
    
    // Apply angular damping
    roverAngularVelocity.multiplyScalar(angularDamping);
    
    // Apply angular velocity to rover rotation
    roverRotation.pitch += roverAngularVelocity.x * 0.03;
    roverRotation.roll += roverAngularVelocity.z * 0.03;
    
    // Limit extreme rotations
    roverRotation.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, roverRotation.pitch));
    roverRotation.roll = Math.max(-Math.PI/2, Math.min(Math.PI/2, roverRotation.roll));
}

function isCenterOfMassSupported(centerOfMass, contactPoints) {
    if (contactPoints.length === 0) return false;
    if (contactPoints.length === 1) return false; // Single point can't provide stability
    if (contactPoints.length === 2) {
        // Two points: stable only if center of mass is between them
        const p1 = contactPoints[0];
        const p2 = contactPoints[1];
        
        // Check if center of mass is on the line between the two points (with tolerance)
        const tolerance = 1.5; // Allow some distance from the line
        const distanceFromLine = distancePointToLine(centerOfMass, p1, p2);
        return distanceFromLine < tolerance;
    }
    
    // 3+ points: use polygon containment
    return isPointInPolygon(centerOfMass, contactPoints);
}

function calculateStabilityTorque(centerOfMass, contactPoints) {
    // Calculate the direction the rover needs to tip to become stable
    const torque = { pitch: 0, roll: 0 };
    
    if (contactPoints.length === 1) {
        // Single contact point - tip toward center
        const contact = contactPoints[0];
        torque.pitch = centerOfMass.z - contact.localZ > 0 ? -1 : 1;
        torque.roll = centerOfMass.x - contact.localX > 0 ? -1 : 1;
    } else if (contactPoints.length === 2) {
        // Two contact points - tip perpendicular to the line between them
        const p1 = contactPoints[0];
        const p2 = contactPoints[1];
        
        // Calculate perpendicular direction from line to center of mass
        const lineVec = { x: p2.localX - p1.localX, z: p2.localZ - p1.localZ };
        const perpendicular = { x: -lineVec.z, z: lineVec.x }; // 90-degree rotation
        
        // Normalize and apply
        const length = Math.sqrt(perpendicular.x * perpendicular.x + perpendicular.z * perpendicular.z);
        if (length > 0) {
            torque.roll = (perpendicular.x / length) * 0.5;
            torque.pitch = -(perpendicular.z / length) * 0.5;
        }
    }
    
    return torque;
}

function distancePointToLine(point, lineStart, lineEnd) {
    const A = point.x - lineStart.localX;
    const B = point.z - lineStart.localZ;
    const C = lineEnd.localX - lineStart.localX;
    const D = lineEnd.localZ - lineStart.localZ;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    const param = dot / lenSq;
    let xx, zz;
    
    if (param < 0) {
        xx = lineStart.localX;
        zz = lineStart.localZ;
    } else if (param > 1) {
        xx = lineEnd.localX;
        zz = lineEnd.localZ;
    } else {
        xx = lineStart.localX + param * C;
        zz = lineStart.localZ + param * D;
    }
    
    const dx = point.x - xx;
    const dz = point.z - zz;
    return Math.sqrt(dx * dx + dz * dz);
}

function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i].localZ > point.z) !== (polygon[j].localZ > point.z)) &&
            (point.x < (polygon[j].localX - polygon[i].localX) * (point.z - polygon[i].localZ) / (polygon[j].localZ - polygon[i].localZ) + polygon[i].localX)) {
            inside = !inside;
        }
    }
    return inside;
}

function getLowestPossibleContactHeight() {
    // Get the highest ground height under any wheel (lowest rover position needed for contact)
    const allWheelHeights = Object.values(wheelContacts).map(contact => contact.height);
    return allWheelHeights.length > 0 ? Math.max(...allWheelHeights) : null;
}

function calculateGroundContact() {
    const groundedWheels = Object.values(wheelContacts).filter(contact => contact.grounded);
    const anyGrounded = groundedWheels.length > 0;
    
    let lowestContactHeight = null;
    if (anyGrounded) {
        lowestContactHeight = Math.max(...groundedWheels.map(contact => contact.height));
    }
    
    return { anyGrounded, lowestContactHeight, groundedCount: groundedWheels.length };
}

// Planet switching function
function switchPlanet(planetType) {
    if (planetTypeManager.setPlanetType(planetType)) {
        // Remove existing planet
        if (planet) {
            scene.remove(planet);
        }
        
        // Remove existing rover and recreate it with updated materials
        if (rover) {
            scene.remove(rover);
        }
        
        // Remove existing dust particle system
        if (dustParticleSystem) {
            scene.remove(dustParticleSystem);
        }
        
        // Create new planet with the selected type
        createPlanet();
        
        // Recreate boulder field
        createBoulderField();
        
        // Recreate rover with updated materials
        createRover();
        
        // Recreate dust particle system (cleanup only - particles disabled)
        createDustParticleSystem();
        
        // Recreate ambient particle system (cleanup only - particles disabled)  
        createAmbientParticleSystem();
        
        // Update lighting for the new planet type
        addLighting();
        
        // Update atmospheric effects for the new planet type
        applyAtmosphericFog();
        
        // Reset rover position on new planet
        positionRoverOnPlanet();
        
        console.log('Switched to planet:', planetType);
        return true;
    }
    return false;
}

// Planet Selection Modal Functions
let selectedPlanetType = null;

function initializePlanetModal() {
    const modal = document.getElementById('planetModal');
    const closeBtn = document.querySelector('.close');
    const planetGrid = document.getElementById('planetGrid');
    
    // Populate planet options
    function populatePlanetOptions() {
        planetGrid.innerHTML = '';
        const planets = planetTypeManager.getAvailablePlanetTypes();
        console.log('Available planets:', planets);
        
        if (planets.length === 0) {
            planetGrid.innerHTML = '<p style="color: #ccc; text-align: center;">Loading planet configurations...</p>';
            return;
        }
        
        planets.forEach(planet => {
            const planetOption = document.createElement('div');
            planetOption.className = 'planet-option';
            planetOption.dataset.planetId = planet.id;
            
            // Get planet config for preview color
            const config = planetTypeManager.getPlanetConfig(planet.id);
            const previewColor = config ? config.material.color.replace('0x', '#') : '#8B4513';
            
            planetOption.innerHTML = `
                <div class="planet-preview" style="background-color: ${previewColor}"></div>
                <div class="planet-name">${planet.name}</div>
                <div class="planet-description">${planet.description}</div>
            `;
            
            // Mark current planet as selected
            if (planet.id === planetTypeManager.getCurrentPlanetType()) {
                planetOption.classList.add('selected');
                selectedPlanetType = planet.id;
            }
            
            planetOption.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.planet-option').forEach(opt => 
                    opt.classList.remove('selected')
                );
                // Add selection to clicked option
                planetOption.classList.add('selected');
                selectedPlanetType = planet.id;
            });
            
            planetGrid.appendChild(planetOption);
        });
        
        // Add action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'planet-buttons';
        buttonContainer.innerHTML = `
            <button class="btn btn-secondary" onclick="closePlanetModal()">Cancel</button>
            <button class="btn btn-primary" onclick="applyPlanetSelection()">Switch Planet</button>
        `;
        planetGrid.parentElement.appendChild(buttonContainer);
    }
    
    // Close modal event handlers
    closeBtn.addEventListener('click', closePlanetModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePlanetModal();
    });
    
    // Store the populate function so we can call it later
    window.repopulatePlanetOptions = populatePlanetOptions;
    
    // Don't populate immediately - wait for explicit call
    // This will be called when the modal is first opened
}

function showPlanetModal() {
    const modal = document.getElementById('planetModal');
    
    // Populate options each time modal is opened to ensure fresh data
    if (window.repopulatePlanetOptions) {
        window.repopulatePlanetOptions();
    }
    
    modal.style.display = 'block';
    selectedPlanetType = planetTypeManager.getCurrentPlanetType();
}

function closePlanetModal() {
    const modal = document.getElementById('planetModal');
    modal.style.display = 'none';
}

function applyPlanetSelection() {
    if (selectedPlanetType && selectedPlanetType !== planetTypeManager.getCurrentPlanetType()) {
        switchPlanet(selectedPlanetType);
    }
    closePlanetModal();
}

// Add keyboard shortcut for planet selection
function handlePlanetSelectionKey() {
    if (keys['KeyP']) {
        showPlanetModal();
        keys['KeyP'] = false; // Prevent repeat
    }
}

// Make functions globally accessible
window.showPlanetModal = showPlanetModal;
window.closePlanetModal = closePlanetModal;
window.applyPlanetSelection = applyPlanetSelection;

// Start the game
init().then(() => {
    // Initialize modal after game loads
    console.log('Game initialized, planet manager loaded:', planetTypeManager.loaded);
    console.log('Available planet types:', planetTypeManager.getAvailablePlanetTypes());
    initializePlanetModal();
});