import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Offer } from '../core/models';
import { AuthService } from '../core/auth.service';
import {
  DiscountChipPipe,
  DistancePipe,
  OfferHeadlinePipe,
  StatusClassPipe,
  ValidityPipe,
} from './offer-badge.pipe';
import { IconComponent } from '../shared/icon.component';

/**
 * The offer card from §40. Shows shop, headline, category, location, distance,
 * expiry and the save control.
 */
@Component({
  selector: 'app-offer-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    OfferHeadlinePipe,
    ValidityPipe,
    DistancePipe,
    StatusClassPipe,
    IconComponent,
  ],
  template: `
    <article class="offer-card" [class.dimmed]="offer.status !== 'active'">
      <a class="media" [routerLink]="['/offers', offer.id]" [attr.aria-label]="offer.title">
        @if (offer.thumbnailUrl || offer.imageUrl) {
          <img
            [src]="offer.thumbnailUrl || offer.imageUrl"
            [alt]="offer.title"
            loading="lazy"
            decoding="async"
          />
        } @else {
          <div class="placeholder" aria-hidden="true">
            <span>{{ offer.shop.name.charAt(0) }}</span>
          </div>
        }

        @if (discountChip) {
          <span class="discount-flag">{{ discountChip }}</span>
        }
        @if (showStatus && offer.status !== 'active') {
          <span class="status-flag" [class]="offer.status | statusClass">{{ offer.status }}</span>
        }
      </a>

      <div class="body">
        <div class="shop-row">
          @if (offer.shop.logoUrl) {
            <img class="shop-logo" [src]="offer.shop.logoUrl" [alt]="offer.shop.name" loading="lazy" />
          }
          <a class="shop-name truncate" [routerLink]="['/shops', offer.shop.slug]">{{ offer.shop.name }}</a>
        </div>

        <a class="title clamp-2" [routerLink]="['/offers', offer.id]">{{ offer | offerHeadline }}</a>

        @if (offer.productName) {
          <p class="product truncate">{{ offer.productName }}</p>
        }

        @if (offer.category) {
          <a class="category" [routerLink]="['/offers', 'c', offer.category.slug]">
            {{ offer.category.name }}
          </a>
        }

        <div class="meta">
          @if (offer.locationLabel || offer.distanceKm !== null) {
            <span class="meta-item">
              <app-icon name="location-outline" [size]="15" /> <span class="truncate">
                {{ offer.locationLabel || 'Multiple locations' }}
                @if (offer.distanceKm !== null) {
                  · {{ offer.distanceKm | distance }}
                }
              </span>
            </span>
          }
          <span class="meta-item" [class.urgent]="isEndingSoon"><app-icon name="calendar-outline" [size]="15" /> {{ offer | validity }}</span>
        </div>

        <div class="actions">
          @if (discountChip) {
            <span class="badge badge-brand">{{ discountChip }}</span>
          } @else {
            <span class="badge badge-brand">Offer</span>
          }
          <span class="spacer"></span>
          <button
            type="button"
            class="save-btn"
            [class.saved]="offer.isFavorite"
            (click)="onToggleFavorite($event)"
            [attr.aria-pressed]="offer.isFavorite"
            [attr.aria-label]="offer.isFavorite ? 'Remove from favourites' : 'Save offer'"
          >
            <app-icon class="heart" [name]="offer.isFavorite ? 'heart' : 'heart-outline'" [size]="15" />
            <span class="save-label">{{ offer.isFavorite ? 'Saved' : 'Save' }}</span>
          </button>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .offer-card {
        display: flex;
        flex-direction: column;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        height: 100%;
        transition:
          transform var(--normal) var(--ease-out),
          box-shadow var(--normal) var(--ease-out),
          border-color var(--normal) var(--ease);
      }

      .offer-card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-lg);
        border-color: transparent;
      }

      .offer-card.dimmed .media {
        opacity: 0.72;
        filter: grayscale(0.35);
      }

      .media {
        position: relative;
        display: block;
        aspect-ratio: 4 / 3;
        background: var(--surface-alt);
        overflow: hidden;
      }

      .media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--slow) var(--ease-out);
      }

      /* Slow zoom on hover; the card lift does the rest of the work. */
      .offer-card:hover .media img {
        transform: scale(1.06);
      }

      /* Gradient scrim keeps the flags legible over busy photography. */
      .media::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, rgba(20, 22, 31, 0.28) 0%, transparent 38%);
        opacity: 0.9;
        pointer-events: none;
      }

      .placeholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, var(--brand-light) 0%, #fcd34d 100%);
        color: var(--brand-strong);
        font-size: 2.6rem;
        font-weight: 800;
        transition: transform var(--slow) var(--ease-out);
      }

      .offer-card:hover .placeholder {
        transform: scale(1.05);
      }

      .discount-flag {
        position: absolute;
        top: 0.65rem;
        left: 0.65rem;
        z-index: 1;
        background: var(--gradient-accent);
        color: #fff;
        padding: 0.22rem 0.65rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        box-shadow: 0 4px 12px -2px rgba(249, 115, 22, 0.55);
        transition: transform var(--normal) var(--ease-spring);
      }

      .offer-card:hover .discount-flag {
        transform: scale(1.06);
      }

      .status-flag {
        position: absolute;
        top: 0.65rem;
        right: 0.65rem;
        z-index: 1;
        text-transform: capitalize;
        backdrop-filter: blur(4px);
      }

      .body {
        padding: 0.85rem 0.95rem 0.95rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        flex: 1;
      }

      .shop-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-width: 0;
      }

      .shop-logo {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
      }

      .shop-name {
        font-size: 0.76rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.055em;
        color: var(--text-muted);
      }

      .shop-name:hover {
        color: var(--brand);
        text-decoration: none;
      }

      .title {
        font-size: 1.02rem;
        font-weight: 660;
        color: var(--text);
        line-height: 1.3;
        letter-spacing: -0.01em;
        transition: color var(--fast) var(--ease);
      }

      .title:hover {
        color: var(--brand-strong);
        text-decoration: none;
      }

      .product {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
      }

      .category {
        font-size: 0.78rem;
        color: var(--brand);
        align-self: flex-start;
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.8rem;
        color: var(--text-muted);
        margin-top: auto;
        padding-top: 0.45rem;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
      }

      .meta-item.urgent {
        color: var(--warning);
        font-weight: 620;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding-top: 0.65rem;
        margin-top: 0.45rem;
        border-top: 1px solid var(--border);
      }

      .save-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.32rem;
        border: 1px solid var(--border-strong);
        background: var(--surface);
        border-radius: 999px;
        padding: 0.26rem 0.72rem;
        font: inherit;
        font-size: 0.82rem;
        cursor: pointer;
        color: var(--text-muted);
        transition:
          border-color var(--fast) var(--ease),
          color var(--fast) var(--ease),
          background var(--fast) var(--ease),
          transform var(--fast) var(--ease-spring);
      }

      .save-btn:hover {
        border-color: var(--danger);
        color: var(--danger);
        background: var(--danger-bg);
        transform: translateY(-1px);
      }

      .save-btn:active {
        transform: scale(0.94);
      }

      .save-btn.saved {
        background: var(--danger-bg);
        border-color: transparent;
        color: var(--danger);
        font-weight: 620;
      }

      /* The heart gives one small beat when it becomes saved. */
      .save-btn.saved .heart {
        animation: heart-beat 420ms var(--ease-spring);
      }

      @keyframes heart-beat {
        0% {
          transform: scale(1);
        }
        35% {
          transform: scale(1.45);
        }
        70% {
          transform: scale(0.92);
        }
        100% {
          transform: scale(1);
        }
      }

      @media (max-width: 420px) {
        .save-label {
          display: none;
        }
      }
    `,
  ],
})
export class OfferCardComponent {
  private readonly auth = inject(AuthService);

  @Input({ required: true }) offer!: Offer;
  /** Shows the lifecycle badge - used in the admin lists, not in discovery. */
  @Input() showStatus = false;

  @Output() toggleFavorite = new EventEmitter<Offer>();
  /**
   * Raised instead of the save when a guest taps the heart (§5). Carries the
   * offer so the parent can replay the save once the visitor signs in (§7).
   */
  @Output() requireLogin = new EventEmitter<Offer>();

  get discountChip(): string {
    return new DiscountChipPipe().transform(this.offer);
  }

  get isEndingSoon(): boolean {
    if (this.offer.status !== 'active') return false;
    const hours = (new Date(this.offer.endDate).getTime() - Date.now()) / 3600000;
    return hours > 0 && hours <= 72;
  }

  onToggleFavorite(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.auth.isAuthenticated()) {
      this.requireLogin.emit(this.offer);
      return;
    }
    this.toggleFavorite.emit(this.offer);
  }
}
