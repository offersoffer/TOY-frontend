import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { SUPPORT_EMAIL, SUPPORT_PHONES } from './content';

/**
 * Contact us.
 *
 * A separate page from Support because they answer different questions.
 * Support is "something is wrong, here is what happened" and produces a ticket;
 * Contact is "how do I reach you" and produces an address. Merging them means
 * somebody wanting a phone number has to scroll past a nine-field form, and
 * somebody with a problem gets an email address instead of a reference.
 *
 * So this page is short, and its main job is to point at the form for anything
 * that would be better as a ticket.
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="container page contact">
      <header>
        <h1>Contact us</h1>
        <p class="subtitle">
          For anything about your account, an offer or a shop, the support form is quicker — it
          gives you a reference and keeps the whole thread in one place.
        </p>
        <a routerLink="/support" class="btn">Raise a support request</a>
      </header>

      <div class="grid methods">
        <div class="card">
          <div class="card-body">
            <app-icon class="glyph" name="mail-outline" [size]="20" />
            <h2>Email</h2>
            <p><a [href]="'mailto:' + supportEmail">{{ supportEmail }}</a></p>
            <p class="small muted mb-0">
              We read everything that arrives here. Include your ticket reference if you already
              have one.
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <app-icon class="glyph" name="call-outline" [size]="20" />
            <h2>Phone</h2>
            @for (phone of supportPhones; track phone) {
              <p class="mb-0"><a [href]="telHref(phone)">{{ phone }}</a></p>
            }
            <p class="small muted mt-1 mb-0">
              Best for something urgent at a shop counter — a code that will not verify, say.
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <app-icon class="glyph" name="shield-checkmark-outline" [size]="20" />
            <h2>Privacy and data</h2>
            <p class="small muted">
              Questions about the information we hold, or a request to access, correct or delete it,
              go to the same address — say what you are asking for and we will handle it.
            </p>
            <p class="small mb-0"><a routerLink="/privacy">Read the Privacy Policy</a></p>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <app-icon class="glyph" name="storefront-outline" [size]="20" />
            <h2>For businesses</h2>
            <p class="small muted">
              Want your shop’s offers on OffersOffer? Get in touch, or create an account and add your
              shop — we review each one before it goes live.
            </p>
            <p class="small mb-0"><a routerLink="/about">About OffersOffer</a></p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .contact {
        max-width: 820px;
      }

      header {
        margin-bottom: 2rem;
      }

      header h1 {
        margin-bottom: 0.35rem;
      }

      header .subtitle {
        color: var(--text-muted);
        max-width: 60ch;
        margin-bottom: 1.1rem;
      }

      .methods {
        grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
      }

      .glyph {
        color: var(--brand);
      }

      h2 {
        font-size: 1.02rem;
        margin: 0.5rem 0 0.4rem;
      }
    `,
  ],
})
export class ContactComponent {
  private readonly seo = inject(SeoService);

  readonly supportEmail = SUPPORT_EMAIL;
  readonly supportPhones = SUPPORT_PHONES;

  /** `tel:` cannot carry the spaces the number is displayed with. */
  telHref(phone: string): string {
    return `tel:${phone.replace(/\s+/g, '')}`;
  }

  constructor() {
    this.seo.apply({
      title: 'Contact us',
      description: `Reach the OffersOffer team by email at ${SUPPORT_EMAIL} or by phone, or raise a support request and get a ticket reference.`,
      path: '/contact',
    });
  }
}
