/** Shared API contracts. These mirror the shapes the Express layer returns. */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  unread?: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface ShopMembership {
  shopId: number;
  shopName: string;
  shopSlug: string;
  shopLogoUrl: string | null;
  branchId: number | null;
  designation: string | null;
  roleName: string | null;
  permissions: string[];
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  preferredLocation: PreferredLocation | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  /** True when the user administers anything at all (any shop, or globally). */
  canAccessAdmin: boolean;
  /**
   * Shop-scoped roles the user holds that are inert because they have not been
   * assigned to a shop yet - surfaced so the situation is explained, not silent.
   */
  unassignedShopRoles: string[];
  shops: ShopMembership[];
  unreadNotifications?: number;
}

export interface PreferredLocation {
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AuthSession {
  user: CurrentUser;
  accessToken: string;
  /**
   * Also returned for non-browser clients. The web app ignores it: its refresh
   * token arrives as an httpOnly cookie instead (§22).
   */
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  /** Seconds until the refresh token expires - the "stay logged in" window. */
  refreshExpiresIn?: number;
  familyId?: string;
}

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  emailVerified: boolean;
  avatarUrl: string | null;
  preferredLocation: PreferredLocation;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { id: number; name: string }[];
  shops: { id: number; name: string }[];
  memberships?: UserMembership[];
}

export interface UserMembership {
  id: number;
  shopId: number;
  shopName: string;
  branchId: number | null;
  branchName: string | null;
  designation: string | null;
  status: string;
  roleName: string | null;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  /** 'shop' roles only take effect for shops the holder is a member of. */
  scope: 'global' | 'shop';
  status: 'active' | 'inactive';
  isSystem: boolean;
  userCount?: number;
  permissions: { id: number; name: string }[];
}

export interface Permission {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  isBuiltIn: boolean;
  roleCount?: number;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  parentId: number | null;
  status: 'active' | 'inactive';
  offerCount?: number;
  serviceCount?: number;
  shopCount?: number;
  isFollowing?: boolean;
  /** Only returned by the "categories I follow" endpoint. */
  activeOfferCount?: number;
  followedAt?: string;
}

/** Where a shop's map pin came from (V3 §24). */
export type LocationSource = 'ADDRESS_SEARCH' | 'MAP_PIN' | 'CURRENT_LOCATION' | 'MANUAL';

/** A day is either shut or a list of open/close windows (V3 §3). */
export type OpeningHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', 'closed' | { open: string; close: string }[]>
>;

export interface Branch {
  id: number;
  shopId: number;
  branchName: string;
  address: string | null;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: LocationSource | null;
  locationAccuracy: number | null;
  locationConfirmedAt: string | null;
  placeId: string | null;
  openingHours: OpeningHours | null;
  contactNumber: string | null;
  isPrimary: boolean;
  status: 'active' | 'inactive';
  offerCount?: number;
  distanceKm: number | null;
}

/** A geocoder answer, as returned by `/geo/search` and `/geo/reverse`. */
export interface GeoPlace {
  latitude: number;
  longitude: number;
  label: string | null;
  placeId: string | null;
  address: {
    addressLine1: string | null;
    area: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
  };
}

/** One row of the §17 profile-completion checklist. */
export interface ProfileChecklistItem {
  key: string;
  label: string;
  required: boolean;
  done: boolean;
}

/** §17 progress bar plus the §18 publish verdict. Owners and staff only. */
export interface ShopProfileStatus {
  percent: number;
  canPublish: boolean;
  missingRequired: string[];
  items: ProfileChecklistItem[];
}

export interface Shop {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  contactNumber: string | null;
  email: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string> | null;
  openingHours: OpeningHours | null;
  status: 'active' | 'inactive';
  /**
   * How this merchant was acquired (Business §17, §32). Sales attribution
   * rather than a shop detail: only a Super Admin's value is stored, and the
   * API silently ignores anyone else's.
   */
  acquisitionChannel?: string | null;
  branchCount?: number;
  activeOfferCount?: number;
  followerCount?: number;
  isFollowing?: boolean;
  distanceKm: number | null;
  city: string | null;
  categories: { id: number; name: string; slug: string }[];
  branches?: Branch[];
  rating?: RatingSummary;
  /** Present only for someone who can edit the shop. */
  profile?: ShopProfileStatus;
}

export interface ShopMember {
  id: number;
  shopId: number;
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  userStatus: string;
  branchId: number | null;
  branchName: string | null;
  roleId: number | null;
  roleName: string | null;
  designation: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export type OfferStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'deactivated';
export type OfferType = 'percentage' | 'flat' | 'buy_x_get_y' | 'price_drop' | 'up_to' | 'other';
export type DiscountType = 'percentage' | 'flat' | 'none';
export type ApplicabilityType = 'shop_wide' | 'selected_branches' | 'online';

export interface RatingSummary {
  count: number;
  average: number | null;
}

export interface OfferImage {
  id: number;
  url: string;
  thumbnailUrl: string | null;
  displayOrder: number;
}

export interface Offer {
  id: number;
  title: string;
  productName: string | null;
  description: string | null;
  offerText: string | null;
  offerType: OfferType;
  discountType: DiscountType;
  discountValue: number | null;
  originalPrice: number | null;
  discountedPrice: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minPurchase: number | null;
  termsConditions: string | null;
  eligibility: string | null;
  usageRestrictions: string | null;
  applicableProducts: string | null;
  isRecurring: boolean;
  recurrenceType: string | null;
  startDate: string;
  endDate: string;
  status: OfferStatus;
  applicabilityType: ApplicabilityType;
  /** Claim rules. Defaults are one code per customer, one use, no cap. */
  claimLimitPerCustomer: number;
  totalClaimLimit: number | null;
  /** Hours a code lives once issued; null means "until the offer ends". */
  claimValidityHours: number | null;
  maxRedemptionsPerClaim: number;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  clickCount: number;
  favoriteCount: number;
  distanceKm: number | null;
  locationLabel: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  shop: {
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    description?: string | null;
    contactNumber?: string | null;
  };
  category: { id: number; name: string; slug: string } | null;
  subcategory?: { id: number; name: string } | null;
  createdBy?: { id: number; name: string } | null;
  updatedBy?: { id: number; name: string } | null;
  images?: OfferImage[];
  branches?: Branch[];
  branchIds?: number[];
  rating?: RatingSummary;
  /**
   * The signed-in customer's own claim on this offer, when they have one — so
   * the page can show the code instead of the Claim button. Absent for guests.
   */
  myClaim?: { id: number; code: string; status: ClaimStatus; expiresAt: string } | null;
}

export interface OfferQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  categoryId?: number;
  shop?: string;
  shopId?: number;
  branchId?: number;
  city?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  minDiscount?: number;
  maxDiscount?: number;
  offerType?: OfferType;
  status?: OfferStatus | 'all';
  expiringInDays?: number;
  favorites?: boolean;
  following?: boolean;
  manage?: boolean;
  sort?: OfferSort;
}

export type OfferSort =
  | 'newest'
  | 'endingSoon'
  | 'highestDiscount'
  | 'mostViewed'
  | 'mostPopular'
  | 'nearest';

export interface OfferPayload {
  shopId: number;
  categoryId?: number | null;
  subcategoryId?: number | null;
  title: string;
  productName?: string | null;
  description?: string | null;
  offerText?: string | null;
  offerType: OfferType;
  discountType: DiscountType;
  discountValue?: number | null;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  minPurchase?: number | null;
  termsConditions?: string | null;
  eligibility?: string | null;
  usageRestrictions?: string | null;
  applicableProducts?: string | null;
  isRecurring: boolean;
  recurrenceType?: string | null;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled' | 'active';
  applicabilityType: ApplicabilityType;
  branchIds: number[];
  images: { url: string; thumbnailUrl?: string | null }[];
  claimLimitPerCustomer: number;
  totalClaimLimit?: number | null;
  claimValidityHours?: number | null;
  maxRedemptionsPerClaim: number;
}

// ---------------------------------------------------------------------------
// V2
// ---------------------------------------------------------------------------

export type BannerStatus = 'draft' | 'scheduled' | 'published' | 'expired' | 'deactivated';

export interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  desktopImageUrl: string | null;
  buttonText: string;
  offerId: number;
  offerTitle: string;
  offerText: string | null;
  offerStatus: OfferStatus;
  offerEndDate: string;
  offerImageUrl: string | null;
  shop: { id: number; name: string; slug: string; logoUrl: string | null };
  startDate: string;
  endDate: string;
  status: BannerStatus;
  displayOrder: number;
  /** True when the customer feed would show this right now. */
  isLive: boolean;
  impressionCount: number;
  clickCount: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface BannerPayload {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  desktopImageUrl?: string | null;
  offerId: number;
  buttonText: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled' | 'published' | 'deactivated';
  displayOrder: number;
}

export interface SelectableOffer {
  id: number;
  title: string;
  offerText: string | null;
  status: string;
  endDate: string;
  shopName: string;
}

export interface BannerStat {
  id: number;
  title: string;
  status: BannerStatus;
  offerId: number;
  offerTitle: string;
  shopName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  offerViews: number;
}

/** Urgency bucket computed server-side so every client words it the same. */
export interface EndingBucket {
  key: 'urgent' | 'today' | 'tomorrow' | 'three-days' | 'soon';
  label: string;
}

export interface EndingSoonOffer extends Offer {
  endingBucket: EndingBucket;
}

export interface RecommendedOffer extends Offer {
  score: number;
  /** Human explanation, e.g. "Because you follow this shop". */
  reason: string;
}

export type ClaimStatus = 'claimed' | 'redeemed' | 'expired' | 'cancelled' | 'revoked';

/**
 * What a claim is for. A product offer and a service offer are the same
 * workflow end to end — same code, same QR, same verify screen — so they share
 * one type and this says which table the record came from.
 */
export type ClaimKind = 'offer' | 'service_offer';

export interface Claim {
  id: number;
  kind: ClaimKind;
  code: string;
  status: ClaimStatus;
  claimedAt: string;
  /** When the code stops working — always set, and never later than the offer. */
  expiresAt: string;
  redeemedAt: string | null;
  redemptionCount: number;
  maxRedemptions: number;
  verificationMethod: 'QR_SCAN' | 'CODE_ENTRY' | null;
  /**
   * The listing the claim is against. For a service claim `title` is the
   * service's name — "AC Deep Cleaning" is what a customer recognises, and the
   * service offer is only ever a price attached to it.
   */
  offer: { id: number; title: string; offerText: string | null; endDate: string; imageUrl: string | null };
  shop: { id: number; name: string };
  branch: { id: number; name: string } | null;
  /**
   * The signed deep link the QR encodes. Present only on the customer's own
   * claim — the merchant and admin views deliberately never carry it.
   */
  qrValue?: string;
  customer?: { id: number; name: string; phone?: string | null };
  redeemedBy?: { id: number; name: string } | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
}

/** What `POST /redemptions/verify` answers with when the coupon is good. */
export interface ClaimVerification extends Claim {
  verdict: 'READY_TO_REDEEM';
  /** False when the member of staff may scan but not redeem. */
  canRedeem: boolean;
  branchId: number | null;
}

/**
 * Why a verification failed. The server sends the same generic sentence for a
 * bad code and for another shop's code; these are the ones it will name.
 */
export type ClaimRejectionReason =
  | 'NOT_FOUND'
  | 'WRONG_BRANCH'
  | 'EXPIRED'
  | 'ALREADY_REDEEMED'
  | 'CANCELLED'
  | 'REVOKED';

export interface RedemptionSummary {
  claimsToday: number;
  redemptionsToday: number;
  pending: number;
  claimsTotal: number;
  redemptionsTotal: number;
  /** Percentage, or null when nothing has been claimed yet. */
  claimToRedemption: number | null;
}

export interface ClaimAuditEvent {
  id: number;
  action: 'VERIFIED' | 'REDEEMED' | 'REJECTED' | 'REVOKED';
  reason: string | null;
  method: 'QR_SCAN' | 'CODE_ENTRY';
  at: string;
  branch: { id: number; name: string } | null;
  actor: { id: number; name: string } | null;
}

export interface ClaimAudit {
  claim: Claim;
  events: ClaimAuditEvent[];
}

export interface VerificationBudget {
  remaining: number;
  limit: number;
  windowMinutes: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  /** Percentage of the previous stage; null for the first. */
  conversion: number | null;
}

export interface Funnel {
  range: { from: string; to: string };
  stages: FunnelStage[];
  totals: {
    impressions: number;
    views: number;
    saves: number;
    claims: number;
    redemptions: number;
  };
}

export interface GrowthPoint {
  day: string;
  customers: number;
  shops: number;
  offers: number;
  claims: number;
}

export interface Review {
  id: number;
  offerId: number | null;
  shopId: number | null;
  rating: number;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  user: { id: number; name: string; avatarUrl: string | null };
  offerTitle?: string | null;
  shopName?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notifications & analytics
// ---------------------------------------------------------------------------

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  followedShopOffers: boolean;
  followedCategoryOffers: boolean;
  nearbyOffers: boolean;
  favoriteExpiring: boolean;
  savedServiceOfferExpiring: boolean;
  offerUpdates: boolean;
  adminAnnouncements: boolean;
}

export interface AnalyticsOverview {
  scope: 'platform' | 'shop';
  shopIds: number[] | null;
  offers: {
    total: number;
    draft: number;
    scheduled: number;
    active: number;
    expired: number;
    deactivated: number;
    expiringSoon: number;
  };
  engagement: {
    views: number;
    clicks: number;
    favorites: number;
    claims: number;
    redemptions: number;
  };
  platform?: {
    totalUsers: number;
    activeUsers: number;
    totalAdmins: number;
    totalCustomers: number;
    totalShops: number;
    activeShops: number;
    totalBranches: number;
    activeBranches: number;
    totalFollows: number;
  };
  shop?: { branches: number; members: number };
}

export interface OfferStat {
  id: number;
  title: string;
  shopName: string;
  views: number;
  clicks: number;
  favorites: number;
}

export interface AnalyticsOffers {
  timeline: { day: string; created: number; views: number; clicks: number; shares: number }[];
  mostViewed: OfferStat[];
  mostPopular: OfferStat[];
  expiringSoon: { id: number; title: string; shopName: string; endDate: string }[];
}

export interface ShopAnalytics {
  shop: { id: number; name: string };
  offers: AnalyticsOverview['offers'];
  engagement: AnalyticsOverview['engagement'];
  branches: { id: number; branchName: string; city: string | null; activeOffers: number; views: number }[];
  mostViewed: OfferStat[];
}

export interface CategoryStat {
  id: number;
  name: string;
  offerCount: number;
  views: number;
  followers: number;
}

export interface LocationStat {
  city: string;
  state: string | null;
  branchCount: number;
  shopCount: number;
  activeOffers: number;
}

export interface ShopStat {
  id: number;
  name: string;
  logoUrl: string | null;
  activeOffers: number;
  views: number;
  followers: number;
}

export interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: number; name: string; email: string } | null;
}

export interface UploadResult {
  url: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  bytes: number;
}

// ---------------------------------------------------------------------------
// V3 — subscriptions
// ---------------------------------------------------------------------------

export type PlanKey = 'FREE' | 'BUSINESS' | 'PREMIUM';

/** Feature flag names, mirroring `config/plans.js` on the backend. */
export type FeatureName =
  | 'OFFER_SCHEDULING'
  | 'RECURRING_OFFERS'
  | 'FEATURED_BANNERS'
  | 'BANNER_SCHEDULING'
  | 'ENDING_SOON'
  | 'CAMPAIGNS'
  | 'ANALYTICS_STANDARD'
  | 'ANALYTICS_ADVANCED'
  | 'CUSTOMER_ANALYTICS_BASIC'
  | 'CUSTOMER_ANALYTICS_ADVANCED'
  | 'LOCATION_ANALYTICS_BASIC'
  | 'LOCATION_ANALYTICS_ADVANCED'
  | 'BRANCH_ANALYTICS'
  | 'CATEGORY_INSIGHTS'
  | 'CUSTOMER_TRENDS'
  | 'OFFER_COMPARISON'
  | 'FUNNEL_BASIC'
  | 'FUNNEL_ADVANCED'
  | 'CLAIMS_ANALYTICS'
  | 'CAMPAIGN_ANALYTICS'
  | 'OFFER_INTELLIGENCE'
  | 'ROI_DASHBOARD'
  | 'ANALYTICS_EXPORT'
  | 'NOTIFICATIONS_ADVANCED'
  | 'PRIORITY_SUPPORT'
  | 'PRIORITY_DISCOVERY'
  | 'SERVICE_SCHEDULING'
  | 'SERVICE_ANALYTICS_BASIC'
  | 'SERVICE_ANALYTICS_ADVANCED';

/** `null` for a limit means unlimited. */
export interface PlanLimits {
  offersPerMonth: number | null;
  branches: number | null;
  categories: number | null;
  banners: number | null;
  exportsPerMonth: number | null;
}

export interface Plan {
  key: PlanKey;
  name: string;
  tagline: string;
  description: string;
  price: number;
  currency: string;
  rank: number;
  limits: PlanLimits;
  features: FeatureName[];
  profile: string;
  visibility: { nearMe: string; search: string; discoveryBoost: number };
}

/** A row of the §3 comparison matrix. `false` renders as a cross. */
export interface ComparisonRow {
  label: string;
  values: (string | boolean)[];
}

/** Whether checkout can actually be opened, and with which gateway. */
export interface PaymentConfig {
  gateway: 'razorpay';
  enabled: boolean;
  keyId: string | null;
  supportsAutopay: boolean;
  methods: string[];
}

export interface PlanCatalogue {
  plans: Plan[];
  featureLabels: Record<string, string>;
  comparison: ComparisonRow[];
  payment?: PaymentConfig;
}

export interface SubscriptionUsage {
  period: string;
  offersThisMonth: number;
  servicesThisMonth?: number;
  branches: number;
  categories: number;
  banners: number;
  exportsThisMonth: number;
}

/** Subscription lifecycle states (payments spec §9). */
export type SubscriptionStatus = 'created' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired';

/**
 * A feature the Super Admin granted independently of the plan (§11A).
 * Read-only to a merchant; only a Super Admin can create or revoke one.
 */
export interface FeatureOverride {
  id: number;
  shopId: number;
  shopName: string | null;
  adminUserId: number | null;
  adminName: string | null;
  featureKey: string;
  featureName: string;
  category: string;
  kind: 'feature' | 'limit';
  status: 'active' | 'revoked' | 'expired';
  startsAt: string | null;
  expiresAt: string | null;
  isPermanent: boolean;
  reason: string | null;
  grantedBy: number | null;
  grantedByName: string | null;
  revokedBy: number | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An entry in the controlled catalogue a Super Admin may grant from (§11D). */
export interface CatalogueFeature {
  featureKey: string;
  name: string;
  description: string;
  category: string;
  kind: 'feature' | 'limit';
  limitKey?: string;
}

/** One row of the override audit trail (§11I). */
export interface FeatureOverrideEvent {
  id: number;
  overrideId: number | null;
  shopId: number;
  shopName: string | null;
  featureKey: string;
  featureName: string;
  action: 'GRANTED' | 'REVOKED' | 'EXTENDED' | 'EXPIRED' | 'MODIFIED';
  previousState: unknown;
  newState: unknown;
  startsAt: string | null;
  expiresAt: string | null;
  reason: string | null;
  actorId: number | null;
  actorName: string | null;
  createdAt: string;
}

/** Dashboard tiles from §11M. */
export interface FeatureOverrideSummary {
  activeOverrides: number;
  expiringThisWeek: number;
  permanentOverrides: number;
  revokedOverrides: number;
  expiredOverrides: number;
  mostGranted: { featureKey: string; featureName: string; count: number }[];
}

/** The Super Admin's per-shop view (§11C). */
export interface ShopOverrideOverview {
  shopId: number;
  shopName: string;
  subscription: {
    plan: PlanKey;
    planName: string;
    status: SubscriptionStatus;
    price: number;
    renewsAt: string | null;
  };
  planFeatures: FeatureName[];
  overrides: FeatureOverride[];
  catalogue: CatalogueFeature[];
}

export interface Entitlements {
  shopId: number;
  plan: PlanKey;
  planName: string;
  tagline: string;
  price: number;
  currency: string;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  paymentStatus: 'not_required' | 'pending' | 'paid' | 'failed';
  startedAt: string;
  renewsAt: string | null;
  cancelledAt: string | null;
  limits: PlanLimits;
  /** Effective set: plan features unioned with active Super Admin grants (§11K). */
  features: FeatureName[];
  /** What the plan alone gives, so the UI can say where access came from (§11G). */
  planFeatures?: FeatureName[];
  overrideFeatures?: FeatureName[];
  /** Active Super Admin grants with their expiry, for the §11N panel. */
  specialAccess?: FeatureOverride[];
  profile: string;
  visibility: { nearMe: string; search: string; discoveryBoost: number };
  // ---- Billing state (§14) ----
  gateway?: string | null;
  gatewaySubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBillingDate?: string | null;
  cancelAtPeriodEnd?: boolean;
  pendingPlan?: PlanKey | null;
  graceUntil?: string | null;
  autopayEnabled?: boolean;
  paymentMethod?: string | null;
  lastPaymentAt?: string | null;
  lastFailureReason?: string | null;
  /** True when the paid features are in force right now. */
  entitled?: boolean;
  /** Present on the cancel response: when the current benefits run out. */
  activeUntil?: string | null;
  usage: SubscriptionUsage;
  /** `null` where the plan is unlimited. */
  remaining: {
    offersThisMonth: number | null;
    servicesThisMonth?: number | null;
    branches: number | null;
    categories: number | null;
    banners: number | null;
  };
}

// ---- Payments (§3, §15, §16) ------------------------------------------------

/** Everything the browser needs to open Razorpay Checkout for a plan purchase. */
export interface CheckoutSession {
  gateway: 'razorpay';
  keyId: string;
  subscriptionId: string;
  /** Razorpay's hosted page - the fallback when the script cannot load. */
  shortUrl: string | null;
  status: string;
  plan: PlanKey;
  planName: string;
  amount: number;
  currency: string;
  recurring: boolean;
  previousPlan: PlanKey;
  prefill: { name: string | null; email: string | null; contact: string | null };
}

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';

export interface PaymentTransaction {
  id: number;
  shopId: number;
  shopName?: string;
  plan: PlanKey;
  planName: string;
  orderId: string | null;
  paymentId: string | null;
  amount: number;
  amountRefunded: number;
  currency: string;
  /** 'upi' | 'card' | 'netbanking' | 'wallet' - never a credential (§6). */
  paymentMethod: string | null;
  /** Safe descriptor Razorpay echoes back, e.g. "Visa ****4242". */
  methodDetail: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface SubscriptionEvent {
  id: number;
  fromPlan: PlanKey | null;
  toPlan: PlanKey;
  action:
    | 'created'
    | 'upgraded'
    | 'downgraded'
    | 'renewed'
    | 'cancelled'
    | 'reactivated'
    | 'payment_failed'
    | 'past_due'
    | 'expired'
    | 'grace_started';
  amount: number;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

/** §16: what a stored invoice carries. */
export interface Invoice {
  id: number;
  number: string;
  reference: string;
  plan: PlanKey;
  planName: string;
  description: string;
  periodStart: string | null;
  periodEnd: string | null;
  subtotal: number;
  taxAmount: number;
  taxPercent: number;
  amount: number;
  total: number;
  currency: string;
  status: 'issued' | 'paid' | 'void' | 'refunded';
  billingName: string | null;
  billingAddress: string | null;
  issuedAt: string;
}

/** One signed-in device (§28). The id is that session's refresh-token family. */
export interface DeviceSession {
  id: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'web' | 'unknown';
  deviceName: string | null;
  platform: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  /** True for the session making the request - never offered for revoke. */
  current: boolean;
}

/** The `details` payload of a PLAN_UPGRADE_REQUIRED error (§31). */
export interface UpgradeRequirement {
  requiredPlan: PlanKey;
  requiredPlanName: string;
  requiredPlanPrice: number;
  feature?: FeatureName;
  currentPlan?: PlanKey | null;
  limit?: number;
  used?: number;
  limitKey?: string;
}

export interface Campaign {
  id: number;
  shopId: number;
  shopName: string | null;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  cost: number | null;
  averageOrderValue: number | null;
  averageMarginPercent: number | null;
  status: 'draft' | 'running' | 'completed' | 'archived';
  offerCount: number;
  bannerCount: number;
  createdAt: string;
  offers?: { id: number; title: string; status: string; endDate: string }[];
}

// ---------------------------------------------------------------------------
// V3 — premium analytics
// ---------------------------------------------------------------------------

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

/** The shared filter contract from §27. */
export interface AnalyticsFilters {
  preset: DatePreset;
  from?: string;
  to?: string;
  shopId?: number | null;
  branchId?: number | null;
  categoryId?: number | null;
  offerId?: number | null;
  campaignId?: number | null;
  city?: string | null;
  offerType?: string | null;
  discountType?: string | null;
  status?: string | null;
  sort?: string;
  limit?: number;
}

export type Trend = 'up' | 'down' | 'flat';

export interface Kpi {
  key: string;
  label: string;
  value: number;
  previous: number;
  /** Percentage change on the previous period; null when there is no baseline. */
  change: number | null;
  trend: Trend;
  format: string;
  hint: string | null;
}

export interface OverviewAlert {
  key: string;
  icon: string;
  tone: 'info' | 'success' | 'warning';
  message: string;
  entityId?: number;
}

export interface OverviewPoint {
  day: string;
  views: number;
  impressions: number;
  claims: number;
  redemptions: number;
  newCustomers: number;
}

export interface PremiumOverview {
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  kpis: Kpi[];
  totals: Record<string, number>;
  previousTotals: Record<string, number>;
  timeline: OverviewPoint[];
  alerts: OverviewAlert[];
}

export interface OfferRates {
  impressionToView: number | null;
  viewToSave: number | null;
  viewToClaim: number | null;
  claimToRedemption: number | null;
  viewToRedemption: number | null;
  engagement: number | null;
}

export interface OfferPerformanceRow {
  id: number;
  title: string;
  status: OfferStatus;
  offerType: string;
  discountType: string;
  discountValue: number | null;
  category: string | null;
  shopName: string;
  startDate: string;
  endDate: string;
  impressions: number;
  views: number;
  clicks: number;
  shares: number;
  saves: number;
  claims: number;
  redemptions: number;
  rates: OfferRates;
}

export interface OfferPerformance {
  range: { from: string; to: string };
  offers: OfferPerformanceRow[];
  totals: Record<string, number>;
  rates: OfferRates;
}

export interface PremiumFunnelStage {
  key: string;
  label: string;
  value: number;
  /** The stage this one converts from — not always the one drawn above it. */
  from: string | null;
  conversion: number | null;
  dropOff: number | null;
  shareOfTop: number | null;
}

export interface PremiumFunnel {
  range: { from: string; to: string };
  stages: PremiumFunnelStage[];
  totals: Record<string, number>;
  rates: Omit<OfferRates, 'engagement'>;
  biggestDropOff: { stage: string; label: string; conversion: number } | null;
}

export interface LocationRow {
  city: string;
  views: number;
  claims: number;
  redemptions: number;
  customers: number;
  conversion: number | null;
}

export interface LocationInsights {
  range: { from: string; to: string };
  locations: LocationRow[];
  heatmap: { latitude: number; longitude: number; weight: number }[];
  branches: { id: number; branchName: string; city: string | null; latitude: number | null; longitude: number | null }[];
  radius: { withinKm: number; views: number; customers: number }[] | null;
  highlights: { mostActive: LocationRow | null; highestConverting: LocationRow | null };
}

export interface BranchRow {
  id: number;
  branchName: string;
  city: string | null;
  isPrimary: boolean;
  activeOffers: number;
  views: number;
  customers: number;
  claims: number;
  redemptions: number;
  conversion: number | null;
  topOffer: { id: number; title: string; views: number } | null;
}

export interface BranchPerformance {
  range: { from: string; to: string };
  branches: BranchRow[];
  winners: {
    bestPerforming: BranchRow | null;
    highestConversion: BranchRow | null;
    mostViewed: BranchRow | null;
    mostRedemptions: BranchRow | null;
  };
}

export interface CustomerInsights {
  range: { from: string; to: string };
  totals: {
    reach: number;
    newCustomers: number;
    returningCustomers: number;
    savingCustomers: number;
    claimingCustomers: number;
    redeemingCustomers: number;
  };
  split: { newPercent: number | null; returningPercent: number | null };
  interests: { category: string; interactions: number; percent: number | null }[];
  visitFrequency: { bucket: string; customers: number; percent: number | null }[];
  segments: { key: string; label: string; customers: number }[];
}

export interface Acquisition {
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  newCustomers: number;
  previousNewCustomers: number;
  growth: number | null;
  trend: Trend;
  timeline: { day: string; customers: number }[];
  funnel: FunnelStage[];
}

export interface Retention {
  range: { from: string; to: string };
  customers: number;
  returningRate: number | null;
  repeatClaimRate: number | null;
  repeatRedemptionRate: number | null;
  averageVisitsPerCustomer: number;
  timeline: { month: string; active: number; returning: number; returningRate: number | null }[];
}

export interface CampaignBannerRow {
  id: number;
  title: string;
  status: string;
  campaignId: number | null;
  campaignName: string | null;
  offerId: number;
  offerTitle: string;
  shopName: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  reach: number;
  offerViews: number;
  offerClaims: number;
  offerRedemptions: number;
}

export interface CampaignRow {
  id: number;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  cost: number | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
  reach: number;
  offerViews: number;
  offerClaims: number;
  offerRedemptions: number;
  banners: number;
}

export interface CampaignPerformance {
  range: { from: string; to: string };
  banners: CampaignBannerRow[];
  campaigns: CampaignRow[];
  winners: Record<string, (CampaignRow & CampaignBannerRow) | null>;
}

export interface ComparisonOffer {
  id: number;
  title: string;
  offerType: string;
  discountType: string;
  discountValue: number | null;
  status: string;
  impressions: number;
  views: number;
  saves: number;
  shares: number;
  claims: number;
  redemptions: number;
  conversion: number | null;
  redemptionRate: number | null;
}

export interface OfferComparison {
  range: { from: string; to: string };
  offers: ComparisonOffer[];
  /** Which offer wins each metric, so the UI can highlight the strongest cell. */
  metrics: { key: string; bestOfferId: number | null }[];
  best: ComparisonOffer | null;
}

export interface DiscountBand {
  band: string;
  offers: number;
  views: number;
  claims: number;
  redemptions: number;
  conversion: number | null;
  sampleSize: number;
}

export interface DiscountEffectiveness {
  range: { from: string; to: string };
  bands: DiscountBand[];
  offerTypes: (DiscountBand & { offerType: string; label: string })[];
  hasEnoughData: boolean;
  observation: string | null;
}

export interface BestTime {
  lookbackDays: number;
  hasEnoughData: boolean;
  message: string | null;
  days: { day: string; views: number; averageViews: number; rating: number }[];
  hours: { hour: number; views: number; claims: number; conversion: number | null }[];
  bestDay: { day: string; views: number; averageViews: number; rating: number } | null;
  bestWindow: { fromHour: number; toHour: number; views: number } | null;
  averages: { views: number; claims: number; conversion: number | null } | null;
}

export interface EndingSoonOpportunity {
  id: number;
  title: string;
  offerText: string | null;
  shopName: string;
  endDate: string;
  hoursLeft: number;
  views: number;
  recentViews: number;
  saves: number;
  claims: number;
  classification: 'high-priority' | 'needs-attention';
  recommendation: string;
  actions: string[];
}

export interface OfferHealthRow {
  id: number;
  title: string;
  status: string;
  endDate: string;
  score: number;
  level: string;
  views: number;
  saves: number;
  claims: number;
  redemptions: number;
  /** Why the score is what it is — §20 requires the score to be explained. */
  reasons: { label: string; good: boolean; detail: string }[];
}

export interface MerchantRecommendation {
  key: string;
  kind: string;
  icon: string;
  title: string;
  body: string;
  action: string;
  entityId?: number;
  evidence: { metric: string; value: number; comparedTo?: number };
}

export interface CategoryInsights {
  range: { from: string; to: string };
  categories: { id: number; name: string; customerInterest: number; previousInterest: number; change: number | null; trend: Trend }[];
  yourCategories: { id: number; name: string; offers: number; views: number }[];
  popularOfferTypes: { offerType: string; offers: number; views: number }[];
  hasEnoughData: boolean;
  note: string;
}

export interface RoiCampaign {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  claims: number;
  redemptions: number;
  cost: number | null;
  averageOrderValue: number | null;
  averageMarginPercent: number | null;
  estimatedOrders: number;
  estimatedRevenue: number;
  estimatedGrossProfit: number | null;
  estimatedRoi: number;
  estimated: true;
}

export interface Roi {
  range: { from: string; to: string };
  campaigns: RoiCampaign[];
  /** Campaigns the merchant has not given cost/order-value figures for yet. */
  needsInput: (Omit<RoiCampaign, 'estimatedOrders' | 'estimatedRevenue' | 'estimatedGrossProfit' | 'estimatedRoi' | 'estimated'> & { missing: string[] })[];
  hasEnoughData: boolean;
  disclaimer: string;
}

/** Everything the Offer Intelligence page needs, in one round trip. */
export interface OfferIntelligence {
  discountEffectiveness: DiscountEffectiveness;
  bestTime: BestTime;
  endingSoon: { withinHours: number; offers: EndingSoonOpportunity[] };
  health: { range: { from: string; to: string }; offers: OfferHealthRow[]; hasEnoughData: boolean };
  recommendations: { items: MerchantRecommendation[]; hasEnoughData: boolean };
}

export interface ReportType {
  key: string;
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// V4 — Services
// ---------------------------------------------------------------------------

export type PricingType = 'fixed' | 'starting_from' | 'price_on_enquiry';
export type BookingType = 'walk_in' | 'appointment' | 'both' | 'enquiry_only';
export type ServiceStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'deactivated';
export type AvailableDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ServiceOfferType = 'percentage' | 'flat' | 'price_drop' | 'other';
export type ServiceOfferStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'deactivated';
export type ServiceSort = 'newest' | 'mostViewed' | 'mostPopular' | 'nearest';

export interface ServiceActiveOffer {
  id: number;
  offerText: string | null;
  discountType: DiscountType;
  discountValue: number | null;
  offerPrice: number | null;
  endDate: string;
}

export interface Service {
  id: number;
  name: string;
  description: string | null;
  pricingType: PricingType;
  price: number | null;
  durationMinutes: number | null;
  durationLabel: string | null;
  availableDays: AvailableDay[];
  availableTimeStart: string | null;
  availableTimeEnd: string | null;
  homeService: boolean;
  walkInAvailable: boolean;
  appointmentRequired: boolean;
  bookingType: BookingType;
  serviceArea: string | null;
  termsConditions: string | null;
  applicabilityType: ApplicabilityType;
  status: ServiceStatus;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  clickCount: number;
  saveCount: number;
  distanceKm: number | null;
  locationLabel: string | null;
  isSaved: boolean;
  activeOffer?: ServiceActiveOffer | null;
  /**
   * The signed-in customer's own claim on the live offer, when they hold one,
   * so the page can show the code rather than the Claim button. Absent for
   * guests and when the service has no offer running.
   */
  myClaim?: { id: number; code: string; status: ClaimStatus; expiresAt: string } | null;
  createdAt: string;
  updatedAt: string;
  shop: {
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    description?: string | null;
    contactNumber?: string | null;
  };
  category: { id: number; name: string; slug: string } | null;
  subcategory?: { id: number; name: string } | null;
  createdBy?: { id: number; name: string } | null;
  updatedBy?: { id: number; name: string } | null;
  images?: OfferImage[];
  branches?: Branch[];
  branchIds?: number[];
}

export interface ServiceQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  categoryId?: number;
  shop?: string;
  shopId?: number;
  branchId?: number;
  city?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  pricingType?: PricingType;
  bookingType?: BookingType;
  homeService?: boolean;
  hasOffer?: boolean;
  status?: ServiceStatus | 'all';
  startDate?: string;
  endDate?: string;
  saved?: boolean;
  manage?: boolean;
  sort?: ServiceSort;
}

export interface ServicePayload {
  shopId: number;
  categoryId?: number | null;
  subcategoryId?: number | null;
  name: string;
  description?: string | null;
  pricingType: PricingType;
  price?: number | null;
  durationMinutes?: number | null;
  durationLabel?: string | null;
  availableDays: AvailableDay[];
  availableTimeStart?: string | null;
  availableTimeEnd?: string | null;
  homeService: boolean;
  walkInAvailable: boolean;
  appointmentRequired: boolean;
  bookingType: BookingType;
  serviceArea?: string | null;
  termsConditions?: string | null;
  applicabilityType: ApplicabilityType;
  status: 'draft' | 'scheduled' | 'active';
  startDate?: string | null;
  endDate?: string | null;
  branchIds: number[];
  images: { url: string; thumbnailUrl?: string | null }[];
}

export interface ServiceOffer {
  id: number;
  serviceId: number;
  offerText: string | null;
  offerType: ServiceOfferType;
  discountType: DiscountType;
  discountValue: number | null;
  originalPrice: number | null;
  offerPrice: number | null;
  termsConditions: string | null;
  isRecurring: boolean;
  recurrenceType: string | null;
  startDate: string;
  endDate: string;
  status: ServiceOfferStatus;
  viewCount: number;
  claimCount: number;
  /** Claim rules, identical in meaning to the ones on a product offer. */
  claimLimitPerCustomer: number;
  totalClaimLimit: number | null;
  claimValidityHours: number | null;
  maxRedemptionsPerClaim: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOfferPayload {
  claimLimitPerCustomer: number;
  totalClaimLimit?: number | null;
  claimValidityHours?: number | null;
  maxRedemptionsPerClaim: number;
  offerText?: string | null;
  offerType: ServiceOfferType;
  discountType: DiscountType;
  discountValue?: number | null;
  originalPrice?: number | null;
  offerPrice?: number | null;
  termsConditions?: string | null;
  isRecurring: boolean;
  recurrenceType?: string | null;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled' | 'active';
}

/**
 * Service-offer claims are `Claim` with `kind: 'service_offer'` — the API
 * returns one shape for both. Kept as a name because call sites read better
 * saying what they expect.
 */
export type ServiceOfferClaim = Claim;

export interface ServiceBooking {
  id: number;
  serviceId: number;
  userId: number;
  branchId: number | null;
  serviceOfferId: number | null;
  requestedAt: string | null;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row from `GET /discovery/offers` — the "View Offers" union of product and
 * service offers. Deliberately a different, lighter shape than `Offer`/`Service`. */
export interface UnifiedListing {
  id: number;
  sourceType: 'product' | 'service';
  serviceId: number | null;
  title: string;
  offerText: string | null;
  discountType: DiscountType;
  discountValue: number | null;
  originalPrice: number | null;
  finalPrice: number | null;
  startDate: string;
  endDate: string;
  status: string;
  imageUrl: string | null;
  distanceKm: number | null;
  isSaved: boolean;
  latitude?: number | null;
  longitude?: number | null;
  shop: { id: number; name: string; slug: string; logoUrl: string | null };
  category: { id: number; name: string; slug: string } | null;
}

// ---- Service analytics ------------------------------------------------------

export interface ServiceAnalyticsOverview {
  range: { from: string; to: string; preset: DatePreset };
  kpis: Kpi[];
  totalServices: number;
  activeServices: number;
}

export interface ServiceTopPerformer {
  id: number;
  name: string;
  views: number;
  saves: number;
  bookings: number;
  claims: number;
  conversion: number | null;
}

export interface ServicePerformance {
  bestService: ServiceTopPerformer | null;
  mostViewedService: ServiceTopPerformer | null;
  mostSavedService: ServiceTopPerformer | null;
  mostBookedService: ServiceTopPerformer | null;
  mostClaimedService: ServiceTopPerformer | null;
  bestConvertingService: ServiceTopPerformer | null;
}

export interface ServiceFunnelStage {
  key: string;
  label: string;
  value: number;
  conversionFromPrevious: number | null;
}

export interface ServiceOfferPerformanceSplit {
  promotional: { views: number };
  normal: { views: number };
}

export interface ServiceBranchRow {
  id: number;
  branchName: string;
  city: string | null;
  views: number;
  bookings: number;
  claims: number;
}

export interface ServiceLocationRow {
  city: string;
  views: number;
  bookings: number;
}

export interface ServiceCustomerInsights {
  newCustomers: number;
  customerGrowth: number | null;
  repeatBookings: number;
  repeatClaims: number;
}

export interface ServiceCategoryInsightRow {
  id: number;
  name: string;
  serviceCount: number;
  views: number;
  saves: number;
}

export interface ServiceComparisonRow {
  id: number;
  name: string;
  views: number;
  saves: number;
  enquiries: number;
  bookings: number;
  claims: number;
  redemptions: number;
  conversion: number | null;
}

// ---------------------------------------------------------------------------
// V5 — Business Dashboard (Super Admin only)
//
// These mirror `modules/business` on the API. They are kept apart from the
// premium analytics types above for the same reason the routers are: those
// describe one merchant's shop, these describe the whole business, and a type
// shared between them would invite a merchant dashboard to render a figure it
// has no right to (Business §1, §55).
// ---------------------------------------------------------------------------

export type ListingTypeFilter = 'all' | 'offer' | 'service';

/** The filter contract from §32. */
export interface BusinessFilters {
  preset: DatePreset;
  from?: string;
  to?: string;
  city?: string | null;
  area?: string | null;
  categoryId?: number | null;
  listingType?: ListingTypeFilter;
  plan?: string | null;
  shopId?: number | null;
  branchId?: number | null;
  acquisitionChannel?: string | null;
  limit?: number;
  sort?: string;
  cohortMonths?: number;
}

export interface BusinessRange {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  preset: DatePreset;
}

export interface DayPoint {
  day: string;
  value: number;
}

export interface HealthAlert {
  key: string;
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  action: { label: string; route: string } | null;
  raisedAt: string;
}

export interface BusinessOverview {
  range: BusinessRange;
  kpis: Kpi[];
  activity: DayPoint[];
  health: { overall: HealthStatus; alerts: HealthAlert[] };
}

export interface EngagementTotals {
  impressions: number;
  views: number;
  clicks: number;
  shares: number;
  saves: number;
  claims: number;
  eligibleClaims: number;
  pendingClaims: number;
  redemptions: number;
  redemptionRate: number | null;
}

export interface CustomerMetrics {
  range: BusinessRange;
  kpis: Kpi[];
  activity: {
    dau: number;
    mau: number;
    averageDau: number;
    stickiness: number | null;
    series: DayPoint[];
  };
  engagement: EngagementTotals;
  signups: DayPoint[];
  definitions: {
    activeUserEvents: string[];
    excludedEvents: string[];
    claimEligibility: string;
  };
}

export interface MerchantActivityRow {
  key: string;
  label: string;
  merchants: number;
}

export interface DistributionBand {
  key: string;
  label: string;
  merchants: number;
  views: number;
  share: number | null;
}

export interface MerchantMetrics {
  range: BusinessRange;
  kpis: Kpi[];
  activeMerchants: number;
  totals: {
    totalOffers: number;
    activeOffers: number;
    totalServices: number;
    activeServices: number;
    views: number;
    claims: number;
    redemptions: number;
  };
  perShop: {
    offers: number | null;
    medianOffers: number | null;
    maxOffers: number;
    views: number | null;
    claims: number | null;
    redemptions: number | null;
  };
  activityBreakdown: MerchantActivityRow[];
  distribution: { merchants: number; totalViews: number; bands: DistributionBand[] };
  definitions: { activities: { key: string; label: string }[]; note: string };
}

export interface BusinessOfferRow {
  id: number;
  title: string;
  status: string;
  shopId: number;
  shopName: string;
  category: string;
  views: number;
  claims: number;
  redemptions: number;
  claimRate: number | null;
  redemptionRate: number | null;
}

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  previous: number;
  conversionFromPrevious: number | null;
}

export interface BusinessFunnel {
  range: BusinessRange;
  stages: FunnelStage[];
  overallConversion: number | null;
  redemptionRate: number | null;
  eligibleClaims: number;
  pendingClaims: number;
  definitions: { claimEligibility: string };
}

export interface RetentionOffset {
  key: string;
  label: string;
  days: number;
  retained: number | null;
  rate: number | null;
  /** False where the cohort is too young to have reached this offset. */
  reached: boolean;
}

export interface RetentionCohort {
  cohort: string;
  merchants: number;
  offsets: RetentionOffset[];
}

export interface CohortCurvePoint {
  month: number;
  label: string;
  rate: number | null;
  cohorts: number;
}

export interface MerchantRetention {
  cohorts: RetentionCohort[];
  curve: CohortCurvePoint[];
  definitions: {
    windowDays: number;
    offsets: { key: string; label: string; days: number }[];
    rule: string;
    activities: string[];
  };
}

export interface PlanDistributionRow {
  plan: string;
  name: string;
  price: number;
  merchants: number;
  mrr: number;
  atRiskMerchants: number;
  atRiskMrr: number;
  share: number | null;
}

export interface ConversionStep {
  key: string;
  label: string;
  eligible: number;
  converted: number;
  rate: number | null;
}

export interface BusinessSubscriptions {
  range: BusinessRange;
  distribution: PlanDistributionRow[];
  totalMerchants: number;
  payingMerchants: number;
  funnel: { steps: ConversionStep[]; directToPremium: number; definitions: { eligibility: string } };
  history: { day: string; action: string; count: number }[];
}

export interface ArpmBasis {
  key: string;
  label: string;
  hint: string;
  value: number;
  denominator: number;
}

export interface RevenueLine {
  plan: string;
  label: string;
  payments: number;
  gross: number;
  refunded: number;
  net: number;
}

export interface BusinessRevenue {
  range: BusinessRange;
  kpis: Kpi[];
  mrr: {
    current: number;
    previous: number;
    growth: number | null;
    atRisk: number;
    new: number;
    expansion: number;
    contraction: number;
    churned: number;
    reactivation: number;
    net: number;
  };
  churn: {
    startingPayingMerchants: number;
    endingPayingMerchants: number;
    churnedMerchants: number;
    merchantChurnRate: number | null;
    startingMrr: number;
    churnedMrr: number;
    mrrChurnRate: number | null;
  };
  arpm: ArpmBasis[];
  breakdown: {
    lines: RevenueLine[];
    total: number;
    refunded: number;
    failedPayments: number;
    failedAmount: number;
    note: string;
  };
  previousBreakdownTotal: number;
  distribution: PlanDistributionRow[];
}

export interface CityRow {
  city: string;
  merchants: number;
  activeMerchants: number;
  customers: number;
  offers: number;
  views: number;
  claims: number;
  redemptions: number;
  redemptionRate: number | null;
  mrr: number;
}

export interface CategoryRow {
  categoryId: number | null;
  category: string;
  merchants: number;
  offers: number;
  views: number;
  claims: number;
  redemptions: number;
  redemptionRate: number | null;
}

// ---- §34, §55 Platform health --------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'not_configured';

export interface HealthComponent {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
  latencyMs?: number;
  failures?: number;
  attempts?: number;
  failureRate?: number;
  queued?: number;
  uptimeSeconds?: number;
}

export interface PlatformHealth {
  overall: HealthStatus;
  checkedAt: string;
  components: HealthComponent[];
  email: HealthStatus;
}

export interface FailingEndpoint {
  endpoint: string;
  method: string;
  dependency: string;
  failures: number;
  lastSeen: string;
}

export interface BusinessFilterOptions {
  datePresets: DatePreset[];
  cities: string[];
  areas: string[];
  categories: { id: number; name: string }[];
  plans: { key: string; name: string; price: number }[];
  listingTypes: { key: ListingTypeFilter; label: string }[];
  acquisitionChannels: string[];
  shops: { id: number; name: string }[];
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export type SupportStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'normal' | 'high';
export type SupportUserType = 'customer' | 'merchant' | 'guest';
/** What a content report can be filed against. Mirrors the API's `REPORTABLE`. */
export type ReportableEntity = 'offer' | 'service' | 'shop' | 'service_offer';

export interface SupportMessage {
  id: number;
  authorRole: 'customer' | 'support';
  /** Null for a message left by a guest, who has no account to name. */
  authorName: string | null;
  body: string;
  /** Always false in a customer's copy — the API strips internal notes. */
  isInternal: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  /** "SUP-10248". What a customer quotes; it authorises nothing. */
  reference: string;
  userId: number | null;
  name: string;
  email: string;
  phone: string | null;
  userType: SupportUserType;
  category: string;
  subject: string;
  description: string;
  attachmentUrl: string | null;
  entityType: string | null;
  entityId: number | null;
  status: SupportStatus;
  priority: SupportPriority;
  assignedTo: number | null;
  assigneeName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only on the single-ticket read, not in a list. */
  messages?: SupportMessage[];
}

export interface SupportTicketPayload {
  name: string;
  email: string;
  phone?: string | null;
  userType: SupportUserType;
  category: string;
  subject: string;
  description: string;
  attachmentUrl?: string | null;
  entityType?: ReportableEntity | null;
  entityId?: number | null;
}

export interface SupportQuery {
  page?: number;
  limit?: number;
  status?: SupportStatus | 'all';
  category?: string;
  search?: string;
}

/** Published contact details, so the number is configured rather than shipped. */
export interface SupportContact {
  email: string;
  phones: string[];
  categories: string[];
}

// ---------------------------------------------------------------------------
// Visibility & Promotion System
//
// Mirrors `src/config/visibility.js` and the `/visibility` API in the backend.
// Nothing here is an access check: the API resolves entitlements and
// permissions independently on every call (§22, §24), and these types only
// decide what a screen can render.
// ---------------------------------------------------------------------------

export type VisibilitySurface = 'SEARCH' | 'NEAR_ME' | 'HOME' | 'CATEGORY' | 'ENDING_SOON';

export type PlacementType =
  | 'HOME_FEATURED'
  | 'CATEGORY_FEATURED'
  | 'NEAR_ME_FEATURED'
  | 'SEASONAL_CAMPAIGN'
  | 'ENDING_SOON_FEATURED';

export type VisibilityLevel = 'BASIC' | 'ENHANCED' | 'PRIORITY';

export type RankingFactor =
  | 'RELEVANCE'
  | 'DISTANCE'
  | 'FRESHNESS'
  | 'ENGAGEMENT'
  | 'OFFER_QUALITY'
  | 'SUBSCRIPTION'
  | 'CUSTOMER_PREFERENCE'
  | 'AVAILABILITY'
  | 'PLACEMENT';

export type FeaturedCampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'paused'
  | 'completed'
  | 'rejected'
  | 'archived';

export type VisibilityListingType = 'offer' | 'service_offer' | 'shop';

/**
 * §21's fixed wording, served by the API rather than composed here.
 *
 * Deliberately not a constant in the frontend: the one thing the platform must
 * never say is "guaranteed #1", and a promise duplicated in the UI is a promise
 * that can drift out of step with the one the backend stands behind.
 */
export interface VisibilityPromise {
  headline: string;
  explanation: string;
  disclaimer: string;
}

export interface VisibilityMeta {
  events: { all: string[]; client: string[] };
  surfaces: VisibilitySurface[];
  placementTypes: PlacementType[];
  visibilityLevels: { key: VisibilityLevel; rank: number; label: string }[];
  promise: VisibilityPromise;
  defaultRadiusKm: number;
}

export type RankingWeights = Record<VisibilitySurface, Record<RankingFactor, number>>;

export interface RankingWeightsResponse {
  surfaces: VisibilitySurface[];
  factors: { key: RankingFactor; label: string }[];
  weights: RankingWeights;
  defaults: RankingWeights;
  /** §13's recommended search priority, for labelling what the numbers express. */
  searchPriority: string[];
}

/** Curve shapes and fairness limits. Values are numbers or small objects. */
export type VisibilityRules = Record<string, number | boolean | Record<string, number>>;

export interface VisibilityRulesResponse {
  rules: VisibilityRules;
  defaults: VisibilityRules;
}

export interface FeaturedSlot {
  id: number;
  code: string;
  placementType: PlacementType;
  name: string;
  description: string | null;
  capacity: number;
  minPlanRank: number;
  categoryId: number | null;
  city: string | null;
  status: 'active' | 'inactive';
  activeCampaigns: number;
  /** Present only on the merchant's slot list: may this shop book it? */
  eligible?: boolean;
}

export interface FrequencyLimit {
  id: number;
  scope: 'offer' | 'shop' | 'campaign' | 'placement';
  placementType: PlacementType | null;
  appliesTo: 'user' | 'session';
  maxImpressions: number;
  windowMinutes: number;
  status: 'active' | 'inactive';
  updatedBy: string | null;
  updatedAt: string;
}

export interface RankingExclusion {
  id: number;
  scope: 'listing' | 'shop';
  listingType: VisibilityListingType | null;
  listingId: number | null;
  shopId: number | null;
  shopName: string | null;
  source: 'admin' | 'auto';
  reason: string | null;
  expiresAt: string | null;
  status: 'active' | 'lifted';
  createdBy: string | null;
  createdAt: string;
}

export interface FeaturedCampaignPlacement {
  id: number;
  listingType: VisibilityListingType;
  listingId: number;
  displayOrder: number;
  status: 'active' | 'paused';
  exposureCount: number;
  lastShownAt: string | null;
}

export interface FeaturedCampaign {
  id: number;
  shopId: number;
  shopName: string | null;
  slotId: number;
  slotCode: string | null;
  slotName: string | null;
  campaignId: number | null;
  name: string;
  description: string | null;
  placementType: PlacementType;
  target: {
    categoryId: number | null;
    categoryName: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    radiusKm: number | null;
  };
  startAt: string;
  endAt: string;
  priority: number;
  status: FeaturedCampaignStatus;
  exposureCount: number;
  lastShownAt: string | null;
  placementCount: number;
  approvedBy: number | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  placements?: FeaturedCampaignPlacement[];
  /**
   * The live §9 verdict, recomputed on read. A campaign can be `approved` and
   * still not display because one of its own offers expired underneath it, and
   * this is what lets the merchant be told so instead of guessing.
   */
  eligibility?: { eligible: boolean; reasons: string[] };
}

export interface FeaturedCampaignPayload {
  shopId: number;
  slotId: number;
  campaignId?: number | null;
  name: string;
  description?: string | null;
  targetCategoryId?: number | null;
  targetCity?: string | null;
  targetRadiusKm?: number | null;
  startAt: string;
  endAt: string;
  listings: { listingType: VisibilityListingType; listingId: number }[];
}

export interface MerchantSlotOptions {
  visibilityLevel: VisibilityLevel;
  featuredAccess: boolean;
  promise: VisibilityPromise;
  slots: FeaturedSlot[];
}

export interface ListingPromotability {
  listingType: VisibilityListingType;
  listingId: number;
  eligible: boolean;
  reasons: string[];
}

/** §23's grant: a visibility *level*, with a reason and an expiry. */
export interface VisibilityEntitlement {
  id: number;
  shopId: number;
  shopName: string | null;
  level: VisibilityLevel;
  reason: string | null;
  featuredAccess: boolean;
  startsAt: string;
  expiresAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  grantedBy: number | null;
  grantedByName: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ResolvedVisibility {
  shopId: number;
  planKey: PlanKey;
  features: string[];
  visibilityLevel: VisibilityLevel;
  visibilityRank: number;
  subscriptionScore: number;
  featuredAccess: boolean;
  featuredSource: string | null;
  /** 'plan', 'override' or 'plan+override' — §11G's "Access:" line. */
  source: string;
  override: {
    id: number;
    level: VisibilityLevel;
    reason: string | null;
    featuredAccess: boolean;
    startsAt: string;
    expiresAt: string | null;
  } | null;
  promise: VisibilityPromise;
}

export interface RotationReport {
  slot: FeaturedSlot;
  windowDays: number;
  totalImpressions: number;
  campaigns: {
    campaignId: number;
    name: string;
    shopId: number;
    shopName: string;
    impressions: number;
    /** The number that answers "is the rotation fair?" (§10). */
    sharePercent: number;
    exposureCount: number;
    lastShownAt: string | null;
  }[];
}

export interface VisibilityOverview {
  impressions: number;
  organicImpressions: number;
  featuredImpressions: number;
  views: number;
  saves: number;
  claims: number;
  redemptions: number;
  profileVisits: number;
  directionsClicks: number;
  searchClicks: number;
  searchAppearances: number;
  uniqueCustomers: number;
}

export interface VisibilityBreakdown {
  nearMeImpressions: number;
  searchImpressions: number;
  featuredImpressions: number;
  categoryImpressions: number;
  bySurface: Record<VisibilitySurface, { organic: number; featured: number }>;
  byCategory: { categoryId: number; categoryName: string | null; impressions: number }[];
  averagePosition: number | null;
  positionRange: { best: number; worst: number } | null;
  rankedImpressions: number;
}

export interface VisibilityFunnel {
  stages: { key: string; label: string; value: number; rateFromPrevious: number | null }[];
  overallConversion: number | null;
}

export interface VisibilityDashboard {
  range: { from: string; to: string; label: string };
  overview: VisibilityOverview;
  visibility: VisibilityBreakdown;
  funnel: VisibilityFunnel;
  visibilityLevel: VisibilityLevel | null;
  visibilitySource: string | null;
  promise: VisibilityPromise;
}

export interface VisibilityPremiumInsights {
  range: { from: string; to: string; label: string };
  byBranch: { branchId: number; impressions: number; customers: number }[];
  byLocation: { city: string; impressions: number; customers: number }[];
  bestPerformingOffers: {
    listingType: VisibilityListingType;
    listingId: number;
    /** Resolved server-side; null when the listing has since been deleted. */
    title: string | null;
    impressions: number;
    views: number;
    saves: number;
    claims: number;
    redemptions: number;
  }[];
  bestPerformingDays: { date: string; impressions: number; views: number; redemptions: number }[];
  bestPerformingHours: { hour: number; events: number; views: number }[];
  bestPerformingWeekdays: { weekday: string | null; events: number; views: number }[];
  searchPerformance: {
    term: string;
    appearances: number;
    clicks: number;
    clickThroughRate: number | null;
  }[];
}

export interface FeaturedCampaignPerformance {
  campaignId: number;
  totals: {
    impressions: number;
    bannerClicks: number;
    offerViews: number;
    saves: number;
    claims: number;
    redemptions: number;
    shopVisits: number;
    directionsClicks: number;
    uniqueCustomers: number;
  };
  daily: {
    date: string;
    impressions: number;
    bannerClicks: number;
    offerViews: number;
    saves: number;
    claims: number;
    redemptions: number;
  }[];
  rates: {
    clickThrough: number | null;
    viewToClaim: number | null;
    claimToRedemption: number | null;
  };
}

/** §27's actionable half: what the merchant can actually fix. */
export interface ListingQualityDetail {
  listingType: VisibilityListingType;
  listingId: number;
  qualityScore: number;
  engagementScore: number;
  checklist: Record<string, boolean>;
  missing: string[];
  engagement: Record<string, number> | null;
  computedAt: string;
  suggestions?: string[];
}
