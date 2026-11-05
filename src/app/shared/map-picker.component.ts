import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, switchMap } from 'rxjs';

import { ApiService } from '../core/api.service';
import { GeoPlace, LocationSource } from '../core/models';
import { environment } from '../../environments/environment';
import { IconComponent } from './icon.component';

/** What the picker hands back once the merchant confirms (V3 §8). */
export interface PickedLocation {
  latitude: number;
  longitude: number;
  source: LocationSource;
  /** Metres of GPS uncertainty, when the device reported any (§25). */
  accuracy: number | null;
  placeId: string | null;
  /** The address the pin sits on, when the geocoder could name it (§26). */
  address: GeoPlace['address'] | null;
  label: string | null;
}

/**
 * A pin that has moved but that nobody has vouched for yet (V3 §8).
 *
 * Deliberately a different shape from `PickedLocation`: that one carries the
 * resolved address and means "the merchant says this is the place", while
 * this one means only "the pin is here now". Keeping them apart is what stops
 * a caller treating a drag as a confirmation.
 */
export interface MovedPin {
  latitude: number;
  longitude: number;
  source: LocationSource;
  accuracy: number | null;
}

interface Tile {
  key: string;
  url: string;
  left: number;
  top: number;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
/** Web Mercator is undefined at the poles; this is where the projection stops. */
const MAX_LATITUDE = 85.05112878;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Shop location picker (V3 §5-§10).
 *
 *   <app-map-picker
 *     [latitude]="lat" [longitude]="lng" [addressHint]="'RS Puram, Coimbatore'"
 *     (picked)="onLocation($event)" />
 *
 * All three of §6's methods in one control: search for an address, drag the map
 * under the pin, or use the device's own position. Whichever produced the pin,
 * the merchant confirms it before it counts - §8 is explicit that an
 * automatically found location is a suggestion, not an answer.
 *
 * Written against raster tiles and the browser's own pointer events rather than
 * a mapping library. The picker needs to pan, zoom and report a centre point;
 * a library would add a few hundred kilobytes to every page in the bundle for
 * clustering, layers and vector styling that this form will never ask for.
 *
 * The tile source is configuration (`environment.mapTileUrl`), so swapping
 * OpenStreetMap's servers for a commercial provider is a one-line change and
 * needs nothing here to move.
 */
@Component({
  selector: 'app-map-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="picker">
      <div class="toolbar">
        <div class="search">
          <app-icon name="search-outline" [size]="16" />
          <input
            #searchInput
            type="text"
            [value]="searchTerm()"
            (input)="onSearchInput($event)"
            (keydown.enter)="$event.preventDefault(); runSearch()"
            (keydown.escape)="results.set([])"
            [attr.aria-label]="'Search for the shop address'"
            placeholder="Search an address, e.g. RS Puram, Coimbatore"
          />
          @if (searching()) {
            <span class="spinner" aria-hidden="true"></span>
          } @else if (searchTerm()) {
            <button type="button" class="icon-btn" (click)="clearSearch()" aria-label="Clear search">
              <app-icon name="close-outline" [size]="16" />
            </button>
          }

          @if (results().length) {
            <ul class="results" role="listbox">
              @for (place of results(); track place.placeId || place.label) {
                <li>
                  <button type="button" (click)="choosePlace(place)">
                    {{ place.label }}
                  </button>
                </li>
              }
            </ul>
          } @else if (searchedEmpty()) {
            <ul class="results">
              <li class="no-results">
                Nothing found. Try a nearby landmark, or drag the map to the shop instead.
              </li>
            </ul>
          }
        </div>

        <button
          type="button"
          class="btn btn-secondary btn-sm"
          (click)="useCurrentLocation()"
          [disabled]="locating()"
        >
          <app-icon name="locate-outline" [size]="15" />
          {{ locating() ? 'Locating…' : 'Use my current location' }}
        </button>
      </div>

      @if (notice(); as message) {
        <p class="notice">{{ message }}</p>
      }

      <!--
        touch-action: none on the surface is what makes a one-finger drag pan
        the map instead of scrolling the page behind it.
      -->
      <div
        #surface
        class="surface"
        role="application"
        tabindex="0"
        [attr.aria-label]="
          'Map of the shop location. Drag, or use the arrow keys to move the pin and plus and minus to zoom.'
        "
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (wheel)="onWheel($event)"
        (keydown)="onKeydown($event)"
      >
        @for (tile of tiles(); track tile.key) {
          <img
            class="tile"
            [src]="tile.url"
            [style.left.px]="tile.left"
            [style.top.px]="tile.top"
            alt=""
            draggable="false"
            loading="lazy"
          />
        }

        <!-- The pin is fixed dead centre: the merchant moves the map under it. -->
        <div class="pin" [class.dragging]="dragging()" aria-hidden="true">
          <app-icon name="location-outline" [size]="34" />
          <span class="pin-shadow"></span>
        </div>

        <div class="zoom">
          <button type="button" (click)="zoomBy(1)" aria-label="Zoom in" [disabled]="zoom() >= 19">+</button>
          <button type="button" (click)="zoomBy(-1)" aria-label="Zoom out" [disabled]="zoom() <= 3">−</button>
        </div>

        <p class="attribution">{{ attribution }}</p>
      </div>

      <div class="readout">
        <div>
          <p class="coords">
            <app-icon name="location-outline" [size]="14" />
            {{ latitudeSignal().toFixed(5) }}, {{ longitudeSignal().toFixed(5) }}
          </p>
          <!--
            §11: customers are shown a place, not a coordinate. This precision
            is here because it is the merchant's own shop and they are checking
            the pin, which is the one moment it is genuinely useful.
          -->
          <p class="resolved">
            @if (resolving()) {
              Looking up this spot…
            } @else if (resolved(); as place) {
              {{ place.label }}
            } @else {
              Drag the map so the pin sits on your shop front.
            }
          </p>
        </div>

        <button type="button" class="btn btn-sm" (click)="confirm()" [disabled]="confirmed()">
          @if (confirmed()) {
            <app-icon name="checkmark-outline" [size]="15" /> Location confirmed
          } @else {
            Confirm location
          }
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .picker {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        background: var(--surface);
      }

      .toolbar {
        display: flex;
        gap: 0.5rem;
        padding: 0.6rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .search {
        position: relative;
        flex: 1 1 240px;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0 0.55rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--surface-alt);
        color: var(--text-subtle);
      }

      .search input {
        flex: 1;
        border: 0;
        background: none;
        padding: 0.5rem 0;
        font: inherit;
        color: var(--text);
        min-width: 0;
      }

      .search input:focus {
        outline: none;
      }

      .search:focus-within {
        border-color: var(--brand);
      }

      .icon-btn {
        border: 0;
        background: none;
        padding: 0;
        cursor: pointer;
        color: inherit;
        display: grid;
        place-items: center;
      }

      .results {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 5;
        margin: 0;
        padding: 0.25rem;
        list-style: none;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow);
        max-height: 220px;
        overflow-y: auto;
      }

      .results button {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        background: none;
        font: inherit;
        color: var(--text);
        padding: 0.45rem 0.5rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 0.85rem;
        line-height: 1.35;
      }

      .results button:hover,
      .results button:focus-visible {
        background: var(--brand-light);
      }

      .no-results {
        padding: 0.5rem;
        font-size: 0.85rem;
        color: var(--text-subtle);
      }

      .notice {
        margin: 0;
        padding: 0 0.6rem 0.5rem;
        font-size: 0.83rem;
        color: var(--text-subtle);
      }

      .surface {
        position: relative;
        height: 320px;
        overflow: hidden;
        background: var(--surface-alt);
        cursor: grab;
        touch-action: none;
        user-select: none;
      }

      .surface:active {
        cursor: grabbing;
      }

      .surface:focus-visible {
        outline: 2px solid var(--brand);
        outline-offset: -2px;
      }

      .tile {
        position: absolute;
        width: 256px;
        height: 256px;
        pointer-events: none;
      }

      .pin {
        position: absolute;
        left: 50%;
        top: 50%;
        /* The point of the marker is its bottom tip, so it hangs above centre. */
        transform: translate(-50%, -100%);
        color: var(--brand);
        pointer-events: none;
        filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.4));
        transition: transform 0.12s ease-out;
      }

      .pin.dragging {
        transform: translate(-50%, calc(-100% - 5px));
      }

      .pin-shadow {
        position: absolute;
        left: 50%;
        bottom: -3px;
        width: 10px;
        height: 4px;
        border-radius: 50%;
        background: rgb(0 0 0 / 0.35);
        transform: translateX(-50%);
      }

      .zoom {
        position: absolute;
        right: 0.5rem;
        top: 0.5rem;
        display: grid;
        gap: 1px;
        background: var(--border);
        border-radius: var(--radius-sm);
        overflow: hidden;
        box-shadow: var(--shadow);
      }

      .zoom button {
        width: 30px;
        height: 30px;
        border: 0;
        background: var(--surface);
        color: var(--text);
        font-size: 1.05rem;
        line-height: 1;
        cursor: pointer;
      }

      .zoom button:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .attribution {
        position: absolute;
        right: 0;
        bottom: 0;
        margin: 0;
        padding: 1px 5px;
        font-size: 0.66rem;
        background: rgb(255 255 255 / 0.75);
        color: #333;
        border-top-left-radius: var(--radius-sm);
      }

      .readout {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
        padding: 0.6rem;
        border-top: 1px solid var(--border);
        flex-wrap: wrap;
      }

      .coords {
        margin: 0;
        font-size: 0.85rem;
        font-variant-numeric: tabular-nums;
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }

      .resolved {
        margin: 0.15rem 0 0;
        font-size: 0.8rem;
        color: var(--text-subtle);
        max-width: 46ch;
      }
    `,
  ],
})
export class MapPickerComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** Where to open. Null centres on `environment.mapDefaultCenter`. */
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  /** Seeds the search box the first time a shop has no coordinates yet. */
  readonly addressHint = input<string>('');

  readonly picked = output<PickedLocation>();
  /**
   * The pin moved, but has not been confirmed (§8).
   *
   * Without this a form cannot tell "no location yet" from "a pin is sitting
   * there unconfirmed", because the only thing it would ever hear is the
   * confirmation - which makes the middle state, whose whole job is to say
   * "now press Confirm", unreachable.
   */
  readonly pinMoved = output<MovedPin>();

  readonly attribution = environment.mapAttribution;

  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly latitudeSignal = signal(environment.mapDefaultCenter.latitude);
  readonly longitudeSignal = signal(environment.mapDefaultCenter.longitude);
  readonly zoom = signal(16);
  readonly dragging = signal(false);
  readonly confirmed = signal(false);

  readonly searchTerm = signal('');
  readonly results = signal<GeoPlace[]>([]);
  readonly searching = signal(false);
  readonly searchedEmpty = signal(false);
  readonly locating = signal(false);
  readonly notice = signal<string | null>(null);

  readonly resolved = signal<GeoPlace | null>(null);
  readonly resolving = signal(false);

  /** Viewport size, tracked so the tile grid always covers it. */
  private readonly width = signal(600);
  private readonly height = signal(320);

  /** How the current pin was arrived at, which §24 stores alongside it. */
  private source: LocationSource = 'MANUAL';
  private accuracy: number | null = null;
  private placeId: string | null = null;

  private readonly reverseRequests = new Subject<{ latitude: number; longitude: number }>();
  private readonly searchRequests = new Subject<string>();
  private pointerId: number | null = null;
  private lastPoint: { x: number; y: number } | null = null;
  /** Set once, so a later parent re-render never yanks the pin back. */
  private seeded = false;

  constructor() {
    // The picker opens on the coordinates it was given, but only the first
    // time: after that the merchant is driving, and re-centring under them
    // would undo the drag they just made.
    effect(() => {
      const lat = this.latitude();
      const lng = this.longitude();
      if (this.seeded || lat === null || lng === null) return;
      this.seeded = true;
      this.latitudeSignal.set(lat);
      this.longitudeSignal.set(lng);
      // Coordinates that already exist were confirmed when they were saved.
      this.confirmed.set(true);
      this.requestReverse();
    });

    // An address with no coordinates is the common case for a shop being set
    // up, so the search runs itself rather than making them retype it.
    effect(() => {
      const hint = this.addressHint().trim();
      if (this.seeded || !hint || this.searchTerm()) return;
      this.seeded = true;
      this.searchTerm.set(hint);
      this.runSearch();
    });

    this.reverseRequests
      .pipe(
        debounceTime(500),
        switchMap(({ latitude, longitude }) => this.api.reverseGeocode(latitude, longitude)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (place) => {
          this.resolving.set(false);
          this.resolved.set(place);
        },
        // A geocoder that cannot name the spot changes nothing: the pin the
        // merchant placed is still the location being saved.
        error: () => this.resolving.set(false),
      });

    this.searchRequests
      .pipe(
        debounceTime(450),
        switchMap((term) => this.api.searchPlaces(term)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (places) => {
          this.searching.set(false);
          this.results.set(places);
          this.searchedEmpty.set(places.length === 0);
        },
        error: () => {
          this.searching.set(false);
          this.searchedEmpty.set(true);
        },
      });

    effect((onCleanup) => {
      const element = this.surface().nativeElement;
      const observer = new ResizeObserver(([entry]) => {
        this.width.set(entry.contentRect.width);
        this.height.set(entry.contentRect.height);
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }

  // ---- Projection ---------------------------------------------------------
  // Standard Web Mercator, the projection every raster tile scheme uses. World
  // pixel coordinates run 0..256*2^zoom in both axes.

  private worldSize(): number {
    return TILE_SIZE * 2 ** this.zoom();
  }

  private lngToWorldX(lng: number): number {
    return ((lng + 180) / 360) * this.worldSize();
  }

  private latToWorldY(lat: number): number {
    const sin = Math.sin((clamp(lat, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI) / 180);
    return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * this.worldSize();
  }

  private worldXToLng(x: number): number {
    return (x / this.worldSize()) * 360 - 180;
  }

  private worldYToLat(y: number): number {
    const n = Math.PI - (2 * Math.PI * y) / this.worldSize();
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  /**
   * The tiles covering the viewport, positioned relative to its top-left.
   *
   * One extra ring is fetched on every side so a drag reveals loaded tiles
   * rather than blank ground.
   */
  readonly tiles = computed<Tile[]>(() => {
    const zoom = this.zoom();
    const count = 2 ** zoom;
    const size = TILE_SIZE * count;

    const centreX = ((this.longitudeSignal() + 180) / 360) * size;
    const sin = Math.sin((clamp(this.latitudeSignal(), -MAX_LATITUDE, MAX_LATITUDE) * Math.PI) / 180);
    const centreY = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;

    const left = centreX - this.width() / 2;
    const top = centreY - this.height() / 2;

    const firstX = Math.floor(left / TILE_SIZE) - 1;
    const firstY = Math.floor(top / TILE_SIZE) - 1;
    const lastX = Math.floor((left + this.width()) / TILE_SIZE) + 1;
    const lastY = Math.floor((top + this.height()) / TILE_SIZE) + 1;

    const tiles: Tile[] = [];
    for (let y = firstY; y <= lastY; y += 1) {
      // Above the north pole or below the south there is nothing to draw.
      if (y < 0 || y >= count) continue;
      for (let x = firstX; x <= lastX; x += 1) {
        // Longitude wraps, so a map panned past the date line repeats.
        const wrapped = ((x % count) + count) % count;
        tiles.push({
          key: `${zoom}/${x}/${y}`,
          url: environment.mapTileUrl
            .replace('{z}', String(zoom))
            .replace('{x}', String(wrapped))
            .replace('{y}', String(y)),
          left: x * TILE_SIZE - left,
          top: y * TILE_SIZE - top,
        });
      }
    }
    return tiles;
  });

  // ---- Moving the map -----------------------------------------------------

  /**
   * Moves the centre by a pixel offset. Any movement invalidates a previous
   * confirmation - §8 has the merchant confirming a pin, not a shop.
   */
  private panBy(dx: number, dy: number, source: LocationSource = 'MAP_PIN'): void {
    const x = this.lngToWorldX(this.longitudeSignal()) - dx;
    const y = clamp(this.latToWorldY(this.latitudeSignal()) - dy, 0, this.worldSize());

    this.latitudeSignal.set(this.worldYToLat(y));
    this.longitudeSignal.set(((((this.worldXToLng(x) + 180) % 360) + 360) % 360) - 180);
    this.source = source;
    this.accuracy = null;
    this.placeId = null;
    this.confirmed.set(false);
    this.requestReverse();
    this.emitMoved();
  }

  /** Tells the parent the pin is somewhere new and still unconfirmed (§8). */
  private emitMoved(): void {
    this.pinMoved.emit({
      latitude: Number(this.latitudeSignal().toFixed(7)),
      longitude: Number(this.longitudeSignal().toFixed(7)),
      source: this.source,
      accuracy: this.accuracy,
    });
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.pointerId = event.pointerId;
    this.lastPoint = { x: event.clientX, y: event.clientY };
    this.dragging.set(true);
    this.surface().nativeElement.setPointerCapture(event.pointerId);
    this.results.set([]);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId || !this.lastPoint) return;
    const dx = event.clientX - this.lastPoint.x;
    const dy = event.clientY - this.lastPoint.y;
    this.lastPoint = { x: event.clientX, y: event.clientY };
    this.panBy(dx, dy);
  }

  onPointerUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.surface().nativeElement.releasePointerCapture(event.pointerId);
    this.pointerId = null;
    this.lastPoint = null;
    this.dragging.set(false);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1 : -1);
  }

  /** Arrow keys pan and +/- zoom, so the picker works without a mouse. */
  onKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 120 : 40;
    const pans: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (pans[event.key]) {
      event.preventDefault();
      this.panBy(...pans[event.key]);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomBy(1);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomBy(-1);
    }
  }

  /** Zoom keeps the centre - and therefore the pin - exactly where it is. */
  zoomBy(delta: number): void {
    this.zoom.update((value) => clamp(value + delta, MIN_ZOOM, MAX_ZOOM));
  }

  // ---- Finding a place ----------------------------------------------------

  onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    this.searchedEmpty.set(false);
    if (term.trim().length < 3) {
      this.results.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchRequests.next(term.trim());
  }

  runSearch(): void {
    const term = this.searchTerm().trim();
    if (term.length < 3) return;
    this.searching.set(true);
    this.searchRequests.next(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.results.set([]);
    this.searchedEmpty.set(false);
    this.searchInput()?.nativeElement.focus();
  }

  /** §6 Method 1: a search result drops the pin, which stays adjustable (§10). */
  choosePlace(place: GeoPlace): void {
    this.latitudeSignal.set(place.latitude);
    this.longitudeSignal.set(place.longitude);
    this.zoom.set(Math.max(this.zoom(), 17));
    this.source = 'ADDRESS_SEARCH';
    this.accuracy = null;
    this.placeId = place.placeId;
    this.resolved.set(place);
    this.results.set([]);
    this.confirmed.set(false);
    this.emitMoved();
    this.notice.set('Pin placed from the search. Drag the map if it is not exactly right.');
  }

  /** §6 Method 3, for a merchant standing in their own shop. */
  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.notice.set('This browser cannot share a location. Search for the address instead.');
      return;
    }

    this.locating.set(true);
    this.notice.set(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        this.latitudeSignal.set(position.coords.latitude);
        this.longitudeSignal.set(position.coords.longitude);
        this.zoom.set(Math.max(this.zoom(), 17));
        this.source = 'CURRENT_LOCATION';
        this.accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;
        this.placeId = null;
        this.confirmed.set(false);
        this.emitMoved();
        // §25: an imprecise fix is still a useful starting point, so this says
        // what it is rather than refusing it.
        this.notice.set(
          this.accuracy !== null
            ? `Located to about ${Math.round(this.accuracy)} m. Drag the map to fine-tune the pin.`
            : 'Located. Drag the map to fine-tune the pin.',
        );
        this.requestReverse();
      },
      (error) => {
        this.locating.set(false);
        this.notice.set(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was refused. Search for the address or drag the pin instead.'
            : 'Your location could not be read. Search for the address or drag the pin instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  private requestReverse(): void {
    this.resolving.set(true);
    this.reverseRequests.next({
      latitude: this.latitudeSignal(),
      longitude: this.longitudeSignal(),
    });
  }

  /** §8: nothing is stored until the merchant says this is their shop. */
  confirm(): void {
    const place = this.resolved();
    this.confirmed.set(true);
    this.notice.set(null);
    this.picked.emit({
      latitude: Number(this.latitudeSignal().toFixed(7)),
      longitude: Number(this.longitudeSignal().toFixed(7)),
      source: this.source,
      accuracy: this.accuracy,
      placeId: this.placeId,
      address: place?.address ?? null,
      label: place?.label ?? null,
    });
  }
}
