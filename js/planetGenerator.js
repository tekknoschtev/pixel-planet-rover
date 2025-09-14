// Procedural Planet Generator System
class PlanetGenerator {
    constructor() {
        this.generatedPlanets = new Map(); // Cache for generated planets
        this.planetNames = [
            "Kepler", "Proxima", "Gliese", "Ross", "Wolf", "Barnard", "Vega", "Altair",
            "Arcturus", "Polaris", "Sirius", "Rigel", "Betelgeuse", "Antares",
            "Nova", "Zenith", "Apex", "Prima", "Ultima", "Nexus"
        ];
        this.planetSuffixes = [
            "Prime", "Alpha", "Beta", "Gamma", "Major", "Minor", "Central", "Outer",
            "Inner", "New", "Far", "Deep", "Bright", "Dark", "Red", "Blue"
        ];
    }

    // Seed-based pseudo-random number generator (Linear Congruential Generator)
    createSeededRNG(seed) {
        let currentSeed = seed;
        return {
            next() {
                currentSeed = (currentSeed * 1664525 + 1013904223) % Math.pow(2, 32);
                return currentSeed / Math.pow(2, 32);
            },
            // Generate float between min and max
            range(min, max) {
                return min + (max - min) * this.next();
            },
            // Generate integer between min and max (inclusive)
            intRange(min, max) {
                return Math.floor(this.range(min, max + 1));
            },
            // Pick random element from array
            choice(array) {
                return array[this.intRange(0, array.length - 1)];
            }
        };
    }

    // Generate a hash from a string to use as seed
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Generate a procedural planet name
    generatePlanetName(rng) {
        const name = rng.choice(this.planetNames);
        const suffix = rng.choice(this.planetSuffixes);
        const number = rng.intRange(1, 999);
        
        // Various naming patterns
        const patterns = [
            `${name}-${number}`,
            `${name} ${suffix}`,
            `${name}-${suffix}`,
            `${suffix} ${name}`,
            `${name} ${number}`,
        ];
        
        return rng.choice(patterns);
    }

    // Get generation parameters for a base biome type
    getBiomeGenerationRanges() {
        return {
            mars: {
                radius: { min: 60, max: 120 },
                material: {
                    color: ["0x8B4513", "0xA0522D", "0x654321", "0x8B4000"],
                },
                terrain: {
                    noiseScale: { min: 0.08, max: 0.15 },
                    heightVariation: { min: 2, max: 5 },
                    roughness: { min: 0.5, max: 0.9 },
                    mountainDensity: { min: 0.2, max: 0.5 },
                    valleyDensity: { min: 0.15, max: 0.4 },
                    craterDensity: { min: 0.3, max: 0.6 },
                    cliffDensity: { min: 0.1, max: 0.3 },
                    mesaDensity: { min: 0.1, max: 0.25 },
                    boulderDensity: { min: 0.3, max: 0.7 }
                },
                atmosphere: {
                    fogDensity: { min: 0.001, max: 0.005 },
                    particleDensity: { min: 0.3, max: 0.7 }
                }
            },
            moon: {
                radius: { min: 40, max: 100 },
                material: {
                    color: ["0x999999", "0x888888", "0xAAAAAA", "0x777777"],
                },
                terrain: {
                    noiseScale: { min: 0.03, max: 0.08 },
                    heightVariation: { min: 5, max: 12 },
                    roughness: { min: 0.7, max: 1.0 },
                    mountainDensity: { min: 0.05, max: 0.2 },
                    valleyDensity: { min: 0.02, max: 0.1 },
                    craterDensity: { min: 0.6, max: 0.9 },
                    cliffDensity: { min: 0.1, max: 0.25 },
                    mesaDensity: { min: 0.02, max: 0.1 },
                    boulderDensity: { min: 0.2, max: 0.5 }
                },
                atmosphere: {
                    fogDensity: { min: 0, max: 0 },
                    particleDensity: { min: 0, max: 0 }
                }
            },
            ice: {
                radius: { min: 100, max: 250 },
                material: {
                    color: ["0xAADDFF", "0x99CCEE", "0xBBEEFF", "0x88BBDD"],
                },
                terrain: {
                    noiseScale: { min: 0.06, max: 0.12 },
                    heightVariation: { min: 3, max: 8 },
                    roughness: { min: 0.3, max: 0.7 },
                    mountainDensity: { min: 0.3, max: 0.6 },
                    valleyDensity: { min: 0.25, max: 0.5 },
                    craterDensity: { min: 0.05, max: 0.2 },
                    cliffDensity: { min: 0.3, max: 0.6 },
                    mesaDensity: { min: 0.15, max: 0.4 },
                    boulderDensity: { min: 0.1, max: 0.3 }
                },
                atmosphere: {
                    fogDensity: { min: 0.003, max: 0.008 },
                    particleDensity: { min: 0.2, max: 0.5 }
                }
            },
            volcanic: {
                radius: { min: 80, max: 200 },
                material: {
                    color: ["0x331100", "0x442200", "0x221100", "0x553300"],
                },
                terrain: {
                    noiseScale: { min: 0.1, max: 0.18 },
                    heightVariation: { min: 4, max: 10 },
                    roughness: { min: 0.6, max: 0.95 },
                    mountainDensity: { min: 0.4, max: 0.8 },
                    valleyDensity: { min: 0.3, max: 0.6 },
                    craterDensity: { min: 0.2, max: 0.5 },
                    cliffDensity: { min: 0.4, max: 0.7 },
                    mesaDensity: { min: 0.1, max: 0.3 },
                    boulderDensity: { min: 0.5, max: 0.9 }
                },
                atmosphere: {
                    fogDensity: { min: 0.002, max: 0.006 },
                    particleDensity: { min: 0.5, max: 0.9 }
                }
            },
            desert: {
                radius: { min: 200, max: 500 },
                material: {
                    color: ["0xDDCC99", "0xEEDD88", "0xCCBB88", "0xFFEE99"],
                },
                terrain: {
                    noiseScale: { min: 0.04, max: 0.1 },
                    heightVariation: { min: 2, max: 6 },
                    roughness: { min: 0.2, max: 0.5 },
                    mountainDensity: { min: 0.1, max: 0.25 },
                    valleyDensity: { min: 0.4, max: 0.8 },
                    craterDensity: { min: 0.05, max: 0.2 },
                    cliffDensity: { min: 0.05, max: 0.2 },
                    mesaDensity: { min: 0.3, max: 0.6 },
                    boulderDensity: { min: 0.05, max: 0.2 }
                },
                atmosphere: {
                    fogDensity: { min: 0.0005, max: 0.002 },
                    particleDensity: { min: 0.3, max: 0.6 }
                }
            }
        };
    }

    // Generate lighting properties based on planet type
    generateLighting(baseBiome, rng) {
        const lightingTemplates = {
            mars: {
                ambientColor: ["0x404040", "0x504030", "0x603020"],
                ambientIntensity: { min: 0.2, max: 0.4 },
                sunColor: ["0xffffff", "0xffeecc", "0xffeedd"],
                sunIntensity: { min: 0.7, max: 0.9 }
            },
            moon: {
                ambientColor: ["0x202020", "0x303030", "0x101020"],
                ambientIntensity: { min: 0.05, max: 0.15 },
                sunColor: ["0xffffff", "0xffffee"],
                sunIntensity: { min: 1.0, max: 1.4 }
            },
            ice: {
                ambientColor: ["0x4466AA", "0x3355BB", "0x5577CC"],
                ambientIntensity: { min: 0.3, max: 0.5 },
                sunColor: ["0xCCEEFF", "0xDDFFFF", "0xBBDDEE"],
                sunIntensity: { min: 0.5, max: 0.7 }
            },
            volcanic: {
                ambientColor: ["0x660000", "0x770000", "0x881100"],
                ambientIntensity: { min: 0.4, max: 0.6 },
                sunColor: ["0xFF6600", "0xFF7700", "0xEE5500"],
                sunIntensity: { min: 0.6, max: 0.8 }
            },
            desert: {
                ambientColor: ["0x665544", "0x776633", "0x887755"],
                ambientIntensity: { min: 0.3, max: 0.5 },
                sunColor: ["0xFFDD88", "0xFFCC77", "0xFFEE99"],
                sunIntensity: { min: 0.8, max: 1.0 }
            }
        };

        const template = lightingTemplates[baseBiome];
        return {
            ambientColor: rng.choice(template.ambientColor),
            ambientIntensity: rng.range(template.ambientIntensity.min, template.ambientIntensity.max),
            sunColor: rng.choice(template.sunColor),
            sunIntensity: rng.range(template.sunIntensity.min, template.sunIntensity.max),
            sunPosition: [
                rng.range(60, 120),
                rng.range(30, 100),
                rng.range(20, 100)
            ]
        };
    }

    // Generate atmosphere properties
    generateAtmosphere(baseBiome, rng, terrain) {
        const atmosphereTemplates = {
            mars: {
                fogColors: ["0x8B4513", "0xA0522D", "0x996633"],
                particleTypes: ["dust"],
                particleColors: ["0xCC9966", "0xDDAA77", "0xBB8855"]
            },
            moon: {
                fogColors: [null],
                particleTypes: [null],
                particleColors: [null]
            },
            ice: {
                fogColors: ["0xCCEEFF", "0xDDFFFF", "0xBBDDEE"],
                particleTypes: ["snow"],
                particleColors: ["0xFFFFFF", "0xEEEEFF", "0xDDDDFF"]
            },
            volcanic: {
                fogColors: ["0x664400", "0x775500", "0x553300"],
                particleTypes: ["ash"],
                particleColors: ["0x442200", "0x553300", "0x331100"]
            },
            desert: {
                fogColors: ["0xDDCC99", "0xEEDD88", "0xCCBB77"],
                particleTypes: ["sand"],
                particleColors: ["0xEEDD99", "0xFFEE88", "0xDDCC88"]
            }
        };

        const template = atmosphereTemplates[baseBiome];
        const fogColor = rng.choice(template.fogColors);
        const particleType = rng.choice(template.particleTypes);
        
        if (!fogColor || !particleType) {
            return {
                fogColor: null,
                fogNear: null,
                fogFar: null,
                fogDensity: 0,
                particles: null
            };
        }

        return {
            fogColor: fogColor,
            fogNear: rng.range(50, 150),
            fogFar: rng.range(300, 700),
            fogDensity: rng.range(terrain.atmosphere.fogDensity.min, terrain.atmosphere.fogDensity.max),
            particles: {
                type: particleType,
                density: rng.range(terrain.atmosphere.particleDensity.min, terrain.atmosphere.particleDensity.max),
                color: rng.choice(template.particleColors)
            }
        };
    }

    // Generate a complete planet configuration
    generatePlanet(seed = null, baseBiome = null, customParams = null) {
        // Create seed from current time if not provided
        if (seed === null) {
            seed = Date.now() % 1000000;
        }
        
        // If seed is a string, hash it to get numeric seed
        if (typeof seed === 'string') {
            seed = this.hashString(seed);
        }

        const rng = this.createSeededRNG(seed);
        
        // Choose random base biome if not specified
        if (!baseBiome) {
            const biomes = ['mars', 'moon', 'ice', 'volcanic', 'desert'];
            baseBiome = rng.choice(biomes);
        }

        const ranges = this.getBiomeGenerationRanges()[baseBiome];
        
        // Generate base parameters
        const radius = customParams?.radius ?? rng.range(ranges.radius.min, ranges.radius.max);
        const materialColor = customParams?.materialColor ?? rng.choice(ranges.material.color);
        
        // Generate terrain parameters
        const terrain = {
            noiseScale: customParams?.noiseScale ?? rng.range(ranges.terrain.noiseScale.min, ranges.terrain.noiseScale.max),
            heightVariation: customParams?.heightVariation ?? rng.range(ranges.terrain.heightVariation.min, ranges.terrain.heightVariation.max),
            roughness: customParams?.roughness ?? rng.range(ranges.terrain.roughness.min, ranges.terrain.roughness.max),
            mountainDensity: customParams?.mountainDensity ?? rng.range(ranges.terrain.mountainDensity.min, ranges.terrain.mountainDensity.max),
            valleyDensity: customParams?.valleyDensity ?? rng.range(ranges.terrain.valleyDensity.min, ranges.terrain.valleyDensity.max),
            craterDensity: customParams?.craterDensity ?? rng.range(ranges.terrain.craterDensity.min, ranges.terrain.craterDensity.max),
            cliffDensity: customParams?.cliffDensity ?? rng.range(ranges.terrain.cliffDensity.min, ranges.terrain.cliffDensity.max),
            mesaDensity: customParams?.mesaDensity ?? rng.range(ranges.terrain.mesaDensity.min, ranges.terrain.mesaDensity.max),
            boulderDensity: customParams?.boulderDensity ?? rng.range(ranges.terrain.boulderDensity.min, ranges.terrain.boulderDensity.max),
            atmosphere: ranges.atmosphere
        };

        const lighting = this.generateLighting(baseBiome, rng);
        const atmosphere = this.generateAtmosphere(baseBiome, rng, terrain);
        const name = customParams?.name ?? this.generatePlanetName(rng);

        const planetConfig = {
            id: `generated_${seed}`,
            name: name,
            description: `Procedurally generated ${baseBiome}-type planet`,
            radius: Math.round(radius),
            seed: seed,
            baseBiome: baseBiome,
            material: {
                color: materialColor,
                flatShading: true
            },
            lighting: lighting,
            atmosphere: atmosphere,
            terrain: {
                noiseScale: Number(terrain.noiseScale.toFixed(3)),
                heightVariation: Number(terrain.heightVariation.toFixed(2)),
                roughness: Number(terrain.roughness.toFixed(2)),
                mountainDensity: Number(terrain.mountainDensity.toFixed(2)),
                valleyDensity: Number(terrain.valleyDensity.toFixed(2)),
                craterDensity: Number(terrain.craterDensity.toFixed(2)),
                cliffDensity: Number(terrain.cliffDensity.toFixed(2)),
                mesaDensity: Number(terrain.mesaDensity.toFixed(2)),
                boulderDensity: Number(terrain.boulderDensity.toFixed(2))
            }
        };

        // Cache the generated planet
        this.generatedPlanets.set(planetConfig.id, planetConfig);
        
        return planetConfig;
    }

    // Export planet as shareable seed string
    exportPlanet(planetConfig) {
        return JSON.stringify({
            seed: planetConfig.seed,
            baseBiome: planetConfig.baseBiome,
            name: planetConfig.name
        });
    }

    // Import planet from seed string
    importPlanet(seedString) {
        try {
            const data = JSON.parse(seedString);
            return this.generatePlanet(data.seed, data.baseBiome, { name: data.name });
        } catch (error) {
            console.error('Failed to import planet:', error);
            return null;
        }
    }

    // Get cached generated planet
    getGeneratedPlanet(id) {
        return this.generatedPlanets.get(id);
    }

    // Clear planet cache
    clearCache() {
        this.generatedPlanets.clear();
    }
}

// Export singleton instance
const planetGenerator = new PlanetGenerator();
window.planetGenerator = planetGenerator; // Make globally accessible for debugging