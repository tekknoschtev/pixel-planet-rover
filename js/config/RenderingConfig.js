/**
 * RenderingConfig
 *
 * Centralized rendering constants and configuration.
 * Extracted from RenderingEngine.js to reduce magic numbers.
 */

const RenderingConfig = {
    // Display settings
    pixelSize: 4,
    backgroundColor: 0x000000,

    // Camera settings
    defaultCameraDistance: 60,
    minCameraZoom: 20,
    maxCameraZoom: 150,
    cameraRotationSpeed: 0.005,

    // Lighting
    ambientLightColor: 0xffffff,
    ambientLightIntensity: 0.6,
    directionalLightColor: 0xffffff,
    directionalLightIntensity: 0.8,
    directionalLightPosition: { x: 5, y: 10, z: 5 },

    // Rendering quality
    targetFrameRate: 60,
    enableShadows: false,
    enableAntialiasing: true,

    // Planet rendering
    planetGeometryDetail: 64,  // Segments for icosahedron
    maxPlanetRadius: 50,

    // Particle rendering
    maxParticles: 1000,
    particleSize: 1.0,

    /**
     * Validate configuration values
     * @returns {array} Array of validation errors, empty if valid
     */
    validate() {
        const errors = [];

        if (this.pixelSize <= 0) errors.push('pixelSize must be positive');
        if (this.defaultCameraDistance <= 0) errors.push('defaultCameraDistance must be positive');
        if (this.minCameraZoom <= 0) errors.push('minCameraZoom must be positive');
        if (this.maxCameraZoom <= this.minCameraZoom) errors.push('maxCameraZoom must be greater than minCameraZoom');
        if (this.ambientLightIntensity < 0 || this.ambientLightIntensity > 1) {
            errors.push('ambientLightIntensity must be between 0 and 1');
        }
        if (this.directionalLightIntensity < 0 || this.directionalLightIntensity > 1) {
            errors.push('directionalLightIntensity must be between 0 and 1');
        }

        return errors;
    },

    /**
     * Get render target size
     * @param {number} windowWidth
     * @param {number} windowHeight
     * @returns {object} {width, height}
     */
    getRenderTargetSize(windowWidth, windowHeight) {
        return {
            width: Math.floor(windowWidth / this.pixelSize),
            height: Math.floor(windowHeight / this.pixelSize),
        };
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RenderingConfig;
}
