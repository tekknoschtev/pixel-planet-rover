// TerrainGenerator.js - Handles all terrain generation algorithms
class TerrainGenerator {
    constructor() {
        // No state needed for pure terrain generation functions
    }

    // Advanced noise generation functions for terrain
    generateLayeredNoise(x, y, z, scale, amplitude) {
        // Convert to spherical coordinates for better planet-wide noise distribution
        const radius = Math.sqrt(x*x + y*y + z*z);
        const lat = Math.asin(y / radius);
        const lon = Math.atan2(z, x);

        // Layer 1: Base terrain using improved Perlin-like noise
        const baseNoise = this.improvedNoise(lon * scale * 4, lat * scale * 4, 0) * amplitude * 3.0;

        // Layer 2: Mid-frequency features (hills, valleys)
        const midNoise = this.improvedNoise(lon * scale * 8, lat * scale * 8, 100) * amplitude * 2.0;

        // Layer 3: High-frequency detail (surface roughness)
        const detailNoise = this.improvedNoise(lon * scale * 16, lat * scale * 16, 200) * amplitude * 1.0;

        // Layer 4: Large-scale continental features
        const continentalNoise = this.improvedNoise(lon * scale * 1, lat * scale * 1, 300) * amplitude * 2.0;

        return baseNoise + midNoise + detailNoise + continentalNoise;
    }

    improvedNoise(x, y, z) {
        // Improved noise function with better distribution than simple sin/cos
        const a = Math.sin(x * 1.2) * Math.cos(y * 0.8) * Math.sin(z * 1.5);
        const b = Math.cos(x * 2.1) * Math.sin(y * 1.7) * Math.cos(z * 0.9);
        const c = Math.sin(x * 0.5) * Math.sin(y * 2.3) * Math.cos(z * 1.8);

        // Combine with different weights for more natural variation
        return (a * 0.5 + b * 0.3 + c * 0.2);
    }

    ridgedNoise(x, y, z) {
        // Ridged noise for mountain ranges and sharp features
        const noise = this.improvedNoise(x, y, z);
        return 1.0 - Math.abs(noise);
    }

    turbulence(x, y, z, octaves = 4) {
        // Multi-octave turbulence for complex terrain features
        let value = 0;
        let amplitude = 1;
        let frequency = 1;

        for (let i = 0; i < octaves; i++) {
            value += this.improvedNoise(x * frequency, y * frequency, z * frequency) * amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
        }

        return value;
    }

    generateMountains(x, y, z, planetRadius, terrainProps) {
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
        const ridgeNoise = this.ridgedNoise(lon * ridgeScale, lat * ridgeScale, 0);

        // Only create mountains where ridge noise is high
        if (ridgeNoise > 0.6) {
            const mountainHeight = (ridgeNoise - 0.6) * 0.4 * mountainDensity;

            // Add jagged peaks using higher frequency noise
            const peakNoise = this.turbulence(lon * ridgeScale * 4, lat * ridgeScale * 4, 0, 3);
            const jaggedPeaks = peakNoise * mountainHeight * 0.3;

            mountainEffect += (mountainHeight * 120 + jaggedPeaks * 50); // EXTREME mountains
        }

        // Generate isolated hills
        const hillScale = 6;
        const hillNoise = this.improvedNoise(lon * hillScale + 500, lat * hillScale + 500, 0);

        if (hillNoise > 0.5 && Math.abs(hillNoise) < 0.8) {
            const hillHeight = (Math.abs(hillNoise) - 0.5) * 0.3 * mountainDensity;

            // Smooth hill profile
            const hillProfile = Math.pow(hillHeight, 2) * 80; // EXTREME hills
            mountainEffect += hillProfile;
        }

        // Add rolling terrain variation
        const rollingScale = 4;
        const rollingNoise = this.improvedNoise(lon * rollingScale, lat * rollingScale, 700);
        mountainEffect += rollingNoise * mountainDensity * 20;

        return mountainEffect;
    }

    generateValleys(x, y, z, planetRadius, terrainProps) {
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
        const riverNoise = this.ridgedNoise(lon * riverScale + 100, lat * riverScale + 100, 0);

        // Create valleys where ridge noise is low (invert the ridged effect)
        const invertedRidge = 1.0 - riverNoise;
        if (invertedRidge > 0.7) {
            const valleyDepth = (invertedRidge - 0.7) * 0.3 * valleyDensity;

            // Add meandering effect to valleys
            const meanderNoise = this.improvedNoise(lon * riverScale * 3, lat * riverScale * 3, 400);
            const meandering = meanderNoise * valleyDepth * 0.2;

            valleyEffect -= (valleyDepth * 100 + meandering * 40); // EXTREME valleys
        }

        // Generate canyon systems using layered noise
        const canyonScale = 1.8;
        const canyonNoise1 = this.improvedNoise(lon * canyonScale, lat * canyonScale, 600);
        const canyonNoise2 = this.improvedNoise(lon * canyonScale * 2, lat * canyonScale * 2, 800);

        // Combine noises to create canyon network
        const canyonPattern = canyonNoise1 * 0.7 + canyonNoise2 * 0.3;

        if (canyonPattern > 0.4 && canyonPattern < 0.6) {
            const canyonDepth = (0.6 - Math.abs(canyonPattern - 0.5) * 2) * valleyDensity;

            // Add canyon wall steepness
            const wallNoise = this.improvedNoise(lon * canyonScale * 8, lat * canyonScale * 8, 1000);
            const wallEffect = wallNoise * canyonDepth * 0.1;

            valleyEffect -= (canyonDepth * 90 + wallEffect * 30); // EXTREME canyons
        }

        // Add small gullies and erosion channels
        const gullyScale = 8;
        const gullyNoise = this.turbulence(lon * gullyScale, lat * gullyScale, 1200, 2);

        if (Math.abs(gullyNoise) > 0.6) {
            const gullyDepth = (Math.abs(gullyNoise) - 0.6) * 0.4 * valleyDensity;
            valleyEffect -= gullyDepth * 3; // Small erosion channels
        }

        return valleyEffect;
    }

    generateCliffs(x, y, z, planetRadius, terrainProps) {
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
        const cliffNoise = this.improvedNoise(lon * cliffScale, lat * cliffScale, 1500);

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
            const faceTexture = this.improvedNoise(lon * cliffScale * 8, lat * cliffScale * 8, 2000);
            cliffEffect += faceTexture * cliffHeight * 2;
        }

        // Generate terraced cliffs (like sedimentary layers)
        const terraceScale = 2;
        const terraceNoise = this.improvedNoise(lon * terraceScale, lat * terraceScale, 2500);

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
        const fault1 = this.improvedNoise(lon * faultScale + 0.5, lat * faultScale, 3000);
        const fault2 = this.improvedNoise(lon * faultScale, lat * faultScale + 0.5, 3500);

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

    generateMesas(x, y, z, planetRadius, terrainProps) {
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
        const mesaBase = this.improvedNoise(lon * mesaScale, lat * mesaScale, 4000);

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
                const erosion = this.improvedNoise(lon * mesaScale * 12, lat * mesaScale * 12, 4500);
                mesaEffect += erosion * mesaHeight * 3; // Edge detail
            }
        }

        // Generate smaller buttes (mini-mesas)
        const butteScale = 4;
        const butteNoise = this.improvedNoise(lon * butteScale + 200, lat * butteScale + 200, 0);

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
        const plateauNoise = this.improvedNoise(lon * plateauScale, lat * plateauScale, 5000);

        if (plateauNoise > 0.3 && plateauNoise < 0.7) {
            const plateauHeight = (0.7 - Math.abs(plateauNoise - 0.5) * 2) * mesaDensity;

            // Large, gently undulating flat areas
            const plateauVariation = this.improvedNoise(lon * plateauScale * 3, lat * plateauScale * 3, 5500);
            const flatness = plateauHeight * 8 + plateauVariation * plateauHeight * 1.5;

            mesaEffect += flatness;
        }

        return mesaEffect;
    }

    generateCraters(x, y, z, planetRadius, terrainProps) {
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
            const centerNoise = this.improvedNoise(lon * crater.scale + 1000, lat * crater.scale + 2000, 0);

            if (centerNoise > (1.0 - crater.density)) {
                // Calculate distance from crater center
                const craterLat = lat + (this.improvedNoise(lon * crater.scale + 3000, lat * crater.scale + 4000, 0) * 0.2);
                const craterLon = lon + (this.improvedNoise(lon * crater.scale + 5000, lat * crater.scale + 6000, 0) * 0.2);

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

    // Helper method to get surface height information at a position
    getSurfaceHeightAtPosition(localX, localZ, planet, planetRadius) {
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

    getSurfaceInfoAtPosition(localX, localZ, planet, planetRadius) {
        // Get height at center position
        const centerHeight = this.getSurfaceHeightAtPosition(localX, localZ, planet, planetRadius);

        // Sample nearby points to calculate surface normal
        const sampleDistance = 1.0;
        const frontHeight = this.getSurfaceHeightAtPosition(localX, localZ + sampleDistance, planet, planetRadius);
        const backHeight = this.getSurfaceHeightAtPosition(localX, localZ - sampleDistance, planet, planetRadius);
        const rightHeight = this.getSurfaceHeightAtPosition(localX + sampleDistance, localZ, planet, planetRadius);
        const leftHeight = this.getSurfaceHeightAtPosition(localX - sampleDistance, localZ, planet, planetRadius);

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
}

// Export for global use
window.TerrainGenerator = TerrainGenerator;