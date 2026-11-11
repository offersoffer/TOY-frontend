import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { Branch, Category, LocationSource, OpeningHours, ShopProfileStatus } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { MapPickerComponent, PickedLocation } from '../../shared/map-picker.component';
import { OpeningHoursComponent } from '../../shared/opening-hours.component';
import { applyServerErrors, errorFor } from '../auth/auth-shell';

/** Shop creation and editing (§16). Creation can seed the first branch. */
@Component({
  selector: 'app-shop-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IconComponent,
    MapPickerComponent,
    OpeningHoursComponent,
  ],
  templateUrl: './shop-form.component.html',
  styles: [
    `
      .alert {
        background: var(--danger-bg);
        color: var(--danger);
        padding: 0.7rem 0.9rem;
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }

      .form-layout {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 300px);
        gap: 1.25rem;
        align-items: start;
      }

      .cat-picker {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.4rem;
      }

      .cat-option {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        padding: 0.5rem 0.6rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 0.9rem;
      }

      .cat-option.selected {
        border-color: var(--brand);
        background: var(--brand-light);
      }

      .cat-option input {
        accent-color: var(--brand);
      }

      .logo-preview {
        width: 100%;
        aspect-ratio: 1;
        max-width: 160px;
        border-radius: var(--radius);
        object-fit: cover;
        border: 1px solid var(--border);
        margin-bottom: 0.6rem;
      }

      .logo-placeholder {
        display: grid;
        place-items: center;
        background: var(--surface-alt);
        color: var(--text-subtle);
        font-size: 0.85rem;
      }

      .confirmed {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0.4rem 0 0;
        font-size: 0.85rem;
        color: var(--success, var(--brand));
      }

      .progress {
        height: 8px;
        border-radius: 99px;
        background: var(--surface-alt);
        overflow: hidden;
      }

      .progress span {
        display: block;
        height: 100%;
        background: var(--brand);
        transition: width 0.25s ease-out;
      }

      .checklist {
        list-style: none;
        margin: 0.75rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.3rem;
        font-size: 0.85rem;
      }

      .checklist li {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--text-subtle);
      }

      .checklist li.done {
        color: var(--text);
      }

      @media (max-width: 960px) {
        .form-layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class ShopFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly categories = signal<Category[]>([]);
  readonly selectedCategories = signal<number[]>([]);
  readonly shopId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly logoUrl = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly locationError = signal<string | null>(null);
  /** §17's checklist, as the server last computed it. */
  readonly profile = signal<ShopProfileStatus | null>(null);
  readonly openingHours = signal<OpeningHours | null>(null);

  readonly isEdit = computed(() => this.shopId() !== null);

  /** How the current pin was chosen, so §24 can record it (default: typed in). */
  private locationSource: LocationSource = 'MANUAL';
  private locationAccuracy: number | null = null;
  private placeId: string | null = null;
  private locationConfirmed = false;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    description: [''],
    contactNumber: [''],
    email: ['', [Validators.email]],
    whatsapp: [''],
    websiteUrl: [''],
    instagram: [''],
    facebook: [''],
    status: ['active' as 'active' | 'inactive'],
    // Business §17/§32. Super Admin only - the control is not rendered for
    // anyone else, and the API ignores the value regardless of what is sent.
    acquisitionChannel: [''],

    // The shop's own location - its primary branch (§4 + §19).
    branchName: [''],
    address: [''],
    addressLine2: [''],
    area: [''],
    city: [''],
    state: [''],
    country: ['India'],
    pincode: [''],
    latitude: [null as number | null],
    longitude: [null as number | null],
    // This location's own contact details, as distinct from the business's.
    // Required to publish an offer here, never to save (§18).
    branchContactNumber: [''],
    contactPersonName: [''],
    contactPersonEmail: ['', [Validators.email]],
  });

  /**
   * §18: a shop may only go live with a full location, so the required marks
   * follow the status field. Saving an unfinished shop as inactive stays open,
   * which is how a merchant parks the work half-done.
   */
  readonly locationRequired = signal(true);

  /** Seeds the picker's search box when a shop has an address but no pin. */
  readonly addressHint = signal('');

  /**
   * Acquisition channels already in use, offered as a datalist so the common
   * case is picking an existing one. Loaded from the business filter options,
   * which is the same list the dashboard groups by - so what a Super Admin is
   * offered here is exactly what they will be able to filter on there.
   */
  readonly knownChannels = signal<string[]>([]);

  constructor() {
    this.api.listCategories({ status: 'all' }).subscribe((categories) => this.categories.set(categories));

    if (this.auth.isSuperAdmin) {
      this.api.businessFilterOptions().subscribe({
        next: (options) => this.knownChannels.set(options.acquisitionChannels),
        // Losing the suggestions costs the merchant nothing - the field is
        // still free text - so this must not put an error on a shop form.
        error: () => undefined,
      });
    }
    this.syncLocationValidators();
    this.form.controls.status.valueChanges.subscribe(() => this.syncLocationValidators());

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.shopId.set(Number(id));
      this.loadShop(Number(id));
    }
  }

  private loadShop(id: number): void {
    this.loading.set(true);
    this.api.getShop(id).subscribe({
      next: (shop) => {
        const branch =
          shop.branches?.find((entry) => entry.isPrimary) ?? shop.branches?.[0] ?? null;

        this.form.patchValue({
          name: shop.name,
          description: shop.description ?? '',
          contactNumber: shop.contactNumber ?? '',
          email: shop.email ?? '',
          whatsapp: shop.socialLinks?.['whatsapp'] ?? '',
          websiteUrl: shop.websiteUrl ?? '',
          instagram: shop.socialLinks?.['instagram'] ?? '',
          facebook: shop.socialLinks?.['facebook'] ?? '',
          status: shop.status,
          acquisitionChannel: shop.acquisitionChannel ?? '',
          ...this.branchPatch(branch),
        });
        this.locationSource = branch?.locationSource ?? 'MANUAL';
        this.locationAccuracy = branch?.locationAccuracy ?? null;
        this.placeId = branch?.placeId ?? null;
        // Coordinates that are already stored were confirmed when they were
        // saved; §8's confirmation is only owed again once the pin moves.
        this.locationConfirmed = branch?.latitude !== null && branch?.latitude !== undefined;
        this.addressHint.set(this.hintFrom(branch));

        this.logoUrl.set(shop.logoUrl);
        this.openingHours.set(shop.openingHours);
        this.selectedCategories.set(shop.categories.map((category) => category.id));
        this.profile.set(shop.profile ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('That shop could not be loaded.');
        void this.router.navigateByUrl('/admin/shops');
      },
    });
  }

  private branchPatch(branch: Branch | null) {
    return {
      branchName: branch?.branchName ?? '',
      address: branch?.address ?? '',
      addressLine2: branch?.addressLine2 ?? '',
      area: branch?.area ?? '',
      city: branch?.city ?? '',
      state: branch?.state ?? '',
      country: branch?.country ?? 'India',
      pincode: branch?.pincode ?? '',
      latitude: branch?.latitude ?? null,
      longitude: branch?.longitude ?? null,
      branchContactNumber: branch?.contactNumber ?? '',
      contactPersonName: branch?.contactPersonName ?? '',
      contactPersonEmail: branch?.contactPersonEmail ?? '',
    };
  }

  /** What to type into the picker's search box for a shop with no pin yet. */
  private hintFrom(branch: Branch | null): string {
    if (!branch || branch.latitude !== null) return '';
    return [branch.address, branch.area, branch.city, branch.state, branch.pincode]
      .filter(Boolean)
      .join(', ');
  }

  /**
   * §18's required list, mirrored client side so the merchant is told before
   * the request rather than by it. The server enforces the same rule; this
   * only saves a round trip.
   */
  private syncLocationValidators(): void {
    const required = this.form.controls.status.value === 'active';
    if (required === this.locationRequired() && this.form.controls.city.validator) return;

    this.locationRequired.set(required);
    for (const name of ['address', 'city', 'pincode'] as const) {
      const control = this.form.controls[name];
      if (required) control.addValidators(Validators.required);
      else control.removeValidators(Validators.required);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  /**
   * §8: the merchant pressed Confirm on the map.
   *
   * Address fields the geocoder can name are filled in only where they are
   * still empty - what the merchant typed is what they meant, and having the
   * map quietly rewrite their own address is how a correct pin ends up
   * attached to a wrong address.
   */
  onLocationPicked(location: PickedLocation): void {
    this.locationError.set(null);
    this.locationSource = location.source;
    this.locationAccuracy = location.accuracy;
    this.placeId = location.placeId;
    this.locationConfirmed = true;

    const patch: Record<string, unknown> = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const fill = (control: 'address' | 'area' | 'city' | 'state' | 'country' | 'pincode', value: string | null) => {
      if (value && !this.form.controls[control].value.trim()) patch[control] = value;
    };
    fill('address', location.address?.addressLine1 ?? null);
    fill('area', location.address?.area ?? null);
    fill('city', location.address?.city ?? null);
    fill('state', location.address?.state ?? null);
    fill('country', location.address?.country ?? null);
    fill('pincode', location.address?.pincode ?? null);

    this.form.patchValue(patch);
    this.toast.success('Location confirmed.');
  }

  error(control: string, label: string): string | null {
    return errorFor(this.form.get(control), label);
  }

  toggleCategory(id: number): void {
    this.selectedCategories.update((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }

  isCategorySelected(id: number): boolean {
    return this.selectedCategories().includes(id);
  }

  uploadLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.api.uploadImage('shops', file).subscribe({
      next: (result) => {
        this.logoUrl.set(result.url);
        this.uploading.set(false);
      },
      error: () => this.uploading.set(false),
    });
    input.value = '';
  }

  save(): void {
    this.formError.set(null);
    this.locationError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    // §18 and §8 together: a shop going live needs a pin, and one the merchant
    // has actually looked at. The server checks the first; only the form knows
    // whether the second happened in this session.
    if (this.locationRequired() && value.latitude === null) {
      this.locationError.set(
        'Confirm the shop location on the map before making the shop live, or set the status to inactive for now.',
      );
      return;
    }

    const socialLinks: Record<string, string> = {};
    if (value.instagram) socialLinks['instagram'] = value.instagram;
    if (value.facebook) socialLinks['facebook'] = value.facebook;
    if (value.whatsapp) socialLinks['whatsapp'] = value.whatsapp;

    const payload: Record<string, unknown> = {
      name: value.name,
      description: value.description || null,
      logoUrl: this.logoUrl(),
      contactNumber: value.contactNumber || null,
      email: value.email || null,
      websiteUrl: value.websiteUrl || null,
      socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
      openingHours: this.openingHours(),
      status: value.status,
      categoryIds: this.selectedCategories(),
    };

    // Only sent by someone who may set it. The API enforces the same rule, so
    // this is about not sending a field the user was never shown rather than
    // about access control.
    if (this.auth.isSuperAdmin) {
      payload['acquisitionChannel'] = value.acquisitionChannel.trim() || null;
    }

    // Sent on create and edit alike: on edit the API treats it as the shop's
    // primary branch, which is what makes §19's "edit location" one form.
    const hasLocation = Boolean(
      value.address.trim() || value.city.trim() || value.pincode.trim() || value.latitude !== null,
    );
    if (hasLocation) {
      payload['primaryBranch'] = {
        // A single-location shop has no meaningful branch name of its own, so
        // it borrows the shop's rather than making it another required field.
        branchName: value.branchName.trim() || value.name.trim(),
        address: value.address || null,
        addressLine2: value.addressLine2 || null,
        area: value.area || null,
        city: value.city,
        state: value.state || null,
        country: value.country || null,
        pincode: value.pincode || null,
        latitude: value.latitude,
        longitude: value.longitude,
        locationSource: value.latitude === null ? null : this.locationSource,
        locationAccuracy: this.locationAccuracy,
        placeId: this.placeId,
        locationConfirmed: this.locationConfirmed,
        // Omitted rather than sent empty: the server reads a missing field as
        // "leave what is there", so clearing the form never wipes a contact
        // person somebody set on the branches screen.
        ...(value.branchContactNumber.trim()
          ? { contactNumber: value.branchContactNumber.trim() }
          : {}),
        ...(value.contactPersonName.trim()
          ? { contactPersonName: value.contactPersonName.trim() }
          : {}),
        ...(value.contactPersonEmail.trim()
          ? { contactPersonEmail: value.contactPersonEmail.trim() }
          : {}),
        isPrimary: true,
      };
    }

    this.saving.set(true);
    const id = this.shopId();
    const request = id
      ? this.api.updateShop(id, payload as never)
      : this.api.createShop(payload as never);

    request.subscribe({
      next: (shop) => {
        this.saving.set(false);
        this.toast.success(id ? 'Shop updated.' : `${shop.name} created.`);
        // A new membership may have appeared, so refresh the cached user.
        this.auth.reload().subscribe();
        void this.router.navigateByUrl(id ? '/admin/shops' : `/admin/shops/${shop.id}/branches`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(applyServerErrors(this.form, error));
      },
    });
  }
}
