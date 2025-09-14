# Purpose

This document defines the guiding principles and constraints for building the Pixel Planet Rover mini-game using Claude Code. It exists to keep development focused, lightweight, and aligned with the intended vibe.

## Core Values

- Low Fidelity First: Prioritize a minimal, functional prototype over polish or realism.
- Browser-Ready: All code should run in a modern browser with no external build tooling required unless absolutely necessary.
- Simplicity over Abstraction: Avoid over-engineering; don’t add systems until they’re needed.
- Vibe Driven: Focus on fun, curiosity, and charm in how the rover and planet feel, even if visuals are basic.
- Composable & Hackable: Keep code modular so future experiments (terrain variation, rover upgrades, hazards) can be slotted in.

## MVP Feature Set

- A simple 3D sphere representing a planet (Mars/moon-like).
- A rover that sits on the planet surface and can move around it. 
- Ability for the player to rotate the planet and control the rover’s movement.
- Basic terrain features: craters, cliffs, uneven surfaces as obstacles.
- Pixel-art or low-poly vibe (blocky, charming rather than realistic).

## Out of Scope (for MVP)

- Textures, advanced shaders, physics simulation.
- Multiplayer.
- Complex UI or menus.

## Technical Guidance

- Target browser-based play (WebGL / Three.js likely candidate).
- Stick to vanilla JS + Three.js (or similar lightweight lib).
- Keep assets lightweight (simple meshes, generated terrain, placeholder art). 
- Favor clarity over optimization at this stage.

## Stretch Ideas (after MVP)

- Different planet biomes (icy, volcanic, desert). 
- Collectible resources or “points of interest.” 
- Day/night cycle or dynamic lighting. 
- Procedural planet generation.