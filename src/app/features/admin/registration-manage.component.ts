import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  RegistrationQuery,
  RegistrationReviewService,
  RegistrationRow,
} from '../../core/registration-review.service';
import { VerificationStatus } from '../../core/onboarding.service';
import { PageMeta } from '../../core/models';
import { EmptyStateComponent, PaginationComponent } from '../../shared/ui.components';
import { IconComponent } from '../../shared/icon.component';
import { VerificationBadgeComponent } from '../../shared/verification-badge.component';

/**
 * Seller Management → Registrations (Self-Service Onboarding §14).
 *
 * The queue a reviewer works from. Oldest submission first, which the backend
 * decides rather than this screen: a queue sorted newest-first quietly
 * starves whoever has been waiting longest, and that is the one thing §25's
 * "pending verification age" metric exists to catch.
 *
 * Nothing here is an access check. Every filter and every action is enforced
 * again by the API behind a global permission, and §13 is explicit that
 * hiding a control in the frontend is never the control.
 */
@Component({
  selector: 'app-registration-manage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PaginationComponent,
    EmptyStateComponent,
    IconComponent,
    VerificationBadgeComponent,
  ],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <h1>Seller registrations</h1>
          <p class="subtitle">
            Shops people registered themselves. Approve, reject, or ask for more before they
            reach customers.
          </p>
        </div>
      </div>

      <div class="filters card">
        <div class="chips">
          @for (tab of tabs; track tab.value) {
            <button
              type="button"
              class="chip"
              [class.active]="query.status === tab.value"
              [attr.aria-pressed]="query.status === tab.value"
              (click)="setStatus(tab.value)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="row gap">
          <label class="field inline">
            <span class="sr-only">Search</span>
            <input
              type="search"
              placeholder="Shop, phone, or owner"
              [(ngModel)]="query.q"
              (keydown.enter)="reload()"
            />
          </label>

          <label class="field inline">
            <span class="sr-only">Registration source</span>
            <select [(ngModel)]="query.source" (change)="reload()">
              <option value="">Any source</option>
              <option value="SELF_REGISTERED">Self-registered</option>
              <option value="EXISTING_SHOP_CLAIM">Claimed existing shop</option>
              <option value="ADMIN_CREATED">Created by our team</option>
            </select>
          </label>

          <label class="field inline">
            <span class="sr-only">Listing</span>
            <select [(ngModel)]="query.listingStatus" (change)="reload()">
              <option value="">Any listing</option>
              <option value="active">Live</option>
              <option value="inactive">Not live</option>
            </select>
          </label>

          <button type="button" class="btn btn-secondary btn-sm" (click)="reload()">Apply</button>
        </div>
      </div>

      @if (loading()) {
        <div class="skeleton" style="height: 320px"></div>
      } @else if (rows().length === 0) {
        <app-empty-state
          icon="storefront-outline"
          title="Nothing here"
          message="No registrations match these filters."
        />
      } @else {
        <div class="stack">
          @for (row of rows(); track row.shopId) {
            <article class="card reg">
              <div class="card-body">
                <div class="head">
                  <div class="who">
                    <a class="name" [routerLink]="['/admin/registrations', row.shopId]">{{ row.name }}</a>
                    <p class="small muted">
                      @if (row.owner) {
                        {{ row.owner.name }} · {{ row.owner.email }}
                      } @else {
                        No active owner
                      }
                    </p>
                  </div>
                  <app-verification-badge [status]="row.verificationStatus" />
                </div>

                <dl class="facts">
                  <div>
                    <dt>Contact</dt>
                    <dd>{{ row.contactNumber || '—' }}</dd>
                  </div>
                  <div>
                    <dt>Where</dt>
                    <dd>
                      {{ row.city || '—' }}@if (row.pincode) { · {{ row.pincode }} }
                      <!-- §7: a pin that was never confirmed is the single
                           most common reason to send a registration back, so
                           it is on the row rather than one click away. -->
                      @if (!row.locationConfirmed) {
                        <span class="warn">
                          <app-icon name="alert-circle-outline" [size]="13" /> pin not confirmed
                        </span>
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{{ row.categories.length ? row.categories.join(', ') : '—' }}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      {{ row.submittedAt ? (row.submittedAt | date: 'd MMM y') : 'Not yet' }}
                      @if (waitingDays(row); as days) {
                        <span class="small muted">· waiting {{ days }}d</span>
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Listing</dt>
                    <dd>{{ row.status === 'active' ? 'Live' : 'Not live' }}</dd>
                  </div>
                </dl>

                <div class="row">
                  <a class="btn btn-sm" [routerLink]="['/admin/registrations', row.shopId]">Review</a>
                  @if (row.reviewer) {
                    <span class="small muted">Last decided by {{ row.reviewer.name }}</span>
                  }
                </div>
              </div>
            </article>
          }
        </div>

        <app-pagination [meta]="meta()" (pageChange)="goToPage($event)" />
      }
    </div>
  `,
  styles: [
    `
      .filters {
        padding: 1rem;
        margin-bottom: 1.25rem;
        display: grid;
        gap: 0.75rem;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .row.gap {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        align-items: center;
      }
      .field.inline {
        margin: 0;
        min-width: 10rem;
        flex: 1 1 10rem;
      }

      .reg .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.9rem;
      }
      .reg .name {
        font-weight: 700;
        font-size: 1.05rem;
      }

      .facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem 1rem;
        margin: 0 0 1rem;
      }
      .facts dt {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
      }
      .facts dd {
        margin: 0.15rem 0 0;
        overflow-wrap: anywhere;
      }

      .warn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin-left: 0.4rem;
        color: var(--warning);
        font-size: 0.8rem;
        white-space: nowrap;
      }
    `,
  ],
})
export class RegistrationManageComponent {
  private readonly reviews = inject(RegistrationReviewService);

  /** §14's filters. "All" means every registration, not every shop. */
  readonly tabs: { value: VerificationStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'PENDING_VERIFICATION', label: 'Pending' },
    { value: 'ADDITIONAL_INFO_REQUIRED', label: 'Info requested' },
    { value: 'VERIFIED', label: 'Verified' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'DRAFT', label: 'Unfinished drafts' },
  ];

  readonly rows = signal<RegistrationRow[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly loading = signal(true);

  query: RegistrationQuery = { page: 1, limit: 20, status: 'PENDING_VERIFICATION' };

  constructor() {
    this.load();
  }

  setStatus(status: VerificationStatus | ''): void {
    this.query = { ...this.query, status, page: 1 };
    this.load();
  }

  reload(): void {
    this.query = { ...this.query, page: 1 };
    this.load();
  }

  goToPage(page: number): void {
    this.query = { ...this.query, page };
    this.load();
  }

  /** How long this one has been waiting, for the queue-age signal in §25. */
  waitingDays(row: RegistrationRow): number | null {
    if (!row.submittedAt || row.verificationStatus !== 'PENDING_VERIFICATION') return null;
    const days = Math.floor((Date.now() - new Date(row.submittedAt).getTime()) / 86_400_000);
    return days > 0 ? days : null;
  }

  private load(): void {
    this.loading.set(true);
    this.reviews.list(this.query).subscribe({
      next: (page) => {
        this.rows.set(page.items);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }
}
