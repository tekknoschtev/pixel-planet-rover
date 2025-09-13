// Planet Type Management System
class PlanetTypeManager {
    constructor() {
        this.planetConfigs = null;
        this.currentPlanetType = 'mars';
        this.loaded = false;
    }

    // Load planet configurations from JSON
    async loadPlanetConfigs() {
        try {
            const response = await fetch('config/planets.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.planetConfigs = data.planetTypes;
            this.currentPlanetType = data.defaultPlanet || 'mars';
            this.loaded = true;
            console.log('Planet configurations loaded successfully:', Object.keys(this.planetConfigs));
            console.log('Default planet set to:', this.currentPlanetType);
            return true;
        } catch (error) {
            console.error('Failed to load planet configurations:', error);
            console.error('Response details:', error.message);
            // Fall back to default Mars config
            this.createFallbackConfig();
            return false;
        }
    }

    // Create fallback configuration if JSON loading fails
    createFallbackConfig() {
        this.planetConfigs = {
            mars: {
                name: "Mars",
                description: "Red planet with rocky terrain",
                material: {
                    color: "0x8B4513",
                    flatShading: true
                },
                lighting: {
                    ambientColor: "0x404040",
                    ambientIntensity: 0.3,
                    sunColor: "0xffffff",
                    sunIntensity: 0.8,
                    sunPosition: [100, 50, 50]
                },
                atmosphere: {
                    fogColor: null,
                    particles: null
                },
                terrain: {
                    noiseScale: 0.1,
                    heightVariation: 3,
                    roughness: 0.7
                }
            }
        };
        this.currentPlanetType = 'mars';
        this.loaded = true;
    }

    // Get current planet configuration
    getCurrentPlanetConfig() {
        if (!this.loaded) {
            console.warn('Planet configurations not loaded yet');
            return null;
        }
        return this.planetConfigs[this.currentPlanetType];
    }

    // Get planet configuration by type
    getPlanetConfig(planetType) {
        if (!this.loaded) {
            console.warn('Planet configurations not loaded yet');
            return null;
        }
        return this.planetConfigs[planetType] || null;
    }

    // Get all available planet types
    getAvailablePlanetTypes() {
        if (!this.loaded) {
            return [];
        }
        return Object.keys(this.planetConfigs).map(key => ({
            id: key,
            name: this.planetConfigs[key].name,
            description: this.planetConfigs[key].description
        }));
    }

    // Set current planet type
    setPlanetType(planetType) {
        if (!this.loaded) {
            console.warn('Planet configurations not loaded yet');
            return false;
        }
        
        if (this.planetConfigs[planetType]) {
            this.currentPlanetType = planetType;
            console.log('Switched to planet type:', planetType);
            return true;
        } else {
            console.error('Unknown planet type:', planetType);
            return false;
        }
    }

    // Get current planet type ID
    getCurrentPlanetType() {
        return this.currentPlanetType;
    }

    // Convert hex string to THREE.js color
    parseColor(colorString) {
        if (!colorString) return null;
        return parseInt(colorString.replace('0x', ''), 16);
    }

    // Get material properties for THREE.js
    getMaterialProperties(planetType = null) {
        const config = planetType ? this.getPlanetConfig(planetType) : this.getCurrentPlanetConfig();
        if (!config) return null;

        return {
            color: this.parseColor(config.material.color),
            flatShading: config.material.flatShading || false
        };
    }

    // Get lighting properties for THREE.js
    getLightingProperties(planetType = null) {
        const config = planetType ? this.getPlanetConfig(planetType) : this.getCurrentPlanetConfig();
        if (!config) return null;

        return {
            ambient: {
                color: this.parseColor(config.lighting.ambientColor),
                intensity: config.lighting.ambientIntensity
            },
            sun: {
                color: this.parseColor(config.lighting.sunColor),
                intensity: config.lighting.sunIntensity,
                position: config.lighting.sunPosition
            }
        };
    }

    // Get atmosphere properties
    getAtmosphereProperties(planetType = null) {
        const config = planetType ? this.getPlanetConfig(planetType) : this.getCurrentPlanetConfig();
        if (!config || !config.atmosphere) return null;

        return {
            fog: config.atmosphere.fogColor ? {
                color: this.parseColor(config.atmosphere.fogColor),
                near: config.atmosphere.fogNear,
                far: config.atmosphere.fogFar,
                density: config.atmosphere.fogDensity
            } : null,
            particles: config.atmosphere.particles ? {
                type: config.atmosphere.particles.type,
                density: config.atmosphere.particles.density,
                color: this.parseColor(config.atmosphere.particles.color)
            } : null
        };
    }

    // Get terrain properties
    getTerrainProperties(planetType = null) {
        const config = planetType ? this.getPlanetConfig(planetType) : this.getCurrentPlanetConfig();
        if (!config) return null;

        return config.terrain;
    }
}

// Export singleton instance
const planetTypeManager = new PlanetTypeManager();
window.planetTypeManager = planetTypeManager; // Make globally accessible for debugging