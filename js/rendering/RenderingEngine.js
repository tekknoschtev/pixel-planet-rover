// RenderingEngine.js - Handles pixel art rendering and camera controls
class RenderingEngine {
    constructor() {
        // Pixel art rendering variables
        this.pixelRenderTarget = null;
        this.pixelCamera = null;
        this.pixelScene = null;
        this.pixelMaterial = null;
        this.pixelSize = 4; // Configurable pixel size

        // Camera control variables
        this.cameraAngle = { theta: 0, phi: 1.1 };
        this.cameraDistance = 60; // Make distance configurable

        // References
        this.renderer = null;
        this.camera = null;
        this.scene = null;
        this.rover = null;
        this.planetRadius = 80;

        // Mouse control state
        this.mouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;

        // Update function reference
        this.updateCameraPosition = this.updateCameraPosition.bind(this);
    }

    setReferences(renderer, camera, scene, rover, planetRadius) {
        this.renderer = renderer;
        this.camera = camera;
        this.scene = scene;
        this.rover = rover;
        this.planetRadius = planetRadius;
    }

    setupPixelArtRendering() {
        // Create low-resolution render target for pixel art effect
        const width = Math.floor(window.innerWidth / this.pixelSize);
        const height = Math.floor(window.innerHeight / this.pixelSize);

        this.pixelRenderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat
        });

        // Create a full-screen quad to display the pixelated result
        this.pixelScene = new THREE.Scene();
        this.pixelCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Create material for the full-screen quad
        this.pixelMaterial = new THREE.MeshBasicMaterial({
            map: this.pixelRenderTarget.texture
        });

        const quadGeometry = new THREE.PlaneGeometry(2, 2);
        const quad = new THREE.Mesh(quadGeometry, this.pixelMaterial);
        this.pixelScene.add(quad);
    }

    drawPixelatedCircle(ctx, centerX, centerY, radius, color) {
        ctx.fillStyle = color;
        ctx.imageSmoothingEnabled = false;

        // Draw circle using pixels - classic Bresenham-style approach
        const pixelSize = 2; // Match game's chunky pixel aesthetic

        for (let x = -radius; x <= radius; x += pixelSize) {
            for (let y = -radius; y <= radius; y += pixelSize) {
                const distance = Math.sqrt(x * x + y * y);
                if (distance <= radius) {
                    ctx.fillRect(centerX + x, centerY + y, pixelSize, pixelSize);
                }
            }
        }
    }

    updatePixelArtSize() {
        if (this.pixelRenderTarget) {
            const width = Math.floor(window.innerWidth / this.pixelSize);
            const height = Math.floor(window.innerHeight / this.pixelSize);
            this.pixelRenderTarget.setSize(width, height);
        }
    }

    renderPixelArt() {
        // First, render the scene to the low-resolution render target
        this.renderer.setRenderTarget(this.pixelRenderTarget);
        this.renderer.render(this.scene, this.camera);

        // Then render the pixelated result to the main canvas
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.pixelScene, this.pixelCamera);
    }

    updateCameraPosition() {
        if (!this.rover) return;

        const distance = this.cameraDistance;
        const x = distance * Math.sin(this.cameraAngle.phi) * Math.cos(this.cameraAngle.theta);
        const y = distance * Math.cos(this.cameraAngle.phi) + this.planetRadius;
        const z = distance * Math.sin(this.cameraAngle.phi) * Math.sin(this.cameraAngle.theta);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.rover.position);
    }

    setupControls() {
        // Only setup mouse controls if not on mobile device
        if (typeof MobileInputHandler === 'undefined' || !MobileInputHandler.isMobileDevice()) {
            // Mouse controls for camera - simpler rotation around rover
            document.addEventListener('mousedown', (event) => {
                this.mouseDown = true;
                this.mouseX = event.clientX;
                this.mouseY = event.clientY;
            });

            document.addEventListener('mouseup', () => {
                this.mouseDown = false;
            });

            document.addEventListener('mousemove', (event) => {
                if (!this.mouseDown) return;

                const deltaX = event.clientX - this.mouseX;
                const deltaY = event.clientY - this.mouseY;

                this.cameraAngle.theta -= deltaX * 0.01;
                this.cameraAngle.phi += deltaY * 0.01;
                this.cameraAngle.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraAngle.phi));

                this.updateCameraPosition();

                this.mouseX = event.clientX;
                this.mouseY = event.clientY;
            });

            // Mouse wheel zoom control
            document.addEventListener('wheel', (event) => {
                event.preventDefault(); // Prevent page scrolling

                const zoomSensitivity = 0.1;
                const minDistance = 20;
                const maxDistance = 150;

                // deltaY > 0 means scrolling down (zoom out), deltaY < 0 means scrolling up (zoom in)
                this.cameraDistance += event.deltaY * zoomSensitivity;
                this.cameraDistance = Math.max(minDistance, Math.min(maxDistance, this.cameraDistance));

                this.updateCameraPosition();
            });
        }

        // Initialize camera position
        this.updateCameraPosition();

        // Make updateCameraPosition globally accessible for delayed initialization
        window.updateCameraPosition = this.updateCameraPosition;
    }

    handlePixelSizeControls(keys) {
        // Pixel size controls
        if (keys['Minus'] || keys['NumpadSubtract']) {
            this.pixelSize = Math.max(1, this.pixelSize - 1);
            this.updatePixelArtSize();
            console.log('Pixel size:', this.pixelSize);
            return true;
        } else if (keys['Equal'] || keys['NumpadAdd']) {
            this.pixelSize = Math.min(8, this.pixelSize + 1);
            this.updatePixelArtSize();
            console.log('Pixel size:', this.pixelSize);
            return true;
        }
        return false;
    }

    handleWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Update pixel render target size
        if (this.pixelRenderTarget) {
            const width = Math.floor(window.innerWidth / this.pixelSize);
            const height = Math.floor(window.innerHeight / this.pixelSize);
            this.pixelRenderTarget.setSize(width, height);
        }
    }

    // Add lighting to the scene
    addLighting(planetType = null) {
        // Get lighting configuration
        const lightingProps = planetTypeManager.getLightingProperties(planetType);

        // Use fallback values if configuration isn't loaded
        const ambientColor = lightingProps ? lightingProps.ambient.color : 0x404040;
        const ambientIntensity = lightingProps ? lightingProps.ambient.intensity : 0.3;
        const sunColor = lightingProps ? lightingProps.sun.color : 0xffffff;
        const sunIntensity = lightingProps ? lightingProps.sun.intensity : 0.8;
        const sunPosition = lightingProps ? lightingProps.sun.position : [100, 50, 50];

        // Remove existing lights
        const existingLights = this.scene.children.filter(child =>
            child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight
        );
        existingLights.forEach(light => this.scene.remove(light));

        // Ambient light
        const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
        this.scene.add(ambientLight);

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
        this.scene.add(directionalLight);
    }

    applyAtmosphericFog(planetType = null) {
        // Get atmosphere configuration
        const atmosphereProps = planetTypeManager.getAtmosphereProperties(planetType);

        // Clear existing fog
        this.scene.fog = null;

        // Apply fog if the planet has atmospheric settings
        if (atmosphereProps && atmosphereProps.fog) {
            const fogSettings = atmosphereProps.fog;

            // Use exponential fog for more realistic atmospheric depth
            this.scene.fog = new THREE.FogExp2(
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

    // Getters for external access
    getPixelSize() {
        return this.pixelSize;
    }

    getCameraDistance() {
        return this.cameraDistance;
    }

    setCameraDistance(distance) {
        this.cameraDistance = distance;
        this.updateCameraPosition();
    }
}

// Export for global use
window.RenderingEngine = RenderingEngine;