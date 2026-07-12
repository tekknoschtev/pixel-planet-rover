// game.js - Entry point: constructs the game engine and UI, then starts the game
import { GameEngine } from './core/GameEngine.js';
import { ModalManager } from './ui/ModalManager.js';
import { toastManager } from './ui/ToastManager.js';
import { planetTypeManager } from './planetTypes.js';

async function init() {
    const gameEngine = new GameEngine();
    await gameEngine.initialize();

    const modalManager = new ModalManager(gameEngine);
    modalManager.initializePlanetModal();

    // Load saved generated planets from localStorage
    if (planetTypeManager.loadGeneratedPlanetsFromStorage()) {
        const count = planetTypeManager.getGeneratedPlanets().length;
        toastManager.info(`Loaded ${count} saved generated planet${count === 1 ? '' : 's'} from storage.`);
    }

    // Keyboard shortcut: P opens the planet selection modal
    document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyP' && gameEngine.inputEnabled) {
            modalManager.showPlanetModal();
        }
    });
}

init().catch((error) => {
    console.error('Failed to initialize game:', error);
    alert(`Failed to initialize the game: ${error.message}\n\nCheck the browser console for details.`);
});
