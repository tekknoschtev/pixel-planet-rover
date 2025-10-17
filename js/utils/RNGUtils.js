/**
 * RNGUtils
 *
 * Shared random number generation utilities.
 * Eliminates duplication of RNG implementation across planetGenerator.js and planetObjects.js.
 */

class RNGUtils {
    /**
     * Create a seeded random number generator using Linear Congruential Generator
     * @param {number} seed - The seed value
     * @returns {object} RNG object with next() method
     */
    static createSeededRNG(seed) {
        let currentSeed = seed;

        return {
            /**
             * Get the next random number between 0 and 1
             * @returns {number}
             */
            next() {
                currentSeed = (currentSeed * 1664525 + 1013904223) % Math.pow(2, 32);
                return currentSeed / Math.pow(2, 32);
            },

            /**
             * Get a random integer between min (inclusive) and max (exclusive)
             * @param {number} min
             * @param {number} max
             * @returns {number}
             */
            nextInt(min, max) {
                return Math.floor(this.next() * (max - min)) + min;
            },

            /**
             * Get a random float between min and max
             * @param {number} min
             * @param {number} max
             * @returns {number}
             */
            nextFloat(min, max) {
                return this.next() * (max - min) + min;
            },

            /**
             * Get a random value from an array
             * @param {array} array
             * @returns {*}
             */
            choice(array) {
                return array[this.nextInt(0, array.length)];
            },

            /**
             * Get the current seed value
             * @returns {number}
             */
            getSeed() {
                return currentSeed;
            },

            /**
             * Reset to a new seed
             * @param {number} newSeed
             */
            reset(newSeed) {
                currentSeed = newSeed;
            },
        };
    }

    /**
     * Create a simple hash-based random function for a given value
     * Useful for consistent "randomness" based on world position
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number} Value between 0 and 1
     */
    static hashRandom(x, y, z) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + z * 43.61512) * 43758.5453;
        return n - Math.floor(n);
    }

    /**
     * Generate a random seed
     * @returns {number}
     */
    static generateRandomSeed() {
        return Math.floor(Math.random() * Math.pow(2, 32));
    }

    /**
     * Validate RNG object has required methods
     * @param {object} rng
     * @returns {boolean}
     */
    static isValidRNG(rng) {
        return rng && typeof rng.next === 'function' && typeof rng.reset === 'function';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RNGUtils;
}
