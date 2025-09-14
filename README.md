# Pixel Planet Rover

A charming, low-fi 3D browser game where you control a rover exploring procedurally generated planets. Built with vanilla JavaScript and Three.js for a lightweight, retro gaming experience.

## 🚀 Features

- **Procedural Planet Generation** - Create unique planets with customizable biomes, terrain, and features
- **Multiple Planet Types** - Explore Mars-like, moon-like, icy, volcanic, and desert worlds
- **Biome Mixing** - Combine different biome types for unique planetary experiences  
- **Object Discovery** - Find and collect mysterious objects scattered across planet surfaces
- **Pixel-Art Aesthetic** - Retro, blocky visuals with a charming low-fi vibe
- **Browser-Ready** - No build tools required, runs directly in modern browsers

## 🎮 Getting Started

1. Clone or download this repository
2. Start a local server:
   ```bash
   npm run serve
   ```
3. Open your browser to `http://localhost:8080`
4. Use mouse to rotate the planet and WASD keys to move the rover

## 🌍 Planet Types

- **Mars** - Red, dusty terrain with canyons and mesas
- **Moon** - Gray, cratered surface with stark lighting
- **Ice World** - Frozen landscapes with crystalline formations
- **Volcanic** - Dark, lava-sculpted terrain with glowing features
- **Desert** - Sandy dunes and rocky outcroppings

## 🛠️ Development Philosophy

This project follows a "low fidelity first" approach, prioritizing:
- Minimal, functional prototypes over polish
- Browser compatibility without complex build tools
- Simple, hackable code for easy experimentation
- Charm and fun over photorealism

## 📁 Project Structure

```
├── index.html          # Main game page
├── css/styles.css      # Pixel-art styling
├── js/
│   ├── game.js         # Core game logic and controls
│   ├── planetGenerator.js # Procedural planet creation
│   ├── planetObjects.js   # Discoverable objects system
│   └── planetTypes.js     # Planet biome definitions
└── config/planets.json   # Preset planet configurations
```

## 🎯 Controls

- **Mouse** - Rotate planet view
- **WASD** - Move rover around planet surface
- **Click "Change Planet"** - Access planet selection and generator