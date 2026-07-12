// ModalManager.js - Handles planet selection modal and UI controls
import { planetTypeManager } from '../planetTypes.js';
import { planetGenerator } from '../planetGenerator.js';
import { toastManager, showConfirmDialog } from './ToastManager.js';

export class ModalManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.selectedPlanetType = null;
        this.biomeSliders = [
            { id: 'marsSlider', valueId: 'marsValue', biome: 'mars' },
            { id: 'moonSlider', valueId: 'moonValue', biome: 'moon' },
            { id: 'iceSlider', valueId: 'iceValue', biome: 'ice' },
            { id: 'volcanicSlider', valueId: 'volcanicValue', biome: 'volcanic' },
            { id: 'desertSlider', valueId: 'desertValue', biome: 'desert' }
        ];
    }

    initializePlanetModal() {
        const modal = document.getElementById('planetModal');
        const closeBtn = document.querySelector('.close');

        // Initialize tab functionality
        this.initializePlanetTabs();

        // Initialize generator sliders
        this.initializeGeneratorSliders();

        // Close button functionality
        closeBtn.addEventListener('click', () => this.closePlanetModal());

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closePlanetModal();
        });

        // Static buttons in the modal markup
        document.getElementById('openPlanetModalBtn').addEventListener('click', () => this.showPlanetModal());
        document.getElementById('importPlanetBtn').addEventListener('click', () => this.importPlanet());
        document.getElementById('randomizeParamsBtn').addEventListener('click', () => this.randomizeGeneratorParams());
        document.getElementById('generatePlanetBtn').addEventListener('click', () => this.generateAndVisitPlanet());
        document.getElementById('clearGeneratedBtn').addEventListener('click', () => this.clearGeneratedPlanets());
    }

    createButton(label, className, onClick) {
        const button = document.createElement('button');
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    populatePresetPlanets() {
        const planetGrid = document.getElementById('planetGrid');
        planetGrid.innerHTML = '';
        const planets = planetTypeManager.getAvailablePlanetTypes().filter(p => p.type === 'preset');

        if (planets.length === 0) {
            planetGrid.innerHTML = '<p style="color: #ccc; text-align: center;">Loading planet configurations...</p>';
            return;
        }

        planets.forEach(planet => {
            const config = planetTypeManager.getPlanetConfig(planet.id);
            const previewColor = config ? config.material.color.replace('0x', '#') : '#8B4513';
            const planetOption = this.createPlanetOption(planet, previewColor);
            planetGrid.appendChild(planetOption);
        });

        // Add bottom buttons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'planet-buttons';
        buttonsDiv.appendChild(this.createButton('Cancel', 'btn btn-secondary', () => this.closePlanetModal()));
        buttonsDiv.appendChild(this.createButton('Visit Planet', 'btn btn-primary', () => this.applyPlanetSelection()));
        planetGrid.appendChild(buttonsDiv);
    }

    populateGeneratedPlanets() {
        const generatedList = document.getElementById('generatedPlanetsList');
        const generatedPlanets = planetTypeManager.getGeneratedPlanets();

        if (generatedPlanets.length === 0) {
            generatedList.innerHTML = '<div class="no-generated-planets">No generated planets yet. Use the Planet Generator to create some!</div>';
            return;
        }

        generatedList.innerHTML = '';

        // Create grid layout for generated planets
        const generatedGrid = document.createElement('div');
        generatedGrid.className = 'planet-grid';

        generatedPlanets.forEach(planet => {
            const planetConfig = planetTypeManager.getPlanetConfig(planet.id);
            const previewColor = planetConfig ? planetConfig.material.color.replace('0x', '#') : '#8B4513';
            const planetOption = this.createPlanetOption(
                { ...planet, description: `Based on ${planet.baseBiome} • Seed: ${planet.seed}` },
                previewColor,
                { generated: true }
            );
            generatedGrid.appendChild(planetOption);
        });

        generatedList.appendChild(generatedGrid);

        // Add management buttons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'planet-buttons';
        buttonsDiv.appendChild(this.createButton('Export All', 'btn btn-secondary', () => this.exportAllGeneratedPlanets()));
        buttonsDiv.appendChild(this.createButton('Clear All', 'btn btn-secondary', () => this.clearGeneratedPlanets()));
        buttonsDiv.appendChild(this.createButton('Visit Selected', 'btn btn-primary', () => this.applyPlanetSelection()));
        generatedList.appendChild(buttonsDiv);
    }

    createPlanetOption(planet, previewColor, { generated = false } = {}) {
        const planetOption = document.createElement('div');
        planetOption.className = generated ? 'planet-option generated' : 'planet-option';
        planetOption.dataset.planetId = planet.id;

        const canvas = document.createElement('canvas');
        canvas.className = 'planet-preview';
        canvas.width = 32;
        canvas.height = 32;
        planetOption.appendChild(canvas);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'planet-name';
        nameDiv.textContent = planet.name;
        planetOption.appendChild(nameDiv);

        const descriptionDiv = document.createElement('div');
        descriptionDiv.className = 'planet-description';
        descriptionDiv.textContent = planet.description;
        planetOption.appendChild(descriptionDiv);

        if (generated) {
            const exportButton = document.createElement('button');
            exportButton.className = 'planet-export-btn';
            exportButton.title = 'Export Planet';
            exportButton.textContent = '📤';
            exportButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.exportPlanet(planet.id);
            });
            planetOption.appendChild(exportButton);
        }

        this.drawPixelatedCircle(canvas.getContext('2d'), 16, 16, 12, previewColor);

        // Mark current planet
        if (planet.id === planetTypeManager.getCurrentPlanetType()) {
            planetOption.classList.add('selected');
            this.selectedPlanetType = planet.id;
        }

        planetOption.addEventListener('click', () => {
            this.selectPlanet(planet.id, planetOption);
        });

        return planetOption;
    }

    drawPixelatedCircle(ctx, centerX, centerY, radius, color) {
        ctx.fillStyle = color;
        ctx.imageSmoothingEnabled = false;

        // Draw circle using pixels - classic Bresenham-style approach
        const pixelSize = 2; // Match game's chunky pixel aesthetic

        for (let x = -radius; x <= radius; x += pixelSize) {
            for (let y = -radius; y <= radius; y += pixelSize) {
                const distance = Math.sqrt(x * x + y * y);
                if (distance <= radius) {
                    ctx.fillRect(centerX + x, centerY + y, pixelSize, pixelSize);
                }
            }
        }
    }

    showPlanetModal() {
        const modal = document.getElementById('planetModal');

        // Populate options each time modal is opened to ensure fresh data
        this.populatePresetPlanets();
        this.populateGeneratedPlanets();

        modal.style.display = 'block';
        this.selectedPlanetType = planetTypeManager.getCurrentPlanetType();

        // Disable gameplay input when modal is open
        if (this.gameEngine) {
            this.gameEngine.inputEnabled = false;
        }
    }

    closePlanetModal() {
        const modal = document.getElementById('planetModal');
        modal.style.display = 'none';

        // Re-enable gameplay input when modal is closed
        if (this.gameEngine) {
            this.gameEngine.inputEnabled = true;
        }
    }

    applyPlanetSelection() {
        if (this.selectedPlanetType && this.selectedPlanetType !== planetTypeManager.getCurrentPlanetType()) {
            if (this.gameEngine) {
                this.gameEngine.switchPlanet(this.selectedPlanetType);
            }
        }
        this.closePlanetModal();
    }

    selectPlanet(planetId, optionElement) {
        // Remove selection from other options
        document.querySelectorAll('.planet-option').forEach(opt =>
            opt.classList.remove('selected')
        );

        // Select this option
        optionElement.classList.add('selected');
        this.selectedPlanetType = planetId;
    }

    // Planet Tab Management Functions
    initializePlanetTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.showPlanetTab(button.dataset.tab);
            });
        });
    }

    showPlanetTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Show selected tab
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        if (tabButton) tabButton.classList.add('active');

        if (tabName === 'preset') {
            document.getElementById('presetTab').classList.add('active');
        } else if (tabName === 'generator') {
            document.getElementById('generatorTab').classList.add('active');
        } else if (tabName === 'generated') {
            document.getElementById('generatedTab').classList.add('active');
            this.populateGeneratedPlanets();
        }
    }

    // Planet Generator Functions
    initializeGeneratorSliders() {
        const sliders = [
            { id: 'radiusSlider', valueId: 'radiusValue' },
            { id: 'roughnessSlider', valueId: 'roughnessValue' },
            { id: 'heightSlider', valueId: 'heightValue' },
            { id: 'craterSlider', valueId: 'craterValue' },
            { id: 'mountainSlider', valueId: 'mountainValue' }
        ];

        sliders.forEach(({ id, valueId }) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(valueId);

            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    valueDisplay.textContent = slider.value;
                });
            }
        });

        // Initialize biome mixing controls
        this.initializeBiomeMixingControls();
    }

    initializeBiomeMixingControls() {
        const enableCheckbox = document.getElementById('enableBiomeMixing');
        const biomeMixingControls = document.getElementById('biomeMixingControls');
        const presetSelect = document.getElementById('biomeMixingPreset');

        if (!enableCheckbox || !biomeMixingControls) return;

        // Toggle biome mixing controls
        enableCheckbox.addEventListener('change', () => {
            biomeMixingControls.style.display = enableCheckbox.checked ? 'block' : 'none';
            if (enableCheckbox.checked) {
                this.updateBiomeMixingFromBaseBiome();
            }
        });

        // Handle preset selection
        if (presetSelect) {
            presetSelect.addEventListener('change', () => {
                if (presetSelect.value) {
                    this.applyBiomeMixingPreset(presetSelect.value);
                }
            });
        }

        // Initialize biome sliders
        this.biomeSliders.forEach(({ id, valueId }) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(valueId);

            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    valueDisplay.textContent = parseFloat(slider.value).toFixed(1);
                    this.updateTotalInfluence();
                    // Clear preset selection when manually adjusting
                    if (presetSelect) presetSelect.value = '';
                });
            }
        });
    }

    updateBiomeMixingFromBaseBiome() {
        const baseBiome = document.getElementById('baseBiome').value;
        if (!baseBiome) return;

        // Reset all sliders
        this.resetBiomeSliders();

        // Set the base biome to 1.0
        const baseSlider = document.getElementById(`${baseBiome}Slider`);
        const baseValue = document.getElementById(`${baseBiome}Value`);
        if (baseSlider && baseValue) {
            baseSlider.value = '1.0';
            baseValue.textContent = '1.0';
            this.updateTotalInfluence();
        }
    }

    resetBiomeSliders() {
        const biomes = ['mars', 'moon', 'ice', 'volcanic', 'desert'];
        biomes.forEach(biome => {
            const slider = document.getElementById(`${biome}Slider`);
            const value = document.getElementById(`${biome}Value`);
            if (slider && value) {
                slider.value = '0.0';
                value.textContent = '0.0';
            }
        });
        this.updateTotalInfluence();
    }

    applyBiomeMixingPreset(presetName) {
        const presets = planetGenerator.getBiomeMixingPresets();
        const preset = presets[presetName];

        if (!preset) return;

        // Reset all sliders first
        this.resetBiomeSliders();

        // Apply preset values
        for (const [biome, value] of Object.entries(preset)) {
            const slider = document.getElementById(`${biome}Slider`);
            const valueDisplay = document.getElementById(`${biome}Value`);
            if (slider && valueDisplay) {
                slider.value = value.toString();
                valueDisplay.textContent = value.toFixed(1);
            }
        }

        this.updateTotalInfluence();
    }

    updateTotalInfluence() {
        const biomes = ['mars', 'moon', 'ice', 'volcanic', 'desert'];
        let total = 0;

        biomes.forEach(biome => {
            const slider = document.getElementById(`${biome}Slider`);
            if (slider) {
                total += parseFloat(slider.value);
            }
        });

        const totalDisplay = document.getElementById('totalInfluence');
        if (totalDisplay) {
            totalDisplay.textContent = total.toFixed(1);

            // Color code the total based on whether it's reasonable
            if (total === 0) {
                totalDisplay.style.color = '#f44336'; // Red
            } else if (total < 0.5 || total > 2.0) {
                totalDisplay.style.color = '#FF9800'; // Orange
            } else {
                totalDisplay.style.color = '#4CAF50'; // Green
            }
        }
    }

    getBiomeMixFromUI() {
        const enableCheckbox = document.getElementById('enableBiomeMixing');
        if (!enableCheckbox || !enableCheckbox.checked) {
            return null;
        }

        const biomes = ['mars', 'moon', 'ice', 'volcanic', 'desert'];
        const ratios = {};
        let hasAnyValue = false;

        biomes.forEach(biome => {
            const slider = document.getElementById(`${biome}Slider`);
            if (slider) {
                const value = parseFloat(slider.value);
                if (value > 0) {
                    ratios[biome] = value;
                    hasAnyValue = true;
                }
            }
        });

        return hasAnyValue ? planetGenerator.createBiomeMix(ratios) : null;
    }

    randomizeGeneratorParams() {
        const biomes = ['', 'mars', 'moon', 'ice', 'volcanic', 'desert'];
        const randomBiome = biomes[Math.floor(Math.random() * biomes.length)];

        document.getElementById('baseBiome').value = randomBiome;
        document.getElementById('planetName').value = '';
        document.getElementById('planetSeed').value = '';

        // Randomize sliders
        document.getElementById('radiusSlider').value = Math.floor(Math.random() * 460) + 40;
        document.getElementById('roughnessSlider').value = (Math.random() * 0.9 + 0.1).toFixed(1);
        document.getElementById('heightSlider').value = Math.floor(Math.random() * 14) + 1;
        document.getElementById('craterSlider').value = Math.random().toFixed(1);
        document.getElementById('mountainSlider').value = Math.random().toFixed(1);

        // Update value displays
        document.getElementById('radiusValue').textContent = document.getElementById('radiusSlider').value;
        document.getElementById('roughnessValue').textContent = document.getElementById('roughnessSlider').value;
        document.getElementById('heightValue').textContent = document.getElementById('heightSlider').value;
        document.getElementById('craterValue').textContent = document.getElementById('craterSlider').value;
        document.getElementById('mountainValue').textContent = document.getElementById('mountainSlider').value;

        // Randomly enable biome mixing (50% chance)
        const enableMixing = Math.random() < 0.5;
        const enableCheckbox = document.getElementById('enableBiomeMixing');
        if (enableCheckbox) {
            enableCheckbox.checked = enableMixing;
            // Trigger the change event to show/hide controls
            enableCheckbox.dispatchEvent(new Event('change'));

            if (enableMixing) {
                // Randomly apply a preset (70% chance) or random mixing (30% chance)
                if (Math.random() < 0.7) {
                    const presets = Object.keys(planetGenerator.getBiomeMixingPresets());
                    const randomPreset = presets[Math.floor(Math.random() * presets.length)];
                    const presetSelect = document.getElementById('biomeMixingPreset');
                    if (presetSelect) {
                        presetSelect.value = randomPreset;
                        this.applyBiomeMixingPreset(randomPreset);
                    }
                } else {
                    // Apply random biome mixing
                    this.resetBiomeSliders();
                    const allBiomes = ['mars', 'moon', 'ice', 'volcanic', 'desert'];
                    const selectedBiomes = allBiomes.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 2);

                    selectedBiomes.forEach((biome, index) => {
                        const slider = document.getElementById(`${biome}Slider`);
                        const value = document.getElementById(`${biome}Value`);
                        if (slider && value) {
                            const influence = index === 0 ? Math.random() * 0.4 + 0.4 : Math.random() * 0.4 + 0.1;
                            slider.value = influence.toFixed(1);
                            value.textContent = influence.toFixed(1);
                        }
                    });
                    this.updateTotalInfluence();
                }
            }
        }
    }

    generateAndVisitPlanet() {
        const baseBiome = document.getElementById('baseBiome').value || null;
        const planetName = document.getElementById('planetName').value || null;
        const planetSeed = document.getElementById('planetSeed').value || null;

        // Get biome mixing settings
        const biomeMix = this.getBiomeMixFromUI();
        const enableBiomeMixing = document.getElementById('enableBiomeMixing').checked;

        // Get custom parameters
        const customParams = {
            name: planetName,
            radius: parseFloat(document.getElementById('radiusSlider').value),
            roughness: parseFloat(document.getElementById('roughnessSlider').value),
            heightVariation: parseFloat(document.getElementById('heightSlider').value),
            craterDensity: parseFloat(document.getElementById('craterSlider').value),
            mountainDensity: parseFloat(document.getElementById('mountainSlider').value),
            biomeMix: biomeMix,
            enableBiomeMixing: enableBiomeMixing
        };

        // Generate planet
        const planetConfig = planetGenerator.generatePlanet(planetSeed, baseBiome, customParams);

        // Add to planet type manager
        planetTypeManager.addGeneratedPlanet(planetConfig);

        // Switch to the generated planet
        if (this.gameEngine) {
            this.gameEngine.switchPlanet(planetConfig.id);
        }

        // Close modal
        this.closePlanetModal();
    }

    // Generated Planet Management Functions
    exportPlanet(planetId) {
        const planetConfig = planetTypeManager.getPlanetConfig(planetId);
        if (planetConfig) {
            const exportData = planetGenerator.exportPlanet(planetConfig);

            // Copy to clipboard
            navigator.clipboard.writeText(exportData).then(() => {
                toastManager.success('Planet data copied to clipboard! Share this with others to let them explore your planet.');
            }).catch(() => {
                // Fallback - show in dialog
                prompt('Planet export data (copy this):', exportData);
            });
        }
    }

    clearGeneratedPlanets() {
        showConfirmDialog('Are you sure you want to remove all generated planets? This will permanently delete them from your browser storage.', () => {
            planetTypeManager.clearGeneratedPlanets();
            this.populateGeneratedPlanets();
            toastManager.info('All generated planets cleared from memory and storage.');
        });
    }

    exportAllGeneratedPlanets() {
        const generatedPlanets = planetTypeManager.getGeneratedPlanets();
        if (generatedPlanets.length === 0) {
            toastManager.info('No generated planets to export.');
            return;
        }

        const allExportData = generatedPlanets.map(planet => {
            const planetConfig = planetTypeManager.getPlanetConfig(planet.id);
            return planetGenerator.exportPlanet(planetConfig);
        });

        const combinedData = JSON.stringify(allExportData);

        // Copy to clipboard
        navigator.clipboard.writeText(combinedData).then(() => {
            toastManager.success(`Exported ${generatedPlanets.length} planets to clipboard!`);
        }).catch(() => {
            // Fallback - show in dialog
            prompt('All generated planets export data (copy this):', combinedData);
        });
    }

    importPlanet() {
        const importData = document.getElementById('importData').value.trim();
        if (!importData) {
            toastManager.warning('Please paste planet export data to import.');
            return;
        }

        const planetConfig = planetGenerator.importPlanet(importData);
        if (planetConfig) {
            // Add to planet type manager
            planetTypeManager.addGeneratedPlanet(planetConfig);

            // Clear import field
            document.getElementById('importData').value = '';

            // Switch to generated planets tab to show the imported planet
            this.showPlanetTab('generated');

            toastManager.success(`Successfully imported planet: ${planetConfig.name}`);
        } else {
            toastManager.error('Invalid planet export data. Please check the format and try again.');
        }
    }
}
