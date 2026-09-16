import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from './core/auth.service';
import { LocationService, SUGGESTED_CITIES } from './core/location.service';
import { ThemeService, ThemePreference } from './core/theme.service';
import { AuthPromptService } from './core/auth-prompt.service';
import { SeoService } from './core/seo.service';
import { StructuredDataService } from './core/structured-data.service';
import { AuthPromptComponent } from './shared/auth-prompt.component';
import { IconComponent } from './shared/icon.component';
import { OfflineBannerComponent } from './shared/state.components';
import { ToastsComponent } from './shared/ui.components';

/** Signed-in areas, and the title each should carry in the browser tab. */
const PRIVATE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ['/admin', 'Dashboard'],
  ['/profile', 'My profile'],
  ['/favorites', 'Saved offers'],
  ['/following', 'Following'],
  ['/notifications', 'Notifications'],
  ['/auth', 'Login'],
];

/** Public discovery pages (§2), with the copy a search result should show. */
const PUBLIC_PAGES: ReadonlyArray<readonly [string, string, string]> = [
  ['/services', 'Services near you', 'Browse local services, compare pricing and availability, and see which ones are running offers.'],
  ['/shops', 'Shops', 'Browse shops near you, their branches, opening hours and the offers they are running right now.'],
  ['/categories', 'Categories', 'Browse offers and services by category — clothing, food, salon, repairs and more.'],
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AuthPromptComponent,
    IconComponent,
    OfflineBannerComponent,
    ToastsComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly auth = inject(AuthService);
  readonly locations = inject(LocationService);
  readonly theme = inject(ThemeService);
  private readonly prompt = inject(AuthPromptService);
  private readonly seo = inject(SeoService);
  private readonly structured = inject(StructuredDataService);
  private readonly router = inject(Router);

  readonly cities = SUGGESTED_CITIES;
  readonly themeOptions: ThemePreference[] = ['light', 'dark', 'system'];
  readonly menuOpen = signal(false);
  readonly locationOpen = signal(false);
  readonly accountOpen = signal(false);

  readonly user = this.auth.user;
  readonly isAdminArea = signal(false);

  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  });

  constructor() {
    // Who the site is and how to search it. Written once and never cleared -
    // unlike the per-page markup, this is true on every address.
    this.structured.site();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects;
      this.isAdminArea.set(url.startsWith('/admin'));
      this.describe(url);
      this.closeAll();
    });
  }

  /**
   * Baseline page metadata (§27).
   *
   * Public discovery pages get a description a crawler can use; anything behind
   * a login is marked `noindex` here, so a page added later is private by
   * default rather than by remembering to say so. Detail components overwrite
   * this with the specifics once their data has loaded.
   */
  private describe(url: string): void {
    const path = url.split('?')[0];

    for (const [prefix, title] of PRIVATE_TITLES) {
      if (path.startsWith(prefix)) {
        this.seo.account(title);
        return;
      }
    }

    const publicPage = PUBLIC_PAGES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
    if (publicPage) {
      this.seo.apply({ title: publicPage[1], description: publicPage[2], path });
      return;
    }

    // Offers and nearby are described by the listing component itself, which
    // knows the category and city in play. All that is owed here is undoing any
    // `noindex` left behind by a private page the visitor came from.
    this.seo.indexable(path);
  }

  /** Closes the dropdowns when the user clicks anywhere outside them. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.location-picker')) this.locationOpen.set(false);
    if (!target.closest('.account-menu')) this.accountOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  toggleLocation(event: Event): void {
    event.stopPropagation();
    this.locationOpen.update((open) => !open);
    this.accountOpen.set(false);
  }

  toggleAccount(event: Event): void {
    event.stopPropagation();
    this.accountOpen.update((open) => !open);
    this.locationOpen.set(false);
  }

  useCurrentLocation(): void {
    this.locations.requestCurrentPosition();
    this.locationOpen.set(false);
  }

  pickCity(city: (typeof SUGGESTED_CITIES)[number]): void {
    this.locations.selectCity(city);
    this.locationOpen.set(false);
  }

  clearLocation(): void {
    this.locations.clear();
    this.locationOpen.set(false);
  }

  logout(): void {
    // A held guest action must not survive the session that answered it (§25.4).
    this.prompt.clearPending();
    this.auth.logout();
  }

  private closeAll(): void {
    this.menuOpen.set(false);
    this.locationOpen.set(false);
    this.accountOpen.set(false);
  }
}
