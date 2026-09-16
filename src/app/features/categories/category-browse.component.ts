import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';
import { IconName } from '../../shared/icons';
import { AuthPromptService } from '../../core/auth-prompt.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Category } from '../../core/models';
import { EmptyStateComponent } from '../../shared/ui.components';

/** Category browse page: entry point into filtered offer listings (§6, §42). */
@Component({
  selector: 'app-category-browse',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, IconComponent],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <h1>Browse by category</h1>
          <p class="subtitle">Follow a category to be told when new offers land in it.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="grid grid-cards stagger">
          @for (item of [1, 2, 3, 4, 5, 6, 7, 8]; track item) {
            <div class="skeleton" style="height: 130px"></div>
          }
        </div>
      } @else if (categories().length === 0) {
        <app-empty-state icon="cube-outline" title="No categories yet" message="Check back soon." />
      } @else {
        <div class="grid grid-cards stagger">
          @for (category of categories(); track category.id) {
            <div class="cat-card card">
              <a class="cat-main" [routerLink]="['/offers', 'c', category.slug]">
                <app-icon class="cat-icon" [name]="iconFor(category.name)" [size]="22" />
                <h2>{{ category.name }}</h2>
                @if (category.description) {
                  <p class="small muted clamp-2">{{ category.description }}</p>
                }
                <p class="small strong mb-0">
                  {{ category.offerCount || 0 }} active offer{{ category.offerCount === 1 ? '' : 's' }}
                  @if (category.shopCount) {
                    · {{ category.shopCount }} shop{{ category.shopCount === 1 ? '' : 's' }}
                  }
                </p>
              </a>

              <div class="cat-actions">
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-secondary]="category.isFollowing"
                  (click)="toggleFollow(category)"
                >
                  <app-icon
                    [name]="category.isFollowing ? 'checkmark-outline' : 'add-outline'"
                    [size]="14"
                  />
                  {{ category.isFollowing ? 'Following' : 'Follow' }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .cat-card {
        position: relative;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition:
          transform var(--normal) var(--ease-out),
          box-shadow var(--normal) var(--ease-out),
          border-color var(--normal) var(--ease);
      }

      /* Brand wash fades in behind the content on hover. */
      .cat-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(140deg, var(--brand-tint) 0%, transparent 60%);
        opacity: 0;
        transition: opacity var(--normal) var(--ease);
        pointer-events: none;
      }

      .cat-card:hover {
        transform: translateY(-3px);
        box-shadow: var(--shadow-lg);
        border-color: transparent;
      }

      .cat-card:hover::before {
        opacity: 1;
      }

      .cat-card:hover .cat-icon {
        transform: scale(1.18) rotate(-6deg);
      }

      .cat-main {
        position: relative;
        display: block;
        padding: 1.15rem;
        color: var(--text);
        flex: 1;
        z-index: 1;
      }

      .cat-main:hover {
        text-decoration: none;
      }

      .cat-main:hover h2 {
        color: var(--brand);
      }

      .cat-icon {
        font-size: 1.9rem;
        display: block;
        margin-bottom: 0.4rem;
        transform-origin: left center;
        transition: transform var(--normal) var(--ease-spring);
      }

      .cat-main h2 {
        font-size: 1.05rem;
        margin-bottom: 0.25rem;
      }

      .cat-actions {
        position: relative;
        z-index: 1;
        padding: 0.65rem 1.15rem;
        border-top: 1px solid var(--border);
        background: var(--surface-alt);
      }
    `,
  ],
})
export class CategoryBrowseComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly prompt = inject(AuthPromptService);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);

  /** Fallback glyph when a category has no icon configured. */
  /**
   * Category name -> icon.
   *
   * `categories.icon` in the database is free text and currently unset, so it is
   * deliberately not read here: a stray emoji or URL in that column would not be
   * a valid icon name, and this component would have no sensible way to draw it.
   * Names come from the database, so this is a
   * best-effort lookup: anything unrecognised falls back to the generic
   * pricetag rather than showing nothing.
   */
  private readonly icons: Record<string, IconName> = {
    food: 'fast-food-outline',
    clothing: 'shirt-outline',
    footwear: 'footsteps-outline',
    'makeup & beauty': 'cut-outline',
    electronics: 'phone-portrait-outline',
    grocery: 'basket-outline',
    restaurants: 'restaurant-outline',
    travel: 'airplane-outline',
    'home & furniture': 'bed-outline',
    sports: 'barbell-outline',
    accessories: 'bag-handle-outline',
    automotive: 'car-outline',
    cleaning: 'sparkles-outline',
    education: 'school-outline',
    events: 'calendar-outline',
    fitness: 'barbell-outline',
    jewellery: 'diamond-outline',
    books: 'book-outline',
    pets: 'paw-outline',
    music: 'musical-notes-outline',
    gaming: 'game-controller-outline',
    health: 'medkit-outline',
    salon: 'cut-outline',
    'beauty & salon': 'cut-outline',
    'health & wellness': 'medkit-outline',
    'home services': 'hammer-outline',
    'repair & maintenance': 'construct-outline',
    'professional services': 'briefcase-outline',
    photography: 'camera-outline',
    technology: 'laptop-outline',
    other: 'ellipsis-horizontal-outline',
  };

  constructor() {
    this.api.listCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  iconFor(name: string): IconName {
    return this.icons[name.toLowerCase()] ?? 'pricetag-outline';
  }

  toggleFollow(category: Category): void {
    // Browsing categories is public (§2); only following needs an account.
    if (!this.prompt.require('follow-category', () => this.toggleFollow(category))) return;

    const following = Boolean(category.isFollowing);
    const request = following
      ? this.api.unfollowCategory(category.id)
      : this.api.followCategory(category.id);

    this.patch(category.id, { isFollowing: !following });
    request.subscribe({
      next: () =>
        this.toast.success(following ? `Unfollowed ${category.name}` : `Following ${category.name}`),
      error: () => this.patch(category.id, { isFollowing: following }),
    });
  }

  private patch(id: number, changes: Partial<Category>): void {
    this.categories.update((list) =>
      list.map((category) => (category.id === id ? { ...category, ...changes } : category)),
    );
  }
}
