import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { SeoService } from '../../core/seo.service';
import {
  OnboardingService,
  Registration,
  RegistrationPayload,
} from '../../core/onboarding.service';
import { Category, LocationSource } from '../../core/models';
import { StepperComponent, WizardStep } from '../../shared/stepper.component';
import { MapPickerComponent, MovedPin, PickedLocation } from '../../shared/map-picker.component';
import { IconComponent } from '../../shared/icon.component';

/**
 * Self-service seller registration (Self-Service Onboarding §4-§12).
 *
 * Six steps, saved to the server one at a time. The server is the only copy:
 * §4 requires a seller to be able to leave and come back, and the reliable way
 * to promise that is to persist each step as it is finished rather than hold a
 * draft in a tab that closing destroys.
 *
 * Nothing here is a security control. Every rule it applies - what may be
 * edited, what is required, whether the map pin counts - is enforced again by
 * the API, and §13 is explicit that frontend hiding is never the access check.
 * This exists to stop a shopkeeper discovering at the end that step three was
 * wrong.
 */
@Component({
  selector: 'app-seller-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    StepperComponent,
    MapPickerComponent,
    IconComponent,
  ],
  templateUrl: './seller-onboarding.component.html',
  styles: [
    `
      .wizard {
        max-width: 760px;
        margin-inline: auto;
      }

      .step-body {
        margin-top: 1.5rem;
      }

      .wizard-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
        margin-top: 1.75rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--border);
      }
      .wizard-actions .spacer {
        flex: 1;
      }

      .category-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .category-grid button {
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        border-radius: 999px;
        padding: 0.4rem 0.85rem;
        font: inherit;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .category-grid button[aria-pressed='true'] {
        border-color: var(--brand);
        background: var(--brand-tint);
        color: var(--brand-dark);
        font-weight: 600;
      }
      .category-grid button:focus-visible {
        outline: 2px solid var(--brand);
        outline-offset: 2px;
      }

      /* §7: the three location states, told apart by words and an icon rather
         than by colour alone (§23). */
      .loc-state {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.8rem;
        border-radius: var(--radius-sm);
        margin-bottom: 0.9rem;
        font-size: 0.9rem;
      }
      .loc-state.not-selected {
        background: var(--surface-alt);
        color: var(--text-muted);
      }
      .loc-state.selected {
        background: var(--info-bg);
        color: var(--info);
      }
      .loc-state.confirmed {
        background: var(--success-bg);
        color: var(--success);
        font-weight: 600;
      }

      .review dl {
        display: grid;
        grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr);
        gap: 0.5rem 1rem;
        margin: 0;
      }
      .review dt {
        color: var(--text-muted);
        font-size: 0.85rem;
      }
      .review dd {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .review h3 {
        margin: 1.25rem 0 0.6rem;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }
      .review h3:first-child {
        margin-top: 0;
      }

      .terms {
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
        margin-top: 1.5rem;
      }
      .terms input {
        margin-top: 0.2rem;
        width: auto;
      }

      .status-card {
        text-align: center;
        padding: 2.5rem 1.5rem;
      }
      .status-card .big {
        font-size: 1.35rem;
        font-weight: 700;
        margin: 0.75rem 0 0.4rem;
      }
      .status-lists {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
        margin-top: 1.75rem;
        text-align: left;
      }
      .status-lists ul {
        margin: 0.4rem 0 0;
        padding-left: 1.1rem;
      }
      .status-lists li {
        margin-bottom: 0.3rem;
        font-size: 0.9rem;
      }

      @media (max-width: 560px) {
        .review dl {
          grid-template-columns: minmax(0, 1fr);
          gap: 0.15rem;
        }
        .review dd {
          margin-bottom: 0.6rem;
        }
        .wizard-actions {
          flex-direction: column-reverse;
        }
        .wizard-actions .btn {
          width: 100%;
        }
        .wizard-actions .spacer {
          display: none;
        }
      }
    `,
  ],
})
export class SellerOnboardingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly onboarding = inject(OnboardingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  readonly auth = inject(AuthService);

  readonly steps: WizardStep[] = [
    { key: 'contact', label: 'Your details' },
    { key: 'shop', label: 'Shop details' },
    { key: 'location', label: 'Address & map' },
    { key: 'verification', label: 'Verification', optional: true },
    { key: 'listings', label: 'First offer', optional: true },
    { key: 'review', label: 'Review' },
  ];

  readonly step = signal(0);
  readonly furthest = signal(0);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly registration = signal<Registration | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly selectedCategories = signal<number[]>([]);
  readonly acceptedTerms = signal(false);

  /** Where the pin came from and whether the seller confirmed it (§7). */
  private locationSource: LocationSource = 'MANUAL';
  private locationAccuracy: number | null = null;
  readonly latitude = signal<number | null>(null);
  readonly longitude = signal<number | null>(null);
  readonly locationConfirmed = signal(false);

  readonly contactForm = this.fb.nonNullable.group({
    contactNumber: ['', [Validators.required, Validators.pattern(/^[+\d][\d\s-]{5,20}$/)]],
  });

  readonly shopForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    email: ['', [Validators.email]],
    websiteUrl: [''],
  });

  readonly addressForm = this.fb.nonNullable.group({
    address: ['', [Validators.required, Validators.minLength(5)]],
    area: [''],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly verificationForm = this.fb.nonNullable.group({
    gstin: [''],
    googleBusinessUrl: [''],
    businessRegistrationNumber: [''],
  });

  /**
   * §7: the step cannot be completed on a pin alone.
   *
   * Both halves, because they fail separately - a confirmation with no
   * coordinates means the provider never returned one, which §7 says must not
   * count as confirmed.
   */
  readonly locationReady = computed(
    () => this.locationConfirmed() && this.latitude() !== null && this.longitude() !== null,
  );

  readonly locationState = computed(() => {
    if (this.latitude() === null) return 'NOT_SELECTED' as const;
    return this.locationConfirmed() ? ('CONFIRMED' as const) : ('PIN_SELECTED_NOT_CONFIRMED' as const);
  });

  /** The address as typed, to seed the map's search box. */
  readonly addressHint = computed(() => {
    const v = this.addressForm.getRawValue();
    return [v.address, v.area, v.city, v.pincode].filter(Boolean).join(', ');
  });

  /** Once submitted, the wizard gives way to the status screen (§12). */
  readonly showStatus = computed(() => {
    const r = this.registration();
    return !!r && !r.canEdit;
  });

  readonly stepKey = computed(() => this.steps[this.step()]?.key ?? 'contact');

  ngOnInit(): void {
    this.seo.apply({
      title: 'Register your shop',
      description:
        'List your shop on OffersOffer. Free to start — publish offers, reach customers nearby, and manage everything yourself.',
      path: '/sell/register',
    });

    this.api.listCategories({ limit: 100 }).subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.categories.set([]),
    });

    // §4: resume whatever is in flight rather than starting a second one.
    this.onboarding.mine().subscribe({
      next: (registrations) => {
        const open = registrations[0] ?? null;
        if (open) {
          this.registration.set(open);
          this.hydrate(open);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Fills the forms from a registration the seller already started. */
  private hydrate(r: Registration): void {
    this.contactForm.patchValue({ contactNumber: r.contactNumber ?? '' });
    this.shopForm.patchValue({
      name: r.name ?? '',
      description: r.description ?? '',
      email: r.email ?? '',
      websiteUrl: r.websiteUrl ?? '',
    });
    this.selectedCategories.set(r.categoryIds ?? []);

    if (r.address) {
      this.addressForm.patchValue({
        address: r.address.address ?? '',
        area: r.address.area ?? '',
        city: r.address.city ?? '',
        state: r.address.state ?? '',
        pincode: r.address.pincode ?? '',
      });
      this.latitude.set(r.address.latitude);
      this.longitude.set(r.address.longitude);
      // Straight from the server's own verdict. Deriving "confirmed" on the
      // client is how a pin that was only selected ends up looking confirmed.
      this.locationConfirmed.set(r.address.locationState === 'CONFIRMED');
      this.locationSource = r.address.locationSource ?? 'MANUAL';
    }

    // Drop the seller back where the registration actually stands, rather
    // than at step one, which would make resuming feel like starting again.
    const resumeAt = !r.address?.address ? 2 : this.steps.length - 1;
    this.step.set(resumeAt);
    this.furthest.set(resumeAt);
  }

  toggleCategory(id: number): void {
    const current = this.selectedCategories();
    this.selectedCategories.set(
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  /**
   * §7's middle state: a pin exists but nobody has vouched for it.
   *
   * Recorded so the banner can say "now press Confirm" and - just as
   * important - so `locationReady` stays false. Coordinates on their own are
   * not a confirmation, and §7 is explicit that they must never be treated as
   * one.
   */
  onPinMoved(pin: MovedPin): void {
    this.latitude.set(pin.latitude);
    this.longitude.set(pin.longitude);
    this.locationSource = pin.source;
    this.locationAccuracy = pin.accuracy;
    this.locationConfirmed.set(false);
  }

  /** §7: the seller pressed Confirm on the map. */
  onPicked(location: PickedLocation): void {
    this.latitude.set(location.latitude);
    this.longitude.set(location.longitude);
    this.locationSource = location.source;
    this.locationAccuracy = location.accuracy;
    this.locationConfirmed.set(true);

    // The geocoder often knows the address better than the typed one, but
    // only fills blanks: overwriting what the seller wrote is how a correct
    // address becomes a wrong one.
    const picked = location.address;
    if (picked) {
      const patch: Record<string, string> = {};
      for (const [key, value] of Object.entries({
        area: picked.area,
        city: picked.city,
        state: picked.state,
        pincode: picked.pincode,
      })) {
        if (value && !this.addressForm.get(key)?.value) patch[key] = value;
      }
      if (Object.keys(patch).length) this.addressForm.patchValue(patch);
    }

    this.toast.success('Shop location confirmed.');
  }

  /** Whether the current step may be left. */
  readonly canContinue = computed(() => {
    switch (this.stepKey()) {
      case 'contact':
        return this.contactForm.valid;
      case 'shop':
        return this.shopForm.valid && this.selectedCategories().length > 0;
      case 'location':
        return this.addressForm.valid && this.locationReady();
      default:
        return true;
    }
  });

  private payloadForStep(): RegistrationPayload {
    switch (this.stepKey()) {
      case 'contact':
        return { contactNumber: this.contactForm.getRawValue().contactNumber };
      case 'shop': {
        const v = this.shopForm.getRawValue();
        return {
          name: v.name,
          description: v.description,
          email: v.email || null,
          websiteUrl: v.websiteUrl || null,
          categoryIds: this.selectedCategories(),
        };
      }
      case 'location': {
        const v = this.addressForm.getRawValue();
        return {
          address: {
            ...v,
            country: 'India',
            latitude: this.latitude(),
            longitude: this.longitude(),
            locationSource: this.locationSource,
            locationAccuracy: this.locationAccuracy,
            locationConfirmed: this.locationConfirmed(),
          },
        };
      }
      case 'verification':
        return { verification: this.verificationForm.getRawValue() } as RegistrationPayload;
      default:
        return {};
    }
  }

  back(): void {
    if (this.step() > 0) this.step.set(this.step() - 1);
  }

  goTo(index: number): void {
    if (index <= this.furthest()) this.step.set(index);
  }

  /** Saves this step, then advances. §4: progress survives leaving. */
  next(): void {
    if (!this.canContinue()) {
      this.markCurrentTouched();
      return;
    }
    this.error.set(null);
    this.saving.set(true);

    const existing = this.registration();

    /**
     * Nothing is created until there is something to register.
     *
     * Step one collects only the shop's phone number, and a registration made
     * from that alone would have to carry a placeholder name and no category
     * - which the API rightly rejects, because those are required to create a
     * shop. So the first step is held locally and the row is created when the
     * shop details are saved, carrying both steps at once.
     */
    if (!existing && this.stepKey() === 'contact') {
      this.saving.set(false);
      this.step.set(1);
      this.furthest.set(Math.max(this.furthest(), 1));
      return;
    }

    const payload = this.payloadForStep();
    const shop = this.shopForm.getRawValue();

    const request = existing
      ? this.onboarding.save(existing.shopId, payload)
      : this.onboarding.start({
          name: shop.name,
          description: shop.description,
          contactNumber: this.contactForm.getRawValue().contactNumber,
          email: shop.email || null,
          websiteUrl: shop.websiteUrl || null,
          categoryIds: this.selectedCategories(),
        });

    request.subscribe({
      next: (saved) => {
        this.registration.set(saved);
        this.saving.set(false);
        const nextStep = Math.min(this.step() + 1, this.steps.length - 1);
        this.step.set(nextStep);
        this.furthest.set(Math.max(this.furthest(), nextStep));
      },
      error: (err) => {
        this.saving.set(false);
        // §24: the step stays filled in, so a failed save costs a retry and
        // not the seller's typing.
        this.error.set(
          err?.error?.error?.message ?? 'We could not save that step. Please try again.',
        );
      },
    });
  }

  submit(): void {
    const existing = this.registration();
    if (!existing || !this.acceptedTerms()) return;

    this.submitting.set(true);
    this.error.set(null);
    this.onboarding.submit(existing.shopId).subscribe({
      next: (saved) => {
        this.registration.set(saved);
        this.submitting.set(false);
        this.toast.success('Registration submitted for verification.');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(
          err?.error?.error?.message ?? 'We could not submit your registration. Please try again.',
        );
      },
    });
  }

  private markCurrentTouched(): void {
    const form =
      this.stepKey() === 'contact'
        ? this.contactForm
        : this.stepKey() === 'shop'
          ? this.shopForm
          : this.stepKey() === 'location'
            ? this.addressForm
            : null;
    form?.markAllAsTouched();
  }

  /** Field error text, shown only once the seller has had a go at the field. */
  fieldError(form: 'contact' | 'shop' | 'address', name: string, label: string): string | null {
    // Widened deliberately: the three groups have different value shapes, so
    // the union's typed `get` has no signature that satisfies all of them.
    const group: FormGroup =
      form === 'contact' ? this.contactForm : form === 'shop' ? this.shopForm : this.addressForm;
    const control = group.get(name);
    if (!control || !control.touched || control.valid) return null;
    if (control.hasError('required')) return `${label} is required`;
    if (control.hasError('minlength')) return `${label} is too short`;
    if (control.hasError('email')) return 'Enter a valid email address';
    if (control.hasError('pattern')) {
      return name === 'pincode' ? 'Enter a 6-digit pincode' : `Enter a valid ${label.toLowerCase()}`;
    }
    return `Check ${label.toLowerCase()}`;
  }

  categoryName(id: number): string {
    return this.categories().find((c) => c.id === id)?.name ?? `#${id}`;
  }
}
