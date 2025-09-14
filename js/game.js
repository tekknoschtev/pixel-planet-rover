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
    
    // Create rover
    createRover();
    
    // Add lighting
    addLighting();
    
    // Create dust particle system
    createDustParticleSystem();
    
    // Set up controls
    setupControls();
    
    // Start render loop
    animate();
    
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
    
    // Add structured terrain variation using noise function
    const vertices = geometry.attributes.position.array;
    const uniqueVertices = new Map();
    
    // First pass: identify unique vertices and apply consistent noise
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
        
        if (!uniqueVertices.has(key)) {
            const vertex = new THREE.Vector3(x, y, z);
            const distance = vertex.length();
            
            // Use position-based noise for consistency with configurable parameters
            const noise = Math.sin(x * noiseScale) * Math.cos(y * noiseScale) * Math.sin(z * noiseScale) * heightVariation;
            const newDistance = distance + noise;
            
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

function createDustParticleSystem() {
    // Create dust particles using individual small spheres instead of Points
    dustParticles = [];
    
    // Get planet-specific dust color
    const atmosphereProps = planetTypeManager.getAtmosphereProperties();
    let dustColor = 0xCC9966; // Default dust color
    
    if (atmosphereProps && atmosphereProps.particles && atmosphereProps.particles.color) {
        dustColor = atmosphereProps.particles.color;
    }
    
    // Create geometry and material for all particles
    const particleGeometry = new THREE.SphereGeometry(0.5, 4, 4); // Small low-poly sphere
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: dustColor, // Planet-specific dust color
        transparent: true,
        opacity: 0.8
    });
    
    for (let i = 0; i < maxDustParticles; i++) {
        // Create individual mesh for each particle
        const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
        particleMesh.position.set(0, -1000, 0); // Start off-screen
        particleMesh.visible = false; // Hide initially
        scene.add(particleMesh);
        
        dustParticles.push({
            mesh: particleMesh,
            position: new THREE.Vector3(0, -1000, 0), // Position in planet-local coordinates
            velocity: new THREE.Vector3(0, 0, 0), // Velocity in planet-local coordinates
            life: 0,
            maxLife: 0,
            size: 1,
            alpha: 0,
            planetRotationAtSpawn: new THREE.Quaternion() // Store planet rotation when particle was spawned
        });
    }
    
    console.log('Created', maxDustParticles, 'dust particle meshes with color:', dustColor.toString(16));
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
        particle.life = 1.5; // Shorter life for more realistic dust
        particle.maxLife = 1.5; 
        particle.size = 1 + Math.random() * 1.5; // Random size variation
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
            
            // Scale particle as it fades
            const scale = 0.5 + (1 - fadeAlpha) * 0.5;
            particle.mesh.scale.setScalar(scale);
        } else {
            // Hide dead particles
            particle.mesh.visible = false;
            particle.mesh.position.set(0, -1000, 0);
        }
    }
    
    // Optional debug logging (removed for cleaner console)
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
    // Simple raycast to find surface height at rover position
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3(localX, planetRadius + 50, localZ);
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
        // Only spawn dust particles when actually moving forward/backward and grounded
        if (forwardMovement && isGrounded && Date.now() - lastRoverMovement > 150) { // Throttle dust spawning
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
            // Detect landing for dust particles
            const landingImpact = Math.abs(roverVelocity.y);
            if (!wasGrounded && isGrounded && landingImpact > 0.3) { // Higher threshold to prevent small landing puffs
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
        
        // Recreate rover with updated materials
        createRover();
        
        // Recreate dust particle system
        createDustParticleSystem();
        
        // Update lighting for the new planet type
        addLighting();
        
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