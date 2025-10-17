/**
 * ServiceBootstrapper
 *
 * Handles initialization and registration of all game services.
 * This replaces the scattered initialization logic in game.js.
 *
 * Usage:
 *   const container = new DependencyContainer();
 *   ServiceBootstrapper.bootstrap(container);
 *   const gameEngine = container.resolve('gameEngine');
 */

class ServiceBootstrapper {
    /**
     * Bootstrap all services into the container
     * @param {DependencyContainer} container
     * @returns {DependencyContainer} The initialized container
     */
    static bootstrap(container) {
        // Register configuration modules first (no dependencies)
        this.registerConfigs(container);

        // Register utility modules (no or minimal dependencies)
        this.registerUtilities(container);

        // Register core rendering and physics (depends on configs)
        this.registerCore(container);

        // Register game managers and specialized systems
        this.registerManagers(container);

        // Register the main game engine (depends on everything)
        this.registerGameEngine(container);

        return container;
    }

    /**
     * Register all configuration modules
     * @private
     */
    static registerConfigs(container) {
        // Configurations are singletons that contain no state
        container.registerInstance('PhysicsConfig', PhysicsConfig);
        container.registerInstance('RenderingConfig', RenderingConfig);
        container.registerInstance('TerrainConfig', TerrainConfig);
        container.registerInstance('GameConfig', GameConfig);
    }

    /**
     * Register utility modules
     * @private
     */
    static registerUtilities(container) {
        // Register shared utility classes
        container.registerInstance('RNGUtils', RNGUtils);
        container.registerInstance('ColorUtils', ColorUtils);
        container.registerInstance('ErrorHandler', ErrorHandler);
        container.registerInstance('ValidationUtils', ValidationUtils);
    }

    /**
     * Register core rendering and physics systems
     * @private
     */
    static registerCore(container) {
        // RenderingEngine depends on RenderingConfig
        container.register(
            'RenderingEngine',
            RenderingEngine,
            ['RenderingConfig'],
            { singleton: true }
        );

        // TerrainGenerator depends on TerrainConfig
        container.register(
            'TerrainGenerator',
            TerrainGenerator,
            ['TerrainConfig'],
            { singleton: true }
        );

        // RoverPhysics depends on PhysicsConfig
        container.register(
            'RoverPhysics',
            RoverPhysics,
            ['PhysicsConfig'],
            { singleton: true }
        );

        // ParticleSystem depends on nothing for now
        container.register(
            'ParticleSystem',
            ParticleSystem,
            [],
            { singleton: true }
        );
    }

    /**
     * Register manager and specialized systems
     * @private
     */
    static registerManagers(container) {
        // Legacy managers - use existing window instances if available
        // These are created by the legacy code and attached to window

        if (window.planetTypeManager) {
            container.registerInstance('PlanetTypeManager', window.planetTypeManager);
        }

        if (window.planetGenerator) {
            container.registerInstance('PlanetGenerator', window.planetGenerator);
        }

        if (window.planetObjectManager) {
            container.registerInstance('PlanetObjectManager', window.planetObjectManager);
        }

        if (window.BiomeManager) {
            container.register(
                'BiomeManager',
                window.BiomeManager,
                [],
                { singleton: true }
            );
        }

        if (window.modalManager) {
            container.registerInstance('ModalManager', window.modalManager);
        }

        if (window.MobileInputHandler) {
            container.register(
                'MobileInputHandler',
                window.MobileInputHandler,
                [],
                { singleton: true }
            );
        }

        // Log which managers were registered
        const registered = ['PlanetTypeManager', 'PlanetGenerator', 'PlanetObjectManager', 'BiomeManager', 'ModalManager', 'MobileInputHandler'].filter(
            name => container.has(name)
        );
        console.log('[ServiceBootstrapper] Registered managers:', registered);
    }

    /**
     * Register the main game engine
     * @private
     */
    static registerGameEngine(container) {
        // Build dependency list - only include services that are registered
        const allDeps = [
            'RenderingEngine',
            'TerrainGenerator',
            'RoverPhysics',
            'ParticleSystem',
            'PlanetTypeManager',
            'PlanetObjectManager',
            'BiomeManager',
            'GameConfig',
            'RenderingConfig',
            'TerrainConfig',
            'PhysicsConfig',
        ];

        const availableDeps = allDeps.filter(dep => container.has(dep));
        const missingDeps = allDeps.filter(dep => !container.has(dep));

        if (missingDeps.length > 0) {
            console.warn('[ServiceBootstrapper] Missing dependencies for GameEngine:', missingDeps);
        }

        console.log('[ServiceBootstrapper] GameEngine will be initialized with dependencies:', availableDeps);

        // GameEngine depends on many subsystems
        container.register(
            'GameEngine',
            GameEngine,
            availableDeps,
            { singleton: true }
        );
    }

    /**
     * Get a summary of what was registered
     * @param {DependencyContainer} container
     * @returns {object}
     */
    static getSummary(container) {
        return {
            servicesRegistered: container.getStats().servicesRegistered,
            serviceNames: container.getStats().serviceNames.sort(),
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServiceBootstrapper;
}
