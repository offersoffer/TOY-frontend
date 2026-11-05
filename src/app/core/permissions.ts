/**
 * Permission names, mirroring `src/config/permissions.js` in the backend.
 *
 * These drive navigation and button visibility only. The API enforces the same
 * names independently - hiding a control here is never the access check.
 */
export const PERMISSIONS = {
  VIEW_OFFERS: 'VIEW_OFFERS',
  CREATE_OFFER: 'CREATE_OFFER',
  EDIT_OFFER: 'EDIT_OFFER',
  DELETE_OFFER: 'DELETE_OFFER',
  MODERATE_REVIEWS: 'MODERATE_REVIEWS',

  VIEW_SHOP: 'VIEW_SHOP',
  CREATE_SHOP: 'CREATE_SHOP',
  EDIT_SHOP: 'EDIT_SHOP',
  DELETE_SHOP: 'DELETE_SHOP',
  VIEW_SHOP_MEMBERS: 'VIEW_SHOP_MEMBERS',
  MANAGE_SHOP_MEMBERS: 'MANAGE_SHOP_MEMBERS',
  MANAGE_LOCATIONS: 'MANAGE_LOCATIONS',

  VIEW_USERS: 'VIEW_USERS',
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_ROLES: 'MANAGE_ROLES',
  MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',

  MANAGE_CATEGORIES: 'MANAGE_CATEGORIES',

  // Onboarding §14: who may decide a seller registration. Granted globally
  // only — a merchant holding it through a shop could approve their own.
  REVIEW_SELLER_REGISTRATIONS: 'REVIEW_SELLER_REGISTRATIONS',

  // Granted individually — holding ADMIN does not imply any of these (§6).
  VIEW_BANNERS: 'VIEW_BANNERS',
  CREATE_BANNER: 'CREATE_BANNER',
  EDIT_BANNER: 'EDIT_BANNER',
  DELETE_BANNER: 'DELETE_BANNER',
  PUBLISH_BANNER: 'PUBLISH_BANNER',

  // Claim & redemption. Four grants rather than one: reading who claimed what,
  // scanning a code, giving the benefit away and exporting the history are
  // different amounts of trust. REVOKE_CLAIM is Super Admin by default.
  VIEW_CLAIMS: 'VIEW_CLAIMS',
  VERIFY_CLAIM: 'VERIFY_CLAIM',
  REDEEM_OFFER: 'REDEEM_OFFER',
  VIEW_REDEMPTION_HISTORY: 'VIEW_REDEMPTION_HISTORY',
  EXPORT_REDEMPTION_REPORT: 'EXPORT_REDEMPTION_REPORT',
  REVOKE_CLAIM: 'REVOKE_CLAIM',

  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',

  // V3. Exporting takes data off the platform, and changing a plan commits the
  // merchant to a charge, so both are granted separately from merely viewing.
  EXPORT_ANALYTICS: 'EXPORT_ANALYTICS',
  VIEW_SUBSCRIPTION: 'VIEW_SUBSCRIPTION',
  MANAGE_SUBSCRIPTION: 'MANAGE_SUBSCRIPTION',
  MANAGE_CAMPAIGNS: 'MANAGE_CAMPAIGNS',

  // V4: Services (mirrors the offer permission set, plus booking management).
  CREATE_SERVICE: 'CREATE_SERVICE',
  VIEW_SERVICE: 'VIEW_SERVICE',
  EDIT_SERVICE: 'EDIT_SERVICE',
  DELETE_SERVICE: 'DELETE_SERVICE',
  PUBLISH_SERVICE: 'PUBLISH_SERVICE',
  SCHEDULE_SERVICE: 'SCHEDULE_SERVICE',
  MANAGE_SERVICE_OFFER: 'MANAGE_SERVICE_OFFER',
  MANAGE_SERVICE_BOOKING: 'MANAGE_SERVICE_BOOKING',
  VIEW_SERVICE_ANALYTICS: 'VIEW_SERVICE_ANALYTICS',
  EXPORT_SERVICE_ANALYTICS: 'EXPORT_SERVICE_ANALYTICS',
  // AI. Holding these only makes the screens reachable — whether a generation
  // actually runs is decided by the shop's subscription plan, server-side.
  USE_AI_ASSISTANT: 'USE_AI_ASSISTANT',
  USE_AI_CONTENT: 'USE_AI_CONTENT',
  MANAGE_SUBSCRIPTIONS: 'MANAGE_SUBSCRIPTIONS',

  // Visibility & Promotion (§22, §24). Split by who is trusted with what: a
  // merchant builds and measures their own promotional campaigns, only the
  // platform owner tunes ranking or approves a campaign onto a shared space.
  // §24 is explicit that an Admin cannot set their own ranking score, which is
  // why MANAGE_VISIBILITY is never on a merchant's role.
  MANAGE_VISIBILITY: 'MANAGE_VISIBILITY',
  MANAGE_FEATURED_CAMPAIGNS: 'MANAGE_FEATURED_CAMPAIGNS',
  APPROVE_FEATURED_CAMPAIGN: 'APPROVE_FEATURED_CAMPAIGN',
  VIEW_VISIBILITY_ANALYTICS: 'VIEW_VISIBILITY_ANALYTICS',

  // Support. Reading a queue of customer problems and answering on the
  // platform's behalf are separate grants — a ticket carries the reporter's
  // name, email and phone whether or not they ever had an account.
  VIEW_SUPPORT_TICKETS: 'VIEW_SUPPORT_TICKETS',
  MANAGE_SUPPORT_TICKETS: 'MANAGE_SUPPORT_TICKETS',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
