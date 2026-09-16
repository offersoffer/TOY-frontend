import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { PreferredLocation } from './models';

const STORAGE_KEY = 'offers.location';

export type LocationSource = 'gps' | 'manual' | 'profile' | 'none';

export interface SelectedLocation {
  label: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  source: LocationSource;
}

const NO_LOCATION: SelectedLocation = {
  label: 'All locations',
  city: null,
  latitude: null,
  longitude: null,
  source: 'none',
};

/** Cities offered for manual selection when the customer declines GPS (§8.1). */
export const SUGGESTED_CITIES: { city: string; latitude: number; longitude: number }[] = [
  { city: 'Coimbatore', latitude: 11.0168, longitude: 76.9558 },
  { city: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
  { city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
  { city: 'Hyderabad', latitude: 17.385, longitude: 78.4867 },
  { city: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { city: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  { city: 'Kochi', latitude: 9.9312, longitude: 76.2673 },
  { city: 'Madurai', latitude: 9.9252, longitude: 78.1198 },
];

/**
 * `Coimbatore` -> `coimbatore`, so a city can be a path segment on the
 * indexable category listings (`/offers/c/clothing/coimbatore`).
 */
export function citySlug(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The city a slug refers to, as the database spells it.
 *
 * Cities are free text on a branch rather than rows of their own, so there is
 * no slug column to look up. A suggested city is matched on its own slug, which
 * keeps the common ones exact; anything else is title-cased, which is how the
 * remaining branch cities are stored. The branch filter compares under a
 * case-insensitive collation, so only the word boundaries have to be right.
 */
export function cityFromSlug(slug: string): string {
  const normalised = citySlug(slug);
  const known = SUGGESTED_CITIES.find((entry) => citySlug(entry.city) === normalised);
  if (known) return known.city;
  return normalised
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Holds the customer's current or selected location.
 *
 * Location is strictly optional (§8.6): if permission is denied, or the browser
 * has no geolocation, the app keeps working and manual selection stays
 * available. Nothing here ever blocks browsing.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  private readonly selected = signal<SelectedLocation>(this.readStored());
  readonly location = this.selected.asReadonly();
  readonly hasPosition = computed(() => this.selected().latitude !== null);
  readonly requesting = signal(false);
  /** True once the browser has refused, so we stop offering "Use my location". */
  readonly permissionDenied = signal(false);

  /**
   * §42 - location was permitted but the fix failed (no GPS lock, a timeout,
   * an unavailable provider). A different state from denial, and it needs a
   * different offer: "Try Again" makes sense here and is pointless after a
   * refusal, where the only way forward is picking a city.
   */
  readonly lookupFailed = signal(false);

  constructor() {
    // Fall back to the location saved on the user's profile when nothing has
    // been picked in this browser yet.
    effect(() => {
      const user = this.auth.user();
      const current = this.selected();
      if (user?.preferredLocation?.latitude && current.source === 'none') {
        this.selected.set({
          label: user.preferredLocation.city ?? 'My location',
          city: user.preferredLocation.city,
          latitude: user.preferredLocation.latitude,
          longitude: user.preferredLocation.longitude,
          source: 'profile',
        });
      }
    });
  }

  /** Position to send with discovery requests, or null when unknown. */
  get position(): PreferredLocation | null {
    const value = this.selected();
    if (value.latitude === null || value.longitude === null) return null;
    return { city: value.city, latitude: value.latitude, longitude: value.longitude };
  }

  /**
   * Asks the browser for GPS.
   *
   * §41 and §42 are two different failures and the app must not conflate them.
   * A refusal is a decision the customer made and re-asking is rude; a failed
   * fix is a technical miss and retrying often works on the second attempt.
   * Neither blocks anything - browsing continues either way (§41: "the app
   * must not be blocked").
   */
  requestCurrentPosition(): void {
    if (!('geolocation' in navigator)) {
      this.toast.info('This browser cannot share your location. Pick a city instead.');
      this.permissionDenied.set(true);
      return;
    }

    this.requesting.set(true);
    this.lookupFailed.set(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.requesting.set(false);
        this.permissionDenied.set(false);
        this.lookupFailed.set(false);
        this.set({
          label: 'Near me',
          city: null,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          source: 'gps',
        });
        this.toast.success('Using your current location.');
      },
      (error) => {
        this.requesting.set(false);
        if (error.code === error.PERMISSION_DENIED) {
          // §41.
          this.permissionDenied.set(true);
          this.lookupFailed.set(false);
          this.toast.info('Location access is off. You can still browse offers — choose a location manually.');
        } else {
          // §42: POSITION_UNAVAILABLE or TIMEOUT. Retrying is worth offering.
          this.lookupFailed.set(true);
          this.toast.info('We couldn’t determine your location. Please try again or select a location manually.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }

  selectCity(city: { city: string; latitude: number; longitude: number }): void {
    // Picking a city is the recovery §41 and §42 both point at, so it clears
    // whichever failure banner was showing.
    this.lookupFailed.set(false);
    this.set({
      label: city.city,
      city: city.city,
      latitude: city.latitude,
      longitude: city.longitude,
      source: 'manual',
    });
  }

  clear(): void {
    this.set(NO_LOCATION);
  }

  private set(value: SelectedLocation): void {
    this.selected.set(value);
    if (value.source === 'none') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  }

  private readStored(): SelectedLocation {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return NO_LOCATION;
      const parsed = JSON.parse(raw) as SelectedLocation;
      return parsed.latitude !== undefined ? parsed : NO_LOCATION;
    } catch {
      return NO_LOCATION;
    }
  }
}
