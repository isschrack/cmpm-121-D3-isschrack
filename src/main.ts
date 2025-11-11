// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// Create basic UI elements
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

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

// Move the player by grid steps (di, dj) where di is change in i (lat), dj in j (lng)
function movePlayer(di: number, dj: number) {
  const center = map.getCenter();
  const newLat = center.lat + di * TILE_DEGREES;
  const newLng = center.lng + dj * TILE_DEGREES;
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

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CACHE_SPAWN_PROBABILITY = 0.1;
// How many tiles from the player to consider for generation (anchors to player)
// NOTE: visibility is now based on actual map viewport bounds.

// Global rank definitions so spawn and proximity logic share the same progression
const RANKS = [
  { name: "Common", value: 2 },
  { name: "Uncommon", value: 4 },
  { name: "Rare", value: 8 },
  { name: "Epic", value: 16 },
  { name: "Legendary", value: 32 },
  { name: "Mythic", value: 64 },
  { name: "Ascendant", value: 128 },
  { name: "Exalted", value: 256 },
  { name: "Exotic", value: 512 },
  { name: "Transcendent", value: 1024 },
  { name: "Divine", value: 2048 },
  { name: "Ancestral", value: 4096 },
];
// Value required to win. Use the top rank's numeric value by default so changing
// the rank table automatically adjusts the victory threshold.
const VICTORY_VALUE = RANKS[RANKS.length - 1].value;

// Precomputed weights for each rank (inverse of value for lower values to be more common)
const RANK_WEIGHTS: number[] = [];
let totalWeight = 0;
for (let i = 0; i < RANKS.length; i++) {
  // Using inverse of value as weight to make lower values more common
  const weight = 1 / RANKS[i].value;
  RANK_WEIGHTS.push(weight);
  totalWeight += weight;
}

// Function to get a weighted random rank index
function getWeightedRankIndex(seed: string): number {
  // Get a random value between 0 and totalWeight
  const randomValue = luck(seed) * totalWeight;

  // Find the rank index based on weights
  let cumulativeWeight = 0;
  for (let i = 0; i < RANKS.length; i++) {
    cumulativeWeight += RANK_WEIGHTS[i];
    if (randomValue <= cumulativeWeight) {
      return i;
    }
  }

  // Fallback to the last rank (shouldn't happen)
  return RANKS.length - 1;
}

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

// Store for spawned caches
const spawnedCaches = new Map<
  string,
  {
    i: number;
    j: number;
    marker: leaflet.Marker | undefined;
    rect: leaflet.Rectangle;
    value: number;
    isFarAway: boolean;
    rankIndex: number;
    name: string;
  }
>();

// Convert cell coordinates to a string key
function cellKey(i: number, j: number): string {
  return `${i},${j}`;
}

// Convert cell numbers into lat/lng bounds
function cellToBounds(i: number, j: number) {
  const origin = CLASSROOM_LATLNG;
  return leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);
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

  const bounds = cellToBounds(i, j);

  // Check if token is more than 3 tiles away from player (anchor to player marker)
  const pm = playerMarker.getLatLng();
  const playerCell = latLngToCell(pm.lat, pm.lng);
  const tokenCell = { i, j };
  const distance = cellDistance(playerCell, tokenCell);
  const isFarAway = distance > 3;

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds, {
    color: isFarAway ? "#ff0000" : "#3388ff", // Red if far away, default blue otherwise
    fillColor: isFarAway ? "#ff0000" : "#3388ff",
    fillOpacity: 0.2,
    weight: isFarAway ? 2 : 5,
  });
  rect.addTo(map);

  // For first-time spawning, only allow common tokens
  const initialRankIndex = getWeightedRankIndex(
    [i, j, "initialRank"].toString(),
  );
  const initialValue = RANKS[initialRankIndex].value;
  const initialName = RANKS[initialRankIndex].name;

  // Add a marker with the token value displayed as text
  const center = bounds.getCenter();
  const marker = leaflet.marker(center, {
    icon: leaflet.divIcon({
      className: "token-marker",
      html: `<div class="token-value${
        isFarAway ? " far-away" : ""
      }"><div class="rank-name">${initialName}</div></div>`,
      iconSize: [36, 36],
    }),
  });
  marker.addTo(map);

  // Add click event listener to show token details
  marker.addEventListener("click", () => {
    showTokenDetails(
      i,
      j,
      initialRankIndex,
      initialValue,
      initialName,
      isFarAway,
    );
  });

  // Store the cache (include coordinates and proximity flag)
  spawnedCaches.set(key, {
    i,
    j,
    rect,
    value: initialValue,
    marker,
    isFarAway,
    rankIndex: initialRankIndex,
    name: initialName,
  });

  // Helper to (re)bind popup for a rect based on current playerToken
  function bindPopupForCache() {
    rect.unbindPopup();
    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      if (playerToken) {
        // Can only craft when the held token is the same rank as the cache
        const canCraft = playerToken.rankIndex === initialRankIndex;
        popupDiv.innerHTML = `
      <div>Cell (${i},${j}) - ${initialName} (${initialValue})</div>
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
            rect.removeFrom(map);
            const cache = spawnedCaches.get(key);
            if (cache && cache.marker) {
              cache.marker.removeFrom(map);
            }
            spawnedCaches.delete(key);
            updateStatusPanel();

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
          initialRankIndex === 0;

        popupDiv.innerHTML = `
          <div>Cell (${i},${j}) - ${initialName} (${initialValue})</div>
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
            rankIndex: initialRankIndex,
            name: initialName,
            value: initialValue,
          };

          // Mark that the player has picked up their first token
          if (!hasPickedUpFirstToken) hasPickedUpFirstToken = true;

          rect.removeFrom(map);
          const cache = spawnedCaches.get(key);
          if (cache && cache.marker) {
            cache.marker.removeFrom(map);
          }
          spawnedCaches.delete(key);

          updateStatusPanel();
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
    const canCraft = playerToken.rankIndex === rankIndex;
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
          cache.rect.removeFrom(map);
          if (cache.marker) {
            cache.marker.removeFrom(map);
          }
          spawnedCaches.delete(key);
        }

        updateStatusPanel();

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

        // Remove cache from map and spawnedCaches
        const key = cellKey(i, j);
        const cache = spawnedCaches.get(key);
        if (cache) {
          cache.rect.removeFrom(map);
          if (cache.marker) {
            cache.marker.removeFrom(map);
          }
          spawnedCaches.delete(key);
        }

        updateStatusPanel();
        map.closePopup();
      });
    }
  }

  // Create a popup at the marker position
  const bounds = cellToBounds(i, j);
  const center = bounds.getCenter();
  // deno-lint-ignore no-unused-vars
  const popup = leaflet.popup()
    .setLatLng(center)
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

  // Remove caches that are no longer visible (forget their state)
  spawnedCaches.forEach((cache, key) => {
    if (!visibleCells.has(key)) {
      cache.rect.removeFrom(map);
      if (cache.marker) {
        cache.marker.removeFrom(map);
      }
      spawnedCaches.delete(key);
    }
  });

  // Generate new caches to fill the visible viewport area
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      // Spawn caches based on luck function for consistency
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
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

    // Update rectangle style
    cache.rect.setStyle({
      color: nowFar ? "#ff0000" : "#3388ff",
      fillColor: nowFar ? "#ff0000" : "#3388ff",
      fillOpacity: 0.2,
      weight: nowFar ? 2 : 5,
    });

    // Update marker icon to reflect far-away styling
    if (cache.marker) {
      cache.marker.setIcon(
        leaflet.divIcon({
          className: "token-marker",
          html: `<div class="token-value${
            nowFar ? " far-away" : ""
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
    cache.rect.unbindPopup();
    if (!nowFar) {
      // Rebind popup using the same code used at spawn time
      cache.rect.bindPopup(() => {
        const popupDiv = document.createElement("div");

        if (playerToken) {
          const canCraft = playerToken.rankIndex === cache.rankIndex;
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
              cache.rect.removeFrom(map);
              if (cache.marker) cache.marker.removeFrom(map);
              spawnedCaches.delete(key);
              updateStatusPanel();

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

            cache.rect.removeFrom(map);
            if (cache.marker) cache.marker.removeFrom(map);
            spawnedCaches.delete(key);
            updateStatusPanel();
            map.closePopup();
          });
        }

        return popupDiv;
      });
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
