// game.js - Main game orchestration using dependency injection
// Game services instance (resolved from DI container)
let gameServices = null;

// Initialize the game with dependency injection
async function init() {
    console.log('[Game] Initializing game with dependency injection...');

    // Create dependency container
    const container = new DependencyContainer();
    console.log('[Game] Dependency container created');

    // Bootstrap all services
    ServiceBootstrapper.bootstrap(container);
    console.log('[Game] Services bootstrapped');

    // Log available services
    const stats = container.getStats();
    console.log(`[Game] ${stats.servicesRegistered} services registered:`, stats.serviceNames);

    // Resolve the main game engine
    console.log('[Game] Resolving GameEngine...');
    const gameEngine = container.resolve('GameEngine');
    console.log('[Game] GameEngine resolved, calling initialize()...');
    await gameEngine.initialize();
    console.log('[Game] GameEngine initialized');

    // Store services for later access
    gameServices = {
        container,
        gameEngine,
        planetTypeManager: container.resolve('PlanetTypeManager'),
        modalManager: container.resolve('ModalManager'),
        toastManager: window.toastManager, // Legacy support
    };

    // Make container globally accessible for debugging (optional)
    if (GameConfig && GameConfig.debugMode) {
        window.gameContainer = container;
        console.log('Dependency container available as window.gameContainer');
        console.log('Bootstrap summary:', ServiceBootstrapper.getSummary(container));
    }

    return gameServices;
}

// Add keyboard shortcut for planet selection
function handlePlanetSelectionKey() {
    if (gameServices && gameServices.gameEngine && gameServices.gameEngine.keys && gameServices.gameEngine.keys['KeyP']) {
        if (gameServices.modalManager) {
            gameServices.modalManager.showPlanetModal();
        }
        gameServices.gameEngine.keys['KeyP'] = false; // Prevent repeat
    }
}

// Start the game
init().then((services) => {
    // Expose game engine globally for modal and input handlers
    window.gameEngine = services.gameEngine;

    const planetTypeManager = services.planetTypeManager;
    const modalManager = services.modalManager;
    const toastManager = services.toastManager;

    // Load saved generated planets from localStorage
    const loadedPlanets = planetTypeManager.loadGeneratedPlanetsFromStorage();

    // Show notification if planets were loaded
    if (loadedPlanets && toastManager) {
        const count = planetTypeManager.getGeneratedPlanets().length;
        toastManager.info(`Loaded ${count} saved generated planet${count === 1 ? '' : 's'} from storage.`);
    }

    // Initialize modal after game loads
    console.log('Game initialized, planet manager loaded:', planetTypeManager.loaded);
    console.log('Available planet types:', planetTypeManager.getAvailablePlanetTypes());

    // Initialize the modal manager
    if (modalManager) {
        modalManager.initializePlanetModal();
    }
}).catch((error) => {
    console.error('Failed to initialize game:', error);
    console.error('Stack trace:', error.stack);
    console.error('Available services in container:', gameServices?.container?.getStats?.());
    alert(`Failed to initialize the game: ${error.message}\n\nCheck the browser console for details.`);
});