# D3: BitWorld

## Game Design Vision

BitWorld is a grid-based exploration and crafting game where players navigate a procedurally generated map to collect and combine tokens. Players can only hold one token at a time and must strategically move around the map to find tokens of matching values to craft higher-value tokens. The ultimate goal is to create a token of sufficient value to win the game, with lower-value tokens being more common and higher-value tokens requiring more crafting steps to obtain.

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
- [x] Lower value ranked tokens should be more common on the map (probability system)

#### Inventory Requirements

- [x] You can only pick up common tokens when first spawning

#### Crafting Requirements

- [x] Player can now craft a token a value higher than before
- [x] The game now requires that threshold to be reached for victory to be declared
- [x] Add something to UI to show user the orders of rankings

### D3.c: Globe-spanning Gameplay

- [x] Cells should appear to have a memory of their state that persists even when they are not visible on the map
  - persistence across page loads is not yet required
  - [x] Cells should apply the Flyweight pattern or some similarly-effective memory-saving strategy so cells not visible on the map do not require memory for storage if they have not been modified by the player.
  - [x] Use the Memento pattern or some similarly-effective serialization strategy to preserve the state of modified cells when they scroll off-screen, and restore them when they return to view.

### D3.d: Gameplay Across Real-world Space and Time

- [x] The browser geolocation API should be used to control player character movement instead of on-screen buttons
- [ ] The implementation of the new player movement control system should be hidden behind an interface so that most of the game code does not depend on what moves the character. This implementation should embody the Facade design pattern.
- [ ] The browser localStorage API should be used to persist game state across page loads.
  - Even if the player closes the game's page, they should be able to continue gameplay from the same state by simply opening the page again.
- [x] The player needs some way to switch between button-based and geolocation-based movement.
