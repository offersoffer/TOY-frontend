import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SeoService } from '../../core/seo.service';
import { ToastService } from '../../core/toast.service';
import { ReportableEntity, SupportTicket, SupportUserType } from '../../core/models';
import { applyServerErrors, errorFor } from '../auth/auth-shell';
import { ImageUploader } from '../../shared/image-upload';
import { IconComponent } from '../../shared/icon.component';
import { SUPPORT_CATEGORIES, SUPPORT_EMAIL, SUPPORT_FAQS, SUPPORT_PHONES } from './content';

/** The entity kinds a report can name, and how to say each one to a person. */
const REPORT_LABELS: Record<ReportableEntity, string> = {
  offer: 'offer',
  service: 'service',
  shop: 'shop',
  service_offer: 'service offer',
};

/**
 * Support.
 *
 * More useful than a phone number, which is the whole point: the form produces
 * a ticket with a reference the customer can quote, and the FAQ below it exists
 * to make the form unnecessary for the eight questions people actually ask.
 *
 * Three things shape it.
 *
 * It works signed out. Someone who cannot log in is precisely the person who
 * needs support and cannot prove who they are while asking, so the form is open
 * and the API takes it without a session.
 *
 * It does not ask for what we already know. A signed-in customer's name, email
 * and phone are filled in, and their account id goes with the ticket
 * automatically — but the fields stay editable, because the address a reply
 * should go to is theirs to choose.
 *
 * And it can arrive pre-aimed. `/support?report=offer&id=12` opens on the
 * report category with the offer already attached, which is what the "Report
 * this offer" link on a listing needs in order to be one click.
 */
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent],
  template: `
    <div class="container page support">
      <header class="head">
        <h1>How can we help?</h1>
        <p class="subtitle">
          Tell us what went wrong and we’ll come back to you. You’ll get a reference straight away.
        </p>
      </header>

      <div class="channels">
        <a class="channel" [href]="'mailto:' + supportEmail">
          <app-icon name="mail-outline" [size]="19" />
          <span>
            <strong>Email support</strong>
            <span class="small muted">{{ supportEmail }}</span>
          </span>
        </a>
        <a class="channel" [href]="telHref(supportPhones[0])">
          <app-icon name="call-outline" [size]="19" />
          <span>
            <strong>Call support</strong>
            <span class="small muted">{{ supportPhones.join(' · ') }}</span>
          </span>
        </a>
        @if (auth.isAuthenticated()) {
          <a class="channel" routerLink="/support/requests">
            <app-icon name="chatbubbles-outline" [size]="19" />
            <span>
              <strong>My requests</strong>
              <span class="small muted">Replies and past requests</span>
            </span>
          </a>
        }
      </div>

      @if (submitted(); as ticket) {
        <!-- The confirmation replaces the form rather than appearing above it.
             Leaving a filled-in form on screen next to "we got it" is how the
             same request gets sent three times. -->
        <div class="card confirmation" role="status">
          <div class="card-body">
            <app-icon class="tick" name="checkmark-circle-outline" [size]="34" />
            <h2>Your request has been received.</h2>
            <p class="reference">Ticket ID: <strong>{{ ticket.reference }}</strong></p>
            <p class="muted">
              We’ve sent a copy to <strong>{{ ticket.email }}</strong
              >. Quote the reference above if you contact us about it again.
            </p>
            <div class="actions">
              @if (auth.isAuthenticated()) {
                <a routerLink="/support/requests" class="btn">Track this request</a>
              }
              <button type="button" class="btn btn-secondary" (click)="raiseAnother()">
                Raise another request
              </button>
              <a routerLink="/offers" class="btn btn-ghost">Back to offers</a>
            </div>
          </div>
        </div>
      } @else {
        <form class="card form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="card-body">
            @if (formError()) {
              <div class="alert" role="alert">{{ formError() }}</div>
            }

            @if (reported(); as target) {
              <p class="reporting">
                <app-icon name="warning-outline" [size]="16" />
                You’re reporting {{ target.label }} <strong>#{{ target.id }}</strong
                >. We’ll look at the listing itself — you don’t need to describe which one.
              </p>
            } @else if (form.value.category === 'report_content') {
              <!-- Reporting without a target is allowed, so this is guidance
                   rather than a blocker: the report is more useful if we can
                   see the listing, and the fastest way to attach it is the
                   link on the listing itself. -->
              <p class="reporting">
                <app-icon name="information-circle-outline" [size]="16" />
                If it’s a specific listing, the quickest way is <strong>Report</strong> on that
                offer, service or shop page — it attaches the listing for us. Otherwise, name the
                shop and the offer below and we’ll find it.
              </p>
            }

            <fieldset class="categories">
              <legend>What do you need help with?</legend>
              <div class="category-grid">
                @for (option of categories; track option.value) {
                  <!-- Wrapped *and* explicitly associated. The wrapping makes
                       the whole card a hit target; the id/for pair is what
                       guarantees the accessible name, which an implicit label
                       around nested markup does not always produce. -->
                  <label
                    class="category"
                    [for]="'category-' + option.value"
                    [class.selected]="form.value.category === option.value"
                  >
                    <input
                      type="radio"
                      [id]="'category-' + option.value"
                      formControlName="category"
                      [value]="option.value"
                    />
                    <span>
                      <strong>{{ option.label }}</strong>
                      <span class="small muted">{{ option.hint }}</span>
                    </span>
                  </label>
                }
              </div>
              @if (error('category', 'A category'); as message) {
                <span class="error-text">{{ message }}</span>
              }
            </fieldset>

            <div class="two-up">
              <div class="field">
                <label for="name">Your name</label>
                <input id="name" type="text" formControlName="name" autocomplete="name" [class.invalid]="error('name', 'Name')" />
                @if (error('name', 'Name'); as message) {
                  <span class="error-text">{{ message }}</span>
                }
              </div>

              <div class="field">
                <label for="email">Email</label>
                <input id="email" type="email" formControlName="email" autocomplete="email" [class.invalid]="error('email', 'Email')" />
                @if (error('email', 'Email'); as message) {
                  <span class="error-text">{{ message }}</span>
                } @else {
                  <span class="hint">This is where we’ll reply.</span>
                }
              </div>
            </div>

            <div class="two-up">
              <div class="field">
                <label for="phone">Phone <span class="muted small">(optional)</span></label>
                <input id="phone" type="tel" formControlName="phone" autocomplete="tel" [class.invalid]="error('phone', 'Phone number')" />
                @if (error('phone', 'Phone number'); as message) {
                  <span class="error-text">{{ message }}</span>
                }
              </div>

              <div class="field">
                <label for="userType">You are</label>
                <select id="userType" formControlName="userType">
                  <option value="customer">A customer</option>
                  <option value="merchant">A shop or merchant</option>
                  <option value="guest">Just browsing, no account</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label for="subject">Subject</label>
              <input id="subject" type="text" formControlName="subject" maxlength="200" [class.invalid]="error('subject', 'Subject')" />
              @if (error('subject', 'Subject'); as message) {
                <span class="error-text">{{ message }}</span>
              } @else {
                <span class="hint">One line — what this is about.</span>
              }
            </div>

            <div class="field">
              <label for="description">What happened?</label>
              <textarea
                id="description"
                rows="6"
                formControlName="description"
                maxlength="5000"
                [class.invalid]="error('description', 'Description')"
              ></textarea>
              @if (error('description', 'Description'); as message) {
                <span class="error-text">{{ message }}</span>
              } @else {
                <span class="hint">
                  What you were doing, what you expected, and what happened instead. Dates, codes and
                  shop names all help.
                </span>
              }
            </div>

            <!-- Attachments need a signed-in user, because uploads are
                 authenticated everywhere in this API and a public upload
                 endpoint is a different decision from a public support form.
                 A guest is told what to do instead rather than shown a control
                 that would reject them. -->
            <div class="field">
              <label>Screenshot <span class="muted small">(optional)</span></label>
              @if (auth.isAuthenticated()) {
                @if (uploader.images().length) {
                  <div class="attachment">
                    <img [src]="uploader.images()[0].thumbnailUrl ?? uploader.images()[0].url" alt="" />
                    <button type="button" class="btn btn-secondary btn-sm" (click)="uploader.remove(0)">
                      Remove
                    </button>
                  </div>
                } @else {
                  <input type="file" accept="image/*" (change)="pickFile($event)" [disabled]="uploader.uploading()" />
                  @if (uploader.uploading()) {
                    <span class="hint"><span class="spinner dark"></span> Uploading…</span>
                  }
                }
                @for (failure of uploader.failed(); track failure.file.name) {
                  <span class="error-text">{{ failure.message }}</span>
                }
              } @else {
                <p class="small muted mb-0">
                  <a [routerLink]="['/auth/login']" [queryParams]="{ returnUrl: '/support' }">Sign in</a>
                  to attach a screenshot, or email it to
                  <a [href]="'mailto:' + supportEmail">{{ supportEmail }}</a> quoting your ticket
                  reference.
                </p>
              }
            </div>

            <button type="submit" class="btn btn-block" [disabled]="submitting() || uploader.uploading()">
              @if (submitting()) {
                <span class="spinner"></span> Sending…
              } @else {
                Send request
              }
            </button>

            <p class="small subtle center mt-2 mb-0">
              We’ll use these details to answer you. See our
              <a routerLink="/privacy">Privacy Policy</a>.
            </p>
          </div>
        </form>
      }

      <section class="faqs" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Common questions</h2>
        <p class="small muted">Worth a look first — most requests we get are one of these.</p>
        @for (faq of faqs; track faq.question) {
          <details class="faq">
            <summary>{{ faq.question }}</summary>
            <p>{{ faq.answer }}</p>
          </details>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .support {
        max-width: 820px;
      }

      .head {
        margin-bottom: 1.5rem;
      }

      .head h1 {
        margin-bottom: 0.3rem;
      }

      .channels {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.75rem;
      }

      .channel {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.85rem 1rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        transition: border-color var(--fast) var(--ease), transform var(--fast) var(--ease);
      }

      .channel:hover {
        border-color: var(--brand);
        transform: translateY(-1px);
        text-decoration: none;
      }

      .channel app-icon {
        color: var(--brand);
        flex-shrink: 0;
      }

      .channel > span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .channel .small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .form .card-body {
        padding: 1.5rem;
      }

      .alert {
        background: var(--danger-bg);
        color: var(--danger);
        padding: 0.65rem 0.8rem;
        border-radius: var(--radius-sm);
        font-size: 0.88rem;
        margin-bottom: 1rem;
      }

      .reporting {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        background: var(--warning-bg);
        border-radius: var(--radius-sm);
        padding: 0.7rem 0.85rem;
        font-size: 0.88rem;
        margin: 0 0 1.25rem;
      }

      fieldset {
        border: 0;
        padding: 0;
        margin: 0 0 1.25rem;
      }

      legend {
        font-size: 0.85rem;
        font-weight: 620;
        padding: 0;
        margin-bottom: 0.55rem;
      }

      .category-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(212px, 1fr));
        gap: 0.5rem;
      }

      /* Radios rather than a select: thirteen options with a line of
         explanation each is a choice people get wrong from labels alone, and a
         dropdown hides the twelve you are not looking at. */
      .category {
        display: flex;
        align-items: flex-start;
        gap: 0.55rem;
        padding: 0.6rem 0.7rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: border-color var(--fast) var(--ease), background var(--fast) var(--ease);
      }

      .category:hover {
        border-color: var(--brand);
      }

      .category.selected {
        border-color: var(--brand);
        background: var(--surface-alt);
      }

      .category input {
        margin-top: 0.2rem;
        flex-shrink: 0;
      }

      .category > span {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }

      .category strong {
        font-size: 0.88rem;
        font-weight: 620;
      }

      .category .small {
        line-height: 1.35;
      }

      .two-up {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 0.9rem;
      }

      @media (max-width: 560px) {
        .two-up {
          grid-template-columns: 1fr;
        }
      }

      .attachment {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .attachment img {
        width: 88px;
        height: 66px;
        object-fit: cover;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
      }

      .confirmation {
        text-align: center;
      }

      .confirmation .card-body {
        padding: 2.5rem 1.5rem;
      }

      .confirmation .tick {
        color: var(--success);
      }

      .confirmation h2 {
        font-size: 1.25rem;
        margin: 0.75rem 0 0.5rem;
      }

      .reference {
        font-size: 1.1rem;
      }

      .reference strong {
        font-family: var(--font-mono, ui-monospace, monospace);
        letter-spacing: 0.04em;
        user-select: all;
      }

      .confirmation .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        justify-content: center;
        margin-top: 1.35rem;
      }

      .faqs {
        margin-top: 2.75rem;
      }

      .faqs h2 {
        font-size: 1.15rem;
        margin-bottom: 0.25rem;
      }

      .faq {
        border-bottom: 1px solid var(--border);
        padding: 0.85rem 0;
      }

      .faq summary {
        cursor: pointer;
        font-weight: 600;
        list-style: none;
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      }

      .faq summary::-webkit-details-marker {
        display: none;
      }

      .faq summary::after {
        content: '+';
        color: var(--text-subtle);
        font-weight: 400;
        font-size: 1.2rem;
        line-height: 1;
      }

      .faq[open] summary::after {
        content: '\\2212';
      }

      .faq p {
        margin: 0.6rem 0 0;
        color: var(--text-muted);
        font-size: 0.92rem;
        line-height: 1.62;
        max-width: 68ch;
      }
    `,
  ],
})
export class SupportComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly categories = SUPPORT_CATEGORIES;
  readonly faqs = SUPPORT_FAQS;
  readonly supportEmail = SUPPORT_EMAIL;
  readonly supportPhones = SUPPORT_PHONES;

  /** One image, and it is a screenshot rather than a gallery. */
  readonly uploader = new ImageUploader('support', 1);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly submitted = signal<SupportTicket | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.pattern(/^[+\d][\d\s-]{5,20}$/)]],
    userType: ['customer' as SupportUserType, [Validators.required]],
    category: ['', [Validators.required]],
    subject: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(200)]],
    description: [
      '',
      [Validators.required, Validators.minLength(20), Validators.maxLength(5000)],
    ],
  });

  /** `?report=offer&id=12`, when the customer arrived from a listing. */
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  readonly reported = computed(() => {
    const map = this.params();
    const kind = map?.get('report') as ReportableEntity | null;
    const id = Number(map?.get('id'));
    if (!kind || !REPORT_LABELS[kind] || !Number.isFinite(id) || id <= 0) return null;
    return { kind, id, label: REPORT_LABELS[kind] };
  });

  constructor() {
    this.seo.apply({
      title: 'Support',
      description:
        'Get help with OffersOffer — raise a support request and get a ticket reference, or find an answer in the common questions.',
      path: '/support',
    });

    // Pre-fill from the account, and keep doing so: the profile arrives after
    // the first render on a cold load, and a form that filled itself in only
    // when the data happened to be ready is the kind of bug nobody reproduces.
    // Guarded on the field being untouched so it never overwrites typing.
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      const controls = this.form.controls;
      if (!controls.name.dirty && !controls.name.value) controls.name.setValue(user.name);
      if (!controls.email.dirty && !controls.email.value) controls.email.setValue(user.email);
      if (!controls.phone.dirty && !controls.phone.value && user.phone) {
        controls.phone.setValue(user.phone);
      }
      // A merchant asking about their shop should not have to say so.
      if (!controls.userType.dirty && (user.shops?.length || user.isSuperAdmin)) {
        controls.userType.setValue('merchant');
      }
    });

    // Arriving from "Report this offer" should land on the report category
    // with the subject started, rather than on an empty form that happens to
    // know an id.
    effect(() => {
      const target = this.reported();
      if (!target) return;
      const controls = this.form.controls;
      if (!controls.category.dirty) controls.category.setValue('report_content');
      if (!controls.subject.dirty && !controls.subject.value) {
        controls.subject.setValue(`Report: ${target.label} #${target.id}`);
      }
    });
  }

  error(control: string, label: string): string | null {
    return errorFor(this.form.get(control), label);
  }

  telHref(phone: string): string {
    return `tel:${phone.replace(/\s+/g, '')}`;
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploader.add([file]);
    // Cleared so picking the same file again after a removal still fires.
    input.value = '';
  }

  /** Back to a blank form, keeping the details we already knew. */
  raiseAnother(): void {
    this.submitted.set(null);
    this.uploader.set([]);
    this.form.patchValue({ category: '', subject: '', description: '' });
    this.form.markAsUntouched();
  }

  submit(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const value = this.form.getRawValue();
    const target = this.reported();

    this.api
      .createSupportTicket({
        name: value.name,
        email: value.email,
        phone: value.phone || null,
        userType: value.userType,
        category: value.category,
        subject: value.subject,
        description: value.description,
        attachmentUrl: this.uploader.images()[0]?.url ?? null,
        // Only sent when the category is actually a content report; a stale
        // `?report=` in the URL must not attach an offer to a billing question.
        entityType: value.category === 'report_content' ? (target?.kind ?? null) : null,
        entityId: value.category === 'report_content' ? (target?.id ?? null) : null,
      })
      .subscribe({
        next: (ticket) => {
          this.submitting.set(false);
          this.submitted.set(ticket);
          this.toast.success(`Request received — ${ticket.reference}`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.formError.set(applyServerErrors(this.form, error));
        },
      });
  }
}
