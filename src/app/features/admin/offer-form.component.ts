import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { AiService } from '../../core/ai.service';
import { AiOfferFacts, ContentSection } from '../../core/ai.models';
import { Branch, BranchPublishBlocker, Category, Offer, OfferPayload, Shop } from '../../core/models';
import { PERMISSIONS } from '../../core/permissions';
import { applyServerErrors, errorFor } from '../auth/auth-shell';
import { AiContentPanelComponent } from '../ai/ai-content-panel.component';
import { IconComponent } from '../../shared/icon.component';
import { ImageUploader } from '../../shared/image-upload';
import { FormDraft } from '../../shared/form-draft';

/** Suggested headlines, matching the promotion examples in §13. */
const HEADLINE_PRESETS = [
  'Buy 2 Get 1 Free',
  'Buy 3 Get 3 Free',
  'Flat 50% Off',
  'Up to 70% Off',
  '₹500 Off on purchases above ₹2,000',
];

/** Post / edit an offer (§13). Handles create and edit through the same form. */
@Component({
  selector: 'app-offer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AiContentPanelComponent, IconComponent],
  templateUrl: './offer-form.component.html',
  styleUrl: './offer-form.component.scss',
})
export class OfferFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly ai = inject(AiService);
  readonly auth = inject(AuthService);

  readonly headlinePresets = HEADLINE_PRESETS;
  /** Set when the form was opened from an AI recommendation (§9). */
  readonly fromAi = signal(false);
  /** The history row that pre-fill came from, so accepting it is recorded (§33). */
  private aiHistoryId: number | null = null;
  readonly shops = signal<Shop[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly branches = signal<Branch[]>([]);
  /**
   * §48. Holds the gallery, and holds on to anything that failed so the
   * merchant can retry just those files without re-sending the ones that
   * already made it - and without losing the rest of this form.
   */
  readonly uploader = new ImageUploader('offers', 8);
  readonly images = this.uploader.images;
  readonly selectedBranchIds = signal<number[]>([]);

  readonly offerId = signal<number | null>(null);
  /**
   * §36. Autosaves the fields so a dropped connection, a reload or a closed
   * tab does not cost the merchant a twenty-field offer. Images are not part
   * of it - a File cannot be serialised - which the restore note says out loud
   * rather than leaving the merchant to discover.
   */
  readonly draft = new FormDraft<Record<string, unknown>>('offer-new');
  readonly shopsLoaded = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = this.uploader.uploading;
  readonly formError = signal<string | null>(null);
  readonly existing = signal<Offer | null>(null);

  readonly isEdit = computed(() => this.offerId() !== null);

  readonly form = this.fb.nonNullable.group({
    shopId: [null as number | null, [Validators.required]],
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    productName: [''],
    description: [''],
    categoryId: [null as number | null],
    subcategoryId: [null as number | null],

    offerText: ['', [Validators.maxLength(200)]],
    offerType: ['percentage'],
    discountType: ['percentage'],
    discountValue: [null as number | null],
    originalPrice: [null as number | null],
    discountedPrice: [null as number | null],
    buyQuantity: [null as number | null],
    getQuantity: [null as number | null],

    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    isRecurring: [false],
    recurrenceType: ['' as string],

    applicabilityType: ['shop_wide'],

    // Claim rules. The defaults are the ordinary shop's answer, so a merchant
    // who never opens this section still gets one code each, used once.
    claimLimitPerCustomer: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    totalClaimLimit: [null as number | null, [Validators.min(1)]],
    claimValidityHours: [null as number | null, [Validators.min(1), Validators.max(8760)]],
    maxRedemptionsPerClaim: [1, [Validators.required, Validators.min(1), Validators.max(100)]],

    minPurchase: [null as number | null],
    applicableProducts: [''],
    eligibility: [''],
    usageRestrictions: [''],
    termsConditions: [''],

    status: ['draft' as 'draft' | 'scheduled' | 'active'],
  });

  constructor() {
    // Only shops the user may post for; the API enforces the same restriction.
    // `mine` keeps an Admin scoped to their own shops without needing the
    // wider EDIT_SHOP permission that listing every shop would require.
    this.api
      .listShops(
        this.auth.isSuperAdmin
          ? { limit: 100, status: 'all', sort: 'name' }
          : { mine: true, limit: 100, status: 'all', sort: 'name' },
      )
      .subscribe({
        next: (page) => {
          const allowed = page.items.filter(
            (shop) =>
              this.auth.hasForShop(shop.id, PERMISSIONS.CREATE_OFFER) ||
              this.auth.hasForShop(shop.id, PERMISSIONS.EDIT_OFFER),
          );
          this.shops.set(allowed.length ? allowed : page.items);
          this.shopsLoaded.set(true);
          // The shop comes from the user's role, so pick it for them rather
          // than presenting a one-option dropdown.
          if (!this.isEdit() && !this.form.controls.shopId.value && this.shops().length) {
            this.form.patchValue({ shopId: this.shops()[0].id });
            this.onShopChange();
          }
        },
        error: () => this.shopsLoaded.set(true),
      });

    this.api.listCategories().subscribe((categories) => this.categories.set(categories));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.offerId.set(Number(id));
      this.loadOffer(Number(id));
    } else {
      // Sensible defaults: starts now, runs for two weeks.
      this.form.patchValue({
        startDate: this.toLocalInput(new Date()),
        endDate: this.toLocalInput(new Date(Date.now() + 14 * 86400000)),
      });
      this.applyAiPrefill();

      // §36. Restored *after* the defaults and the AI pre-fill, so a real
      // draft wins over both - the merchant's own half-finished work is the
      // most recent intent on the screen. Watching starts afterwards so this
      // restore does not immediately overwrite what it just read.
      this.draft.restoreInto(this.form);
      this.draft.watch(this.form);
    }
  }

  /** §36's discard: the merchant would rather start clean. */
  discardDraft(): void {
    this.draft.clear();
    this.form.reset({
      startDate: this.toLocalInput(new Date()),
      endDate: this.toLocalInput(new Date(Date.now() + 14 * 86400000)),
      claimLimitPerCustomer: 1,
      maxRedemptionsPerClaim: 1,
      offerType: 'percentage',
      discountType: 'percentage',
      applicabilityType: 'shop_wide',
      status: 'draft',
      shopId: this.shops().length ? this.shops()[0].id : null,
    });
  }

  /**
   * Fills the form from a recommendation the admin chose in the AI assistant
   * (§9). This is the whole hand-off: a pre-filled form, with every field still
   * editable and nothing saved. §10 keeps publishing with the admin.
   */
  private applyAiPrefill(): void {
    const staged = this.ai.takePrefill();
    if (!staged) return;

    const { prefill, historyId } = staged;
    this.aiHistoryId = historyId;
    this.fromAi.set(true);

    this.form.patchValue({
      shopId: prefill.shopId,
      title: prefill.title,
      offerText: prefill.offerText ?? '',
      description: prefill.description ?? '',
      productName: prefill.productName ?? '',
      offerType: prefill.offerType,
      discountType: prefill.discountType,
      discountValue: prefill.discountValue,
      buyQuantity: prefill.buyQuantity,
      getQuantity: prefill.getQuantity,
      startDate: this.toLocalInput(new Date(prefill.startDate)),
      endDate: this.toLocalInput(new Date(prefill.endDate)),
      // Deliberately left as a draft: the AI must never put an offer live (§10).
      status: 'draft',
    });

    // The category arrives as a name; match it to the real list once loaded.
    if (prefill.categoryName) this.matchCategory(prefill.categoryName);
    if (prefill.shopId) this.loadBranches(prefill.shopId);
  }

  /** Best-effort match of an AI-suggested category name to a real category. */
  private matchCategory(name: string): void {
    const apply = () => {
      const wanted = name.trim().toLowerCase();
      const match = this.categories().find(
        (category) => category.name.toLowerCase() === wanted,
      );
      if (match) this.form.patchValue({ categoryId: match.id });
    };
    if (this.categories().length) apply();
    // Categories load asynchronously, so retry once they have arrived.
    else setTimeout(apply, 600);
  }

  private loadOffer(id: number): void {
    this.loading.set(true);
    this.api.getOffer(id).subscribe({
      next: (offer) => {
        this.existing.set(offer);
        this.form.patchValue({
          shopId: offer.shop.id,
          title: offer.title,
          productName: offer.productName ?? '',
          description: offer.description ?? '',
          categoryId: offer.category?.id ?? null,
          subcategoryId: offer.subcategory?.id ?? null,
          offerText: offer.offerText ?? '',
          offerType: offer.offerType,
          discountType: offer.discountType,
          discountValue: offer.discountValue,
          originalPrice: offer.originalPrice,
          discountedPrice: offer.discountedPrice,
          buyQuantity: offer.buyQuantity,
          getQuantity: offer.getQuantity,
          startDate: this.toLocalInput(new Date(offer.startDate)),
          endDate: this.toLocalInput(new Date(offer.endDate)),
          isRecurring: offer.isRecurring,
          recurrenceType: offer.recurrenceType ?? '',
          applicabilityType: offer.applicabilityType,
          claimLimitPerCustomer: offer.claimLimitPerCustomer ?? 1,
          totalClaimLimit: offer.totalClaimLimit,
          claimValidityHours: offer.claimValidityHours,
          maxRedemptionsPerClaim: offer.maxRedemptionsPerClaim ?? 1,
          minPurchase: offer.minPurchase,
          applicableProducts: offer.applicableProducts ?? '',
          eligibility: offer.eligibility ?? '',
          usageRestrictions: offer.usageRestrictions ?? '',
          termsConditions: offer.termsConditions ?? '',
          // Editing never silently republishes a draft or deactivated offer.
          status: offer.status === 'active' ? 'active' : 'draft',
        });

        this.uploader.set(
          (offer.images ?? []).map((image) => ({ url: image.url, thumbnailUrl: image.thumbnailUrl })),
        );
        this.selectedBranchIds.set(offer.branchIds ?? []);
        this.loadBranches(offer.shop.id);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('That offer could not be loaded.');
        void this.router.navigateByUrl('/admin/offers');
      },
    });
  }

  onShopChange(): void {
    const shopId = this.form.controls.shopId.value;
    this.selectedBranchIds.set([]);
    if (shopId) this.loadBranches(shopId);
    else this.branches.set([]);
  }

  private loadBranches(shopId: number): void {
    this.api.listBranches(shopId).subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => this.branches.set([]),
    });
  }

  // ---- Offer type helpers -------------------------------------------------

  /** Keeps discountType consistent with the chosen offerType (§31). */
  onOfferTypeChange(): void {
    const type = this.form.controls.offerType.value;
    const mapping: Record<string, string> = {
      percentage: 'percentage',
      up_to: 'percentage',
      flat: 'flat',
      price_drop: 'flat',
      buy_x_get_y: 'none',
      other: 'none',
    };
    this.form.patchValue({ discountType: mapping[type] ?? 'percentage' });
  }

  get showPercentage(): boolean {
    return ['percentage', 'up_to'].includes(this.form.controls.offerType.value);
  }

  get showFlat(): boolean {
    return ['flat', 'price_drop'].includes(this.form.controls.offerType.value);
  }

  get showBuyGet(): boolean {
    return this.form.controls.offerType.value === 'buy_x_get_y';
  }

  get showPricing(): boolean {
    return ['price_drop', 'flat', 'percentage', 'up_to'].includes(this.form.controls.offerType.value);
  }

  applyPreset(preset: string): void {
    this.form.patchValue({ offerText: preset });
  }

  toggleBranch(branchId: number): void {
    this.selectedBranchIds.update((ids) =>
      ids.includes(branchId) ? ids.filter((id) => id !== branchId) : [...ids, branchId],
    );
  }

  isBranchSelected(branchId: number): boolean {
    return this.selectedBranchIds().includes(branchId);
  }

  // -------------------------------------------------------------------------
  // The publish gate (§18)
  // -------------------------------------------------------------------------

  /**
   * The branches this offer would actually appear at, by the same rule the
   * server applies: every active branch for a shop-wide offer, the chosen ones
   * for a targeted offer, and none at all for an online one - an online offer
   * has no counter for a customer to walk into.
   *
   * A method and not a `computed`, deliberately. `applicabilityType` lives on
   * the form, and a form control is not a signal, so a computed reading it
   * never invalidates: it captured 'shop_wide' on first render and went on
   * warning about incomplete branches after the merchant had switched the
   * offer to Online. The template re-reads this each change-detection pass
   * instead, which is what the control's own bindings already do.
   */
  private targetedBranches(): Branch[] {
    const applicability = this.form.controls.applicabilityType.value;
    if (applicability === 'online') return [];

    // Inactive branches are never checked by the gate, because they are never
    // offered to customers - that is the merchant's exit when they cannot
    // complete one.
    const active = this.branches().filter((branch) => branch.status === 'active');
    if (applicability === 'shop_wide') return active;

    const chosen = this.selectedBranchIds();
    return active.filter((branch) => chosen.includes(branch.id));
  }

  /**
   * Which of them are not ready, and why.
   *
   * Shown before the merchant presses Publish rather than only in the 422 that
   * comes back from it. The server still decides - this is the same list it
   * would send - but a twenty-field form is a bad place to learn that the
   * problem is on a different screen entirely.
   */
  incompleteBranches(): { branch: Branch; blockers: BranchPublishBlocker[] }[] {
    return this.targetedBranches()
      .map((branch) => ({ branch, blockers: branch.publishBlockers ?? [] }))
      .filter((entry) => entry.blockers.length > 0);
  }

  /**
   * How many requirements a branch still fails, or zero for one the gate will
   * not look at - which an inactive branch always is, whatever state its
   * fields are in.
   */
  branchBlockerCount(branch: Branch): number {
    if (branch.status !== 'active') return 0;
    return (branch.publishBlockers ?? []).length;
  }

  missingFor(branch: Branch): string {
    return (branch.publishBlockers ?? []).map((blocker) => blocker.label).join(', ');
  }

  selectAllBranches(): void {
    this.selectedBranchIds.set(this.branches().map((branch) => branch.id));
  }

  // ---- Images -------------------------------------------------------------

  uploadImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // The picker is cleared straight away so choosing the same file twice still
    // fires a change event - which is exactly what "choose another image" after
    // a failure often turns out to be.
    input.value = '';
    if (!files.length) return;

    if (this.uploader.room <= 0) {
      this.toast.info('You can attach up to 8 images.');
      return;
    }
    this.uploader.add(files);
  }

  removeImage(index: number): void {
    this.uploader.remove(index);
  }

  moveImage(index: number, direction: -1 | 1): void {
    this.uploader.move(index, direction);
  }

  // ---- AI content generation (§15-§22) ------------------------------------

  /**
   * The offer as it stands right now, for the content panel.
   *
   * A function rather than a value so the panel always reads the live form -
   * generated copy has to describe what is actually on screen (§23).
   */
  readonly aiFacts = (): AiOfferFacts => {
    const value = this.form.getRawValue();
    const category = this.categories().find((item) => item.id === value.categoryId);
    return {
      title: value.title || null,
      productName: value.productName || null,
      categoryName: category?.name ?? null,
      offerType: value.offerType as AiOfferFacts['offerType'],
      offerText: value.offerText || null,
      discountType: value.discountType as AiOfferFacts['discountType'],
      discountValue: value.discountValue,
      originalPrice: value.originalPrice,
      discountedPrice: value.discountedPrice,
      buyQuantity: value.buyQuantity,
      getQuantity: value.getQuantity,
      minPurchase: value.minPurchase,
      startDate: value.startDate ? new Date(value.startDate).toISOString() : null,
      endDate: value.endDate ? new Date(value.endDate).toISOString() : null,
      termsConditions: value.termsConditions || null,
      eligibility: value.eligibility || null,
      usageRestrictions: value.usageRestrictions || null,
      applicableProducts: value.applicableProducts || null,
    };
  };

  /** There is nothing to write about until the offer says what it is. */
  get aiReady(): boolean {
    const value = this.form.getRawValue();
    return Boolean(value.title?.trim() || value.offerText?.trim() || value.productName?.trim());
  }

  /** Puts an accepted piece of AI copy into the matching field (§35). */
  applyAiContent(event: { section: ContentSection | 'terms'; text: string }): void {
    switch (event.section) {
      case 'title':
        this.form.patchValue({ title: event.text.slice(0, 200) });
        break;
      case 'shortDescription':
      case 'detailedDescription':
        this.form.patchValue({ description: event.text });
        break;
      case 'bannerText':
      case 'pushNotification':
      case 'socialCaption':
        // These are not offer fields: the admin copies them into the banner or
        // notification tools, so the form only offers them as a headline.
        this.form.patchValue({ offerText: event.text.split('\n')[0].slice(0, 200) });
        break;
      case 'terms': {
        const existing = this.form.controls.termsConditions.value;
        this.form.patchValue({
          termsConditions: existing ? `${existing}\n${event.text}` : event.text,
        });
        break;
      }
    }
  }

  // ---- Save ---------------------------------------------------------------

  error(control: string, label: string): string | null {
    return errorFor(this.form.get(control), label);
  }

  save(status: 'draft' | 'scheduled' | 'active'): void {
    this.formError.set(null);
    this.form.patchValue({ status });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Some required fields still need attention.');
      return;
    }

    const value = this.form.getRawValue();

    if (value.applicabilityType === 'selected_branches' && this.selectedBranchIds().length === 0) {
      this.formError.set('Choose at least one branch, or make the offer shop-wide.');
      return;
    }

    const payload: OfferPayload = {
      shopId: value.shopId!,
      categoryId: value.categoryId,
      subcategoryId: value.subcategoryId,
      title: value.title,
      productName: value.productName || null,
      description: value.description || null,
      offerText: value.offerText || null,
      offerType: value.offerType as OfferPayload['offerType'],
      discountType: value.discountType as OfferPayload['discountType'],
      discountValue: value.discountValue,
      originalPrice: value.originalPrice,
      discountedPrice: value.discountedPrice,
      buyQuantity: value.buyQuantity,
      getQuantity: value.getQuantity,
      minPurchase: value.minPurchase,
      termsConditions: value.termsConditions || null,
      eligibility: value.eligibility || null,
      usageRestrictions: value.usageRestrictions || null,
      applicableProducts: value.applicableProducts || null,
      isRecurring: value.isRecurring,
      recurrenceType: value.isRecurring ? value.recurrenceType || null : null,
      startDate: new Date(value.startDate).toISOString(),
      endDate: new Date(value.endDate).toISOString(),
      status,
      applicabilityType: value.applicabilityType as OfferPayload['applicabilityType'],
      branchIds: value.applicabilityType === 'selected_branches' ? this.selectedBranchIds() : [],
      claimLimitPerCustomer: value.claimLimitPerCustomer ?? 1,
      totalClaimLimit: value.totalClaimLimit,
      claimValidityHours: value.claimValidityHours,
      maxRedemptionsPerClaim: value.maxRedemptionsPerClaim ?? 1,
      images: this.images().map((image) => ({ url: image.url, thumbnailUrl: image.thumbnailUrl })),
    };

    this.saving.set(true);
    const id = this.offerId();
    const request = id ? this.api.updateOffer(id, payload) : this.api.createOffer(payload);

    request.subscribe({
      next: (offer) => {
        this.saving.set(false);
        // §33: the recommendation was acted on, so the history row says so.
        if (this.aiHistoryId) {
          this.ai.setHistoryOutcome(this.aiHistoryId, 'accepted', offer.id).subscribe({
            error: () => undefined,
          });
          this.aiHistoryId = null;
        }
        // The work is on the server now, so the local copy must go - a draft
        // that outlives its save is a stale version waiting to be restored
        // over a newer one.
        this.draft.clear();
        this.toast.success(
          id ? 'Offer updated.' : `Offer created and saved as ${offer.status}.`,
        );
        void this.router.navigateByUrl('/admin/offers');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(applyServerErrors(this.form, error));
      },
    });
  }

  /** `datetime-local` needs a local-time string without a timezone suffix. */
  private toLocalInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }

  shopName(): string {
    const id = this.form.controls.shopId.value;
    return this.shops().find((shop) => shop.id === id)?.name ?? 'YOUR SHOP';
  }

  /** With a single shop there is nothing to choose - show it as a fact. */
  get hasSingleShop(): boolean {
    return this.shops().length === 1;
  }

  get selectedShopName(): string {
    const id = this.form.controls.shopId.value;
    return this.shops().find((shop) => shop.id === id)?.name ?? '';
  }

  /** Live preview of what the card will say. */
  get previewHeadline(): string {
    const value = this.form.getRawValue();
    if (value.offerText) return value.offerText;
    switch (value.offerType) {
      case 'buy_x_get_y':
        return value.buyQuantity && value.getQuantity
          ? `Buy ${value.buyQuantity} Get ${value.getQuantity} Free`
          : 'Buy X Get Y';
      case 'up_to':
        return value.discountValue ? `Up to ${value.discountValue}% OFF` : 'Up to … % OFF';
      case 'price_drop':
        return value.discountedPrice
          ? `₹${value.discountedPrice}${value.originalPrice ? ` instead of ₹${value.originalPrice}` : ''}`
          : 'Price drop';
      case 'flat':
        return value.discountValue ? `₹${value.discountValue} OFF` : 'Flat discount';
      default:
        return value.discountValue ? `${value.discountValue}% OFF` : 'Percentage off';
    }
  }
}
