/**
 * DependencyContainer
 *
 * Manages dependency injection for the game engine.
 * Replaces window.* global assignments with explicit dependency resolution.
 *
 * Usage:
 *   const container = new DependencyContainer();
 *   container.register('gameEngine', GameEngine, [config]);
 *   const engine = container.resolve('gameEngine');
 */

class DependencyContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
    }

    /**
     * Register a service or factory
     * @param {string} name - Service identifier
     * @param {class|function} definition - Class constructor or factory function
     * @param {array} dependencies - Optional array of dependency names to inject
     * @param {object} options - {singleton: boolean, factory: boolean}
     */
    register(name, definition, dependencies = [], options = {}) {
        if (this.services.has(name)) {
            console.warn(`Service '${name}' is already registered. Overwriting.`);
        }

        this.services.set(name, {
            definition,
            dependencies,
            singleton: options.singleton !== false, // default true
            isFactory: options.factory === true,
        });
    }

    /**
     * Register a singleton instance
     * @param {string} name - Service identifier
     * @param {object} instance - The instance to use
     */
    registerInstance(name, instance) {
        this.singletons.set(name, instance);
        this.services.set(name, {
            instance,
            singleton: true,
        });
    }

    /**
     * Resolve a service by name
     * @param {string} name - Service identifier
     * @returns {object} The resolved service instance
     */
    resolve(name) {
        // Check if already resolved singleton
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not found in container`);
        }

        // If it's already an instance, return it
        if (service.instance) {
            return service.instance;
        }

        // Resolve dependencies first
        const resolvedDeps = (service.dependencies || []).map(depName => {
            return this.resolve(depName);
        });

        // Create new instance
        let instance;
        if (typeof service.definition === 'function') {
            // It's a class or constructor
            instance = new service.definition(...resolvedDeps);
        } else if (typeof service.definition === 'object') {
            // It's already an object
            instance = service.definition;
        } else {
            throw new Error(`Invalid service definition for '${name}'`);
        }

        // Cache singleton if needed
        if (service.singleton) {
            this.singletons.set(name, instance);
        }

        return instance;
    }

    /**
     * Get all registered service names
     * @returns {array} Array of service names
     */
    getServiceNames() {
        return Array.from(this.services.keys());
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service identifier
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name) || this.singletons.has(name);
    }

    /**
     * Clear all services (useful for testing)
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
    }

    /**
     * Get container stats (for debugging)
     * @returns {object}
     */
    getStats() {
        return {
            servicesRegistered: this.services.size,
            singletonsResolved: this.singletons.size,
            serviceNames: this.getServiceNames(),
        };
    }
}

// Export for use in both Node and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DependencyContainer;
}
