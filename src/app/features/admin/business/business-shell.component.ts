import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ApiService } from '../../../core/api.service';
import { HealthAlert } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { BusinessFiltersService } from './business-filters.service';

/**
 * The Business Dashboard shell (§3's navigation).
 *
 * The alert strip lives here rather than on the Platform Health page, because
 * §59's whole point is that a Super Admin should not have to be looking at
 * Platform Health to find out that payments are failing. It polls quietly and
 * says nothing at all when there is nothing wrong.
 */
@Component({
  selector: 'app-business-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="container page business-shell">
      <div class="page-header">
        <div>
          <h1>Business dashboard</h1>
          <p class="subtitle">How is the OffersOffer business performing?</p>
        </div>
        <span class="badge badge-brand">Super Admin only</span>
      </div>

      @if (alerts().length) {
        <div class="alerts mb-2">
          @for (alert of alerts(); track alert.key) {
            <div class="alert" [class.critical]="alert.severity === 'critical'">
              <app-icon
                class="icon"
                [name]="alert.severity === 'critical' ? 'alert-circle-outline' : 'warning-outline'"
                [size]="17"
              />
              <div class="body">
                <strong>{{ alert.title }}</strong>
                <span class="small">{{ alert.message }}</span>
              </div>
              @if (alert.action) {
                <a class="btn btn-secondary btn-sm" [routerLink]="alert.action.route">
                  {{ alert.action.label }}
                </a>
              }
            </div>
          }
        </div>
      }

      <nav class="tabs" aria-label="Business dashboard sections">
        @for (tab of tabs; track tab.route) {
          <a [routerLink]="tab.route" routerLinkActive="active">{{ tab.label }}</a>
        }
      </nav>

      <router-outlet />
    </div>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 0.2rem;
        overflow-x: auto;
        border-bottom: 1px solid var(--border);
        margin-bottom: 1rem;
        scrollbar-width: thin;
      }

      .tabs a {
        padding: 0.55rem 0.85rem;
        white-space: nowrap;
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--text-muted);
        border-bottom: 2px solid transparent;
        transition:
          color var(--fast) var(--ease),
          border-color var(--fast) var(--ease),
          background var(--fast) var(--ease);
      }

      .tabs a:hover {
        color: var(--text);
        background: var(--surface-alt);
        text-decoration: none;
      }

      .tabs a.active {
        color: var(--brand-strong);
        border-bottom-color: var(--brand);
      }

      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .alerts {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      /* Severity is a left rail plus the glyph, not a colour wash: it has to
         read the same in both themes and without colour vision. */
      .alert {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 0.85rem;
        border: 1px solid var(--border);
        border-left: 3px solid var(--warning);
        border-radius: var(--radius-sm);
        background: var(--warning-bg);
      }

      .alert.critical {
        border-left-color: var(--danger);
        background: var(--danger-bg, var(--warning-bg));
      }

      .alert .icon {
        flex: none;
      }

      .alert .body {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
    `,
  ],
})
export class BusinessShellComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly filters = inject(BusinessFiltersService);

  readonly alerts = signal<HealthAlert[]>([]);

  /** §3's navigation, in the order the requirements list it. */
  protected readonly tabs = [
    { label: 'Overview', route: 'overview' },
    { label: 'Customers', route: 'customers' },
    { label: 'Merchants', route: 'merchants' },
    { label: 'Offer performance', route: 'offers' },
    { label: 'Conversion funnel', route: 'funnel' },
    { label: 'Retention', route: 'retention' },
    { label: 'Subscriptions', route: 'subscriptions' },
    { label: 'Revenue', route: 'revenue' },
    { label: 'Cities & categories', route: 'segments' },
    { label: 'Platform health', route: 'health' },
  ];

  /**
   * Two minutes. Fast enough that an incident surfaces while someone is still
   * at the screen, slow enough that leaving the tab open all afternoon is not
   * a self-inflicted load test - and every one of these probes touches the
   * database.
   */
  private readonly poll = setInterval(() => this.loadAlerts(), 120_000);

  constructor() {
    this.filters.loadOptions();
    this.loadAlerts();
  }

  ngOnDestroy(): void {
    clearInterval(this.poll);
  }

  private loadAlerts(): void {
    this.api.platformAlerts().subscribe({
      next: (result) => this.alerts.set(result.alerts),
      // A failing alert poll must not put an error on top of whatever page the
      // administrator is actually reading. The Platform Health tab is where a
      // broken health check becomes visible.
      error: () => undefined,
    });
  }
}
