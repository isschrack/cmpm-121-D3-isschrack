# D3: BitWorld

## Game Design Vision

{a few-sentence description of the game mechanics}

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

### D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?

- [x] Examine leaflet starter code
- [x] Create initial README.md documentation

#### Map Requirements

- [x] Cells generate to edge of the map
- [x] Limit cell interaction to those nearby
  - [x] Add indicator that some cells are further away (they're red)
- [x] Initial cell load state is consistent with different page loads
- [x] Can see value of token without clicking on it

#### Inventory Requirements

- [x] Can only pick up one cell at once
- [x] Picking up cell removes it from cell containing it
- [x] If you're holding the token then you can clearly see its value

#### Crafting Requirements

- [x] Can place token on other equal value token to create new token with updated value
- [x] The game detects when the player has a token of sufficient value in hand

### D3.b: Globe-spanning Gameplay

#### Map Requirements

- [x] Player movement buttons
- [x] Cells should appear to be memoryless in the sense that they forget their state when they are no longer visible on the screen.
  - The player should be able to farm tokens by moving into and out of the visibility range of a cell.

#### Crafting Requirements

- [x] Player can now craft a token a value higher than before
- [ ] The game now requires that threshold to be reached for victory to be declared
- [x] Add something to UI to show user the orders of rankings
