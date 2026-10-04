import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { ABOUT_FEATURES } from './content';

/**
 * About OffersOffer.
 *
 * Written for a customer, not for a regulator: what the platform is for, and
 * what you can do with it. The legal register belongs on the Privacy and Terms
 * pages, and mixing the two makes both worse.
 *
 * Public and indexable — for a local discovery product this is one of the few
 * pages a search engine can use to work out what the site is.
 */
@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="container page">
      <header class="hero">
        <h1>About OffersOffer</h1>
        <p class="lead">Discover better offers. Find useful services. Shop smarter.</p>
        <p>
          OffersOffer is a local discovery platform that helps customers find offers, discounts,
          promotions and services from shops around them.
        </p>
        <p>
          Instead of checking a dozen Instagram pages, WhatsApp forwards, posters and individual shop
          websites, you can find what is actually on offer near you in one place.
        </p>
      </header>

      <section aria-labelledby="what-you-can-do">
        <h2 id="what-you-can-do">What you can do</h2>
        <div class="grid features">
          @for (feature of features; track feature.title) {
            <div class="card feature">
              <div class="card-body">
                <span class="glyph"><app-icon [name]="feature.icon" [size]="20" /></span>
                <h3>{{ feature.title }}</h3>
                <p class="small muted mb-0">{{ feature.body }}</p>
              </div>
            </div>
          }
        </div>
      </section>

      <section class="card merchants" aria-labelledby="for-merchants">
        <div class="card-body">
          <h2 id="for-merchants">Built for local businesses</h2>
          <p>
            OffersOffer helps shops show their offers and services to nearby customers, and gives
            merchants something they rarely get from a poster or a story post: how many people saw a
            listing, how many claimed it, and how many of those claims were actually redeemed at the
            counter.
          </p>
          <div class="actions">
            @if (!auth.isAuthenticated()) {
              <a routerLink="/auth/register" class="btn">Create a free account</a>
            }
            <a routerLink="/support" class="btn btn-secondary">Talk to us</a>
          </div>
        </div>
      </section>

      <p class="closing">
        We’re starting locally, with a focus on helping businesses and customers connect more easily
        through relevant offers and services.
      </p>

      <nav class="more" aria-label="Related pages">
        <a routerLink="/support">Support</a>
        <a routerLink="/contact">Contact us</a>
        <a routerLink="/privacy">Privacy Policy</a>
        <a routerLink="/terms">Terms &amp; Conditions</a>
      </nav>
    </div>
  `,
  styles: [
    `
      .hero {
        max-width: 62ch;
        margin-bottom: 2.5rem;
      }

      .hero h1 {
        margin-bottom: 0.5rem;
      }

      /* The one sentence the page exists to say, so it is sized like one. */
      .lead {
        font-size: 1.22rem;
        font-weight: 650;
        background: var(--gradient-brand-deep);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        margin-bottom: 1.1rem;
      }

      section {
        margin-bottom: 2.25rem;
      }

      h2 {
        font-size: 1.2rem;
        margin-bottom: 1rem;
      }

      .features {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      }

      .feature h3 {
        font-size: 1rem;
        margin: 0.55rem 0 0.35rem;
      }

      .glyph {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-sm);
        background: var(--surface-alt);
        color: var(--brand);
      }

      .merchants .card-body {
        padding: 1.5rem;
      }

      .merchants p {
        max-width: 62ch;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-top: 1.1rem;
      }

      .closing {
        max-width: 62ch;
        font-size: 1.02rem;
        border-left: 3px solid var(--brand);
        padding-left: 1rem;
        color: var(--text-muted);
      }

      .more {
        display: flex;
        flex-wrap: wrap;
        gap: 1.15rem;
        margin-top: 2.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--border);
        font-size: 0.9rem;
      }
    `,
  ],
})
export class AboutComponent {
  readonly auth = inject(AuthService);
  private readonly seo = inject(SeoService);

  readonly features = ABOUT_FEATURES;

  constructor() {
    this.seo.apply({
      title: 'About OffersOffer',
      description:
        'OffersOffer is a local discovery platform for finding offers, discounts and services from shops near you — browsable without an account.',
      path: '/about',
    });
  }
}
