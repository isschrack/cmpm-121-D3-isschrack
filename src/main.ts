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

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CACHE_SPAWN_PROBABILITY = 0.1;

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
    marker: leaflet.Marker | undefined;
    rect: leaflet.Rectangle;
    value: number;
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

  // Check if token is more than 3 tiles away from player
  const playerCell = latLngToCell(map.getCenter().lat, map.getCenter().lng);
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

  // Store the cache
  spawnedCaches.set(key, {
    rect,
    value: initialValue,
    marker,
  });

  // Handle interactions with the cache (only if not far away)
  if (!isFarAway) {
    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      if (playerToken) {
        // If player is holding a token, show crafting option
        const canCraft = playerToken.value === initialValue;
        popupDiv.innerHTML = `
      <div>Cell (${i},${j}) - Current value: ${initialValue}</div>
      <button id="craft" ${
          canCraft ? "" : "disabled"
        }>Craft with held token (value ${playerToken.value})</button>`;

        popupDiv.querySelector("#craft")?.addEventListener("click", () => {
          // Crafting logic - combine tokens (only if values are equal)
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

            // Check for win condition - reaching 2048 like in the 2048 game
            if (newValue >= 2048) {
              alert("You've created a 2048 token! You win!");
            }
          }
          map.closePopup();
        });
      } else {
        // If player is not holding a token, show pickup option
        popupDiv.innerHTML = `
        <div>Cell (${i},${j}) - Token value: ${initialValue}</div>
        <button id="pickup">Pick up token</button>`;

        popupDiv.querySelector("#pickup")?.addEventListener("click", () => {
          // Pickup logic - remove from map and add to inventory
          playerToken = { i, j, value: initialValue };

          // Mirror the crafting removal: remove rect, remove stored marker if present,
          // then delete the cache entry.
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
}

// Generate cells to edge of the map based on player position
function generateMap() {
  // Get the bounds of the visible map
  const bounds = map.getBounds();

  // Calculate the cell indices for the corners of the visible map
  const southwest = bounds.getSouthWest();
  const northeast = bounds.getNorthEast();

  // Convert lat/lng to cell indices
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

  // Create a set of currently visible cells
  const visibleCells = new Set<string>();
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      visibleCells.add(cellKey(i, j));
    }
  }

  // Remove caches that are no longer visible
  spawnedCaches.forEach((cache, key) => {
    if (!visibleCells.has(key)) {
      cache.rect.removeFrom(map);
      if (cache.marker) {
        cache.marker.removeFrom(map);
      }
      spawnedCaches.delete(key);
    }
  });

  // Generate new caches to fill the visible map
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      // Spawn caches based on luck function for consistency
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
}

// Initial map generation
generateMap();

// Regenerate map when player moves
map.on("moveend", generateMap);
