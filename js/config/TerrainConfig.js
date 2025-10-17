/**
 * TerrainConfig
 *
 * Centralized terrain generation constants and configuration.
 * Extracted from TerrainGenerator.js and planetGenerator.js to reduce magic numbers.
 */

const TerrainConfig = {
    // Noise scales for different terrain features
    mainNoiseScale: 0.1,
    detailNoiseScale1: 0.08,
    detailNoiseScale2: 0.15,
    microDetailScale: 0.25,

    // Terrain depth and amplitude
    craterDepthAmplitude: 60,
    cliffHeightAmplitude: 35,
    smallFeatureAmplitude: 18,

    // Terrain frequency and octaves
    craterFrequency: 0.02,
    cliffFrequency: 0.08,
    smallFeatureFrequency: 0.2,

    // Surface sampling
    raycastDistance: 100,
    raycastPrecision: 0.1,

    // LOD (Level of Detail)
    detailDistance: 30,
    normalDistance: 80,
    lowDetailDistance: 150,

    // Collision buffer
    groundCollisionBuffer: 1.0,

    /**
     * Validate configuration values
     * @returns {array} Array of validation errors, empty if valid
     */
    validate() {
        const errors = [];

        if (this.mainNoiseScale <= 0) errors.push('mainNoiseScale must be positive');
        if (this.detailNoiseScale1 <= 0) errors.push('detailNoiseScale1 must be positive');
        if (this.craterDepthAmplitude <= 0) errors.push('craterDepthAmplitude must be positive');
        if (this.raycastDistance <= 0) errors.push('raycastDistance must be positive');

        return errors;
    },

    /**
     * Get noise configuration for a specific feature
     * @param {string} featureType - 'crater', 'cliff', 'detail'
     * @returns {object}
     */
    getFeatureNoise(featureType) {
        switch (featureType) {
            case 'crater':
                return {
                    scale: this.mainNoiseScale,
                    frequency: this.craterFrequency,
                    amplitude: this.craterDepthAmplitude,
                };
            case 'cliff':
                return {
                    scale: this.detailNoiseScale1,
                    frequency: this.cliffFrequency,
                    amplitude: this.cliffHeightAmplitude,
                };
            case 'detail':
                return {
                    scale: this.detailNoiseScale2,
                    frequency: this.smallFeatureFrequency,
                    amplitude: this.smallFeatureAmplitude,
                };
            default:
                throw new Error(`Unknown feature type: ${featureType}`);
        }
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerrainConfig;
}
