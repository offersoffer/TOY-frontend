import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ToastService } from '../../../core/toast.service';
import { PERMISSIONS } from '../../../core/permissions';
import {
  FeaturedCampaign,
  FeaturedCampaignPerformance,
  Shop,
  VisibilityDashboard,
  VisibilityPremiumInsights,
  VisibilitySurface,
} from '../../../core/models';

/**
 * Merchant → Visibility & reach (§15, §16, §17, §27).
 *
 * §27 says what this screen is for: the merchant should be able to see how many
 * people saw their offers, how many opened them, saved them, claimed them and
 * redeemed them, *where* customers discovered them, and which campaigns worked.
 *
 * ## Two decisions worth keeping
 *
 * The funnel shows each stage as a percentage of the stage above it, not of
 * impressions. "3% of the people who opened it saved it" is a number a merchant
 * can act on; "0.4% of impressions became saves" mostly measures how many lists
 * the offer appeared in.
 *
 * Organic and featured figures are shown separately wherever both exist. §20
 * requires that promotion must not falsify organic analytics, and a merchant
 * who cannot tell the two apart cannot judge whether the promotion was worth
 * it — which is the only question they are asking.
 */
@Component({
  selector: 'app-visibility-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <h1>Visibility &amp; reach</h1>
          <p class="subtitle">Where your offers were shown, and what happened next.</p>
        </div>
        <div class="row gap">
          @if (shops().length > 1) {
            <select [ngModel]="shopId()" (ngModelChange)="selectShop(+$event)" aria-label="Shop">
              @for (shop of shops(); track shop.id) {
                <option [value]="shop.id">{{ shop.name }}</option>
              }
            </select>
          }
          <select [ngModel]="days()" (ngModelChange)="setDays(+$event)" aria-label="Period">
            <option [value]="7">Last 7 days</option>
            <option [value]="30">Last 30 days</option>
            <option [value]="90">Last 90 days</option>
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="skeleton" style="height: 420px"></div>
      } @else if (!dashboard()) {
        <section class="card">
          <div class="card-body">
            <p class="strong">Visibility analytics are not on your current plan.</p>
            <p class="small subtle">
              Standard visibility reporting comes with Business, and the branch, location, timing and
              campaign breakdowns with Premium.
            </p>
            <a class="btn btn-secondary btn-sm" routerLink="/admin/subscription">See plans</a>
          </div>
        </section>
      } @else if (dashboard(); as data) {
        <!-- §21's wording, and where this merchant's level comes from. -->
        <section class="card mb-2">
          <div class="card-body promise">
            <div>
              <p class="strong">
                Visibility level:
                <span class="badge" [class]="levelBadge(data.visibilityLevel)">
                  {{ data.visibilityLevel ?? 'BASIC' }}
                </span>
                @if (data.visibilitySource) {
                  <span class="small subtle"> · from your {{ sourceLabel(data.visibilitySource) }}</span>
                }
              </p>
              <p class="small subtle">{{ data.promise.explanation }}</p>
            </div>
          </div>
        </section>

        <!-- §15 Overview -->
        <div class="tiles mb-2">
          <div class="tile">
            <p class="value">{{ data.overview.impressions | number }}</p>
            <p class="label">Times shown</p>
            <p class="sub small subtle">
              {{ data.overview.organicImpressions | number }} organic ·
              {{ data.overview.featuredImpressions | number }} promoted
            </p>
          </div>
          <div class="tile">
            <p class="value">{{ data.overview.views | number }}</p>
            <p class="label">Opened</p>
          </div>
          <div class="tile">
            <p class="value">{{ data.overview.saves | number }}</p>
            <p class="label">Saved</p>
          </div>
          <div class="tile">
            <p class="value">{{ data.overview.claims | number }}</p>
            <p class="label">Claimed</p>
          </div>
          <div class="tile">
            <p class="value">{{ data.overview.redemptions | number }}</p>
            <p class="label">Redeemed</p>
          </div>
          <div class="tile">
            <p class="value">{{ data.overview.profileVisits | number }}</p>
            <p class="label">Shop visits</p>
          </div>
          <div class="tile">
            <p class="value">{{ data.overview.directionsClicks | number }}</p>
            <p class="label">Directions</p>
          </div>
          <div class="tile">
            <p class="value">{{ data.overview.searchAppearances | number }}</p>
            <p class="label">Search appearances</p>
          </div>
        </div>

        <div class="split">
          <!-- §15 Visibility -->
          <section class="card">
            <div class="card-header">
              <h2>Where you were shown</h2>
              <!-- §20 requires promotion never to be mistaken for organic
                   reach, so the split is labelled as well as coloured. -->
              <p class="legend small subtle">
                <span class="key organic"></span> organic
                <span class="key featured"></span> promoted
              </p>
            </div>
            <div class="card-body">
              @if (!surfaceRows().length) {
                <p class="small subtle">No impressions recorded in this period yet.</p>
              } @else {
                <ul class="bars">
                  @for (row of surfaceRows(); track row.surface) {
                    <li>
                      <div class="bar-head">
                        <span>{{ surfaceLabel(row.surface) }}</span>
                        <span class="strong">{{ row.total | number }}</span>
                      </div>
                      <div class="bar">
                        <span class="organic" [style.width.%]="row.organicPercent"></span>
                        <span class="featured" [style.width.%]="row.featuredPercent"></span>
                      </div>
                      @if (row.featured) {
                        <p class="small subtle">
                          {{ row.organic | number }} organic · {{ row.featured | number }} promoted
                        </p>
                      }
                    </li>
                  }
                </ul>
              }

              @if (data.visibility.averagePosition !== null) {
                <p class="small subtle position">
                  Average position <span class="strong">{{ data.visibility.averagePosition }}</span>
                  @if (data.visibility.positionRange; as range) {
                    · ranged from {{ range.best }} to {{ range.worst }}
                  }
                </p>
              }
            </div>
          </section>

          <!-- §15 Funnel -->
          <section class="card">
            <div class="card-header"><h2>What happened next</h2></div>
            <div class="card-body">
              <ul class="funnel">
                @for (stage of data.funnel.stages; track stage.key) {
                  <li>
                    <div class="bar-head">
                      <span>{{ stage.label }}</span>
                      <span>
                        <span class="strong">{{ stage.value | number }}</span>
                        @if (stage.rateFromPrevious !== null) {
                          <span class="small subtle"> · {{ stage.rateFromPrevious }}% of previous</span>
                        }
                      </span>
                    </div>
                    <div class="bar">
                      <span class="organic" [style.width.%]="funnelWidth(stage.value)"></span>
                    </div>
                  </li>
                }
              </ul>
              @if (data.funnel.overallConversion !== null) {
                <p class="small subtle position">
                  {{ data.funnel.overallConversion }}% of the times you were shown ended in a
                  redemption.
                </p>
              }
            </div>
          </section>
        </div>

        @if (data.visibility.byCategory.length) {
          <section class="card mt-2">
            <div class="card-header"><h2>Categories you appeared in</h2></div>
            <div class="card-body">
              <ul class="ranked small">
                @for (row of data.visibility.byCategory; track row.categoryId) {
                  <li>
                    <span>{{ row.categoryName ?? 'Uncategorised' }}</span>
                    <span class="strong">{{ row.impressions | number }}</span>
                  </li>
                }
              </ul>
            </div>
          </section>
        }

        <!-- §17 Campaign performance -->
        @if (campaigns().length) {
          <section class="card mt-2">
            <div class="card-header"><h2>Campaign performance</h2></div>
            <div class="card-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>Views</th>
                      <th>Saves</th>
                      <th>Claims</th>
                      <th>Redemptions</th>
                      <th>Click rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of campaigns(); track row.campaign.id) {
                      <tr>
                        <td class="strong">{{ row.campaign.name }}</td>
                        <td>{{ row.performance.totals.impressions | number }}</td>
                        <td>{{ row.performance.totals.bannerClicks | number }}</td>
                        <td>{{ row.performance.totals.offerViews | number }}</td>
                        <td>{{ row.performance.totals.saves | number }}</td>
                        <td>{{ row.performance.totals.claims | number }}</td>
                        <td>{{ row.performance.totals.redemptions | number }}</td>
                        <td>
                          {{
                            row.performance.rates.clickThrough === null
                              ? '—'
                              : row.performance.rates.clickThrough + '%'
                          }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        }

        <!-- §16 Premium-only breakdowns -->
        @if (premium(); as extra) {
          <div class="split mt-2">
            @if (extra.byLocation.length) {
              <section class="card">
                <div class="card-header"><h2>Where your customers are</h2></div>
                <div class="card-body">
                  <ul class="ranked small">
                    @for (row of extra.byLocation; track row.city) {
                      <li>
                        <span>{{ row.city }}</span>
                        <span class="strong">{{ row.impressions | number }}</span>
                      </li>
                    }
                  </ul>
                </div>
              </section>
            }

            @if (extra.searchPerformance.length) {
              <section class="card">
                <div class="card-header"><h2>What they searched for</h2></div>
                <div class="card-body">
                  <ul class="ranked small">
                    @for (row of extra.searchPerformance; track row.term) {
                      <li>
                        <span>{{ row.term }}</span>
                        <span class="strong">
                          {{ row.appearances | number }}
                          @if (row.clickThroughRate !== null) {
                            <span class="subtle"> · {{ row.clickThroughRate }}%</span>
                          }
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              </section>
            }

            @if (extra.bestPerformingHours.length) {
              <section class="card">
                <div class="card-header"><h2>When they were looking</h2></div>
                <div class="card-body">
                  <ul class="hours">
                    @for (row of extra.bestPerformingHours; track row.hour) {
                      <li>
                        <div class="hour-bar">
                          <span [style.height.%]="hourHeight(row.events)"></span>
                        </div>
                        <span class="small subtle">{{ hourLabel(row.hour) }}</span>
                      </li>
                    }
                  </ul>
                </div>
              </section>
            }

            @if (extra.bestPerformingOffers.length) {
              <section class="card">
                <div class="card-header"><h2>Your best offers</h2></div>
                <div class="card-body">
                  <ul class="ranked small">
                    @for (row of extra.bestPerformingOffers; track row.listingId) {
                      <li>
                        <span>{{ row.title ?? listingLabel(row) }}</span>
                        <span class="strong">
                          {{ row.redemptions | number }} redeemed
                          <span class="subtle">· {{ row.views | number }} views</span>
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              </section>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .row.gap {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .promise p {
        margin: 0 0 0.25rem;
      }

      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
        gap: 0.75rem;
      }

      .tile {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.9rem 1rem;
      }

      .tile .value {
        margin: 0;
        font-size: 1.65rem;
        font-weight: 780;
        font-variant-numeric: tabular-nums;
      }

      .tile .label {
        margin: 0.1rem 0 0;
        color: var(--text-muted);
        font-size: 0.78rem;
      }

      .tile .sub {
        margin: 0.3rem 0 0;
      }

      .split {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
        gap: 1rem;
      }

      .bars,
      .funnel {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.9rem;
      }

      .bar-head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: baseline;
        margin-bottom: 0.3rem;
      }

      .bar {
        height: 8px;
        border-radius: 4px;
        background: var(--border);
        overflow: hidden;
        display: flex;
      }

      .bar span {
        display: block;
        height: 100%;
      }

      .bar .organic {
        background: var(--brand);
      }

      .bar .featured {
        background: var(--accent, #fb923c);
      }

      .legend {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        margin: 0;
      }

      .key {
        display: inline-block;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 2px;
      }

      .key.organic {
        background: var(--brand);
      }

      .key.featured {
        background: var(--accent, #fb923c);
      }

      .position {
        margin: 0.9rem 0 0;
      }

      .ranked {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.35rem;
      }

      .ranked li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      }

      .hours {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        gap: 0.25rem;
        align-items: flex-end;
      }

      .hours li {
        flex: 1;
        display: grid;
        gap: 0.25rem;
        justify-items: center;
      }

      .hour-bar {
        width: 100%;
        height: 60px;
        display: flex;
        align-items: flex-end;
        background: var(--border);
        border-radius: 3px;
        overflow: hidden;
      }

      .hour-bar span {
        width: 100%;
        background: var(--brand);
      }

      .mt-2 {
        margin-top: 1rem;
      }
    `,
  ],
})
export class VisibilityDashboardComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly shops = signal<Shop[]>([]);
  readonly shopId = signal<number | null>(null);
  readonly days = signal(30);
  readonly dashboard = signal<VisibilityDashboard | null>(null);
  readonly premium = signal<VisibilityPremiumInsights | null>(null);
  readonly campaigns = signal<
    { campaign: FeaturedCampaign; performance: FeaturedCampaignPerformance }[]
  >([]);
  readonly loading = signal(true);

  constructor() {
    this.api
      .listShops(
        this.auth.isSuperAdmin
          ? { limit: 100, status: 'all', sort: 'name' }
          : { mine: true, limit: 100, status: 'all', sort: 'name' },
      )
      .subscribe({
        next: (page) => {
          const allowed = page.items.filter((shop) =>
            this.auth.hasForShop(shop.id, PERMISSIONS.VIEW_VISIBILITY_ANALYTICS),
          );
          const shops = allowed.length ? allowed : page.items;
          this.shops.set(shops);
          if (shops.length) this.selectShop(shops[0].id);
          else this.reload();
        },
        error: () => this.reload(),
      });
  }

  selectShop(shopId: number): void {
    this.shopId.set(shopId);
    this.reload();
  }

  setDays(days: number): void {
    this.days.set(days);
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    const query = { shopId: this.shopId() ?? undefined, days: this.days() };

    this.api.visibilityDashboard(query).subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.loading.set(false);
      },
      error: () => {
        // A 403 here means the plan does not include it, which the template
        // already explains. Anything else is worth a toast.
        this.dashboard.set(null);
        this.loading.set(false);
      },
    });

    // §16 and §17 are separate entitlements, so each is asked for on its own
    // and simply stays absent when the plan does not cover it. One combined
    // request would make a Business merchant's whole page fail on the Premium
    // half of it.
    this.api.visibilityPremium(query).subscribe({
      next: (data) => this.premium.set(data),
      error: () => this.premium.set(null),
    });

    this.api.visibilityCampaignPerformance(query).subscribe({
      next: (data) => this.campaigns.set(data.campaigns),
      error: () => this.campaigns.set([]),
    });
  }

  // ---- Presentation -------------------------------------------------------

  readonly surfaceRows = computed(() => {
    const data = this.dashboard();
    if (!data) return [];
    const rows = Object.entries(data.visibility.bySurface)
      .map(([surface, counts]) => ({
        surface: surface as VisibilitySurface,
        organic: counts.organic,
        featured: counts.featured,
        total: counts.organic + counts.featured,
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);

    const max = Math.max(...rows.map((row) => row.total), 1);
    return rows.map((row) => ({
      ...row,
      organicPercent: (row.organic / max) * 100,
      featuredPercent: (row.featured / max) * 100,
    }));
  });

  funnelWidth(value: number): number {
    const top = this.dashboard()?.funnel.stages[0]?.value ?? 0;
    return top > 0 ? (value / top) * 100 : 0;
  }

  /**
   * A readable clock label. A bare "12" is ambiguous between noon and midnight,
   * and a merchant reading "when they were looking" needs to know which.
   */
  hourLabel(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  }

  /** Fallback when a listing has since been deleted and has no title left. */
  listingLabel(row: { listingType: string; listingId: number }): string {
    const kind = row.listingType === 'service_offer' ? 'Service offer' : 'Offer';
    return `${kind} #${row.listingId} (removed)`;
  }

  hourHeight(events: number): number {
    const max = Math.max(...(this.premium()?.bestPerformingHours ?? []).map((row) => row.events), 1);
    return (events / max) * 100;
  }

  surfaceLabel(surface: VisibilitySurface): string {
    return (
      {
        SEARCH: 'Search results',
        NEAR_ME: 'Near Me',
        HOME: 'Home feed',
        CATEGORY: 'Category browsing',
        ENDING_SOON: 'Ending Soon',
      } as Record<VisibilitySurface, string>
    )[surface];
  }

  sourceLabel(source: string): string {
    if (source === 'plan+override') return 'plan and a platform grant';
    if (source === 'override') return 'platform grant';
    return 'plan';
  }

  levelBadge(level: string | null): string {
    if (level === 'PRIORITY') return 'badge-brand';
    if (level === 'ENHANCED') return 'badge-info';
    return '';
  }
}
