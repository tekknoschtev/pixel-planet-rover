import { describe, it, expect } from 'vitest';
import { PlanetGenerator } from '../js/planetGenerator.js';
import { RNGUtils } from '../js/utils/RNGUtils.js';

describe('PlanetGenerator', () => {
    describe('seed determinism', () => {
        it('should generate identical planets from the same numeric seed', () => {
            const genA = new PlanetGenerator();
            const genB = new PlanetGenerator();

            const planetA = genA.generatePlanet(42);
            const planetB = genB.generatePlanet(42);

            expect(planetA).toEqual(planetB);
        });

        it('should generate identical planets from the same string seed', () => {
            const genA = new PlanetGenerator();
            const genB = new PlanetGenerator();

            const planetA = genA.generatePlanet('my-shared-planet');
            const planetB = genB.generatePlanet('my-shared-planet');

            expect(planetA).toEqual(planetB);
        });

        it('should generate different planets from different seeds', () => {
            const gen = new PlanetGenerator();

            const planetA = gen.generatePlanet(1);
            const planetB = gen.generatePlanet(2);

            expect(planetA).not.toEqual(planetB);
        });

        // Pins the exact RNG stream so a change to the shared LCG (or to how many
        // draws generation consumes) can't silently break previously shared seeds.
        it('should preserve the historical RNG value stream', () => {
            const rng = RNGUtils.createSeededRNG(12345);

            expect(rng.next()).toBeCloseTo(0.02040268573909998, 12);
            expect(rng.range(0, 10)).toBeCloseTo(0.1654784823767841, 12);
            expect(rng.intRange(0, 9)).toBe(5);
            expect(rng.choice(['a', 'b', 'c', 'd'])).toBe('c');
        });
    });

    describe('export/import round-trip', () => {
        it('should reproduce a planet from its export string', () => {
            const gen = new PlanetGenerator();
            const original = gen.generatePlanet(777, 'ice');

            const exported = gen.exportPlanet(original);
            const imported = new PlanetGenerator().importPlanet(exported);

            expect(imported.seed).toBe(original.seed);
            expect(imported.baseBiome).toBe(original.baseBiome);
            expect(imported.terrain).toEqual(original.terrain);
            expect(imported.radius).toBe(original.radius);
        });
    });
});
