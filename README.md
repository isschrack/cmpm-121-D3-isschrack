# BitWorld - CMPM 121 D3 Project

BitWorld is a grid-based exploration and crafting game built with TypeScript and Leaflet.js. Players navigate a map to collect tokens and combine them to create higher-value tokens in a manner inspired by the game 2048.

## Game Overview

In BitWorld, players explore a procedurally generated map divided into a grid of cells. Each cell may contain a token with a value based on powers of two (2, 4, 8, ...). The goal is to collect tokens and craft them together to create higher-value tokens; the codebase currently defines the victory value as `4096` (see `src/cellFlyweight.ts`).

## Core Mechanics

### Map Exploration

- The game uses Leaflet.js to render an interactive map centered on a classroom location
- The map is divided into a grid of cells, each representing a specific geographic area
- Players can only interact with cells that are nearby their current position
- Cells that are too far away are visually indicated with red coloring
- **Disclaimer**: Red tokens are too far away and cannot be clicked.

### Token Collection

- Players can only hold one token at a time
- Tokens can be picked up from cells by interacting with them
- When a token is picked up, it disappears from the cell
- The value of tokens is visible without clicking on the cell

### Token Values

- Tokens have values based on powers of two: 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096. Only tokens with equal values can be crafted together (they merge into the next power of two).

### Crafting System

- Players can combine two tokens of equal value to create a new token with the next value (e.g., 2 + 2 -> 4). To craft, a player must hold a token and interact with a cell containing a token of the same value. The win condition is creating a token with value `4096` (the top rank).

## Technical Implementation

### Design Patterns

- **Flyweight**: shared, read-only cell metadata is implemented in `src/cellFlyweight.ts` via `CellFlyweight` and `CellFlyweightFactory` to minimize duplicated bounds/center objects and improve performance.
- **Facade**: movement and geolocation complexity are wrapped by `src/movementFacade.ts`'s `MovementController`, which provides a simple interface for the rest of the app.
- **Memento**: cell state serialization and restoration is provided by `MementoManager` and `CellMemento` in `src/cellFlyweight.ts`, and mementos are persisted to `localStorage` when available.

### Technologies Used

- `TypeScript`: Primary language for game logic
- `Leaflet.js`: Map rendering and interaction
- `Deno`: Runtime environment and task runner
- `Vite`: Build tool / dev server (configured for use with Deno tasks)
- `MurmurHash` (or similar): Deterministic hashing used for reproducible token placement

### Key Features

- Procedurally generated grid cells with deterministic token placement
- Distance-based interaction limits (Manhattan distance)
- Deterministic token values using hash-based randomization
- Visual indicators for nearby vs. out-of-range cells (out-of-range cells are shown in red)

### Project Structure

- `src/main.ts`: Core game logic (map generation, token management, player interactions)
- `src/style.css`: Styling for game UI elements
- `src/_luck.ts`: Deterministic RNG helpers for consistent state
- `src/_leafletWorkaround.ts`: Small fix/workaround for Leaflet marker assets
- `src/cellFlyweight.ts`: Lightweight representation and rendering helpers for grid cells
- `src/movementFacade.ts`: Movement and distance calculation helpers

### Development

#### Prerequisites

- Install `Deno` (v1.40+ recommended) — see [Deno](https://deno.land) for installation instructions

#### Common Tasks

Start the development server (Vite via Deno task):

```bash
deno task dev
```

Build a production bundle:

```bash
deno task build
```

Preview the production build locally:

```bash
deno task preview
```

Lint and format the code:

```bash
deno task lint
deno task fmt
```

Run the full CI checks (lint, fmt, build):

```bash
deno task ci
```

#### Development Plan

This repository uses an incremental development plan model. See `PLAN.md` for milestone decomposition, task lists, and the workflow you should follow. The assignment expects you to maintain and update `PLAN.md` as requirements evolve (break milestones into small, testable steps and track progress).

## Game Controls

- Navigate the map by dragging
- Click on cells to interact with them (pickup/craft tokens)
- Zoom is fixed to maintain consistent gameplay

### Win Condition

Create a token with a value of `4096` by merging tokens of equal value/rank repeatedly (the value defined by `VICTORY_VALUE` in `src/cellFlyweight.ts`).
