// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts";

// Constants
const TILE_DEGREES = 1e-4;
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const CACHE_SPAWN_PROBABILITY = 0.1;

// Global rank definitions
export const RANKS = [
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

// Precomputed weights for each rank
const RANK_WEIGHTS: number[] = [];
let totalWeight = 0;
for (let i = 0; i < RANKS.length; i++) {
  const weight = 1 / RANKS[i].value;
  RANK_WEIGHTS.push(weight);
  totalWeight += weight;
}

// Function to get a weighted random rank index
export function getWeightedRankIndex(seed: string): number {
  const randomValue = luck(seed) * totalWeight;
  let cumulativeWeight = 0;
  for (let i = 0; i < RANKS.length; i++) {
    cumulativeWeight += RANK_WEIGHTS[i];
    if (randomValue <= cumulativeWeight) {
      return i;
    }
  }
  return RANKS.length - 1;
}

// Flyweight interface for shared cell properties
export interface CellFlyweight {
  i: number;
  j: number;
  bounds: leaflet.LatLngBounds;
  center: leaflet.LatLng;
  shouldSpawnCache: boolean;
  initialRankIndex: number;
  initialValue: number;
  initialName: string;
}

// Context for cell-specific state
export interface CellContext {
  i: number;
  j: number;
  marker?: leaflet.Marker;
  rect?: leaflet.Rectangle;
  value: number;
  isFarAway: boolean;
  rankIndex: number;
  name: string;
  isModified: boolean;
}

// Flyweight factory to manage shared cell properties
export class CellFlyweightFactory {
  private static flyweights = new Map<string, CellFlyweight>();

  static getFlyweight(i: number, j: number): CellFlyweight {
    const key = `${i},${j}`;

    if (!this.flyweights.has(key)) {
      // Create bounds for the cell
      const bounds = leaflet.latLngBounds([
        [
          CLASSROOM_LATLNG.lat + i * TILE_DEGREES,
          CLASSROOM_LATLNG.lng + j * TILE_DEGREES,
        ],
        [
          CLASSROOM_LATLNG.lat + (i + 1) * TILE_DEGREES,
          CLASSROOM_LATLNG.lng + (j + 1) * TILE_DEGREES,
        ],
      ]);

      // Determine if cache should spawn based on luck function
      const shouldSpawnCache =
        luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY;

      // Get initial rank for the cache
      const initialRankIndex = getWeightedRankIndex(
        [i, j, "initialRank"].toString(),
      );
      const initialValue = RANKS[initialRankIndex].value;
      const initialName = RANKS[initialRankIndex].name;

      const flyweight: CellFlyweight = {
        i,
        j,
        bounds,
        center: bounds.getCenter(),
        shouldSpawnCache,
        initialRankIndex,
        initialValue,
        initialName,
      };

      this.flyweights.set(key, flyweight);
    }

    return this.flyweights.get(key)!;
  }

  static clearCache(): void {
    this.flyweights.clear();
  }
}
