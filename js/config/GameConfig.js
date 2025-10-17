/**
 * GameConfig
 *
 * Centralized game engine and general configuration.
 * Extracted from GameEngine.js and game.js to reduce magic numbers.
 */

const GameConfig = {
    // Game state
    maxPlanets: 100,
    defaultPlanetRadius: 40,
    roverSpawnHeightOffset: 20,  // Height above surface to spawn rover

    // Planet rotation
    planetRotationSpeed: 0.0015,
    planetRotationDamping: 0.98,

    // Input sensitivity
    roverMovementSensitivity: 1.0,
    planetRotationSensitivity: 0.5,

    // Performance
    maxFrameSkip: 2,            // Maximum frames to skip when catching up
    physicsSubsteps: 1,         // Number of physics updates per frame

    // Particle effects
    dustParticleCount: 50,
    dustParticleLifetime: 0.5,
    dustParticleSpeedMultiplier: 2.0,

    // Modal settings
    defaultModalAnimationDuration: 300,

    // Debug settings
    debugMode: false,
    debugPhysics: false,
    debugTerrainRaycasting: false,
    debugCollisions: false,

    // Storage keys
    storageKeyGeneratedPlanets: 'pixelPlanetRover_generatedPlanets',
    storageKeyCurrentState: 'pixelPlanetRover_currentState',

    /**
     * Validate configuration values
     * @returns {array} Array of validation errors, empty if valid
     */
    validate() {
        const errors = [];

        if (this.defaultPlanetRadius <= 0) errors.push('defaultPlanetRadius must be positive');
        if (this.maxPlanets <= 0) errors.push('maxPlanets must be positive');
        if (this.physicsSubsteps < 1) errors.push('physicsSubsteps must be at least 1');

        return errors;
    },

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            console.log('Debug mode enabled:', this);
        }
    },

    /**
     * Get initial rover position on a planet
     * @param {number} planetRadius
     * @returns {object} {x, y, z}
     */
    getInitialRoverPosition(planetRadius) {
        return {
            x: 0,
            y: 0,
            z: planetRadius + this.roverSpawnHeightOffset,
        };
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameConfig;
}
