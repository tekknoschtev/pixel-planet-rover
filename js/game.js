// game.js - Main game orchestration using modular systems
// Global game engine instance
let gameEngine = null;

// Object collision detection variables
let lastObjectCollisionCheck = 0;
const objectCollisionInterval = 100; // Check every 100ms

// Initialize the game
async function init() {
    // Create and initialize the game engine
    gameEngine = new GameEngine();
    await gameEngine.initialize();

    // Make game engine globally accessible for other systems
    window.gameEngine = gameEngine;
}

// Add keyboard shortcut for planet selection
function handlePlanetSelectionKey() {
    if (gameEngine && gameEngine.keys && gameEngine.keys['KeyP']) {
        if (window.modalManager) {
            window.modalManager.showPlanetModal();
        }
        gameEngine.keys['KeyP'] = false; // Prevent repeat
    }
}

// Start the game
init().then(() => {
    // Load saved generated planets from localStorage
    const loadedPlanets = planetTypeManager.loadGeneratedPlanetsFromStorage();

    // Show notification if planets were loaded
    if (loadedPlanets && window.toastManager) {
        const count = planetTypeManager.getGeneratedPlanets().length;
        window.toastManager.info(`Loaded ${count} saved generated planet${count === 1 ? '' : 's'} from storage.`);
    }

    // Initialize modal after game loads
    console.log('Game initialized, planet manager loaded:', planetTypeManager.loaded);
    console.log('Available planet types:', planetTypeManager.getAvailablePlanetTypes());

    // Initialize the modal manager
    if (window.modalManager) {
        window.modalManager.initializePlanetModal();
    }
});