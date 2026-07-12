// BiomeManager.js - Handles biome region generation and sampling
import * as THREE from 'three';
import { RNGUtils } from '../utils/RNGUtils.js';
import { planetGenerator } from '../planetGenerator.js';

export class BiomeManager {
    constructor() {
        this.currentBiomeRegionData = null;
    }

    // Biome Region Generation Functions
    initializeBiomeRegions(biomeMix, seed) {
        // Create seeded random for consistent biome placement
        const rng = RNGUtils.createSeededRNG(seed + 1000);

        // Create biome region data
        const biomeRegionData = {
            biomeMix: biomeMix,
            biomes: Object.keys(biomeMix),
            // Biome region noise parameters
            regionScale: rng.range(0.8, 1.5), // How large biome regions are
            regionOffset: [rng.range(-1000, 1000), rng.range(-1000, 1000), rng.range(-1000, 1000)], // Random offset
            // Transition parameters
            transitionWidth: rng.range(0.1, 0.3), // How smoothly biomes blend
            // Store biome material data for quick access
            biomeData: {}
        };

        this.currentBiomeRegionData = biomeRegionData;
        return biomeRegionData;
    }

    sampleBiomeAtPosition(x, y, z, biomeRegionData) {
        if (!biomeRegionData) {
            return null;
        }

        // Normalize to unit sphere
        const length = Math.sqrt(x * x + y * y + z * z);
        const nx = x / length;
        const ny = y / length;
        const nz = z / length;

        const biomes = biomeRegionData.biomes;
        if (!biomes || biomes.length === 0) {
            return null;
        }

        // Create irregular, organic regions using Voronoi-like approach
        // Generate a few "seed points" on the sphere and assign each vertex to the closest seed

        const [ox, oy, oz] = biomeRegionData.regionOffset;

        // Create seed points for each biome (fewer seeds = larger regions)
        const numSeeds = 4; // Small number = large regions
        const seeds = [];

        for (let i = 0; i < numSeeds; i++) {
            // Create pseudo-random seed positions based on region offset
            const seedX = Math.sin(ox + i * 2.5) * 0.8;
            const seedY = Math.cos(oy + i * 1.7) * 0.8;
            const seedZ = Math.sin(oz + i * 3.1) * 0.8;

            // Normalize seed position to unit sphere
            const seedLen = Math.sqrt(seedX * seedX + seedY * seedY + seedZ * seedZ);
            seeds.push({
                x: seedX / seedLen,
                y: seedY / seedLen,
                z: seedZ / seedLen,
                biome: biomes[i % biomes.length]
            });
        }

        // Find closest seed to this vertex position
        let closestSeed = seeds[0];
        let minDistance = Number.MAX_VALUE;

        for (const seed of seeds) {
            const dx = nx - seed.x;
            const dy = ny - seed.y;
            const dz = nz - seed.z;
            const distance = dx * dx + dy * dy + dz * dz;

            if (distance < minDistance) {
                minDistance = distance;
                closestSeed = seed;
            }
        }

        return closestSeed.biome;
    }

    // Simple 3D noise function (basic implementation)
    simpleNoise3D(x, y, z) {
        // Simple pseudo-3D noise using sine functions
        return (
            Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.33 +
            Math.sin(x * 23.119 + y * 45.567 + z * 89.123) * 0.33 +
            Math.sin(x * 67.891 + y * 34.567 + z * 12.345) * 0.34
        ) * 0.5;
    }

    getBiomePropertiesAtPosition(x, y, z, biomeRegionData, defaultProps) {
        if (!biomeRegionData) {
            return defaultProps;
        }

        const biome = this.sampleBiomeAtPosition(x, y, z, biomeRegionData);
        if (!biome) {
            return defaultProps;
        }

        // Get biome-specific properties
        const biomeRanges = planetGenerator.getBiomeGenerationRanges()[biome];
        if (!biomeRanges) {
            return defaultProps;
        }

        // Return biome-specific terrain and material properties
        return {
            biome: biome,
            color: biomeRanges.material.color[0], // Use first color for consistency
            heightVariation: (biomeRanges.terrain.heightVariation.min + biomeRanges.terrain.heightVariation.max) * 0.5,
            roughness: (biomeRanges.terrain.roughness.min + biomeRanges.terrain.roughness.max) * 0.5,
            mountainDensity: (biomeRanges.terrain.mountainDensity.min + biomeRanges.terrain.mountainDensity.max) * 0.5,
            craterDensity: (biomeRanges.terrain.craterDensity.min + biomeRanges.terrain.craterDensity.max) * 0.5,
            // Add more properties as needed
        };
    }

    // Vertex coloring for biome regions
    addVertexColorsForBiomes(geometry, uniqueVertices, vertexBiomes) {
        const vertices = geometry.attributes.position.array;
        const colors = new Float32Array(vertices.length); // RGB values for each vertex

        // Process each triangle face (3 vertices at a time) and assign the same color to all 3 vertices
        for (let i = 0; i < vertices.length; i += 9) { // Step by 9 (3 vertices * 3 components each)
            // Get the center point of the triangle face
            const centerX = (vertices[i] + vertices[i + 3] + vertices[i + 6]) / 3;
            const centerY = (vertices[i + 1] + vertices[i + 4] + vertices[i + 7]) / 3;
            const centerZ = (vertices[i + 2] + vertices[i + 5] + vertices[i + 8]) / 3;

            // Sample biome at the triangle center
            const length = Math.sqrt(centerX * centerX + centerY * centerY + centerZ * centerZ);
            const biome = this.sampleBiomeAtPosition(centerX, centerY, centerZ, this.currentBiomeRegionData);

            let color = 0x8B4513; // Default mars color

            if (biome) {
                const biomeRanges = planetGenerator.getBiomeGenerationRanges()[biome];
                if (biomeRanges) {
                    color = parseInt(biomeRanges.material.color[0].replace('0x', ''), 16);
                }
            }

            // Convert hex color to RGB values (0-1 range)
            const r = ((color >> 16) & 255) / 255;
            const g = ((color >> 8) & 255) / 255;
            const b = (color & 255) / 255;

            // Assign the SAME color to all 3 vertices of this triangle face
            for (let j = 0; j < 3; j++) { // 3 vertices per face
                const vertexIndex = i + j * 3;
                colors[vertexIndex] = r;     // Red component
                colors[vertexIndex + 1] = g; // Green component
                colors[vertexIndex + 2] = b; // Blue component
            }
        }

        // Add color attribute to geometry
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    // Get current biome region data
    getCurrentBiomeRegionData() {
        return this.currentBiomeRegionData;
    }

    // Set current biome region data (for use by other systems)
    setCurrentBiomeRegionData(data) {
        this.currentBiomeRegionData = data;
    }
}