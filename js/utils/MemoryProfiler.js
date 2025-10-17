/**
 * MemoryProfiler - Monitor and analyze memory usage in Three.js applications
 *
 * Provides utilities for tracking GPU/CPU memory consumption, identifying leaks,
 * and monitoring resource allocation patterns.
 */
class MemoryProfiler {
    constructor() {
        this.samples = [];
        this.maxSamples = 300; // Keep last 300 samples (~5 minutes at 60fps)
        this.lastSampleTime = 0;
        this.sampleInterval = 1000; // Sample every 1 second by default
    }

    /**
     * Get comprehensive resource statistics from Three.js renderer
     * @returns {Object} Statistics about geometries, materials, textures, etc.
     */
    getResourceStats() {
        const renderer = window.gameEngine?.renderer;
        if (!renderer) return null;

        const info = renderer.info;

        return {
            memory: {
                geometries: info.memory.geometries || 0,
                textures: info.memory.textures || 0,
                renderTargets: info.memory.render_targets || 0
            },
            render: {
                calls: info.render.calls || 0,
                triangles: info.render.triangles || 0,
                points: info.render.points || 0,
                lines: info.render.lines || 0
            },
            programs: info.programs?.length || 0,
            timestamp: Date.now()
        };
    }

    /**
     * Sample current memory state and store for analysis
     */
    sample(label = '') {
        const now = Date.now();
        if (now - this.lastSampleTime < this.sampleInterval) return;

        const stats = this.getResourceStats();
        if (!stats) return;

        this.samples.push({
            label,
            ...stats,
            estimatedMemoryMB: this.estimateGPUMemory(),
            estimatedMemoryKB: this.estimateGPUMemory() * 1024
        });

        // Keep array size bounded
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }

        this.lastSampleTime = now;
    }

    /**
     * Estimate GPU memory usage in MB based on resource counts
     * @returns {number} Estimated GPU memory in MB
     */
    estimateGPUMemory() {
        const renderer = window.gameEngine?.renderer;
        if (!renderer) return 0;

        const info = renderer.info;
        const mem = info.memory || {};

        // Rough estimates per resource type
        const geometryKB = (mem.geometries || 0) * 50; // ~50KB per geometry avg
        const textureKB = (mem.textures || 0) * 512; // ~512KB per texture avg
        const renderTargetKB = (mem.render_targets || 0) * 2048; // ~2MB per render target

        return (geometryKB + textureKB + renderTargetKB) / 1024; // Convert to MB
    }

    /**
     * Get detailed statistics about current scene
     */
    getSceneStats() {
        const gameEngine = window.gameEngine;
        if (!gameEngine?.scene) return null;

        let meshCount = 0;
        let lightCount = 0;
        let geometryCount = 0;
        let materialCount = 0;

        gameEngine.scene.traverse((child) => {
            if (child.isMesh) meshCount++;
            if (child.isLight) lightCount++;
            if (child.geometry) geometryCount++;
            if (child.material) {
                if (Array.isArray(child.material)) {
                    materialCount += child.material.length;
                } else {
                    materialCount++;
                }
            }
        });

        return {
            meshes: meshCount,
            lights: lightCount,
            geometries: geometryCount,
            materials: materialCount,
            estimatedGPUMemoryMB: this.estimateGPUMemory()
        };
    }

    /**
     * Log detailed memory statistics
     * @param {string} label - Optional label for the report
     */
    logStats(label = 'Memory Report') {
        const stats = this.getSceneStats();
        const memStats = this.getResourceStats();

        if (!stats) {
            console.warn('MemoryProfiler: Game engine not initialized');
            return;
        }

        console.group(`🧠 ${label}`);
        console.log(`Timestamp: ${new Date().toLocaleTimeString()}`);
        console.log('Scene Statistics:', {
            meshes: stats.meshes,
            lights: stats.lights,
            geometries: stats.geometries,
            materials: stats.materials
        });

        if (memStats) {
            console.log('Memory Statistics:', {
                geometries: memStats.memory.geometries,
                textures: memStats.memory.textures,
                renderTargets: memStats.memory.renderTargets,
                estimatedGPUMemoryMB: stats.estimatedGPUMemoryMB.toFixed(2)
            });

            console.log('Render Statistics:', {
                calls: memStats.render.calls,
                triangles: memStats.render.triangles,
                points: memStats.render.points,
                lines: memStats.render.lines,
                programs: memStats.programs
            });
        }
        console.groupEnd();
    }

    /**
     * Get detailed breakdown of resources by type
     */
    getDetailedResourceBreakdown() {
        const gameEngine = window.gameEngine;
        if (!gameEngine?.scene) return null;

        const breakdown = {
            geometries: { count: 0, types: {} },
            materials: { count: 0, types: {} },
            textures: { count: 0, types: {} },
            meshes: { count: 0, byType: {} },
            lights: { count: 0, byType: {} }
        };

        gameEngine.scene.traverse((child) => {
            if (child.isMesh) {
                breakdown.meshes.count++;
                const type = child.type || 'Mesh';
                breakdown.meshes.byType[type] = (breakdown.meshes.byType[type] || 0) + 1;

                if (child.geometry) {
                    breakdown.geometries.count++;
                    const geoType = child.geometry.type || 'BufferGeometry';
                    breakdown.geometries.types[geoType] = (breakdown.geometries.types[geoType] || 0) + 1;
                }

                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        breakdown.materials.count++;
                        const matType = mat.type || 'Material';
                        breakdown.materials.types[matType] = (breakdown.materials.types[matType] || 0) + 1;

                        // Check for textures
                        if (mat.map) breakdown.textures.count++;
                        if (mat.normalMap) breakdown.textures.count++;
                        if (mat.emissiveMap) breakdown.textures.count++;
                    });
                }
            }

            if (child.isLight) {
                breakdown.lights.count++;
                const lightType = child.type || 'Light';
                breakdown.lights.byType[lightType] = (breakdown.lights.byType[lightType] || 0) + 1;
            }
        });

        return breakdown;
    }

    /**
     * Log detailed resource breakdown
     */
    logDetailedBreakdown(label = 'Detailed Resource Breakdown') {
        const breakdown = this.getDetailedResourceBreakdown();
        if (!breakdown) {
            console.warn('MemoryProfiler: Game engine not initialized');
            return;
        }

        console.group(`📊 ${label}`);

        console.log('Meshes:', breakdown.meshes.count);
        if (Object.keys(breakdown.meshes.byType).length > 0) {
            console.table(breakdown.meshes.byType);
        }

        console.log('Geometries:', breakdown.geometries.count);
        if (Object.keys(breakdown.geometries.types).length > 0) {
            console.table(breakdown.geometries.types);
        }

        console.log('Materials:', breakdown.materials.count);
        if (Object.keys(breakdown.materials.types).length > 0) {
            console.table(breakdown.materials.types);
        }

        console.log('Textures:', breakdown.textures.count);
        console.log('Lights:', breakdown.lights.count);
        if (Object.keys(breakdown.lights.byType).length > 0) {
            console.table(breakdown.lights.byType);
        }

        console.groupEnd();
    }

    /**
     * Compare memory between two samples
     * @param {number} indexA - Index of first sample
     * @param {number} indexB - Index of second sample
     */
    compareSamples(indexA = 0, indexB = this.samples.length - 1) {
        if (this.samples.length < 2) {
            console.warn('MemoryProfiler: Not enough samples to compare');
            return;
        }

        const sampleA = this.samples[Math.max(0, indexA)];
        const sampleB = this.samples[Math.min(this.samples.length - 1, indexB)];

        const deltaMem = sampleB.estimatedMemoryMB - sampleA.estimatedMemoryMB;
        const direction = deltaMem > 0 ? '📈' : deltaMem < 0 ? '📉' : '➡️';

        console.group(`${direction} Memory Comparison`);
        console.log('Sample A:', {
            time: new Date(sampleA.timestamp).toLocaleTimeString(),
            memory: sampleA.estimatedMemoryMB.toFixed(2) + ' MB',
            label: sampleA.label || 'Unlabeled'
        });
        console.log('Sample B:', {
            time: new Date(sampleB.timestamp).toLocaleTimeString(),
            memory: sampleB.estimatedMemoryMB.toFixed(2) + ' MB',
            label: sampleB.label || 'Unlabeled'
        });
        console.log('Delta:', {
            memory: (deltaMem > 0 ? '+' : '') + deltaMem.toFixed(2) + ' MB',
            geometries: sampleB.memory.geometries - sampleA.memory.geometries,
            textures: sampleB.memory.textures - sampleA.memory.textures
        });
        console.groupEnd();
    }

    /**
     * Start automatic sampling at interval
     * @param {number} intervalMs - Sample interval in milliseconds
     */
    startAutoSampling(intervalMs = 5000) {
        this.sampleInterval = intervalMs;
        console.log(`MemoryProfiler: Started auto-sampling every ${intervalMs}ms`);
    }

    /**
     * Get all samples collected
     */
    getSamples() {
        return [...this.samples];
    }

    /**
     * Clear all samples
     */
    clearSamples() {
        this.samples = [];
    }

    /**
     * Export samples as JSON for analysis
     */
    exportSamples() {
        return JSON.stringify(this.samples, null, 2);
    }
}

// Export for global use
window.MemoryProfiler = MemoryProfiler;
const memoryProfiler = new MemoryProfiler();
window.memoryProfiler = memoryProfiler;
