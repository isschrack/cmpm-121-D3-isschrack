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
const NEIGHBORHOOD_SIZE = 3; // Limit interaction to 3 cells away
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
  { rect: leaflet.Rectangle; value: number }
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

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  const key = cellKey(i, j);

  // Don't spawn if already exists
  if (spawnedCaches.has(key)) {
    return;
  }

  const bounds = cellToBounds(i, j);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Each cache has a random point value
  const initialValue = Math.floor(
    luck([i, j, "initialValue"].toString()) * 100,
  );

  // Store the cache
  spawnedCaches.set(key, { rect, value: initialValue });

  // Handle interactions with the cache
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");

    if (playerToken) {
      // If player is holding a token, show crafting option
      popupDiv.innerHTML = `
        <div>Cell (${i},${j}) - Current value: ${initialValue}</div>
        <button id="craft">Craft with held token (value ${playerToken.value})</button>
        <button id="leave">Leave token</button>`;

      popupDiv.querySelector("#craft")?.addEventListener("click", () => {
        // Crafting logic - combine tokens
        const newValue = playerToken!.value + initialValue;
        playerToken = { i, j, value: newValue };
        rect.removeFrom(map);
        spawnedCaches.delete(key);
        updateStatusPanel();

        // Check for win condition
        if (newValue >= 200) {
          alert("You've created a high-value token! You win!");
        }

        map.closePopup();
      });

      popupDiv.querySelector("#leave")?.addEventListener("click", () => {
        // Put down the held token
        spawnCache(playerToken!.i, playerToken!.j);
        playerToken = null;
        updateStatusPanel();
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
        rect.removeFrom(map);
        spawnedCaches.delete(key);
        updateStatusPanel();
        map.closePopup();
      });
    }

    return popupDiv;
  });
}

// Generate cells to edge of the map based on player position
function generateMap() {
  const center = map.getCenter();
  const centerI = Math.floor(
    (center.lat - CLASSROOM_LATLNG.lat) / TILE_DEGREES,
  );
  const centerJ = Math.floor(
    (center.lng - CLASSROOM_LATLNG.lng) / TILE_DEGREES,
  );

  // Clear existing caches
  // deno-lint-ignore no-unused-vars
  spawnedCaches.forEach((cache, key) => {
    cache.rect.removeFrom(map);
  });
  spawnedCaches.clear();

  // Generate new caches around player
  for (
    let i = centerI - NEIGHBORHOOD_SIZE;
    i <= centerI + NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = centerJ - NEIGHBORHOOD_SIZE;
      j <= centerJ + NEIGHBORHOOD_SIZE;
      j++
    ) {
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
