// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts";

// Constants (exported so main and other modules share the same values)
export const TILE_DEGREES = 1e-4;
export const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
export const CACHE_SPAWN_PROBABILITY = 0.1;

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

// Precomputed weights for each rank (used by the weighted selection helper)
const RANK_WEIGHTS: number[] = [];
let totalWeight = 0;
for (let i = 0; i < RANKS.length; i++) {
  const weight = 1 / RANKS[i].value;
  RANK_WEIGHTS.push(weight);
  totalWeight += weight;
}

// Convenience export: value required to win (top rank's numeric value)
export const VICTORY_VALUE = RANKS[RANKS.length - 1].value;

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

// Memento interface for cell state serialization
export interface CellMemento {
  i: number;
  j: number;
  value: number;
  isFarAway: boolean;
  rankIndex: number;
  name: string;
  isModified: boolean;
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

// MementoManager to handle preservation and restoration of cell states
export class MementoManager {
  private static mementos = new Map<string, CellMemento>();

  static saveMemento(key: string, memento: CellMemento): void {
    this.mementos.set(key, memento);
    this.persistToLocalStorage();
  }

  static getMemento(key: string): CellMemento | undefined {
    return this.mementos.get(key);
  }

  static hasMemento(key: string): boolean {
    return this.mementos.has(key);
  }

  static removeMemento(key: string): boolean {
    const removed = this.mementos.delete(key);
    if (removed) this.persistToLocalStorage();
    return removed;
  }

  static clearMementos(): void {
    this.mementos.clear();
    this.persistToLocalStorage();
  }

  // Export mementos as a plain object for serialization
  static exportMementos(): Record<string, CellMemento> {
    return Object.fromEntries(this.mementos.entries());
  }

  // Import mementos from a plain object (e.g. deserialized JSON)
  static importMementos(
    obj: Record<string, CellMemento> | null | undefined,
  ): void {
    this.mementos.clear();
    if (!obj) return;
    for (const [k, v] of Object.entries(obj)) {
      this.mementos.set(k, v as CellMemento);
    }
    this.persistToLocalStorage();
  }

  // Persist the mementos map to localStorage (browser). No-op if unavailable.
  private static persistToLocalStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const obj = Object.fromEntries(this.mementos.entries());
      localStorage.setItem("game_mementos", JSON.stringify(obj));
    } catch (_e) {
      // Ignore storage errors (e.g. privacy mode)
    }
  }

  // Load persisted mementos from localStorage into memory. No-op if unavailable.
  static loadFromLocalStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem("game_mementos");
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, CellMemento>;
      this.mementos.clear();
      for (const [k, v] of Object.entries(obj)) {
        this.mementos.set(k, v as CellMemento);
      }
    } catch (_e) {
      // ignore parse errors
    }
  }
}
