import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { AuthPromptService } from '../../core/auth-prompt.service';
import { AuthService } from '../../core/auth.service';
import { LocationService, SUGGESTED_CITIES } from '../../core/location.service';
import { ToastService } from '../../core/toast.service';
import { BookingType, Category, PageMeta, PricingType, Service, ServiceQuery, ServiceSort, Shop } from '../../core/models';
import { ServiceCardComponent } from '../../shared/service-card.component';
import { CardSkeletonsComponent, EmptyStateComponent, PaginationComponent } from '../../shared/ui.components';
import { IconComponent } from '../../shared/icon.component';

interface SortOption {
  value: ServiceSort;
  label: string;
  needsLocation?: boolean;
}

const SORTS: SortOption[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'mostViewed', label: 'Most viewed' },
  { value: 'mostPopular', label: 'Most popular' },
  { value: 'nearest', label: 'Nearest', needsLocation: true },
];

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: 'fixed', label: 'Fixed price' },
  { value: 'starting_from', label: 'Starting from' },
  { value: 'price_on_enquiry', label: 'Price on enquiry' },
];

const BOOKING_TYPES: { value: BookingType; label: string }[] = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'both', label: 'Walk-in or appointment' },
  { value: 'enquiry_only', label: 'Enquiry only' },
];

/**
 * The View Services page (§9, §37). Mirrors the Offers list page's filter/URL-sync
 * pattern, but has no discovery-sections block (banners/ending-soon/recommended
 * rails) since services have no such backend endpoints.
 */
@Component({
  selector: 'app-service-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ServiceCardComponent,
    PaginationComponent,
    EmptyStateComponent,
    CardSkeletonsComponent,
    IconComponent,
  ],
  templateUrl: './service-list.component.html',
  styleUrl: './service-list.component.scss',
})
export class ServiceListComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly prompt = inject(AuthPromptService);
  readonly locations = inject(LocationService);

  readonly sorts = SORTS;
  readonly pricingTypes = PRICING_TYPES;
  readonly bookingTypes = BOOKING_TYPES;
  readonly cities = SUGGESTED_CITIES;
  readonly radiusOptions = environment.radiusOptions;

  readonly services = signal<Service[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly loading = signal(true);
  readonly categories = signal<Category[]>([]);
  readonly shops = signal<Shop[]>([]);
  readonly filtersOpen = signal(false);

  search = '';
  categoryId: number | null = null;
  shopId: number | null = null;
  city = '';
  pincode = '';
  radius: number | null = null;
  pricingType: PricingType | '' = '';
  bookingType: BookingType | '' = '';
  homeService = false;
  hasOffer = false;
  sort: ServiceSort = 'newest';
  page = 1;

  private readonly searchInput$ = new Subject<string>();
  readonly activeFilterCount = computed(() => this.countActiveFilters());
  private readonly filterTick = signal(0);

  // ---- Category chips -----------------------------------------------------
  //
  // Same treatment as the offers listing: two dozen categories in one sideways
  // scroller is a wall of pills, so the strip shows the ones worth scanning and
  // folds the rest behind a disclosure.

  readonly chipLimit = 8;
  readonly categoriesExpanded = signal(false);

  /** Busiest first, with the category in effect pinned so it is never folded. */
  readonly orderedCategories = computed(() => {
    this.filterTick();
    const active = this.categoryId;
    return [...this.categories()].sort((a, b) => {
      if (a.id === active) return -1;
      if (b.id === active) return 1;
      const byCount = (b.serviceCount ?? 0) - (a.serviceCount ?? 0);
      return byCount !== 0 ? byCount : a.name.localeCompare(b.name);
    });
  });

  readonly foldedCategoryCount = computed(() =>
    Math.max(0, this.orderedCategories().length - this.chipLimit),
  );

  constructor() {
    this.searchInput$.pipe(debounceTime(350), distinctUntilChanged()).subscribe((value) => {
      this.search = value;
      this.page = 1;
      this.applyToUrl();
    });

    this.route.queryParamMap.subscribe((params) => {
      this.search = params.get('search') ?? '';
      this.categoryId = this.num(params.get('categoryId'));
      this.shopId = this.num(params.get('shopId'));
      this.city = params.get('city') ?? '';
      this.pincode = params.get('pincode') ?? '';
      this.pricingType = (params.get('pricingType') as PricingType | null) ?? '';
      this.bookingType = (params.get('bookingType') as BookingType | null) ?? '';
      this.homeService = params.get('homeService') === 'true';
      this.hasOffer = params.get('hasOffer') === 'true';
      this.radius = this.num(params.get('radius'));
      this.page = this.num(params.get('page')) ?? 1;
      this.sort = (params.get('sort') as ServiceSort | null) ?? 'newest';

      this.filterTick.update((tick) => tick + 1);
      this.load();
    });

    this.api.listCategories().subscribe((categories) => this.categories.set(categories));
    this.api.listShops({ limit: 100, sort: 'name' }).subscribe((page) => this.shops.set(page.items));
  }

  private load(): void {
    this.loading.set(true);
    const position = this.locations.position;

    const query: ServiceQuery = {
      page: this.page,
      limit: environment.pageSize,
      search: this.search || undefined,
      categoryId: this.categoryId ?? undefined,
      shopId: this.shopId ?? undefined,
      city: this.city || undefined,
      pincode: this.pincode || undefined,
      pricingType: this.pricingType || undefined,
      bookingType: this.bookingType || undefined,
      homeService: this.homeService || undefined,
      hasOffer: this.hasOffer || undefined,
      sort: this.sort,
    };

    if (position) {
      query.latitude = position.latitude!;
      query.longitude = position.longitude!;
      if (this.radius) query.radius = this.radius;
    } else if (this.sort === 'nearest') {
      query.sort = 'newest';
    }

    this.api.listServices(query).subscribe({
      next: (result) => {
        this.services.set(result.items);
        this.meta.set(result.meta);
        this.loading.set(false);
      },
      error: () => {
        this.services.set([]);
        this.meta.set(null);
        this.loading.set(false);
      },
    });
  }

  onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  setCategory(id: number | null): void {
    this.categoryId = this.categoryId === id ? null : id;
    this.page = 1;
    this.applyToUrl();
  }

  setSort(sort: ServiceSort): void {
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
    this.radius = null;
    this.pricingType = '';
    this.bookingType = '';
    this.homeService = false;
    this.hasOffer = false;
    this.sort = 'newest';
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
    setTimeout(() => this.load(), 900);
  }

  pickCity(city: (typeof SUGGESTED_CITIES)[number]): void {
    this.locations.selectCity(city);
    this.load();
  }

  toggleSave(service: Service): void {
    const request = service.isSaved ? this.api.unsaveService(service.id) : this.api.saveService(service.id);

    this.patchService(service.id, { isSaved: !service.isSaved });
    request.subscribe({
      next: () => this.toast.success(service.isSaved ? 'Removed from saved' : 'Saved'),
      error: () => this.patchService(service.id, { isSaved: service.isSaved }),
    });
  }

  /** §5/§7: overlay over the list, then the save is replayed after login. */
  promptLogin(service: Service): void {
    this.prompt.require('save-service', () => this.toggleSave(service));
  }

  private patchService(id: number, changes: Partial<Service>): void {
    this.services.update((list) => list.map((service) => (service.id === id ? { ...service, ...changes } : service)));
  }

  private applyToUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.search || null,
        categoryId: this.categoryId,
        shopId: this.shopId,
        city: this.city || null,
        pincode: this.pincode || null,
        radius: this.radius,
        pricingType: this.pricingType || null,
        bookingType: this.bookingType || null,
        homeService: this.homeService || null,
        hasOffer: this.hasOffer || null,
        sort: this.sort,
        page: this.page > 1 ? this.page : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private countActiveFilters(): number {
    this.filterTick();
    let count = 0;
    if (this.categoryId) count++;
    if (this.shopId) count++;
    if (this.city) count++;
    if (this.pincode) count++;
    if (this.pricingType) count++;
    if (this.bookingType) count++;
    if (this.homeService) count++;
    if (this.hasOffer) count++;
    if (this.radius) count++;
    return count;
  }

  private num(value: string | null): number | null {
    if (value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
