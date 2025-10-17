import { describe, it, expect, beforeEach } from 'vitest';

// Import RNGUtils (adjust path if needed)
// Since this is in tests folder, we need to use relative paths
import RNGUtils from '../js/utils/RNGUtils.js';

describe('RNGUtils', () => {
    describe('createSeededRNG', () => {
        it('should create an RNG with next method', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            expect(rng).toBeDefined();
            expect(typeof rng.next).toBe('function');
        });

        it('should generate consistent values with same seed', () => {
            const rng1 = RNGUtils.createSeededRNG(12345);
            const rng2 = RNGUtils.createSeededRNG(12345);

            const values1 = [rng1.next(), rng1.next(), rng1.next()];
            const values2 = [rng2.next(), rng2.next(), rng2.next()];

            expect(values1).toEqual(values2);
        });

        it('should generate different values with different seeds', () => {
            const rng1 = RNGUtils.createSeededRNG(12345);
            const rng2 = RNGUtils.createSeededRNG(54321);

            const value1 = rng1.next();
            const value2 = rng2.next();

            expect(value1).not.toBe(value2);
        });

        it('should return values between 0 and 1', () => {
            const rng = RNGUtils.createSeededRNG(12345);

            for (let i = 0; i < 100; i++) {
                const value = rng.next();
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
            }
        });

        it('should have nextInt method', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            const value = rng.nextInt(1, 10);

            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(1);
            expect(value).toBeLessThan(10);
        });

        it('should have nextFloat method', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            const value = rng.nextFloat(5.0, 10.0);

            expect(value).toBeGreaterThanOrEqual(5.0);
            expect(value).toBeLessThan(10.0);
        });

        it('should have choice method', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            const array = [1, 2, 3, 4, 5];
            const value = rng.choice(array);

            expect(array).toContain(value);
        });

        it('should have getSeed method', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            const seed = rng.getSeed();

            expect(typeof seed).toBe('number');
        });

        it('should have reset method', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            const first = rng.next();

            rng.reset(12345);
            const afterReset = rng.next();

            expect(first).toBe(afterReset);
        });
    });

    describe('hashRandom', () => {
        it('should return a value between 0 and 1', () => {
            const value = RNGUtils.hashRandom(1.5, 2.5, 3.5);

            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        });

        it('should return consistent value for same input', () => {
            const value1 = RNGUtils.hashRandom(1, 2, 3);
            const value2 = RNGUtils.hashRandom(1, 2, 3);

            expect(value1).toBe(value2);
        });

        it('should return different values for different inputs', () => {
            const value1 = RNGUtils.hashRandom(1, 2, 3);
            const value2 = RNGUtils.hashRandom(4, 5, 6);

            expect(value1).not.toBe(value2);
        });
    });

    describe('generateRandomSeed', () => {
        it('should generate a number', () => {
            const seed = RNGUtils.generateRandomSeed();
            expect(typeof seed).toBe('number');
        });

        it('should generate different seeds on multiple calls', () => {
            const seed1 = RNGUtils.generateRandomSeed();
            const seed2 = RNGUtils.generateRandomSeed();
            const seed3 = RNGUtils.generateRandomSeed();

            // Very unlikely to generate same seed three times
            const allDifferent = seed1 !== seed2 && seed2 !== seed3 && seed1 !== seed3;
            expect(allDifferent).toBe(true);
        });
    });

    describe('isValidRNG', () => {
        it('should return true for valid RNG object', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            expect(RNGUtils.isValidRNG(rng)).toBe(true);
        });

        it('should return false for null', () => {
            expect(RNGUtils.isValidRNG(null)).toBe(false);
        });

        it('should return false for object without next method', () => {
            expect(RNGUtils.isValidRNG({})).toBe(false);
        });

        it('should return false for object without reset method', () => {
            expect(RNGUtils.isValidRNG({ next: () => 0.5 })).toBe(false);
        });
    });

    describe('RNG distribution', () => {
        it('should have uniform distribution', () => {
            const rng = RNGUtils.createSeededRNG(12345);
            const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 10 buckets for 0-1 range
            const samples = 1000;

            for (let i = 0; i < samples; i++) {
                const value = rng.next();
                const bucket = Math.floor(value * 10);
                buckets[bucket]++;
            }

            // Each bucket should have approximately 100 values
            // Allow 30% deviation for randomness
            const expectedPerBucket = samples / 10;
            const tolerance = expectedPerBucket * 0.3;

            for (let count of buckets) {
                expect(count).toBeGreaterThan(expectedPerBucket - tolerance);
                expect(count).toBeLessThan(expectedPerBucket + tolerance);
            }
        });
    });
});
