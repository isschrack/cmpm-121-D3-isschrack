RE# BitWorld - CMPM 121 D3 Project

BitWorld is a grid-based exploration and crafting game built with TypeScript and Leaflet.js. Players navigate a map to collect tokens and combine them to create higher-value tokens.

## Game Overview

In BitWorld, players explore a procedurally generated map divided into a grid of cells. Each cell may contain a token with a value based on powers of 2 (like in the 2048 game). The goal is to collect tokens and craft them together to create higher-value tokens, ultimately achieving a token value of 2048 to win the game.

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

- Tokens now have values based on powers of 2: 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024
- This creates a more consistent crafting experience similar to the 2048 game
- Only tokens with matching values can be crafted together

### Crafting System

- Players can combine two tokens of equal value to create a new token with their combined value
- To craft, players must hold one token and interact with a cell containing another token
- Successfully crafting a token with a value of 200 or higher wins the game

## Technical Implementation

### Technologies Used

- **TypeScript**: Primary language for game logic
- **Leaflet.js**: Map rendering and interaction
- **Deno**: Runtime environment
- **Vite**: Build tool and development server
- **MurmurHash**: For deterministic random number generation

### Key Features

- Procedurally generated map cells with consistent token placement
- Distance-based interaction limits (Manhattan distance calculation)
- Deterministic token values using hash-based randomization
- Responsive UI with clear visual indicators for token values and distances

### Project Structure

- `src/main.ts`: Core game logic including map generation, token management, and player interactions
- `src/style.css`: Custom styling for game UI elements
- `src/_luck.ts`: Deterministic random number generation for consistent game state
- `src/_leafletWorkaround.ts`: Fix for Leaflet marker image loading issues

## Development

### Prerequisites

- Deno installed on your system

### Running the Project

1. Clone the repository
2. Run `deno task dev` to start the development server
3. The game will open automatically in your default browser

### Building for Production

Run `deno task build` to create a production build in the `dist` folder.

## Game Controls

- Navigate the map by dragging
- Click on cells to interact with them (pickup/craft tokens)
- Zoom is fixed to maintain consistent gameplay

## Win Condition

Create a token with a value of 2048 by crafting tokens together.
