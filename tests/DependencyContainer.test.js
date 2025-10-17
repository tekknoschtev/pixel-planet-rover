import { describe, it, expect, beforeEach } from 'vitest';
import DependencyContainer from '../js/core/DependencyContainer.js';

// Mock classes for testing
class MockServiceA {
    constructor() {
        this.name = 'ServiceA';
    }
}

class MockServiceB {
    constructor(serviceA) {
        this.name = 'ServiceB';
        this.dependency = serviceA;
    }
}

class MockServiceC {
    constructor(serviceA, serviceB) {
        this.name = 'ServiceC';
        this.dep1 = serviceA;
        this.dep2 = serviceB;
    }
}

describe('DependencyContainer', () => {
    let container;

    beforeEach(() => {
        container = new DependencyContainer();
    });

    describe('register and resolve', () => {
        it('should register a service', () => {
            container.register('serviceA', MockServiceA, []);
            expect(container.has('serviceA')).toBe(true);
        });

        it('should resolve a registered service', () => {
            container.register('serviceA', MockServiceA, []);
            const service = container.resolve('serviceA');
            expect(service).toBeInstanceOf(MockServiceA);
        });

        it('should throw error for unregistered service', () => {
            expect(() => container.resolve('nonexistent')).toThrow();
        });

        it('should resolve service with dependencies', () => {
            container.register('serviceA', MockServiceA, []);
            container.register('serviceB', MockServiceB, ['serviceA']);

            const serviceB = container.resolve('serviceB');
            expect(serviceB.dependency).toBeInstanceOf(MockServiceA);
        });

        it('should resolve service with multiple dependencies', () => {
            container.register('serviceA', MockServiceA, []);
            container.register('serviceB', MockServiceB, ['serviceA']);
            container.register('serviceC', MockServiceC, ['serviceA', 'serviceB']);

            const serviceC = container.resolve('serviceC');
            expect(serviceC.dep1).toBeInstanceOf(MockServiceA);
            expect(serviceC.dep2).toBeInstanceOf(MockServiceB);
        });
    });

    describe('singleton behavior', () => {
        it('should create singleton by default', () => {
            container.register('serviceA', MockServiceA, [], { singleton: true });

            const instance1 = container.resolve('serviceA');
            const instance2 = container.resolve('serviceA');

            expect(instance1).toBe(instance2);
        });

        it('should create new instance when singleton is false', () => {
            container.register('serviceA', MockServiceA, [], { singleton: false });

            const instance1 = container.resolve('serviceA');
            const instance2 = container.resolve('serviceA');

            expect(instance1).not.toBe(instance2);
        });
    });

    describe('registerInstance', () => {
        it('should register an instance directly', () => {
            const instance = new MockServiceA();
            container.registerInstance('serviceA', instance);

            const resolved = container.resolve('serviceA');
            expect(resolved).toBe(instance);
        });

        it('should return same instance on multiple resolves', () => {
            const instance = new MockServiceA();
            container.registerInstance('serviceA', instance);

            const resolved1 = container.resolve('serviceA');
            const resolved2 = container.resolve('serviceA');

            expect(resolved1).toBe(instance);
            expect(resolved2).toBe(instance);
        });
    });

    describe('getServiceNames', () => {
        it('should return list of registered services', () => {
            container.register('serviceA', MockServiceA, []);
            container.register('serviceB', MockServiceB, ['serviceA']);

            const names = container.getServiceNames();
            expect(names).toContain('serviceA');
            expect(names).toContain('serviceB');
        });

        it('should return empty array for empty container', () => {
            const names = container.getServiceNames();
            expect(names).toEqual([]);
        });
    });

    describe('has', () => {
        it('should return true for registered service', () => {
            container.register('serviceA', MockServiceA, []);
            expect(container.has('serviceA')).toBe(true);
        });

        it('should return false for unregistered service', () => {
            expect(container.has('nonexistent')).toBe(false);
        });

        it('should return true for registered instance', () => {
            container.registerInstance('serviceA', new MockServiceA());
            expect(container.has('serviceA')).toBe(true);
        });
    });

    describe('clear', () => {
        it('should clear all registered services', () => {
            container.register('serviceA', MockServiceA, []);
            container.register('serviceB', MockServiceB, ['serviceA']);

            container.clear();

            expect(container.has('serviceA')).toBe(false);
            expect(container.has('serviceB')).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return container statistics', () => {
            container.register('serviceA', MockServiceA, []);
            container.register('serviceB', MockServiceB, ['serviceA']);

            const stats = container.getStats();

            expect(stats.servicesRegistered).toBe(2);
            expect(stats.serviceNames).toContain('serviceA');
            expect(stats.serviceNames).toContain('serviceB');
        });

        it('should include only registered services', () => {
            container.register('serviceA', MockServiceA, []);
            container.resolve('serviceA'); // Resolve to make it singleton

            const stats = container.getStats();
            expect(stats.singletonsResolved).toBe(1);
        });
    });

    describe('complex dependency chains', () => {
        it('should resolve deep dependency chains', () => {
            class ServiceD {
                constructor(serviceC) {
                    this.dependency = serviceC;
                }
            }

            class ServiceE {
                constructor(serviceD) {
                    this.dependency = serviceD;
                }
            }

            container.register('serviceA', MockServiceA, []);
            container.register('serviceB', MockServiceB, ['serviceA']);
            container.register('serviceC', MockServiceC, ['serviceA', 'serviceB']);
            container.register('serviceD', ServiceD, ['serviceC']);
            container.register('serviceE', ServiceE, ['serviceD']);

            const serviceE = container.resolve('serviceE');

            expect(serviceE).toBeInstanceOf(ServiceE);
            expect(serviceE.dependency).toBeInstanceOf(ServiceD);
            expect(serviceE.dependency.dependency).toBeInstanceOf(MockServiceC);
        });
    });

    describe('error handling', () => {
        it('should throw error for circular dependencies', () => {
            // Register circular dependency
            container.register('serviceA', MockServiceA, ['serviceB']);
            container.register('serviceB', MockServiceB, ['serviceA']);

            expect(() => container.resolve('serviceA')).toThrow();
        });

        it('should throw error with helpful message for missing service', () => {
            expect(() => container.resolve('missingService')).toThrow(
                /Service 'missingService' not found/
            );
        });
    });

    describe('edge cases', () => {
        it('should handle service with no dependencies', () => {
            container.register('serviceA', MockServiceA, []);
            const service = container.resolve('serviceA');
            expect(service).toBeInstanceOf(MockServiceA);
        });

        it('should handle registering same service multiple times', () => {
            container.register('serviceA', MockServiceA, []);
            container.register('serviceA', MockServiceB, []); // Overwrite

            const service = container.resolve('serviceA');
            expect(service).toBeInstanceOf(MockServiceB);
        });

        it('should handle resolving instance before registering class', () => {
            const instance = new MockServiceA();
            container.registerInstance('serviceA', instance);

            const resolved = container.resolve('serviceA');
            expect(resolved).toBe(instance);
        });
    });

    describe('mixed registration types', () => {
        it('should work with mix of registered classes and instances', () => {
            const instanceA = new MockServiceA();
            container.registerInstance('serviceA', instanceA);
            container.register('serviceB', MockServiceB, ['serviceA']);

            const serviceB = container.resolve('serviceB');

            expect(serviceB.dependency).toBe(instanceA);
        });

        it('should resolve multiple services with shared dependency', () => {
            container.register('serviceA', MockServiceA, [], { singleton: true });
            container.register('serviceB', MockServiceB, ['serviceA'], { singleton: true });

            class ServiceF {
                constructor(serviceA) {
                    this.dependency = serviceA;
                }
            }

            container.register('serviceF', ServiceF, ['serviceA'], { singleton: true });

            const serviceB = container.resolve('serviceB');
            const serviceF = container.resolve('serviceF');

            // Both should share the same serviceA instance
            expect(serviceB.dependency).toBe(serviceF.dependency);
        });
    });
});
