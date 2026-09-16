import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { AuthPromptService } from '../../core/auth-prompt.service';
import { SeoService } from '../../core/seo.service';
import { AuthService } from '../../core/auth.service';
import { LocationService, SUGGESTED_CITIES, cityFromSlug, citySlug } from '../../core/location.service';
import { ToastService } from '../../core/toast.service';
import {
  Banner,
  Category,
  EndingSoonOffer,
  Offer,
  OfferQuery,
  OfferSort,
  PageMeta,
  RecommendedOffer,
  Shop,
} from '../../core/models';
import { OfferCardComponent } from '../../shared/offer-card.component';
import { BannerCarouselComponent } from '../../shared/banner-carousel.component';
import { OfferRailComponent } from '../../shared/offer-rail.component';
import { CardSkeletonsComponent, EmptyStateComponent, PaginationComponent } from '../../shared/ui.components';
import { IconComponent } from '../../shared/icon.component';

interface SortOption {
  value: OfferSort;
  label: string;
  needsLocation?: boolean;
}

const SORTS: SortOption[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'endingSoon', label: 'Ending soon' },
  { value: 'highestDiscount', label: 'Highest discount' },
  { value: 'mostViewed', label: 'Most viewed' },
  { value: 'mostPopular', label: 'Most popular' },
  { value: 'nearest', label: 'Nearest', needsLocation: true },
];

const OFFER_TYPES = [
  { value: 'percentage', label: 'Percentage off' },
  { value: 'flat', label: 'Flat amount off' },
  { value: 'buy_x_get_y', label: 'Buy X get Y' },
  { value: 'price_drop', label: 'Price drop' },
  { value: 'up_to', label: 'Up to' },
  { value: 'other', label: 'Other' },
];

/**
 * The View Offers page (§5). All filtering, sorting and distance work happens
 * server-side; this component only translates UI state into query parameters
 * and keeps them in the URL so a filtered view can be shared or bookmarked.
 */
@Component({
  selector: 'app-offer-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    OfferCardComponent,
    BannerCarouselComponent,
    OfferRailComponent,
    PaginationComponent,
    EmptyStateComponent,
    CardSkeletonsComponent,
    IconComponent,
  ],
  templateUrl: './offer-list.component.html',
  styleUrl: './offer-list.component.scss',
})
export class OfferListComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly prompt = inject(AuthPromptService);
  private readonly seo = inject(SeoService);
  readonly locations = inject(LocationService);

  readonly sorts = SORTS;
  readonly offerTypes = OFFER_TYPES;
  readonly cities = SUGGESTED_CITIES;
  readonly radiusOptions = environment.radiusOptions;

  readonly offers = signal<Offer[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly loading = signal(true);
  readonly categories = signal<Category[]>([]);
  readonly shops = signal<Shop[]>([]);
  readonly filtersOpen = signal(false);

  // ---- V2 discovery sections (§2) -----------------------------------------
  readonly banners = signal<Banner[]>([]);
  readonly endingSoon = signal<EndingSoonOffer[]>([]);
  readonly nearby = signal<Offer[]>([]);
  readonly recommended = signal<RecommendedOffer[]>([]);
  readonly loadingSections = signal(true);

  /**
   * The sections are only meaningful on the unfiltered landing view. Once
   * someone is searching or filtering they want results, not merchandising.
   */
  readonly showSections = computed(() => {
    this.filterTick();
    return !this.search && this.activeFilterCount() === 0 && this.page === 1;
  });

  readonly endingNote = (offer: Offer): string | null =>
    (offer as EndingSoonOffer).endingBucket?.label ?? null;

  readonly recommendedNote = (offer: Offer): string | null =>
    (offer as RecommendedOffer).reason ?? null;

  readonly distanceNote = (offer: Offer): string | null =>
    offer.distanceKm === null
      ? null
      : offer.distanceKm < 1
        ? `${Math.round(offer.distanceKm * 1000)} m away`
        : `${offer.distanceKm.toFixed(1)} km away`;

  /** "Nearby" mode is the same page with the radius filter switched on (§8.4). */
  readonly nearbyMode = signal(false);

  // ---- Category route (§27) ------------------------------------------------
  //
  // Set when the page was entered through `/offers/c/:categorySlug` or
  // `/offers/c/:categorySlug/:citySlug`. On those addresses the category and
  // the city are the page's identity rather than filter state, which is what
  // lets them carry a canonical of their own.
  readonly routeCategorySlug = signal<string | null>(null);
  readonly routeCitySlug = signal<string | null>(null);

  /**
   * The id the path's slug resolved to, or null while the category list is
   * still in flight. Remembered so a filter change can tell "the visitor picked
   * a different category" from "the id has not arrived yet".
   */
  private routeCategoryId: number | null = null;

  // Filter state, hydrated from the URL on every navigation.
  search = '';
  categoryId: number | null = null;
  shopId: number | null = null;
  city = '';
  pincode = '';
  radius: number | null = null;
  minDiscount: number | null = null;
  offerType = '';
  expiringInDays: number | null = null;
  sort: OfferSort = 'newest';
  page = 1;

  private readonly searchInput$ = new Subject<string>();

  readonly activeFilterCount = computed(() => this.countActiveFilters());
  private readonly filterTick = signal(0);

  constructor() {
    this.nearbyMode.set(this.route.snapshot.data['nearby'] === true);

    this.searchInput$.pipe(debounceTime(350), distinctUntilChanged()).subscribe((value) => {
      this.search = value;
      this.page = 1;
      this.applyToUrl();
    });

    // Both halves of the URL matter now that a category can arrive as a path
    // segment. Angular emits each of them on every navigation, so the pair is
    // collapsed into one tick rather than loading the listing twice.
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(debounceTime(0))
      .subscribe(([path, params]) => {
        const slug = path.get('categorySlug');
        const city = path.get('citySlug');
        this.routeCategorySlug.set(slug);
        this.routeCitySlug.set(city);

        this.search = params.get('search') ?? '';
        // On a category route the slug is the filter; the query parameter form
        // is what the in-app chips and the filter panel write.
        this.routeCategoryId = slug ? (this.categoryBySlug(slug)?.id ?? null) : null;
        this.categoryId = slug ? this.routeCategoryId : this.num(params.get('categoryId'));
        this.shopId = this.num(params.get('shopId'));
        this.city = city ? cityFromSlug(city) : (params.get('city') ?? '');
        this.pincode = params.get('pincode') ?? '';
        this.minDiscount = this.num(params.get('minDiscount'));
        this.offerType = params.get('offerType') ?? '';
        this.expiringInDays = this.num(params.get('expiringInDays'));
        this.page = this.num(params.get('page')) ?? 1;

        const radiusParam = this.num(params.get('radius'));
        this.radius = radiusParam ?? (this.nearbyMode() ? environment.defaultRadiusKm : null);

        const sortParam = params.get('sort') as OfferSort | null;
        this.sort = sortParam ?? (this.nearbyMode() ? 'nearest' : 'newest');

        this.filterTick.update((tick) => tick + 1);
        this.describePage();
        this.load();
      });

    this.api.listCategories().subscribe((categories) => {
      this.categories.set(categories);
      // A category route filters through the API on the slug itself, so the
      // listing is already right; the id is what the chips highlight, and it
      // only exists now. No reload - it selects the same category.
      const slug = this.routeCategorySlug();
      if (slug) {
        this.routeCategoryId = this.categoryBySlug(slug)?.id ?? null;
        this.categoryId = this.routeCategoryId;
        this.filterTick.update((tick) => tick + 1);
      }
      // The category name is only known once this resolves, so the title is
      // written again rather than left as the generic "Offers near you".
      this.describePage();
    });
    this.api
      .listShops({ limit: 100, sort: 'name' })
      .subscribe((page) => this.shops.set(page.items));

    this.loadSections();
  }

  /**
   * Loads the V2 discovery sections. Each one fails independently: a section
   * that errors simply stays empty and is hidden rather than breaking the page.
   */
  private loadSections(): void {
    this.loadingSections.set(true);
    const position = this.locations.position;
    const coords = position
      ? { latitude: position.latitude!, longitude: position.longitude! }
      : {};

    this.api.featuredBanners(8).subscribe({
      next: (banners) => this.banners.set(banners),
      error: () => this.banners.set([]),
    });

    this.api.endingSoon({ ...coords, limit: 8 }).subscribe({
      next: (offers) => {
        this.endingSoon.set(offers);
        this.loadingSections.set(false);
      },
      error: () => {
        this.endingSoon.set([]);
        this.loadingSections.set(false);
      },
    });

    // Near Me needs coordinates; without them the section simply does not show.
    if (position) {
      this.api
        .nearbyOffers({ ...coords, radius: this.radius ?? environment.defaultRadiusKm, limit: 8 })
        .subscribe({
          next: (offers) => this.nearby.set(offers),
          error: () => this.nearby.set([]),
        });
    } else {
      this.nearby.set([]);
    }

    this.api.recommendedOffers({ ...coords, limit: 8 }).subscribe({
      next: (offers) => this.recommended.set(offers),
      error: () => this.recommended.set([]),
    });
  }

  /**
   * §27: "Clothing Offers in Coimbatore". The listing is the page a search
   * engine is most likely to land on, so its title tracks the category and city
   * the visitor is actually filtered to. The canonical still drops the query
   * string, which is why the same listing under a dozen filter combinations
   * does not present itself as a dozen pages - but it now points at the
   * category's own route rather than flattening every category onto `/offers`.
   */
  private describePage(): void {
    const category = this.selectedCategory();
    // Only a real place belongs in the title - the picker's "All locations" and
    // "Near me" placeholders would read as city names to a search engine.
    const picked = this.locations.location();
    const city = this.city || (picked.city ?? null);
    // A slug nobody's category answers to is a typo, not a page. It renders the
    // ordinary empty state, but it must not invite a crawler to index itself.
    const unknown = !!this.routeCategorySlug() && this.categories().length > 0 && !category;
    this.seo.categoryListing(category, city, this.canonicalPath(category), unknown);
  }

  /**
   * The address this view claims as its own.
   *
   * Category listings have real routes now, so `/offers?categoryId=3` points at
   * `/offers/c/clothing`: the filtered view still is not a page of its own, but
   * the page it is a view of finally exists, and the sitemap can name it.
   *
   * Only a city that is in the URL counts. The location picker is a per-visitor
   * setting - letting it into the canonical would have two visitors reading the
   * same address disagree about which page they are on, and a crawler, which
   * grants no location at all, agree with neither.
   */
  private canonicalPath(category: Category | null): string {
    // `/nearby` renders from coordinates a crawler has not got, which is why it
    // is out of the sitemap; it has no category address to point at either.
    if (this.nearbyMode()) return '/nearby';

    const slug = this.routeCategorySlug() ?? category?.slug ?? null;
    if (!slug) return '/offers';

    const city = this.routeCitySlug() ?? (this.city ? citySlug(this.city) : null);
    return city ? `/offers/c/${slug}/${city}` : `/offers/c/${slug}`;
  }

  private selectedCategory(): Category | null {
    return this.categoryId
      ? (this.categories().find((item) => item.id === this.categoryId) ?? null)
      : null;
  }

  private categoryBySlug(slug: string): Category | null {
    return this.categories().find((category) => category.slug === slug) ?? null;
  }

  // ---- Data ---------------------------------------------------------------

  private load(): void {
    this.loading.set(true);
    const position = this.locations.position;

    const query: OfferQuery = {
      page: this.page,
      limit: environment.pageSize,
      search: this.search || undefined,
      // A category route filters on its slug, before and after the category list
      // resolves. The API takes either, so the page renders filtered on first
      // paint rather than flashing the whole catalogue - but the two forms are
      // not quite the same predicate (the id form also matches an offer's
      // subcategory), and one address must not change what it means the moment
      // the visitor sorts it. The sitemap counts its offers with the slug form
      // too, so a listing it advertises is a listing with something on it.
      categoryId: this.routeCategorySlug() ? undefined : (this.categoryId ?? undefined),
      category: this.routeCategorySlug() ?? undefined,
      shopId: this.shopId ?? undefined,
      city: this.city || undefined,
      pincode: this.pincode || undefined,
      minDiscount: this.minDiscount ?? undefined,
      offerType: (this.offerType || undefined) as OfferQuery['offerType'],
      expiringInDays: this.expiringInDays ?? undefined,
      sort: this.sort,
    };

    // Coordinates are only sent when we actually have them; the radius filter
    // and "nearest" sort are dropped otherwise so browsing never breaks (§8.6).
    if (position) {
      query.latitude = position.latitude!;
      query.longitude = position.longitude!;
      if (this.radius) query.radius = this.radius;
    } else if (this.sort === 'nearest') {
      query.sort = 'newest';
    }

    this.api.listOffers(query).subscribe({
      next: (result) => {
        this.offers.set(result.items);
        this.meta.set(result.meta);
        this.loading.set(false);
      },
      error: () => {
        this.offers.set([]);
        this.meta.set(null);
        this.loading.set(false);
      },
    });
  }

  // ---- Filter interactions ------------------------------------------------

  onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  setSort(sort: OfferSort): void {
    if (sort === 'nearest' && !this.locations.hasPosition()) {
      this.toast.info('Share or choose a location to sort by distance.');
      return;
    }
    this.sort = sort;
    this.page = 1;
    this.applyToUrl();
  }

  setRadius(km: number | null): void {
    if (km !== null && !this.locations.hasPosition()) {
      this.toast.info('Share or choose a location to filter by distance.');
      return;
    }
    this.radius = this.radius === km ? null : km;
    this.page = 1;
    this.applyToUrl();
  }

  applyFilters(): void {
    this.page = 1;
    this.filtersOpen.set(false);
    this.applyToUrl();
  }

  clearFilters(): void {
    this.search = '';
    this.categoryId = null;
    this.shopId = null;
    this.city = '';
    this.pincode = '';
    this.minDiscount = null;
    this.offerType = '';
    this.expiringInDays = null;
    this.radius = this.nearbyMode() ? environment.defaultRadiusKm : null;
    this.sort = this.nearbyMode() ? 'nearest' : 'newest';
    this.page = 1;
    this.applyToUrl();
  }

  goToPage(page: number): void {
    this.page = page;
    this.applyToUrl();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useMyLocation(): void {
    this.locations.requestCurrentPosition();
    // The service updates asynchronously; reload once it settles.
    setTimeout(() => {
      this.load();
      this.loadSections();
    }, 900);
  }

  pickCity(city: (typeof SUGGESTED_CITIES)[number]): void {
    this.locations.selectCity(city);
    this.load();
    this.loadSections();
  }

  // ---- Category chips -----------------------------------------------------

  /**
   * How many category chips stand in the strip before the rest are folded away.
   *
   * The catalogue runs to two dozen categories and most of them have nothing in
   * them on any given day. All of them in one scrolling row is a wall of pills
   * the eye cannot use - so the strip shows the few worth scanning and keeps a
   * door to the rest.
   */
  readonly chipLimit = 8;

  readonly categoriesExpanded = signal(false);

  /**
   * Categories in the order they are worth offering.
   *
   * Alphabetical put "Accessories" first and "Restaurants" out of sight, which
   * is backwards: the ones with offers in them are the ones somebody wants. The
   * category in effect is pinned to the front so it is never the one folded
   * away - a filter you cannot see you have applied is worse than no filter.
   */
  readonly orderedCategories = computed(() => {
    this.filterTick();
    const active = this.categoryId;
    return [...this.categories()].sort((a, b) => {
      if (a.id === active) return -1;
      if (b.id === active) return 1;
      const byCount = (b.offerCount ?? 0) - (a.offerCount ?? 0);
      return byCount !== 0 ? byCount : a.name.localeCompare(b.name);
    });
  });

  readonly foldedCategoryCount = computed(() =>
    Math.max(0, this.orderedCategories().length - this.chipLimit),
  );

  /**
   * Where a chip points: the category's own page, or back to the unfiltered
   * listing when it is the one already applied, which is the toggle the chips
   * have always had. A string rather than a segment array so the binding is
   * compared by value and the href is not rebuilt on every change detection.
   */
  chipLink(category: Category): string {
    return this.categoryId === category.id ? '/offers' : `/offers/c/${category.slug}`;
  }

  /**
   * What a chip carries across.
   *
   * The category is in the chip's path, so everything else the visitor has set
   * rides along as query parameters - picking a category should not silently
   * throw away their search. The city comes too, as a parameter rather than the
   * path segment, and the page canonicalises it back into the path on arrival.
   *
   * Defaults are left out, so on the unfiltered listing a crawler reads a bare
   * `/offers/c/clothing` rather than a filtered view of it.
   */
  readonly chipParams = computed<Params>(() => {
    this.filterTick();
    const params: Params = {};
    if (this.search) params['search'] = this.search;
    if (this.shopId) params['shopId'] = this.shopId;
    if (this.city) params['city'] = this.city;
    if (this.pincode) params['pincode'] = this.pincode;
    if (this.radius) params['radius'] = this.radius;
    if (this.minDiscount) params['minDiscount'] = this.minDiscount;
    if (this.offerType) params['offerType'] = this.offerType;
    if (this.expiringInDays) params['expiringInDays'] = this.expiringInDays;
    if (this.sort !== (this.nearbyMode() ? 'nearest' : 'newest')) params['sort'] = this.sort;
    return params;
  });

  // ---- Favourites ---------------------------------------------------------

  toggleFavorite(offer: Offer): void {
    const request = offer.isFavorite
      ? this.api.removeFavorite(offer.id)
      : this.api.addFavorite(offer.id);

    // Optimistic: flip immediately, roll back if the call fails.
    this.patchOffer(offer.id, { isFavorite: !offer.isFavorite });
    request.subscribe({
      next: () => {
        this.toast.success(offer.isFavorite ? 'Removed from favourites' : 'Saved to favourites');
      },
      error: () => this.patchOffer(offer.id, { isFavorite: offer.isFavorite }),
    });
  }

  /**
   * §5/§7: browsing never redirects. The heart raises an overlay over the list
   * the guest is already reading, and the save itself is replayed after login
   * so they never have to find the offer again.
   */
  promptLogin(offer: Offer): void {
    this.prompt.require('save-offer', () => this.toggleFavorite(offer));
  }

  private patchOffer(id: number, changes: Partial<Offer>): void {
    const apply = <T extends Offer>(list: T[]) =>
      list.map((offer) => (offer.id === id ? { ...offer, ...changes } : offer));

    // The same offer can appear in several sections at once, so they all move
    // together when it is saved or unsaved.
    this.offers.update(apply);
    this.endingSoon.update(apply);
    this.nearby.update(apply);
    this.recommended.update(apply);
  }

  // ---- URL sync -----------------------------------------------------------

  /**
   * Writes the current filters back into the URL.
   *
   * On a category route the category and the city are path segments, so a
   * change to either is a move to a different address rather than a query
   * parameter edit. Everything else - sort, page, discount - stays a query
   * parameter layered on top, which is how a visitor who arrived on
   * `/offers/c/clothing` keeps that address while they sort and page.
   */
  private applyToUrl(): void {
    const onCategoryRoute = this.routeCategorySlug() !== null;
    if (onCategoryRoute && !this.pathStillDescribes()) {
      this.navigateToListing();
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.filterQueryParams(onCategoryRoute),
      queryParamsHandling: 'merge',
    });
  }

  /** Whether the path segments still name the category and city in effect. */
  private pathStillDescribes(): boolean {
    return (
      this.categoryId === this.routeCategoryId &&
      (this.routeCitySlug() ?? '') === (this.city ? citySlug(this.city) : '')
    );
  }

  /**
   * Moves to the address the current filters belong at: the category's own
   * route while one is selected, plain `/offers` once it has been cleared.
   */
  private navigateToListing(): void {
    const category = this.selectedCategory();
    const path = category
      ? ['/offers', 'c', category.slug, ...(this.city ? [citySlug(this.city)] : [])]
      : ['/offers'];

    void this.router.navigate(path, { queryParams: this.filterQueryParams(category !== null) });
  }

  /**
   * Filter state as query parameters. `inPath` drops the two the category route
   * carries as segments, so the URL never states a filter twice and the two
   * copies can never disagree.
   */
  private filterQueryParams(inPath: boolean): Params {
    return {
      search: this.search || null,
      categoryId: inPath ? null : this.categoryId,
      shopId: this.shopId,
      city: inPath ? null : this.city || null,
      pincode: this.pincode || null,
      radius: this.radius,
      minDiscount: this.minDiscount,
      offerType: this.offerType || null,
      expiringInDays: this.expiringInDays,
      sort: this.sort,
      page: this.page > 1 ? this.page : null,
    };
  }

  private countActiveFilters(): number {
    this.filterTick();
    let count = 0;
    // The path's category counts even before its id has resolved, so the
    // merchandising rails stay hidden on a category listing from first paint.
    if (this.categoryId || this.routeCategorySlug()) count++;
    if (this.shopId) count++;
    if (this.city) count++;
    if (this.pincode) count++;
    if (this.minDiscount) count++;
    if (this.offerType) count++;
    if (this.expiringInDays) count++;
    if (this.radius) count++;
    return count;
  }

  private num(value: string | null): number | null {
    if (value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  categoryName(id: number | null): string {
    return this.categories().find((category) => category.id === id)?.name ?? '';
  }
}
