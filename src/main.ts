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
let playerToken: { i: number; j: number; value: number } | null = null;

// Display the player's inventory
function updateStatusPanel() {
  if (playerToken) {
    statusPanelDiv.innerHTML =
      `Holding token from cell (${playerToken.i}, ${playerToken.j}) with value ${playerToken.value}`;
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

  // Each cache has a point value based on powers of 2 (like 2048 game)
  // Values will be 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024
  const possibleValues = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  const randomIndex = Math.floor(
    luck([i, j, "initialValue"].toString()) * possibleValues.length,
  );
  const initialValue = possibleValues[randomIndex];

  // Add a marker with the token value displayed as text
  const center = bounds.getCenter();
  const marker = leaflet.marker(center, {
    icon: leaflet.divIcon({
      className: "token-marker",
      html: `<div class="token-value${
        isFarAway ? " far-away" : ""
      }">${initialValue}</div>`,
      iconSize: [30, 30],
    }),
  });
  marker.addTo(map);

  // Store the cache (include coordinates and proximity flag)
  spawnedCaches.set(key, {
    i,
    j,
    rect,
    value: initialValue,
    marker,
    isFarAway,
  });

  // Helper to (re)bind popup for a rect based on current playerToken
  function bindPopupForCache() {
    rect.unbindPopup();
    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      if (playerToken) {
        const canCraft = playerToken.value === initialValue;
        popupDiv.innerHTML = `
      <div>Cell (${i},${j}) - Current value: ${initialValue}</div>
      <button id="craft" ${
          canCraft ? "" : "disabled"
        }>Craft with held token (value ${playerToken.value})</button>`;

        popupDiv.querySelector("#craft")?.addEventListener("click", () => {
          if (canCraft) {
            const newValue = playerToken!.value + initialValue;
            playerToken = { i, j, value: newValue };
            rect.removeFrom(map);
            const cache = spawnedCaches.get(key);
            if (cache && cache.marker) {
              cache.marker.removeFrom(map);
            }
            spawnedCaches.delete(key);
            updateStatusPanel();

            if (newValue >= 2048) {
              alert("You've created a 2048 token! You win!");
            }
          }
          map.closePopup();
        });
      } else {
        popupDiv.innerHTML = `
        <div>Cell (${i},${j}) - Token value: ${initialValue}</div>
        <button id="pickup">Pick up token</button>`;

        popupDiv.querySelector("#pickup")?.addEventListener("click", () => {
          playerToken = { i, j, value: initialValue };

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

// Generate cells to edge of the map based on player position
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
          }">${cache.value}</div>`,
          iconSize: [30, 30],
        }),
      );
    }

    // Toggle popup binding: remove if far, add if now near
    cache.rect.unbindPopup();
    if (!nowFar) {
      // Rebind popup using the same code used at spawn time
      cache.rect.bindPopup(() => {
        const popupDiv = document.createElement("div");

        if (playerToken) {
          const canCraft = playerToken.value === cache.value;
          popupDiv.innerHTML = `
      <div>Cell (${cache.i},${cache.j}) - Current value: ${cache.value}</div>
      <button id="craft" ${
            canCraft ? "" : "disabled"
          }>Craft with held token (value ${playerToken.value})</button>`;

          popupDiv.querySelector("#craft")?.addEventListener("click", () => {
            if (canCraft) {
              const newValue = playerToken!.value + cache.value;
              playerToken = { i: cache.i, j: cache.j, value: newValue };
              cache.rect.removeFrom(map);
              if (cache.marker) cache.marker.removeFrom(map);
              spawnedCaches.delete(key);
              updateStatusPanel();

              if (newValue >= 2048) {
                alert("You've created a 2048 token! You win!");
              }
            }
            map.closePopup();
          });
        } else {
          popupDiv.innerHTML = `
        <div>Cell (${cache.i},${cache.j}) - Token value: ${cache.value}</div>
        <button id="pickup">Pick up token</button>`;

          popupDiv.querySelector("#pickup")?.addEventListener("click", () => {
            playerToken = { i: cache.i, j: cache.j, value: cache.value };
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
