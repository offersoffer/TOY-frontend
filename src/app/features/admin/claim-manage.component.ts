import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RegistrationReviewService, ReviewClaim } from '../../core/registration-review.service';
import { ToastService } from '../../core/toast.service';
import { PageMeta } from '../../core/models';
import { EmptyStateComponent, PaginationComponent } from '../../shared/ui.components';
import { IconComponent } from '../../shared/icon.component';

/**
 * Requests to manage a shop we already have (Self-Service Onboarding §16).
 *
 * The decision here is a different question from a registration's. There,
 * the question is "is this business real"; here the business is plainly real
 * and the question is "is this person connected to it" - which is why the
 * claimant's own words are the main thing on each card rather than a detail
 * behind a click.
 *
 * Approving adds a manager. It never removes one: §16 says existing managers
 * must not be dropped automatically, and the backend is what guarantees that
 * - this screen simply has no control that could.
 */
@Component({
  selector: 'app-claim-manage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, PaginationComponent, EmptyStateComponent, IconComponent],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <h1>Shop claims</h1>
          <p class="subtitle">
            People asking to manage a shop we already have. Approving adds them to the team; it
            does not remove anyone.
          </p>
        </div>
        <p><a routerLink="/admin/registrations" class="btn btn-secondary btn-sm">Registrations</a></p>
      </div>

      <div class="chips">
        @for (tab of tabs; track tab.value) {
          <button
            type="button"
            class="chip"
            [class.active]="status === tab.value"
            [attr.aria-pressed]="status === tab.value"
            (click)="setStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="skeleton" style="height: 280px"></div>
      } @else if (claims().length === 0) {
        <app-empty-state icon="key-outline" title="Nothing to decide" message="No claims match this filter." />
      } @else {
        <div class="stack">
          @for (claim of claims(); track claim.id) {
            <article class="card">
              <div class="card-body">
                <div class="head">
                  <div>
                    <strong>{{ claim.shopName }}</strong>
                    <span class="small muted d-block">
                      @if (claim.requester) {
                        Asked by {{ claim.requester.name }} · {{ claim.requester.email }}
                      }
                      @if (claim.contactPhone) {
                        · {{ claim.contactPhone }}
                      }
                      · {{ claim.createdAt | date: 'd MMM y' }}
                    </span>
                  </div>
                  <span
                    class="badge"
                    [class.badge-success]="claim.status === 'APPROVED'"
                    [class.badge-warning]="claim.status === 'PENDING'"
                    [class.badge-danger]="claim.status === 'REJECTED'"
                  >
                    {{ claim.status | lowercase }}
                  </span>
                </div>

                <!-- Their case, in their words. This is the evidence. -->
                <blockquote>{{ claim.reason }}</blockquote>

                @if (claim.decisionReason) {
                  <p class="small muted">Decision: {{ claim.decisionReason }}</p>
                }

                @if (claim.status === 'PENDING') {
                  <div class="row">
                    <a class="btn btn-ghost btn-sm" [routerLink]="['/shops', claim.shopSlug]" target="_blank">
                      <app-icon name="storefront-outline" [size]="14" /> Look at the shop
                    </a>
                    <span class="spacer"></span>
                    <button type="button" class="btn btn-sm" [disabled]="busy()" (click)="approve(claim)">
                      Approve and grant access
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="startReject(claim)">
                      Reject
                    </button>
                  </div>

                  @if (rejecting()?.id === claim.id) {
                    <div class="reject">
                      <label class="field">
                        <span>Why? *</span>
                        <textarea
                          rows="3"
                          [ngModel]="reason()"
                          (ngModelChange)="reason.set($event)"
                          placeholder="e.g. We could not confirm you are connected to this business. Send us a utility bill or GST certificate in the shop's name."
                        ></textarea>
                        <span class="hint">The person who asked reads this word for word.</span>
                      </label>
                      <div class="row">
                        <button
                          type="button"
                          class="btn btn-sm"
                          [disabled]="reason().trim().length < 10 || busy()"
                          (click)="reject(claim)"
                        >
                          Reject this claim
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm" (click)="rejecting.set(null)">
                          Cancel
                        </button>
                      </div>
                    </div>
                  }
                }
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
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 1.25rem;
      }
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }
      .d-block {
        display: block;
      }
      blockquote {
        margin: 0 0 0.9rem;
        padding-left: 0.8rem;
        border-left: 3px solid var(--border);
        color: var(--text);
        overflow-wrap: anywhere;
      }
      .reject {
        margin-top: 0.9rem;
        padding-top: 0.9rem;
        border-top: 1px solid var(--border);
      }
      .spacer {
        flex: 1;
      }
    `,
  ],
})
export class ClaimManageComponent {
  private readonly reviews = inject(RegistrationReviewService);
  private readonly toast = inject(ToastService);

  readonly tabs = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'WITHDRAWN', label: 'Withdrawn' },
    { value: '', label: 'All' },
  ];

  readonly claims = signal<ReviewClaim[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly rejecting = signal<ReviewClaim | null>(null);
  /** A signal, so the computed-free disabled binding still tracks typing. */
  readonly reason = signal('');

  status = 'PENDING';
  page = 1;

  constructor() {
    this.load();
  }

  setStatus(status: string): void {
    this.status = status;
    this.page = 1;
    this.load();
  }

  goToPage(page: number): void {
    this.page = page;
    this.load();
  }

  startReject(claim: ReviewClaim): void {
    this.rejecting.set(this.rejecting()?.id === claim.id ? null : claim);
    this.reason.set('');
  }

  approve(claim: ReviewClaim): void {
    this.busy.set(true);
    this.reviews.approveClaim(claim.id).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.busy.set(false);
        this.toast.success(`${updated.requester?.name ?? 'They'} can now manage ${updated.shopName}.`);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(err?.error?.error?.message ?? 'We could not approve that claim.');
      },
    });
  }

  reject(claim: ReviewClaim): void {
    const reason = this.reason().trim();
    if (reason.length < 10) return;
    this.busy.set(true);
    this.reviews.rejectClaim(claim.id, reason).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.busy.set(false);
        this.rejecting.set(null);
        this.reason.set('');
        this.toast.success('Claim rejected. They have been told why.');
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(err?.error?.error?.message ?? 'We could not reject that claim.');
      },
    });
  }

  private replace(updated: ReviewClaim): void {
    this.claims.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  }

  private load(): void {
    this.loading.set(true);
    this.reviews.listClaims({ status: this.status, page: this.page, limit: 20 }).subscribe({
      next: (page) => {
        this.claims.set(page.items);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        this.claims.set([]);
        this.loading.set(false);
      },
    });
  }
}
