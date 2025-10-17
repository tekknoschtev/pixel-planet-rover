import { describe, it, expect, beforeEach } from 'vitest';
import SpatialHashGrid from '../js/utils/SpatialHashGrid.js';

describe('SpatialHashGrid', () => {
    let grid;
    const boundsMin = { x: -100, y: -100, z: -100 };
    const boundsMax = { x: 100, y: 100, z: 100 };

    beforeEach(() => {
        grid = new SpatialHashGrid(boundsMin, boundsMax, 10);
    });

    describe('basic operations', () => {
        it('should insert and retrieve objects', () => {
            const obj = { id: 1 };
            const pos = { x: 0, y: 0, z: 0 };

            grid.insert(obj, pos);
            const nearby = grid.getNearby(pos, 1);

            expect(nearby).toContain(obj);
        });

        it('should not find objects outside radius', () => {
            const obj1 = { id: 1 };
            const pos1 = { x: 0, y: 0, z: 0 };
            const pos2 = { x: 50, y: 0, z: 0 };

            grid.insert(obj1, pos1);
            const nearby = grid.getNearby(pos2, 5);

            expect(nearby).not.toContain(obj1);
        });

        it('should find objects within radius', () => {
            const obj = { id: 1 };
            grid.insert(obj, { x: 0, y: 0, z: 0 });

            const nearby = grid.getNearby({ x: 5, y: 5, z: 5 }, 10);
            expect(nearby).toContain(obj);
        });
    });

    describe('multiple objects', () => {
        it('should handle multiple objects in same cell', () => {
            const objs = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const pos = { x: 0, y: 0, z: 0 };

            objs.forEach(obj => grid.insert(obj, pos));

            const nearby = grid.getNearby(pos, 1);
            expect(nearby.length).toBe(3);
            objs.forEach(obj => expect(nearby).toContain(obj));
        });

        it('should handle objects in multiple cells', () => {
            const objs = [
                { id: 1, pos: { x: 0, y: 0, z: 0 } },
                { id: 2, pos: { x: 15, y: 0, z: 0 } },
                { id: 3, pos: { x: -15, y: 0, z: 0 } },
            ];

            objs.forEach(({ id, pos }) => grid.insert({ id }, pos));

            const nearby = grid.getNearby({ x: 0, y: 0, z: 0 }, 20);
            expect(nearby.length).toBe(3);
        });
    });

    describe('update and remove', () => {
        it('should update object position', () => {
            const obj = { id: 1 };
            grid.insert(obj, { x: 0, y: 0, z: 0 });

            grid.update(obj, { x: 50, y: 0, z: 0 });

            const nearOld = grid.getNearby({ x: 0, y: 0, z: 0 }, 10);
            const nearNew = grid.getNearby({ x: 50, y: 0, z: 0 }, 10);

            expect(nearOld).not.toContain(obj);
            expect(nearNew).toContain(obj);
        });

        it('should remove objects', () => {
            const obj = { id: 1 };
            grid.insert(obj, { x: 0, y: 0, z: 0 });

            grid.remove(obj);

            const nearby = grid.getNearby({ x: 0, y: 0, z: 0 }, 10);
            expect(nearby).not.toContain(obj);
        });

        it('should handle removing non-existent object gracefully', () => {
            const obj = { id: 1 };
            expect(() => grid.remove(obj)).not.toThrow();
        });
    });

    describe('clear', () => {
        it('should clear all objects', () => {
            const objs = [{ id: 1 }, { id: 2 }, { id: 3 }];
            objs.forEach(obj => grid.insert(obj, { x: 0, y: 0, z: 0 }));

            grid.clear();

            const nearby = grid.getNearby({ x: 0, y: 0, z: 0 }, 50);
            expect(nearby.length).toBe(0);
        });
    });

    describe('getStats', () => {
        it('should report correct statistics', () => {
            const objs = [{ id: 1 }, { id: 2 }];
            objs.forEach(obj => grid.insert(obj, { x: 0, y: 0, z: 0 }));

            const stats = grid.getStats();

            expect(stats.totalObjects).toBe(2);
            expect(stats.filledCells).toBeGreaterThan(0);
            expect(stats.totalGridCells).toBeGreaterThan(0);
        });
    });

    describe('getNearbyFiltered', () => {
        it('should filter results', () => {
            const objs = [
                { id: 1, type: 'a' },
                { id: 2, type: 'b' },
                { id: 3, type: 'a' },
            ];

            objs.forEach(obj => grid.insert(obj, { x: 0, y: 0, z: 0 }));

            const filtered = grid.getNearbyFiltered(
                { x: 0, y: 0, z: 0 },
                10,
                obj => obj.type === 'a'
            );

            expect(filtered.length).toBe(2);
            expect(filtered.every(obj => obj.type === 'a')).toBe(true);
        });
    });

    describe('countNearby', () => {
        it('should count nearby objects without creating array', () => {
            const objs = [{ id: 1 }, { id: 2 }, { id: 3 }];
            objs.forEach(obj => grid.insert(obj, { x: 0, y: 0, z: 0 }));

            const count = grid.countNearby({ x: 0, y: 0, z: 0 }, 10);
            expect(count).toBe(3);
        });
    });

    describe('findNearest', () => {
        it('should find nearest object', () => {
            const objs = [
                { id: 1, pos: { x: 0, y: 0, z: 0 } },
                { id: 2, pos: { x: 20, y: 0, z: 0 } },
            ];

            objs.forEach(obj => grid.insert(obj, obj.pos));

            const nearest = grid.findNearest(
                { x: 5, y: 0, z: 0 },
                100,
                (obj, pos) => {
                    const dx = obj.pos.x - pos.x;
                    return Math.abs(dx);
                }
            );

            expect(nearest.id).toBe(1);
        });

        it('should return null if no nearby objects', () => {
            const obj = { id: 1, pos: { x: 0, y: 0, z: 0 } };
            grid.insert(obj, obj.pos);

            const nearest = grid.findNearest(
                { x: 90, y: 0, z: 0 },
                5,
                (obj, pos) => {
                    const dx = obj.pos.x - pos.x;
                    return Math.abs(dx);
                }
            );

            expect(nearest).toBeNull();
        });
    });

    describe('rebuild', () => {
        it('should rebuild grid from objects list', () => {
            const objects = [
                { object: { id: 1 }, position: { x: 0, y: 0, z: 0 } },
                { object: { id: 2 }, position: { x: 10, y: 0, z: 0 } },
            ];

            grid.rebuild(objects);

            const nearby = grid.getNearby({ x: 0, y: 0, z: 0 }, 50);
            expect(nearby.length).toBe(2);
        });
    });

    describe('edge cases', () => {
        it('should handle objects at bounds', () => {
            const obj = { id: 1 };
            grid.insert(obj, { x: 99, y: 99, z: 99 });

            const nearby = grid.getNearby({ x: 99, y: 99, z: 99 }, 5);
            expect(nearby).toContain(obj);
        });

        it('should clamp positions outside bounds', () => {
            const obj = { id: 1 };
            grid.insert(obj, { x: 200, y: 200, z: 200 }); // Outside bounds

            const nearby = grid.getNearby({ x: 100, y: 100, z: 100 }, 50);
            expect(nearby).toContain(obj); // Should still be found
        });

        it('should handle radius of 0', () => {
            const obj = { id: 1 };
            grid.insert(obj, { x: 0, y: 0, z: 0 });

            const nearby = grid.getNearby({ x: 0, y: 0, z: 0 }, 0);
            expect(nearby).toContain(obj);
        });

        it('should handle large radius', () => {
            const objs = [
                { id: 1, pos: { x: -50, y: 0, z: 0 } },
                { id: 2, pos: { x: 50, y: 0, z: 0 } },
            ];

            objs.forEach(obj => grid.insert(obj, obj.pos));

            const nearby = grid.getNearby({ x: 0, y: 0, z: 0 }, 100);
            expect(nearby.length).toBe(2);
        });
    });
});
