# D3: BitWorld

# Game Design Vision

{a few-sentence description of the game mechanics}

# Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

# Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?

- [ ] Examine leaflet starter code

### Map Requirements

- [ ] Cells generate to edge of the map
- [ ] Limit cell interaction to those nearby (3 cells away)
- [ ] Initial cell load state is consistent with different page loads

### Inventory Requirements

- [ ] Can only pick up one cell at once
- [ ] Picking up cell removes it from cell containing it
- [ ] If you're holding the token then you can clearly see its value

### Crafting Requirements

- [ ] Can place token on other equal value token to create new token with updated value
- [ ] The game detects when the player has a token of sufficient value in hand
