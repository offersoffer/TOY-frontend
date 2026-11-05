import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { PERMISSIONS, PermissionName } from '../../core/permissions';
import { IconComponent } from '../../shared/icon.component';
import { IconName } from '../../shared/icons';

interface NavItem {
  label: string;
  route: string;
  icon: IconName;
  /** Shown when the user holds any of these; omitted means always shown. */
  permissions?: PermissionName[];
  superAdminOnly?: boolean;
  exact?: boolean;
}

/**
 * Admin shell with a permission-filtered sidebar (§42). The menu adapts to what
 * the signed-in user may actually do, so an Admin never sees Super Admin areas.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="admin-layout">
      <aside class="sidebar" [class.open]="sidebarOpen()">
        <div class="sidebar-head">
          <span class="small subtle">{{ contextLabel() }}</span>
          <strong class="truncate">{{ scopeName() }}</strong>
        </div>

        <nav aria-label="Admin">
          @for (item of visibleNav(); track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              (click)="sidebarOpen.set(false)"
            >
              <app-icon class="icon" [name]="item.icon" [size]="17" />
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-foot">
          <a routerLink="/offers" class="small">← Back to the customer site</a>
        </div>
      </aside>

      <div class="admin-content">
        <button type="button" class="sidebar-toggle btn btn-secondary btn-sm" (click)="sidebarOpen.set(!sidebarOpen())">
          <app-icon name="menu-outline" [size]="18" /> Menu
        </button>
        <router-outlet />
      </div>
    </div>
  `,
  styles: [
    `
      .admin-layout {
        display: grid;
        grid-template-columns: 232px minmax(0, 1fr);
        min-height: calc(100vh - var(--header-height));
        align-items: start;
      }

      .sidebar {
        position: sticky;
        top: var(--header-height);
        height: calc(100vh - var(--header-height));
        background: var(--surface);
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }

      .sidebar-head strong {
        background: var(--gradient-brand-deep);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        font-size: 1.05rem;
      }

      .sidebar-head {
        padding: 1rem 1rem 0.75rem;
        border-bottom: 1px solid var(--border);
        display: flex;
        flex-direction: column;
      }

      .sidebar nav {
        display: flex;
        flex-direction: column;
        padding: 0.5rem;
        gap: 0.1rem;
        flex: 1;
      }

      .sidebar nav a {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.58rem 0.7rem;
        border-radius: var(--radius-sm);
        color: var(--text-muted);
        font-size: 0.9rem;
        font-weight: 560;
        overflow: hidden;
        transition:
          background var(--fast) var(--ease),
          color var(--fast) var(--ease),
          padding-left var(--normal) var(--ease-out);
      }

      /* Accent bar slides in from the left on hover and locks for the active route. */
      .sidebar nav a::before {
        content: '';
        position: absolute;
        left: 0;
        top: 20%;
        bottom: 20%;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: var(--gradient-brand);
        transform: translateX(-4px);
        opacity: 0;
        transition: transform var(--normal) var(--ease-out), opacity var(--fast) var(--ease);
      }

      .sidebar nav a:hover {
        background: var(--surface-alt);
        color: var(--text);
        text-decoration: none;
        padding-left: 0.9rem;
      }

      .sidebar nav a:hover::before {
        transform: translateX(0);
        opacity: 0.5;
      }

      .sidebar nav a.active {
        background: var(--brand-light);
        color: var(--brand-strong);
        padding-left: 0.9rem;
      }

      .sidebar nav a.active::before {
        transform: translateX(0);
        opacity: 1;
      }

      .sidebar nav a .icon {
        transition: transform var(--normal) var(--ease-spring);
      }

      .sidebar nav a:hover .icon {
        transform: scale(1.15);
      }

      .icon {
        width: 20px;
        text-align: center;
      }

      .sidebar-foot {
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--border);
      }

      .admin-content {
        min-width: 0;
        padding-bottom: 2rem;
      }

      .sidebar-toggle {
        display: none;
        margin: 1rem 1rem 0;
      }

      @media (max-width: 900px) {
        .admin-layout {
          grid-template-columns: minmax(0, 1fr);
        }

        .sidebar {
          display: none;
          position: static;
          height: auto;
          border-right: none;
          border-bottom: 1px solid var(--border);
        }

        .sidebar.open {
          display: flex;
          animation: slide-down var(--normal) var(--ease-out);
        }

        .sidebar-toggle {
          display: inline-flex;
        }
      }
    `,
  ],
})
export class AdminShellComponent {
  readonly auth = inject(AuthService);
  readonly sidebarOpen = signal(false);

  private readonly nav: NavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'grid-outline' },
    { label: 'Offers', route: '/admin/offers', icon: 'pricetags-outline', permissions: [PERMISSIONS.VIEW_OFFERS] },
    { label: 'Post an offer', route: '/admin/offers/new', icon: 'add-circle-outline', permissions: [PERMISSIONS.CREATE_OFFER] },
    // Claim/Redemption §35: verifying is what a shopkeeper reaches for with a
    // customer in front of them, so it sits above the management screens
    // rather than under analytics with the rest of the reporting.
    {
      label: 'Verify claim',
      route: '/admin/verify-claim',
      icon: 'camera-outline',
      permissions: [PERMISSIONS.VERIFY_CLAIM],
    },
    {
      label: 'Redemptions',
      route: '/admin/redemptions',
      icon: 'ticket-outline',
      permissions: [PERMISSIONS.VIEW_REDEMPTION_HISTORY, PERMISSIONS.VIEW_CLAIMS],
    },
    { label: 'Services', route: '/admin/services', icon: 'briefcase-outline', permissions: [PERMISSIONS.VIEW_SERVICE] },
    { label: 'Add a service', route: '/admin/services/new', icon: 'add-circle-outline', permissions: [PERMISSIONS.CREATE_SERVICE] },
    {
      label: 'AI Offer Assistant',
      route: '/admin/ai/assistant',
      icon: 'sparkles-outline',
      permissions: [PERMISSIONS.USE_AI_ASSISTANT],
    },
    {
      label: 'AI usage & history',
      route: '/admin/ai/history',
      icon: 'document-text-outline',
      permissions: [PERMISSIONS.USE_AI_CONTENT, PERMISSIONS.USE_AI_ASSISTANT],
    },
    {
      // Onboarding §14. Above Shops on purpose: a queue has people waiting in
      // it, and the shop list does not.
      label: 'Registrations',
      route: '/admin/registrations',
      icon: 'shield-checkmark-outline',
      permissions: [PERMISSIONS.REVIEW_SELLER_REGISTRATIONS],
    },
    {
      label: 'Shop claims',
      route: '/admin/registrations/claims',
      icon: 'key-outline',
      permissions: [PERMISSIONS.REVIEW_SELLER_REGISTRATIONS],
    },
    {
      label: 'Shops',
      route: '/admin/shops',
      icon: 'storefront-outline',
      permissions: [PERMISSIONS.VIEW_SHOP_MEMBERS, PERMISSIONS.EDIT_SHOP, PERMISSIONS.MANAGE_LOCATIONS],
    },
    {
      label: 'Featured banners',
      route: '/admin/banners',
      icon: 'image-outline',
      permissions: [PERMISSIONS.VIEW_BANNERS],
    },
    { label: 'Analytics', route: '/admin/analytics', icon: 'bar-chart-outline', permissions: [PERMISSIONS.VIEW_ANALYTICS] },
    {
      label: 'Visibility & reach',
      route: '/admin/visibility',
      icon: 'eye-outline',
      permissions: [PERMISSIONS.VIEW_VISIBILITY_ANALYTICS],
    },
    {
      label: 'Featured campaigns',
      route: '/admin/featured-campaigns',
      icon: 'megaphone-outline',
      permissions: [PERMISSIONS.MANAGE_FEATURED_CAMPAIGNS],
    },
    {
      label: 'Service analytics',
      route: '/admin/service-analytics',
      icon: 'pulse-outline',
      permissions: [PERMISSIONS.VIEW_SERVICE_ANALYTICS],
    },
    {
      label: 'Subscription',
      route: '/admin/subscription',
      icon: 'card-outline',
      permissions: [PERMISSIONS.VIEW_SUBSCRIPTION, PERMISSIONS.MANAGE_SUBSCRIPTION],
    },
    { label: 'Categories', route: '/admin/categories', icon: 'albums-outline', permissions: [PERMISSIONS.MANAGE_CATEGORIES] },
    { label: 'Reviews', route: '/admin/reviews', icon: 'star-outline', permissions: [PERMISSIONS.MODERATE_REVIEWS] },
    { label: 'Support', route: '/admin/support', icon: 'chatbubbles-outline', permissions: [PERMISSIONS.VIEW_SUPPORT_TICKETS] },
    { label: 'Users', route: '/admin/users', icon: 'people-outline', permissions: [PERMISSIONS.VIEW_USERS] },
    // The platform owner's own dashboard (Business §1). Sits above the
    // Super Admin configuration entries because it is read daily, whereas
    // roles and overrides are touched occasionally.
    { label: 'Business dashboard', route: '/admin/business', icon: 'trending-up-outline', superAdminOnly: true },
    { label: 'Roles & permissions', route: '/admin/roles', icon: 'lock-closed-outline', superAdminOnly: true },
    { label: 'Feature overrides', route: '/admin/feature-overrides', icon: 'gift-outline', superAdminOnly: true },
    // §22, §23. Deliberately Super Admin only: a merchant who could tune the
    // ranking weights, or approve their own campaign onto the home page, is
    // exactly what §24 forbids.
    { label: 'Visibility controls', route: '/admin/visibility-controls', icon: 'options-outline', superAdminOnly: true },
    { label: 'Campaign approvals', route: '/admin/campaign-approvals', icon: 'checkmark-circle-outline', superAdminOnly: true },
    { label: 'Visibility grants', route: '/admin/visibility-entitlements', icon: 'ribbon-outline', superAdminOnly: true },
    { label: 'Subscriptions & AI', route: '/admin/subscriptions', icon: 'wallet-outline', superAdminOnly: true },
    { label: 'Audit logs', route: '/admin/audit-logs', icon: 'receipt-outline', permissions: [PERMISSIONS.VIEW_AUDIT_LOGS] },
  ];

  readonly visibleNav = computed(() => {
    // Reading the signal keeps the menu in step with role changes.
    this.auth.user();
    return this.nav.filter((item) => {
      if (item.superAdminOnly) return this.auth.isSuperAdmin;
      if (!item.permissions) return true;
      return this.auth.hasAny(...item.permissions);
    });
  });

  readonly contextLabel = computed(() => (this.auth.isSuperAdmin ? 'Signed in as' : 'Managing'));

  readonly scopeName = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    if (user.isSuperAdmin) return 'Super Admin';
    if (user.shops.length === 1) return user.shops[0].shopName;
    if (user.shops.length > 1) return `${user.shops.length} shops`;
    return user.name;
  });
}
