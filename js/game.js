// Game variables
let scene, camera, renderer, planet, rover;
let planetRadius = 80;
let roverPosition = { lat: 0, lon: 0 };
let roverHeading = Math.PI / 2; // rover's facing direction in radians (start facing north)
let planetQuaternion = new THREE.Quaternion(); // Use quaternion instead of Euler rotations
let keys = {};

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    // Create camera - positioned to look at rover from behind/above
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Create planet
    createPlanet();
    
    // Create rover
    createRover();
    
    // Add lighting
    addLighting();
    
    // Set up controls
    setupControls();
    
    // Start render loop
    animate();
}

function createPlanet() {
    // Create higher quality planet sphere
    const geometry = new THREE.IcosahedronGeometry(planetRadius, 4);
    
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
            
            // Use position-based noise for consistency
            const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * Math.sin(z * 0.1) * 3;
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
    
    // Planet material - reddish like Mars
    const material = new THREE.MeshLambertMaterial({ 
        color: 0x8B4513,
        flatShading: true
    });
    
    planet = new THREE.Mesh(geometry, material);
    planet.receiveShadow = true;
    scene.add(planet);
}

function createRover() {
    const roverGroup = new THREE.Group();
    
    // Main body - a box
    const bodyGeometry = new THREE.BoxGeometry(4, 2, 6);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    body.castShadow = true;
    roverGroup.add(body);
    
    // Wheels - 4 cylinders
    const wheelGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 8);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
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
    const panelMaterial = new THREE.MeshLambertMaterial({ color: 0x000066 });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.y = 2.5;
    panel.castShadow = true;
    roverGroup.add(panel);
    
    // Headlight to show front direction
    const headlightGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const headlightMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xffff00,
        emissive: 0x444400
    });
    const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    headlight.position.set(0, 1, 3.2); // Front of rover (positive Z)
    headlight.castShadow = true;
    roverGroup.add(headlight);
    
    // Front indicator bar for even clearer direction
    const frontBarGeometry = new THREE.BoxGeometry(2, 0.3, 0.3);
    const frontBarMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const frontBar = new THREE.Mesh(frontBarGeometry, frontBarMaterial);
    frontBar.position.set(0, 1.5, 3); // Front of rover
    frontBar.castShadow = true;
    roverGroup.add(frontBar);
    
    rover = roverGroup;
    
    positionRoverOnPlanet();
    scene.add(rover);
}

function positionRoverOnPlanet() {
    // Position rover closer to surface with slight terrain following
    const surfaceHeight = getSurfaceHeightAtPosition(0, 0);
    rover.position.set(0, surfaceHeight + 1, 0);
    
    // Rotate rover to face its heading direction (flip visual rotation)
    rover.rotation.set(0, -roverHeading, 0);
    
    // Apply quaternion rotation to planet
    planet.quaternion.copy(planetQuaternion);
    
    // Update position display
    document.getElementById('position').textContent = 
        `Lat: ${roverPosition.lat.toFixed(1)}, Lon: ${roverPosition.lon.toFixed(1)}, Heading: ${(roverHeading * 180 / Math.PI).toFixed(1)}°`;
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

function addLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 50, 50);
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
    let cameraAngle = { theta: 0, phi: 0.3 };
    
    function updateCameraPosition() {
        const distance = 35;
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
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function handleRoverMovement() {
    const moveSpeed = 0.02;
    const turnSpeed = 0.03;
    let moved = false;
    
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
    }
    if (keys['KeyS']) {
        // Backward movement - opposite of forward
        const rotationAxis = new THREE.Vector3(Math.cos(roverHeading), 0, Math.sin(roverHeading));
        const rotationQuaternion = new THREE.Quaternion();
        rotationQuaternion.setFromAxisAngle(rotationAxis, moveSpeed); // Flip sign
        planetQuaternion.multiplyQuaternions(rotationQuaternion, planetQuaternion);
        moved = true;
    }
    
    // Wrap longitude for display purposes only
    if (roverPosition.lon > 180) roverPosition.lon -= 360;
    if (roverPosition.lon < -180) roverPosition.lon += 360;
    
    if (moved) {
        positionRoverOnPlanet();
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    handleRoverMovement();
    
    // No auto-rotation - planet only moves with rover movement
    
    renderer.render(scene, camera);
}

// Start the game
init();