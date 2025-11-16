// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// Import Flyweight pattern
import {
  CACHE_SPAWN_PROBABILITY,
  CellContext,
  CellFlyweightFactory,
  CellMemento,
  CLASSROOM_LATLNG,
  MementoManager,
  RANKS,
  TILE_DEGREES,
  VICTORY_VALUE,
} from "./cellFlyweight.ts";
import MovementController from "./movementFacade.ts";
// Create basic UI elements
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

// Geolocation status display (shows raw GPS coords and accuracy)
const geoStatusDiv = document.createElement("div");
geoStatusDiv.id = "geoStatus";
geoStatusDiv.style.cssText = `
  margin-left: 10px;
  padding: 6px 10px;
  background: #f1f1f1;
  border-radius: 4px;
  font-size: 12px;
`;
geoStatusDiv.textContent = "Geolocation: inactive";
controlPanelDiv.append(geoStatusDiv);

// Manual location simulator (for debugging/testing when GPS is unavailable)
const mockContainer = document.createElement("div");
mockContainer.style.cssText =
  `display:flex; gap:6px; align-items:center; margin-left:10px;`;
const mockLatInput = document.createElement("input");
mockLatInput.placeholder = "lat";
mockLatInput.style.width = "110px";
const mockLngInput = document.createElement("input");
mockLngInput.placeholder = "lng";
mockLngInput.style.width = "110px";
const mockBtn = document.createElement("button");
mockBtn.textContent = "Simulate Location";
mockBtn.type = "button";
mockBtn.addEventListener("click", () => {
  const lat = parseFloat(mockLatInput.value);
  const lng = parseFloat(mockLngInput.value);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    simulatePosition(lat, lng);
  } else {
    alert("Enter valid numeric lat and lng to simulate.");
  }
});
mockContainer.append(mockLatInput, mockLngInput, mockBtn);
controlPanelDiv.append(mockContainer);

// Movement mode tracking
type MovementMode = "buttons" | "geolocation";
let currentMovementMode: MovementMode = "buttons";
const _geolocationWatchId: number | null = null;
const _lastPosition: { lat: number; lng: number } | null = null;
let lastSnappedCell: { i: number; j: number } | null = null;
let movementController: MovementController | null = null;

// Add a button to show rankings
const rankingsButton = document.createElement("button");
rankingsButton.id = "rankingsButton";
rankingsButton.textContent = "Show Rankings";
rankingsButton.type = "button";
rankingsButton.style.cssText = `
  margin-left: 10px;
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;
rankingsButton.addEventListener("click", showRankings);
controlPanelDiv.append(rankingsButton);

// Add a button to toggle movement mode
const toggleMovementButton = document.createElement("button");
toggleMovementButton.id = "toggleMovement";
toggleMovementButton.textContent = "Use Geolocation";
toggleMovementButton.type = "button";
toggleMovementButton.style.cssText = `
  margin-left: 10px;
  padding: 8px 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;
toggleMovementButton.addEventListener("click", toggleMovementMode);
controlPanelDiv.append(toggleMovementButton);

// Add a button to start a new game (clears persisted state)
const newGameButton = document.createElement("button");
newGameButton.id = "newGame";
newGameButton.textContent = "New Game";
newGameButton.type = "button";
newGameButton.style.cssText = `
  margin-left: 10px;
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;
newGameButton.addEventListener("click", () => {
  if (!confirm("Start a new game? This will erase saved progress.")) return;
  // Clear persisted state
  try {
    localStorage.removeItem("game_state");
    localStorage.removeItem("game_mementos");
  } catch (_e) {
    // ignore
  }

  // Clear in-memory state
  spawnedCaches.forEach((c) => {
    if (c.rect) c.rect.removeFrom(map);
    if (c.marker) c.marker.removeFrom(map);
  });
  spawnedCaches.clear();
  MementoManager.clearMementos();
  playerToken = null;
  hasPickedUpFirstToken = false;
  // Reset player position to classroom
  map.setView(CLASSROOM_LATLNG, GAMEPLAY_ZOOM_LEVEL);
  playerMarker.setLatLng(CLASSROOM_LATLNG);
  updateStatusPanel();
  generateMap();
  updateCacheProximity();
});
controlPanelDiv.append(newGameButton);

// Movement controls (N/S/E/W) to move the local player one grid step
const movementControls = document.createElement("div");
movementControls.id = "movementControls";
movementControls.style.cssText =
  `display: flex; gap: 8px; align-items: center; justify-content: center;`;

const btn = (id: string, label: string) => {
  const b = document.createElement("button");
  b.id = id;
  b.className = "move-btn";
  b.textContent = label;
  b.type = "button";
  return b;
};

// Function to toggle between movement modes
function toggleMovementMode() {
  if (movementController) {
    movementController.toggleMode();
    currentMovementMode = movementController.getMode();
    // Keep button text in sync (controller also updates it)
    toggleMovementButton.textContent = currentMovementMode === "buttons"
      ? "Use Geolocation"
      : "Use Buttons";
  } else {
    alert("Movement controller not yet initialized.");
  }
}

// Function to show rankings in a modal
function showRankings() {
  // Create modal overlay
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
  `;

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modalContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // Create close button
  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 15px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #333;
  `;
  closeButton.addEventListener("click", () => {
    document.body.removeChild(modalOverlay);
  });

  // Create title
  const title = document.createElement("h2");
  title.textContent = "Rankings";
  title.style.cssText = `
    margin-top: 0;
    text-align: center;
  `;

  // Create rankings table
  const rankingsTable = document.createElement("table");
  rankingsTable.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
  `;

  // Create table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const rankHeader = document.createElement("th");
  rankHeader.textContent = "Rank";
  rankHeader.style.cssText =
    "text-align: left; padding: 8px; border-bottom: 1px solid #ddd;";
  const valueHeader = document.createElement("th");
  valueHeader.textContent = "Value";
  valueHeader.style.cssText =
    "text-align: right; padding: 8px; border-bottom: 1px solid #ddd;";
  headerRow.append(rankHeader, valueHeader);
  thead.append(headerRow);
  rankingsTable.append(thead);

  // Create table body with rankings data
  const tbody = document.createElement("tbody");
  RANKS.forEach((rank, index) => {
    const row = document.createElement("tr");

    const rankCell = document.createElement("td");
    rankCell.textContent = `${index + 1}. ${rank.name}`;
    rankCell.style.cssText = "padding: 8px; border-bottom: 1px solid #eee;";

    const valueCell = document.createElement("td");
    valueCell.textContent = rank.value.toString();
    valueCell.style.cssText =
      "text-align: right; padding: 8px; border-bottom: 1px solid #eee;";

    row.append(rankCell, valueCell);
    tbody.append(row);
  });
  rankingsTable.append(tbody);

  // Assemble modal
  modalContent.append(closeButton, title, rankingsTable);
  modalOverlay.append(modalContent);
  document.body.append(modalOverlay);

  // Close modal when clicking outside
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      document.body.removeChild(modalOverlay);
    }
  });
}

const up = btn("move-n", "N");
const left = btn("move-w", "W");
const down = btn("move-s", "S");
const right = btn("move-e", "E");

// Arrange buttons in a simple layout
const dpad = document.createElement("div");
dpad.className = "dpad";
dpad.append(up);
const row = document.createElement("div");
row.style.display = "flex";
row.style.gap = "8px";
row.append(left, down, right);
dpad.append(row);

movementControls.append(dpad);
controlPanelDiv.append(movementControls);

// Hint for keyboard controls so users know WASD also works
const movementHint = document.createElement("div");
movementHint.id = "movementHint";
movementHint.textContent =
  "Tip: You can also use WASD keys to move (works with movement buttons).";
movementHint.style.cssText = `
  margin-left: 10px;
  font-size: 13px;
  color: #333;
`;
controlPanelDiv.append(movementHint);

// Enable/disable movement controls (buttons + visual state)
function setMovementControlsEnabled(enabled: boolean) {
  const buttons = [up, down, left, right];
  buttons.forEach((b) => {
    b.disabled = !enabled;
    b.style.opacity = enabled ? "1" : "0.4";
    b.style.pointerEvents = enabled ? "auto" : "none";
    b.style.cursor = enabled ? "pointer" : "default";
  });
  movementControls.style.display = enabled ? "flex" : "none";
}

// Start with buttons enabled
setMovementControlsEnabled(true);

// Move the player by grid steps (di, dj) where di is change in i (lat), dj in j (lng)
function movePlayer(di: number, dj: number) {
  // Use the player's current world position as the movement origin so
  // panning the viewport (moving the screen) does not change where the
  // player actually is. Fallback to the map center if the marker has no
  // position for any reason.
  const origin = playerMarker.getLatLng() || map.getCenter();
  const newLat = origin.lat + di * TILE_DEGREES;
  const newLng = origin.lng + dj * TILE_DEGREES;
  const newCenter = leaflet.latLng(newLat, newLng);

  // Recenter map and update player marker
  // Use the known gameplay zoom to keep view consistent
  map.setView(newCenter, GAMEPLAY_ZOOM_LEVEL);
  playerMarker.setLatLng(newCenter);

  // Status panel might reflect nearby tokens; update it if needed
  updateStatusPanel();
  // When the player moves, regenerate caches anchored to the player and refresh proximity
  generateMap();
  updateCacheProximity();
  saveGameState();
}

// Wire buttons to move exactly one cell in the expected directions:
// - North: increase i (lat) by +1
// - South: decrease i by -1
// - East: increase j (lng) by +1
// - West: decrease j by -1
up.addEventListener("click", () => movePlayer(1, 0));
down.addEventListener("click", () => movePlayer(-1, 0));
left.addEventListener("click", () => movePlayer(0, -1));
right.addEventListener("click", () => movePlayer(0, 1));

// Add WASD key movement controls
document.addEventListener("keydown", (event) => {
  // Ignore key movement unless buttons mode is active
  if (currentMovementMode !== "buttons") return;
  switch (event.key.toLowerCase()) {
    case "w":
      movePlayer(1, 0); // North
      break;
    case "s":
      movePlayer(-1, 0); // South
      break;
    case "a":
      movePlayer(0, -1); // West
      break;
    case "d":
      movePlayer(0, 1); // East
      break;
  }
});

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// Add disclaimer about red tokens
const disclaimerDiv = document.createElement("div");
disclaimerDiv.id = "disclaimer";
disclaimerDiv.innerHTML =
  "<p><strong>Disclaimer:</strong> Red tokens are too far away and cannot be clicked.</p>";
disclaimerDiv.style.cssText = `
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 5px;
  padding: 10px;
  margin: 10px;
  text-align: center;
  font-size: 14px;
`;
document.body.insertBefore(disclaimerDiv, statusPanelDiv);

// Shared constants imported from `cellFlyweight.ts`:
// - `CLASSROOM_LATLNG`, `TILE_DEGREES`, `CACHE_SPAWN_PROBABILITY`, `RANKS`, `VICTORY_VALUE`
// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;

// Create the map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Player inventory - can only hold one token at a time
// Tokens now have ranks. We store rankIndex, rank name, and numeric value.
let playerToken:
  | { i: number; j: number; rankIndex: number; name: string; value: number }
  | null = null;

// Track if player has picked up their first token
let hasPickedUpFirstToken = false;

// Display the player's inventory
function updateStatusPanel() {
  if (playerToken) {
    statusPanelDiv.innerHTML =
      `Holding ${playerToken.name} token (${playerToken.value}) from cell (${playerToken.i}, ${playerToken.j})`;
  } else {
    statusPanelDiv.innerHTML = "No token in hand";
  }
}

// Initialize status panel
updateStatusPanel();

// Save/load helpers: persist player state and mementos to localStorage
function saveGameState() {
  try {
    const state = {
      playerToken: playerToken,
      hasPickedUpFirstToken: hasPickedUpFirstToken,
      // Persist player marker center so we can restore position
      playerPosition: playerMarker.getLatLng()
        ? {
          lat: playerMarker.getLatLng().lat,
          lng: playerMarker.getLatLng().lng,
        }
        : null,
    };
    localStorage.setItem("game_state", JSON.stringify(state));
    // Mementos are persisted by MementoManager, but ensure export exists
    if (
      typeof MementoManager !== "undefined" &&
      typeof MementoManager.exportMementos === "function"
    ) {
      // export handled internally by MementoManager.persistToLocalStorage
    }
  } catch (_e) {
    // ignore storage errors
  }
}

function loadGameState() {
  try {
    // Load mementos first so map generation uses them
    if (
      typeof MementoManager !== "undefined" &&
      typeof MementoManager.loadFromLocalStorage === "function"
    ) {
      MementoManager.loadFromLocalStorage();
    }

    const raw = localStorage.getItem("game_state");
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state) {
      playerToken = state.playerToken ?? null;
      hasPickedUpFirstToken = !!state.hasPickedUpFirstToken;
      if (
        state.playerPosition && state.playerPosition.lat &&
        state.playerPosition.lng
      ) {
        const pos = leaflet.latLng(
          state.playerPosition.lat,
          state.playerPosition.lng,
        );
        playerMarker.setLatLng(pos);
        map.setView(pos, GAMEPLAY_ZOOM_LEVEL);
      }
      updateStatusPanel();
    }
  } catch (_e) {
    // ignore
  }
}

// Load persisted state if available
loadGameState();

// Update all markers to show matching rank styling
function updateMatchingRankMarkers() {
  spawnedCaches.forEach((cache, _key) => {
    if (cache.marker) {
      cache.marker.setIcon(
        leaflet.divIcon({
          className: "token-marker",
          html: `<div class="token-value${cache.isFarAway ? " far-away" : ""}${
            playerToken && playerToken.rankIndex === cache.rankIndex
              ? " matching-rank"
              : ""
          }"><div class="rank-name">${cache.name}</div></div>`,
          iconSize: [36, 36],
        }),
      );
    }
  });
}

// Store for spawned caches (using Flyweight pattern)
const spawnedCaches = new Map<string, CellContext>();

// Convert cell coordinates to a string key
function cellKey(i: number, j: number): string {
  return `${i},${j}`;
}

// Convert lat/lng to cell coordinates
function latLngToCell(lat: number, lng: number): { i: number; j: number } {
  const origin = CLASSROOM_LATLNG;
  const i = Math.floor((lat - origin.lat) / TILE_DEGREES);
  const j = Math.floor((lng - origin.lng) / TILE_DEGREES);
  return { i, j };
}

// Calculate Manhattan distance between two cells
function cellDistance(
  cell1: { i: number; j: number },
  cell2: { i: number; j: number },
): number {
  return Math.abs(cell1.i - cell2.i) + Math.abs(cell1.j - cell2.j);
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  const key = cellKey(i, j);

  // Don't spawn if already exists
  if (spawnedCaches.has(key)) {
    return;
  }

  // Check if we have a memento for this cell
  let cacheState: CellMemento | null = null;
  if (MementoManager.hasMemento(key)) {
    cacheState = MementoManager.getMemento(key)!;
  }

  // If we have a memento and the cell was modified, we should spawn it
  // Otherwise, use the flyweight's shouldSpawnCache property
  const shouldSpawn = cacheState
    ? cacheState.isModified
    : CellFlyweightFactory.getFlyweight(i, j).shouldSpawnCache;

  // Don't spawn if we shouldn't
  if (!shouldSpawn) {
    return;
  }

  // Get flyweight for shared properties
  const flyweight = CellFlyweightFactory.getFlyweight(i, j);

  // Use memento state if available, otherwise use flyweight defaults
  const value = cacheState ? cacheState.value : flyweight.initialValue;
  const rankIndex = cacheState
    ? cacheState.rankIndex
    : flyweight.initialRankIndex;
  const name = cacheState ? cacheState.name : flyweight.initialName;
  const isModified = cacheState ? cacheState.isModified : false;

  // Check if token is more than 3 tiles away from player (anchor to player marker)
  const pm = playerMarker.getLatLng();
  const playerCell = latLngToCell(pm.lat, pm.lng);
  const tokenCell = { i, j };
  const distance = cellDistance(playerCell, tokenCell);
  const isFarAway = cacheState ? cacheState.isFarAway : (distance > 3);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(flyweight.bounds, {
    color: isFarAway ? "#ff0000" : "#3388ff", // Red if far away, default blue otherwise
    fillColor: isFarAway ? "#ff0000" : "#3388ff",
    fillOpacity: 0.2,
    weight: isFarAway ? 2 : 5,
  });
  rect.addTo(map);

  // Add a marker with the token value displayed as text
  const marker = leaflet.marker(flyweight.center, {
    icon: leaflet.divIcon({
      className: "token-marker",
      html: `<div class="token-value${isFarAway ? " far-away" : ""}${
        playerToken && playerToken.rankIndex === rankIndex
          ? " matching-rank"
          : ""
      }"><div class="rank-name">${name}</div></div>`,
      iconSize: [36, 36],
    }),
  });
  marker.addTo(map);

  // Add click event listener to show token details
  marker.addEventListener("click", () => {
    showTokenDetails(
      i,
      j,
      rankIndex,
      value,
      name,
      isFarAway,
    );
  });

  // Store the cache (include coordinates and proximity flag)
  const cellContext: CellContext = {
    i,
    j,
    rect,
    value,
    marker,
    isFarAway,
    rankIndex,
    name,
    isModified,
  };
  spawnedCaches.set(key, cellContext);

  // Helper to (re)bind popup for a rect based on current playerToken
  function bindPopupForCache() {
    rect.unbindPopup();
    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      if (playerToken) {
        // Can only craft when the held token is the same rank as the cache
        const canCraft = playerToken.rankIndex === rankIndex && !isFarAway;
        popupDiv.innerHTML = `
      <div>Cell (${i},${j}) - ${name} (${value})</div>
      <button id="craft" ${
          canCraft ? "" : "disabled"
        }>Craft with held token (${playerToken.name} ${playerToken.value})</button>`;

        popupDiv.querySelector("#craft")?.addEventListener("click", () => {
          if (canCraft) {
            // Combine ranks to the next rank
            const newRankIndex = Math.min(
              playerToken!.rankIndex + 1,
              RANKS.length - 1,
            );
            const newValue = RANKS[newRankIndex].value;
            const newName = RANKS[newRankIndex].name;
            playerToken = {
              i,
              j,
              rankIndex: newRankIndex,
              name: newName,
              value: newValue,
            };
            // Save a memento marking this cell empty so the crafted token
            // (now in the player's hand) does not respawn when the
            // viewport/player moves.
            const cache = spawnedCaches.get(key);
            const mementoToSave: CellMemento = {
              i: i,
              j: j,
              value: cache ? cache.value : 0,
              isFarAway: cache ? cache.isFarAway : false,
              rankIndex: cache ? cache.rankIndex : -1,
              name: cache ? cache.name : "",
              isModified: false,
            };
            MementoManager.saveMemento(key, mementoToSave);

            rect.removeFrom(map);
            if (cache && cache.marker) {
              cache.marker.removeFrom(map);
            }
            spawnedCaches.delete(key);
            updateStatusPanel();
            updateMatchingRankMarkers();
            saveGameState();

            if (newValue >= VICTORY_VALUE) {
              alert(
                `You've created a ${newName} token (${newValue})! You win!`,
              );
            }
          }
          map.closePopup();
        });
      } else {
        // Enforce rule: at game start (when player hasn't picked up any token yet)
        // only allow picking up Common tokens (rankIndex === 0). After the
        // first successful pickup set `hasPickedUpFirstToken = true` so normal
        // pickups resume.
        const initialRestrictionActive = !hasPickedUpFirstToken;
        const canPickupInitial = !initialRestrictionActive ||
          rankIndex === 0;

        popupDiv.innerHTML = `
          <div>Cell (${i},${j}) - ${name} (${value})</div>
          <button id="pickup" ${
          canPickupInitial ? "" : "disabled"
        }>Pick up token</button>
          ${
          initialRestrictionActive && !canPickupInitial
            ? '<div style="color: #c0392b; font-size:12px; margin-top:6px;">At game start you may only pick up Common tokens.</div>'
            : ""
        }`;

        popupDiv.querySelector("#pickup")?.addEventListener("click", () => {
          if (!canPickupInitial) return; // should be disabled, but guard anyway

          playerToken = {
            i,
            j,
            rankIndex: rankIndex,
            name: name,
            value: value,
          };

          // Mark that the player has picked up their first token
          if (!hasPickedUpFirstToken) hasPickedUpFirstToken = true;

          // Save a memento indicating this cell no longer has a cache so it
          // will not be respawned when the player or viewport moves.
          const cache = spawnedCaches.get(key);
          const mementoToSave: CellMemento = {
            i: i,
            j: j,
            value: cache ? cache.value : 0,
            isFarAway: cache ? cache.isFarAway : false,
            rankIndex: cache ? cache.rankIndex : -1,
            name: cache ? cache.name : "",
            isModified: false,
          };
          MementoManager.saveMemento(key, mementoToSave);

          rect.removeFrom(map);
          if (cache && cache.marker) {
            cache.marker.removeFrom(map);
          }
          spawnedCaches.delete(key);

          updateStatusPanel();
          updateMatchingRankMarkers();
          saveGameState();
          map.closePopup();
        });
      }

      return popupDiv;
    });
  }

  // Only bind popup if cache is not far away
  if (!isFarAway) bindPopupForCache();
}

// Function to show token details/actions when clicking on a marker
function showTokenDetails(
  i: number,
  j: number,
  rankIndex: number,
  value: number,
  name: string,
  isFarAway: boolean,
) {
  // Create popup content
  const popupDiv = document.createElement("div");

  if (playerToken) {
    // Can only craft when the held token is the same rank as the cache
    const canCraft = playerToken.rankIndex === rankIndex && !isFarAway;
    popupDiv.innerHTML = `
      <div>Cell (${i},${j}) - ${name} (${value})</div>
      <button id="craft" ${
      canCraft ? "" : "disabled"
    }>Craft with held token (${playerToken.name} ${playerToken.value})</button>`;

    popupDiv.querySelector("#craft")?.addEventListener("click", () => {
      if (canCraft) {
        // Combine ranks to the next rank
        const newRankIndex = Math.min(
          playerToken!.rankIndex + 1,
          RANKS.length - 1,
        );
        const newValue = RANKS[newRankIndex].value;
        const newName = RANKS[newRankIndex].name;
        playerToken = {
          i,
          j,
          rankIndex: newRankIndex,
          name: newName,
          value: newValue,
        };

        // Remove cache from map and spawnedCaches
        const key = cellKey(i, j);
        const cache = spawnedCaches.get(key);
        if (cache) {
          // Save a memento marking this cell empty so the crafted token
          // (now in the player's hand) does not respawn later.
          const mementoToSave: CellMemento = {
            i: cache.i,
            j: cache.j,
            value: cache.value,
            isFarAway: cache.isFarAway,
            rankIndex: -1,
            name: "",
            isModified: false,
          };
          MementoManager.saveMemento(key, mementoToSave);
          if (cache.rect) cache.rect.removeFrom(map);
          if (cache.marker) {
            cache.marker.removeFrom(map);
          }
          spawnedCaches.delete(key);
        }

        updateStatusPanel();
        updateMatchingRankMarkers();
        saveGameState();

        if (newValue >= VICTORY_VALUE) {
          alert(
            `You've created a ${newName} token (${newValue})! You win!`,
          );
        }
      }
      map.closePopup();
    });
  } else {
    if (isFarAway) {
      popupDiv.innerHTML = `
        <div>Cell (${i},${j}) - ${name} (${value})</div>
        <div style="color: red;">Too far away to interact!</div>`;
    } else {
      // Enforce initial pickup restriction: only allow Common tokens until
      // the player has picked up their first token.
      const initialRestrictionActive = !hasPickedUpFirstToken;
      const canPickupInitial = !initialRestrictionActive || rankIndex === 0;

      popupDiv.innerHTML = `
        <div>Cell (${i},${j}) - ${name} (${value})</div>
        <button id="pickup" ${
        canPickupInitial ? "" : "disabled"
      }>Pick up token</button>
        ${
        initialRestrictionActive && !canPickupInitial
          ? '<div style="color: #c0392b; font-size:12px; margin-top:6px;">At game start you may only pick up Common tokens.</div>'
          : ""
      }`;

      popupDiv.querySelector("#pickup")?.addEventListener("click", () => {
        if (!canPickupInitial) return; // guard in case disabled attr isn't respected

        playerToken = {
          i,
          j,
          rankIndex: rankIndex,
          name: name,
          value: value,
        };

        // Mark that the player has picked up their first token
        if (!hasPickedUpFirstToken) hasPickedUpFirstToken = true;

        // Remove cache from map and spawnedCaches. Also save a memento so
        // this cell remains empty when it leaves and later re-enters the
        // viewport.
        const key = cellKey(i, j);
        const cache = spawnedCaches.get(key);
        const mementoToSave: CellMemento = {
          i: i,
          j: j,
          value: cache ? cache.value : 0,
          isFarAway: cache ? cache.isFarAway : false,
          rankIndex: cache ? cache.rankIndex : -1,
          name: cache ? cache.name : "",
          isModified: false,
        };
        MementoManager.saveMemento(key, mementoToSave);

        if (cache) {
          if (cache.rect) cache.rect.removeFrom(map);
          if (cache.marker) {
            cache.marker.removeFrom(map);
          }
          spawnedCaches.delete(key);
        }

        updateStatusPanel();
        updateMatchingRankMarkers();
        saveGameState();
        map.closePopup();
      });
    }
  }

  // Create a popup at the marker position
  const flyweight = CellFlyweightFactory.getFlyweight(i, j);
  // deno-lint-ignore no-unused-vars
  const popup = leaflet.popup()
    .setLatLng(flyweight.center)
    .setContent(popupDiv)
    .openOn(map);
}

// Generate cells to edge of the map based on player position
// deno-lint-ignore no-unused-vars
function generateMap(mode: "player" | "viewport" = "player") {
  // Use the actual map viewport to determine which cells are visible.
  // This makes cells "memoryless": when a cell leaves the viewport it is
  // removed from the map and its in-memory state is discarded. When it
  // becomes visible again it will be (re)generated deterministically.
  const bounds = map.getBounds();
  const southwest = bounds.getSouthWest();
  const northeast = bounds.getNorthEast();

  const minI = Math.floor(
    (southwest.lat - CLASSROOM_LATLNG.lat) / TILE_DEGREES,
  );
  const maxI = Math.floor(
    (northeast.lat - CLASSROOM_LATLNG.lat) / TILE_DEGREES,
  );
  const minJ = Math.floor(
    (southwest.lng - CLASSROOM_LATLNG.lng) / TILE_DEGREES,
  );
  const maxJ = Math.floor(
    (northeast.lng - CLASSROOM_LATLNG.lng) / TILE_DEGREES,
  );

  // Create a set of currently visible cells (based on viewport)
  const visibleCells = new Set<string>();
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      visibleCells.add(cellKey(i, j));
    }
  }

  // Remove caches that are no longer visible (save their state before removing)
  spawnedCaches.forEach((cache, key) => {
    if (!visibleCells.has(key)) {
      // Save the state of the cache before removing it
      const memento: CellMemento = {
        i: cache.i,
        j: cache.j,
        value: cache.value,
        isFarAway: cache.isFarAway,
        rankIndex: cache.rankIndex,
        name: cache.name,
        isModified: cache.isModified,
      };
      MementoManager.saveMemento(key, memento);

      if (cache.rect) cache.rect.removeFrom(map);
      if (cache.marker) {
        cache.marker.removeFrom(map);
      }
      spawnedCaches.delete(key);
    }
  });

  // Generate new caches to fill the visible viewport area
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      // Spawn caches based on luck function for consistency.
      // Also ensure that any cell which has a saved memento (i.e. was
      // modified by the player) is always respawned when it returns to
      // the viewport so its state is preserved across player moves/pans.
      const key = cellKey(i, j);
      const shouldSpawnFromMemento = MementoManager.hasMemento(key);
      if (
        shouldSpawnFromMemento ||
        luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY
      ) {
        spawnCache(i, j);
      }
    }
  }
}

// Update proximity (coloring/popup) for all spawned caches based on player position
function updateCacheProximity() {
  const pm = playerMarker.getLatLng();
  const playerCell = latLngToCell(pm.lat, pm.lng);

  spawnedCaches.forEach((cache, key) => {
    const tokenCell = { i: cache.i, j: cache.j };
    const distance = cellDistance(playerCell, tokenCell);
    const nowFar = distance > 3;

    if (nowFar === cache.isFarAway) return; // no change

    // Update stored flag
    cache.isFarAway = nowFar;

    // Save the updated state
    const memento: CellMemento = {
      i: cache.i,
      j: cache.j,
      value: cache.value,
      isFarAway: cache.isFarAway,
      rankIndex: cache.rankIndex,
      name: cache.name,
      isModified: cache.isModified,
    };
    MementoManager.saveMemento(key, memento);

    // Update rectangle style
    if (cache.rect) {
      cache.rect.setStyle({
        color: nowFar ? "#ff0000" : "#3388ff",
        fillColor: nowFar ? "#ff0000" : "#3388ff",
        fillOpacity: 0.2,
        weight: nowFar ? 2 : 5,
      });
    }

    // Update marker icon to reflect far-away styling
    if (cache.marker) {
      cache.marker.setIcon(
        leaflet.divIcon({
          className: "token-marker",
          html: `<div class="token-value${nowFar ? " far-away" : ""}${
            playerToken && playerToken.rankIndex === cache.rankIndex
              ? " matching-rank"
              : ""
          }"><div class="rank-name">${cache.name}</div></div>`,
          iconSize: [36, 36],
        }),
      );

      // Update click event listener
      cache.marker.removeEventListener("click");
      cache.marker.addEventListener("click", () => {
        showTokenDetails(
          cache.i,
          cache.j,
          cache.rankIndex,
          cache.value,
          cache.name,
          nowFar,
        );
      });
    }

    // Toggle popup binding: remove if far, add if now near
    if (cache.rect) cache.rect.unbindPopup();
    if (!nowFar) {
      // Rebind popup using the same code used at spawn time
      if (cache.rect) {
        cache.rect.bindPopup(() => {
          const popupDiv = document.createElement("div");

          if (playerToken) {
            const canCraft = playerToken.rankIndex === cache.rankIndex &&
              !cache.isFarAway;
            popupDiv.innerHTML = `
      <div>Cell (${cache.i},${cache.j}) - ${cache.name} (${cache.value})</div>
      <button id="craft" ${
              canCraft ? "" : "disabled"
            }>Craft with held token (${playerToken.name} ${playerToken.value})</button>`;

            popupDiv.querySelector("#craft")?.addEventListener("click", () => {
              if (canCraft) {
                const newRankIndex = Math.min(
                  playerToken!.rankIndex + 1,
                  RANKS.length - 1,
                );
                const newValue = RANKS[newRankIndex].value;
                const newName = RANKS[newRankIndex].name;
                playerToken = {
                  i: cache.i,
                  j: cache.j,
                  rankIndex: newRankIndex,
                  name: newName,
                  value: newValue,
                };
                // Save a memento marking this cell empty so the crafted
                // token (now in the player's hand) does not respawn later.
                const mementoToSave: CellMemento = {
                  i: cache.i,
                  j: cache.j,
                  value: cache.value,
                  isFarAway: cache.isFarAway,
                  rankIndex: -1,
                  name: "",
                  isModified: false,
                };
                MementoManager.saveMemento(key, mementoToSave);

                if (cache.rect) cache.rect.removeFrom(map);
                if (cache.marker) cache.marker.removeFrom(map);
                spawnedCaches.delete(key);
                updateStatusPanel();
                updateMatchingRankMarkers();
                saveGameState();

                if (newValue >= VICTORY_VALUE) {
                  alert(
                    `You've created a ${newName} token (${newValue})! You win!`,
                  );
                }
              }
              map.closePopup();
            });
          } else {
            // Enforce initial pickup restriction: only allow Common tokens until
            // the player has picked up their first token.
            const initialRestrictionActive = !hasPickedUpFirstToken;
            const canPickupInitial = !initialRestrictionActive ||
              cache.rankIndex === 0;

            popupDiv.innerHTML = `
        <div>Cell (${cache.i},${cache.j}) - ${cache.name} (${cache.value})</div>
        <button id="pickup" ${
              canPickupInitial ? "" : "disabled"
            }>Pick up token</button>
        ${
              initialRestrictionActive && !canPickupInitial
                ? '<div style="color: #c0392b; font-size:12px; margin-top:6px;">At game start you may only pick up Common tokens.</div>'
                : ""
            }`;

            popupDiv.querySelector("#pickup")?.addEventListener("click", () => {
              if (!canPickupInitial) return;

              playerToken = {
                i: cache.i,
                j: cache.j,
                rankIndex: cache.rankIndex,
                name: cache.name,
                value: cache.value,
              };

              // Mark that the player has picked up their first token
              if (!hasPickedUpFirstToken) hasPickedUpFirstToken = true;

              // Save a memento so this cell remains empty when it leaves
              // and later re-enters the viewport.
              const mementoToSave: CellMemento = {
                i: cache.i,
                j: cache.j,
                value: cache.value,
                isFarAway: cache.isFarAway,
                rankIndex: cache.rankIndex,
                name: cache.name,
                isModified: false,
              };
              MementoManager.saveMemento(key, mementoToSave);

              if (cache.rect) cache.rect.removeFrom(map);
              if (cache.marker) cache.marker.removeFrom(map);
              spawnedCaches.delete(key);
              updateStatusPanel();
              updateMatchingRankMarkers();
              saveGameState();
              map.closePopup();
            });
          }

          return popupDiv;
        });
      }
    }
  });
}

// Initial map generation: populate current viewport so panning immediately shows tokens
generateMap();
// Note: caches close to the player update only when the player moves; panning regenerates
// viewport caches but does not change proximity (isFarAway) until the player moves.

// Regenerate viewport caches when the user pans/zooms the map so unreachable tokens
// become visible; do NOT update cache proximity here (that only happens on player move).
map.on("moveend", () => generateMap());

// Helper used by the simulator and tests to reuse geolocation handling logic
function simulatePosition(latitude: number, longitude: number) {
  // Delegate to MovementController if available so behavior is centralized
  if (movementController) {
    movementController.simulatePosition(latitude, longitude);
    return;
  }

  // Fallback: reuse same logic as watchPosition callback (show marker, compute cell, snap)
  const exactLatLng = leaflet.latLng(latitude, longitude);
  playerMarker.setLatLng(exactLatLng);

  const gpsCell = latLngToCell(latitude, longitude);

  if (!lastSnappedCell) {
    lastSnappedCell = gpsCell;
    const fly = CellFlyweightFactory.getFlyweight(gpsCell.i, gpsCell.j);
    const center = fly.center;
    map.setView(center, GAMEPLAY_ZOOM_LEVEL);
    playerMarker.setLatLng(center);
    generateMap();
    updateCacheProximity();
    saveGameState();
    return;
  }

  if (gpsCell.i !== lastSnappedCell.i || gpsCell.j !== lastSnappedCell.j) {
    const di = gpsCell.i - lastSnappedCell.i;
    const dj = gpsCell.j - lastSnappedCell.j;
    lastSnappedCell = gpsCell;
    movePlayer(di, dj);
    return;
  }
}

// Instantiate MovementController facade so main game code talks through an interface
movementController = new MovementController({
  map,
  playerMarker,
  movePlayer: (di: number, dj: number) => movePlayer(di, dj),
  setMovementControlsEnabled,
  geoStatusDiv,
  toggleButton: toggleMovementButton,
  latLngToCell,
});
