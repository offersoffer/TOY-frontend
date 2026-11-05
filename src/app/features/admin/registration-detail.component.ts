import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  RegistrationDetail,
  RegistrationReviewService,
} from '../../core/registration-review.service';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { VerificationBadgeComponent } from '../../shared/verification-badge.component';
import { MapPickerComponent } from '../../shared/map-picker.component';

/** The decisions this screen can take, and what each one needs. */
type Decision = 'approve' | 'request-info' | 'reject' | 'suspend' | 'reactivate';

/**
 * One seller registration, and the decision (Onboarding §14).
 *
 * Everything a reviewer needs on one screen: who registered, what they said
 * the shop is, where the pin actually landed, what evidence they offered, and
 * every previous round on the same registration.
 *
 * The decision buttons are deliberately not symmetrical. Approve is one
 * press; reject, suspend and "ask for more" each make the reviewer write
 * something first, because §14 makes the reason mandatory and §12 shows it to
 * the seller verbatim. A reason box that appears only after you choose the
 * action is what stops "Rejected: no" being a thing that can happen quickly.
 */
@Component({
  selector: 'app-registration-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent,
    VerificationBadgeComponent,
    MapPickerComponent,
  ],
  template: `
    <div class="container page detail">
      <p class="back">
        <a routerLink="/admin/registrations">
          <app-icon name="arrow-back-outline" [size]="15" /> All registrations
        </a>
      </p>

      @if (loading()) {
        <div class="skeleton" style="height: 420px"></div>
      } @else if (registration(); as r) {
        <div class="page-header">
          <div>
            <h1>{{ r.name }}</h1>
            <p class="subtitle">
              @if (r.owner) {
                Registered by {{ r.owner.name }} · {{ r.owner.email }}
                @if (r.owner.phone) {
                  · {{ r.owner.phone }}
                }
              } @else {
                This registration has no active owner.
              }
            </p>
          </div>
          <div class="badges">
            <app-verification-badge [status]="r.verificationStatus" />
            <span class="badge" [class.badge-success]="r.listingStatus === 'active'">
              {{ r.listingStatus === 'active' ? 'Live to customers' : 'Not live' }}
            </span>
          </div>
        </div>

        @if (error(); as message) {
          <div class="alert alert-danger" role="alert">{{ message }}</div>
        }

        <div class="columns">
          <div class="main">
            <section class="card">
              <div class="card-body">
                <h2>The shop</h2>
                <dl>
                  <dt>What they sell</dt>
                  <dd>{{ r.description || '—' }}</dd>
                  <dt>Shop contact</dt>
                  <dd>{{ r.contactNumber || '—' }}</dd>
                  <dt>Email</dt>
                  <dd>{{ r.email || '—' }}</dd>
                  <dt>Website</dt>
                  <dd>{{ r.websiteUrl || '—' }}</dd>
                  <dt>Registered as</dt>
                  <dd>{{ r.registrationSource === 'SELF_REGISTERED' ? 'Self-registered' : r.registrationSource }}</dd>
                  <dt>Submitted</dt>
                  <dd>{{ r.submittedAt ? (r.submittedAt | date: 'd MMM y, HH:mm') : 'Not submitted yet' }}</dd>
                </dl>
              </div>
            </section>

            <section class="card">
              <div class="card-body">
                <h2>Address and map pin</h2>
                @if (r.address; as a) {
                  <p class="address">
                    {{ a.address }}@if (a.area) {, {{ a.area }}}<br />
                    {{ a.city }}, {{ a.state }} {{ a.pincode }}
                  </p>

                  <!-- §7: a confirmed pin is a required part of the
                       submission, so whether it is confirmed is stated rather
                       than left for the reviewer to infer from a map. -->
                  <p
                    class="pin-state"
                    [class.ok]="a.locationState === 'CONFIRMED'"
                    [class.bad]="a.locationState !== 'CONFIRMED'"
                  >
                    <app-icon
                      [name]="a.locationState === 'CONFIRMED' ? 'checkmark-circle-outline' : 'alert-circle-outline'"
                      [size]="16"
                    />
                    @switch (a.locationState) {
                      @case ('CONFIRMED') {
                        Pin confirmed by the seller
                        @if (a.locationConfirmedAt) {
                          on {{ a.locationConfirmedAt | date: 'd MMM y' }}
                        }
                        @if (a.locationSource) {
                          · placed by {{ sourceLabel(a.locationSource) }}
                        }
                      }
                      @case ('PIN_SELECTED_NOT_CONFIRMED') {
                        A pin was placed but never confirmed
                      }
                      @default {
                        No map location was ever chosen
                      }
                    }
                  </p>

                  @if (a.latitude !== null && a.longitude !== null) {
                    <!--
                      The same picker the seller used, in its read-only mode:
                      pan and zoom, no searching, locating or confirming. It
                      is here so a reviewer can see whether the pin is on a
                      shopfront or in the middle of a field.
                    -->
                    <app-map-picker
                      [latitude]="a.latitude"
                      [longitude]="a.longitude"
                      [readonly]="true"
                    />
                    <p class="small muted coords">{{ a.latitude }}, {{ a.longitude }}</p>
                  }
                } @else {
                  <p class="muted">No address was saved.</p>
                }
              </div>
            </section>

            <section class="card">
              <div class="card-body">
                <h2>Verification evidence</h2>
                <!-- §8: optional by design, and §19 keeps it off every public
                     API. Nothing here is proof on its own. -->
                @if (hasEvidence()) {
                  <dl>
                    @if (r.verification?.gstin) {
                      <dt>GSTIN</dt>
                      <dd>{{ r.verification?.gstin }}</dd>
                    }
                    @if (r.verification?.googleBusinessUrl) {
                      <dt>Google Business</dt>
                      <dd>
                        <a [href]="r.verification?.googleBusinessUrl" target="_blank" rel="noopener noreferrer">
                          {{ r.verification?.googleBusinessUrl }}
                        </a>
                      </dd>
                    }
                    @if (r.verification?.businessRegistrationNumber) {
                      <dt>Registration number</dt>
                      <dd>{{ r.verification?.businessRegistrationNumber }}</dd>
                    }
                  </dl>
                } @else {
                  <p class="muted">
                    None provided. Plenty of small businesses have none of these, so this is not a
                    reason to reject on its own.
                  </p>
                }
              </div>
            </section>

            <!--
              §14, §16: other shops that look like this one. A warning, never
              a verdict - §16 is explicit that a name match is not identity
              and nothing here merges anything.
            -->
            @if (r.duplicates.length) {
              <section class="card">
                <div class="card-body">
                  <h2>Possible duplicates</h2>
                  <p class="small muted">
                    These look similar. Check before approving — if this seller is registering a
                    shop we already have, the claim flow is the right route, not a second listing.
                  </p>
                  <ul class="dupes">
                    @for (dupe of r.duplicates; track dupe.shopId) {
                      <li>
                        <div>
                          <a [routerLink]="['/admin/registrations', dupe.shopId]">{{ dupe.name }}</a>
                          <span class="small muted d-block">
                            {{ dupe.city || 'Location unknown' }}@if (dupe.pincode) {
                              · {{ dupe.pincode }}
                            }
                            · matched on {{ dupe.matchedOn.join(', ') }}
                          </span>
                        </div>
                        <app-verification-badge [status]="dupe.verificationStatus" />
                      </li>
                    }
                  </ul>
                </div>
              </section>
            }

            <section class="card">
              <div class="card-body">
                <h2>Review history</h2>
                @if (r.history.length === 0) {
                  <p class="muted">No decisions yet.</p>
                } @else {
                  <ol class="history">
                    @for (entry of r.history; track entry.id) {
                      <li>
                        <strong>{{ actionLabel(entry.action) }}</strong>
                        <span class="small muted">
                          {{ entry.at | date: 'd MMM y, HH:mm' }}
                          @if (entry.by) {
                            · {{ entry.by.name }}
                          }
                        </span>
                        @if (entry.reason) {
                          <p class="reason">“{{ entry.reason }}”</p>
                        }
                      </li>
                    }
                  </ol>
                }
              </div>
            </section>
          </div>

          <aside class="side">
            <section class="card">
              <div class="card-body">
                <h2>Decision</h2>

                @if (!canDecide()) {
                  <p class="muted small">
                    @if (r.verificationStatus === 'DRAFT') {
                      This registration has not been submitted yet. There is nothing to decide
                      until the seller submits it.
                    } @else {
                      No decision is available from this state.
                    }
                  </p>
                } @else {
                  <div class="actions">
                    @for (option of available(); track option.key) {
                      <button
                        type="button"
                        class="btn btn-sm"
                        [class.btn-secondary]="option.key !== 'approve'"
                        [attr.aria-pressed]="chosen() === option.key"
                        [class.chosen]="chosen() === option.key"
                        (click)="choose(option.key)"
                      >
                        {{ option.label }}
                      </button>
                    }
                  </div>

                  @if (chosen(); as action) {
                    <div class="confirm">
                      @if (action === 'approve') {
                        <label class="check">
                          <input
                            type="checkbox"
                            [ngModel]="activate()"
                            (ngModelChange)="activate.set($event)"
                          />
                          <span>
                            Put the shop live straight away.
                            <span class="small muted d-block">
                              Leave this off to verify now and launch later — verified and live are
                              separate.
                            </span>
                          </span>
                        </label>
                      } @else {
                        <label class="field">
                          <span>
                            {{ action === 'request-info' ? 'What do you need from them?' : 'Why?' }}
                            @if (reasonRequired(action)) {
                              *
                            }
                          </span>
                          <textarea
                            rows="4"
                            [ngModel]="reason()"
                            (ngModelChange)="reason.set($event)"
                            [placeholder]="placeholder(action)"
                          ></textarea>
                          <span class="hint">
                            The seller reads this word for word, so say what is wrong and what
                            they should do.
                          </span>
                        </label>
                      }

                      <div class="row">
                        <button
                          type="button"
                          class="btn btn-sm"
                          [disabled]="submitting() || !ready()"
                          (click)="submit()"
                        >
                          {{ submitting() ? 'Saving…' : confirmLabel() }}
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm" (click)="chosen.set(null)">
                          Cancel
                        </button>
                      </div>
                    </div>
                  }
                }
              </div>
            </section>

            @if (r.verificationStatus === 'VERIFIED') {
              <section class="card">
                <div class="card-body">
                  <h2>Listing</h2>
                  <p class="small muted">
                    Verification says the business is real. This says whether customers can see it.
                  </p>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    [disabled]="submitting()"
                    (click)="toggleListing(r)"
                  >
                    {{ r.listingStatus === 'active' ? 'Take off the marketplace' : 'Put live' }}
                  </button>
                </div>
              </section>
            }

            <section class="card">
              <div class="card-body">
                <h2>People</h2>
                <ul class="members">
                  @for (member of r.members; track member.id) {
                    <li>
                      {{ member.name }}
                      <span class="small muted d-block">
                        {{ member.email }}@if (member.designation) { · {{ member.designation }} }
                      </span>
                    </li>
                  }
                </ul>
              </div>
            </section>
          </aside>
        </div>
      } @else {
        <div class="alert alert-danger" role="alert">
          This registration could not be loaded. It may have been removed.
        </div>
      }
    </div>
  `,
  styles: [
    `
      .back {
        margin-bottom: 0.75rem;
      }
      .back a {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }

      .columns {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 22rem);
        gap: 1.25rem;
        align-items: start;
      }
      @media (max-width: 900px) {
        .columns {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .main,
      .side {
        display: grid;
        gap: 1.25rem;
        min-width: 0;
      }

      h2 {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        margin: 0 0 0.9rem;
      }

      dl {
        display: grid;
        grid-template-columns: minmax(7rem, 10rem) minmax(0, 1fr);
        gap: 0.5rem 1rem;
        margin: 0;
      }
      dt {
        color: var(--text-muted);
        font-size: 0.85rem;
      }
      dd {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .address {
        margin: 0 0 0.75rem;
      }
      .pin-state {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.55rem 0.75rem;
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
        margin-bottom: 0.9rem;
      }
      .pin-state.ok {
        background: var(--success-bg);
        color: var(--success);
      }
      .pin-state.bad {
        background: var(--warning-bg);
        color: var(--warning);
      }
      .coords {
        margin-top: 0.5rem;
        font-variant-numeric: tabular-nums;
      }

      .dupes {
        list-style: none;
        margin: 0.75rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .dupes li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.55rem 0.75rem;
      }

      .history {
        margin: 0;
        padding-left: 1.1rem;
        display: grid;
        gap: 0.9rem;
      }
      .history .reason {
        margin: 0.3rem 0 0;
        padding-left: 0.7rem;
        border-left: 2px solid var(--border);
        color: var(--text-muted);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 0.9rem;
      }
      .actions .chosen {
        outline: 2px solid var(--brand);
        outline-offset: 1px;
      }

      .confirm {
        border-top: 1px solid var(--border);
        padding-top: 0.9rem;
        display: grid;
        gap: 0.75rem;
      }
      .check {
        display: flex;
        gap: 0.55rem;
        align-items: flex-start;
      }
      .check input {
        width: auto;
        margin-top: 0.2rem;
      }
      .d-block {
        display: block;
      }

      .members {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }
    `,
  ],
})
export class RegistrationDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reviews = inject(RegistrationReviewService);
  private readonly toast = inject(ToastService);

  readonly registration = signal<RegistrationDetail | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly chosen = signal<Decision | null>(null);

  /**
   * Signals rather than plain fields, because `ready()` and `confirmLabel()`
   * are computed from them. A computed only recomputes when a signal it reads
   * changes, so as plain properties these two left the confirm button
   * permanently disabled however much the reviewer typed.
   */
  readonly reason = signal('');
  readonly activate = signal(true);

  private shopId = 0;

  /** Which decisions the current state allows, mirroring the backend's map. */
  readonly available = computed<{ key: Decision; label: string }[]>(() => {
    switch (this.registration()?.verificationStatus) {
      case 'PENDING_VERIFICATION':
        return [
          { key: 'approve', label: 'Approve' },
          { key: 'request-info', label: 'Ask for more' },
          { key: 'reject', label: 'Reject' },
        ];
      case 'ADDITIONAL_INFO_REQUIRED':
        // Not approvable from here: the seller has to resubmit first, so the
        // thing being approved is the answer rather than the question.
        return [{ key: 'reject', label: 'Reject' }];
      case 'VERIFIED':
        return [{ key: 'suspend', label: 'Suspend' }];
      case 'SUSPENDED':
        return [{ key: 'reactivate', label: 'Lift the suspension' }];
      case 'REJECTED':
      default:
        return [];
    }
  });

  readonly canDecide = computed(() => this.available().length > 0);

  readonly hasEvidence = computed(() => {
    const v = this.registration()?.verification as Record<string, unknown> | undefined;
    return !!v && Object.values(v).some((value) => !!value);
  });

  /** Reject, suspend and "ask for more" all need a reason the seller can act on (§14). */
  reasonRequired(action: Decision): boolean {
    return action === 'reject' || action === 'suspend' || action === 'request-info';
  }

  readonly ready = computed(() => {
    const action = this.chosen();
    if (!action) return false;
    if (!this.reasonRequired(action)) return true;
    return this.reason().trim().length >= 10;
  });

  readonly confirmLabel = computed(() => {
    switch (this.chosen()) {
      case 'approve':
        return this.activate() ? 'Approve and put live' : 'Approve';
      case 'reject':
        return 'Reject this registration';
      case 'request-info':
        return 'Send this back';
      case 'suspend':
        return 'Suspend this shop';
      case 'reactivate':
        return 'Lift the suspension';
      default:
        return 'Confirm';
    }
  });

  ngOnInit(): void {
    this.shopId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  choose(action: Decision): void {
    this.chosen.set(this.chosen() === action ? null : action);
    this.reason.set('');
    this.error.set(null);
  }

  placeholder(action: Decision): string {
    if (action === 'request-info') {
      return 'e.g. The map pin is in a residential street. Please move it to the shopfront and resubmit.';
    }
    if (action === 'suspend') return 'e.g. Multiple customer reports of offers not being honoured.';
    return 'e.g. We could not find any evidence this business exists at this address.';
  }

  sourceLabel(source: string): string {
    return (
      {
        ADDRESS_SEARCH: 'searching the address',
        MAP_PIN: 'dragging the map',
        CURRENT_LOCATION: 'their phone’s location',
        MANUAL: 'typing coordinates',
      }[source] ?? source.toLowerCase()
    );
  }

  actionLabel(action: string): string {
    return (
      {
        SELLER_REGISTRATION_VERIFIED: 'Approved',
        SELLER_REGISTRATION_REJECTED: 'Rejected',
        SELLER_REGISTRATION_INFO_REQUESTED: 'More information requested',
        SELLER_REGISTRATION_SUSPENDED: 'Suspended',
        SHOP_ACTIVATED: 'Put live',
        SHOP_DEACTIVATED: 'Taken off the marketplace',
      }[action] ?? action
    );
  }

  submit(): void {
    const action = this.chosen();
    if (!action || !this.ready()) return;

    const reason = this.reason().trim();
    const call = {
      approve: () => this.reviews.approve(this.shopId, this.activate()),
      reject: () => this.reviews.reject(this.shopId, reason),
      'request-info': () => this.reviews.requestInfo(this.shopId, reason),
      suspend: () => this.reviews.suspend(this.shopId, reason),
      reactivate: () => this.reviews.reactivate(this.shopId, reason || undefined),
    }[action];

    this.submitting.set(true);
    this.error.set(null);
    call().subscribe({
      next: (updated) => {
        this.registration.set(updated);
        this.submitting.set(false);
        this.chosen.set(null);
        this.reason.set('');
        this.toast.success('Decision recorded. The seller has been notified.');
      },
      error: (err) => {
        this.submitting.set(false);
        // A 409 here is usually a second reviewer, not a bug — the backend's
        // message says so, so it is shown rather than replaced.
        this.error.set(
          err?.error?.error?.message ?? 'We could not record that decision. Please try again.',
        );
      },
    });
  }

  toggleListing(current: RegistrationDetail): void {
    const next = current.listingStatus === 'active' ? 'inactive' : 'active';
    this.submitting.set(true);
    this.reviews.setListing(this.shopId, next).subscribe({
      next: (updated) => {
        this.registration.set(updated);
        this.submitting.set(false);
        this.toast.success(next === 'active' ? 'The shop is live.' : 'The shop is no longer listed.');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error?.message ?? 'We could not change the listing.');
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.reviews.get(this.shopId).subscribe({
      next: (detail) => {
        this.registration.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.registration.set(null);
        this.loading.set(false);
      },
    });
  }
}
