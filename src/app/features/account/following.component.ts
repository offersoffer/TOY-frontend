import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Category, Offer, Shop } from '../../core/models';
import { OfferCardComponent } from '../../shared/offer-card.component';
import { EmptyStateComponent } from '../../shared/ui.components';
import { IconComponent } from '../../shared/icon.component';

/** Followed shops and categories, plus the resulting feed (§23). */
@Component({
  selector: 'app-following',
  standalone: true,
  imports: [CommonModule, RouterLink, OfferCardComponent, EmptyStateComponent, IconComponent],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <h1>Following</h1>
          <p class="subtitle">New offers from these shops and categories reach you first.</p>
        </div>
      </div>

      <div class="follow-grid">
        <section class="card">
          <div class="card-header">
            <h2>Shops</h2>
            <a routerLink="/shops" class="small">Find more</a>
          </div>
          <div class="card-body">
            @if (loadingShops()) {
              <div class="skeleton" style="height: 90px"></div>
            } @else if (shops().length === 0) {
              <p class="small muted mb-0">
                You are not following any shops yet. <a routerLink="/shops">Browse shops</a>.
              </p>
            } @else {
              <ul class="follow-list">
                @for (shop of shops(); track shop.id) {
                  <li>
                    <a class="entry" [routerLink]="['/shops', shop.slug]">
                      @if (shop.logoUrl) {
                        <img [src]="shop.logoUrl" [alt]="shop.name" />
                      } @else {
                        <span class="mark">{{ shop.name.charAt(0) }}</span>
                      }
                      <span class="entry-body">
                        <strong class="truncate">{{ shop.name }}</strong>
                        <span class="small muted">
                          {{ shop.activeOfferCount || 0 }} active offer{{ shop.activeOfferCount === 1 ? '' : 's' }}
                        </span>
                      </span>
                    </a>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="unfollowShop(shop)">
                      Unfollow
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Categories</h2>
            <a routerLink="/categories" class="small">Find more</a>
          </div>
          <div class="card-body">
            @if (loadingCategories()) {
              <div class="skeleton" style="height: 90px"></div>
            } @else if (categories().length === 0) {
              <p class="small muted mb-0">
                You are not following any categories yet. <a routerLink="/categories">Browse categories</a>.
              </p>
            } @else {
              <ul class="follow-list">
                @for (category of categories(); track category.id) {
                  <li>
                    <a class="entry" [routerLink]="['/offers', 'c', category.slug]">
                      <span class="mark"><app-icon name="pricetags-outline" [size]="16" /></span>
                      <span class="entry-body">
                        <strong class="truncate">{{ category.name }}</strong>
                        <span class="small muted">
                          {{ category.activeOfferCount || 0 }} active
                          offer{{ category.activeOfferCount === 1 ? '' : 's' }}
                        </span>
                      </span>
                    </a>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="unfollowCategory(category)">
                      Unfollow
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        </section>
      </div>

      <h2 class="mt-3">Latest from your follows</h2>
      @if (loadingFeed()) {
        <div class="grid grid-cards stagger">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="skeleton" style="height: 300px"></div>
          }
        </div>
      } @else if (feed().length === 0) {
        <app-empty-state
          icon="notifications-outline"
          title="Nothing new yet"
          message="Follow a shop or category and their new offers will appear here."
        />
      } @else {
        <div class="grid grid-cards stagger">
          @for (offer of feed(); track offer.id) {
            <app-offer-card [offer]="offer" (toggleFavorite)="toggleFavorite($event)" />
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .follow-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
      }

      .follow-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }

      .follow-list li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid var(--border);
      }

      .follow-list li:last-child {
        border-bottom: none;
      }

      .entry {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex: 1;
        min-width: 0;
        color: var(--text);
      }

      .entry:hover {
        text-decoration: none;
      }

      .entry:hover strong {
        color: var(--brand);
      }

      .entry img,
      .mark {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        object-fit: cover;
        flex-shrink: 0;
      }

      .mark {
        display: grid;
        place-items: center;
        background: var(--brand-light);
        color: var(--brand);
        font-weight: 700;
      }

      .entry-body {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
    `,
  ],
})
export class FollowingComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly shops = signal<Shop[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly feed = signal<Offer[]>([]);
  readonly loadingShops = signal(true);
  readonly loadingCategories = signal(true);
  readonly loadingFeed = signal(true);

  constructor() {
    this.api.listFollowedShops().subscribe({
      next: (shops) => {
        this.shops.set(shops);
        this.loadingShops.set(false);
      },
      error: () => this.loadingShops.set(false),
    });

    this.api.listFollowedCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loadingCategories.set(false);
      },
      error: () => this.loadingCategories.set(false),
    });

    this.api.listOffers({ following: true, limit: 8, sort: 'newest' }).subscribe({
      next: (page) => {
        this.feed.set(page.items);
        this.loadingFeed.set(false);
      },
      error: () => this.loadingFeed.set(false),
    });
  }

  unfollowShop(shop: Shop): void {
    const previous = this.shops();
    this.shops.update((list) => list.filter((item) => item.id !== shop.id));
    this.api.unfollowShop(shop.id).subscribe({
      next: () => this.toast.success(`Unfollowed ${shop.name}`),
      error: () => this.shops.set(previous),
    });
  }

  unfollowCategory(category: Category): void {
    const previous = this.categories();
    this.categories.update((list) => list.filter((item) => item.id !== category.id));
    this.api.unfollowCategory(category.id).subscribe({
      next: () => this.toast.success(`Unfollowed ${category.name}`),
      error: () => this.categories.set(previous),
    });
  }

  toggleFavorite(offer: Offer): void {
    const request = offer.isFavorite
      ? this.api.removeFavorite(offer.id)
      : this.api.addFavorite(offer.id);

    this.feed.update((list) =>
      list.map((item) => (item.id === offer.id ? { ...item, isFavorite: !item.isFavorite } : item)),
    );
    request.subscribe({
      error: () =>
        this.feed.update((list) =>
          list.map((item) => (item.id === offer.id ? { ...item, isFavorite: offer.isFavorite } : item)),
        ),
    });
  }
}
