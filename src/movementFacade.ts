// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import { CellFlyweightFactory } from "./cellFlyweight.ts";

export type MovementMode = "buttons" | "geolocation";

export type MovementOptions = {
  map: leaflet.Map;
  playerMarker: leaflet.Marker;
  movePlayer: (di: number, dj: number) => void;
  setMovementControlsEnabled: (enabled: boolean) => void;
  geoStatusDiv?: HTMLElement | null;
  toggleButton?: HTMLButtonElement | null;
  latLngToCell: (lat: number, lng: number) => { i: number; j: number };
};

export class MovementController {
  private map: leaflet.Map;
  private playerMarker: leaflet.Marker;
  private movePlayerCb: (di: number, dj: number) => void;
  private setMovementControlsEnabled: (enabled: boolean) => void;
  private geoStatusDiv: HTMLElement | null;
  private toggleButton: HTMLButtonElement | null;
  private latLngToCell: (lat: number, lng: number) => { i: number; j: number };

  private mode: MovementMode = "buttons";
  private watchId: number | null = null;
  private lastSnappedCell: { i: number; j: number } | null = null;

  constructor(opts: MovementOptions) {
    this.map = opts.map;
    this.playerMarker = opts.playerMarker;
    this.movePlayerCb = opts.movePlayer;
    this.setMovementControlsEnabled = opts.setMovementControlsEnabled;
    this.geoStatusDiv = opts.geoStatusDiv ?? null;
    this.toggleButton = opts.toggleButton ?? null;
    this.latLngToCell = opts.latLngToCell;
  }

  getMode(): MovementMode {
    return this.mode;
  }

  toggleMode() {
    if (this.mode === "buttons") {
      this.startGeolocation();
    } else {
      this.stopGeolocation();
    }
  }

  startGeolocation() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported by this browser.");
      return;
    }

    this.mode = "geolocation";
    this.setMovementControlsEnabled(false);
    if (this.toggleButton) this.toggleButton.textContent = "Use Buttons";

    // Start watching position (use optional chaining for environments without geolocation)
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => {
        console.error("Geolocation error:", error);
        alert("Geolocation error: " + error.message);
        this.stopGeolocation();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
  }

  stopGeolocation() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    this.mode = "buttons";
    this.setMovementControlsEnabled(true);
    if (this.toggleButton) this.toggleButton.textContent = "Use Geolocation";
    if (this.geoStatusDiv) {
      this.geoStatusDiv.textContent = "Geolocation: inactive";
    }
    this.lastSnappedCell = null;
  }

  private handlePosition(position: GeolocationPosition) {
    const { latitude, longitude } = position.coords;

    if (this.geoStatusDiv) {
      const acc = position.coords.accuracy;
      this.geoStatusDiv.textContent = `Geolocation: ${latitude.toFixed(6)}, ${
        longitude.toFixed(6)
      }${typeof acc === "number" ? ` (±${acc}m)` : ""}`;
    }

    // Show exact GPS position on marker
    const exactLatLng = leaflet.latLng(latitude, longitude);
    this.playerMarker.setLatLng(exactLatLng);

    const gpsCell = this.latLngToCell(latitude, longitude);

    if (!this.lastSnappedCell) {
      this.lastSnappedCell = gpsCell;
      const fly = CellFlyweightFactory.getFlyweight(gpsCell.i, gpsCell.j);
      const center = fly.center;
      const zoom = typeof this.map.getZoom === "function"
        ? this.map.getZoom()
        : 19;
      this.map.setView(center, zoom);
      this.playerMarker.setLatLng(center);
      // Let the game-level code refresh caches/proximity after a snap by calling movePlayer with 0,0
      this.movePlayerCb(0, 0);
      return;
    }

    if (
      gpsCell.i !== this.lastSnappedCell.i ||
      gpsCell.j !== this.lastSnappedCell.j
    ) {
      const di = gpsCell.i - this.lastSnappedCell.i;
      const dj = gpsCell.j - this.lastSnappedCell.j;
      this.lastSnappedCell = gpsCell;
      this.movePlayerCb(di, dj);
      return;
    }

    // Still in same cell: keep marker at exact GPS, don't recenter map.
  }

  // Expose a simulator hook so tests or the UI can simulate GPS updates
  simulatePosition(latitude: number, longitude: number) {
    // reuse same logic as real geolocation handler
    const position = {
      coords: { latitude, longitude, accuracy: 0 },
    } as GeolocationPosition;
    this.handlePosition(position);
  }
}

export default MovementController;
