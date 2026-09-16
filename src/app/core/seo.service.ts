import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { Category, Offer, Service, Shop } from './models';

/**
 * Public discovery metadata (Guest Browsing §27).
 *
 * The customer-facing pages are public, which means a search engine can reach
 * them, which means the title and description have to describe the specific
 * offer, service, shop or city rather than the app shell. This service is
 * called from the detail components once their data has loaded.
 *
 * Two things beyond the obvious tags:
 *
 *   - `robots`. Public discovery pages are indexable; account pages are not, so
 *     `noindex` is applied explicitly rather than left to chance.
 *   - `canonical`. Discovery URLs pick up filter, sort and pagination query
 *     parameters, which would otherwise present the same listing to a crawler
 *     under dozens of addresses.
 *
 * This is a client-rendered SPA, so these tags are set after hydration. Modern
 * crawlers execute JavaScript and will see them; a future move to SSR would
 * make the same calls render into the initial HTML with no changes here.
 */

export interface PageMeta {
  title: string;
  description: string;
  /** Canonical path without query parameters. Defaults to the current path. */
  path?: string;
  image?: string | null;
  /** Account and admin pages set this to keep themselves out of the index. */
  noindex?: boolean;
  type?: 'website' | 'article' | 'product';
}

const SITE_NAME = 'OffersOffer';
const SUFFIX = ` · ${SITE_NAME}`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  apply(page: PageMeta): void {
    const fullTitle = page.title.endsWith(SITE_NAME) ? page.title : `${page.title}${SUFFIX}`;
    const url = this.absolute(page.path);

    this.title.setTitle(fullTitle);
    this.set('description', page.description);
    this.set('robots', page.noindex ? 'noindex, nofollow' : 'index, follow');

    this.setProperty('og:title', fullTitle);
    this.setProperty('og:description', page.description);
    this.setProperty('og:type', page.type ?? 'website');
    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:url', url);
    if (page.image) this.setProperty('og:image', page.image);
    else this.meta.removeTag("property='og:image'");

    this.set('twitter:card', page.image ? 'summary_large_image' : 'summary');
    this.set('twitter:title', fullTitle);
    this.set('twitter:description', page.description);

    this.setCanonical(url);
  }

  // ---- Page builders -------------------------------------------------------
  //
  // Kept here rather than in the components so the phrasing of a "Diwali Offers
  // in Coimbatore" style title (§27) lives in one place.

  offer(offer: Offer): void {
    const city = offer.branches?.find((branch) => branch.city)?.city;
    const headline = offer.offerText || offer.title;
    this.apply({
      title: city ? `${headline} at ${offer.shop.name}, ${city}` : `${headline} at ${offer.shop.name}`,
      description: this.clamp(
        offer.description ||
          `${headline} from ${offer.shop.name}${city ? ` in ${city}` : ''}. Valid until ${this.day(offer.endDate)}.`,
      ),
      path: `/offers/${offer.id}`,
      image: offer.imageUrl ?? null,
      type: 'product',
    });
  }

  service(service: Service): void {
    const city = service.branches?.find((branch) => branch.city)?.city;
    this.apply({
      title: city ? `${service.name} in ${city} · ${service.shop.name}` : `${service.name} · ${service.shop.name}`,
      description: this.clamp(
        service.description ||
          `Book ${service.name} with ${service.shop.name}${city ? ` in ${city}` : ''}. See pricing, availability and offers.`,
      ),
      path: `/services/${service.id}`,
      image: service.imageUrl ?? null,
      type: 'product',
    });
  }

  shop(shop: Shop): void {
    const city = shop.city ?? shop.branches?.find((branch) => branch.city)?.city;
    this.apply({
      title: city ? `${shop.name}, ${city} — offers and services` : `${shop.name} — offers and services`,
      description: this.clamp(
        shop.description ||
          `Browse current offers, services, branches and opening hours for ${shop.name}${city ? ` in ${city}` : ''}.`,
      ),
      path: `/shops/${shop.slug ?? shop.id}`,
      image: shop.logoUrl ?? null,
    });
  }

  /**
   * "Clothing Offers in Coimbatore" (§27) - category crossed with location.
   *
   * `path` is the listing's own route, so `/offers/c/clothing` canonicalises to
   * itself rather than to `/offers`. `noindex` is for the case that address is
   * a slug no category answers to: the page renders, but it is not a page.
   */
  categoryListing(
    category: Category | null,
    city: string | null,
    path: string,
    noindex = false,
  ): void {
    const subject = category ? `${category.name} offers` : 'Offers';
    const title = city ? `${subject} in ${city}` : `${subject} near you`;
    this.apply({
      title,
      description: this.clamp(
        `Find ${title.toLowerCase()} from local shops. Compare discounts, see what is ending soon and get directions — no account needed.`,
      ),
      path,
      noindex,
    });
  }

  /**
   * Marks the current page indexable without touching its title or description.
   *
   * Needed because a SPA carries its tags across navigations: arriving at a
   * public page from an account page would otherwise inherit that page's
   * `noindex`.
   */
  indexable(path?: string): void {
    this.set('robots', 'index, follow');
    this.setCanonical(this.absolute(path));
  }

  /** Signed-in areas: readable in the tab, invisible to crawlers. */
  account(title: string): void {
    this.apply({
      title,
      description: 'Your OffersOffer account.',
      noindex: true,
    });
  }

  // ---- Tag plumbing --------------------------------------------------------

  private set(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private setCanonical(href: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private absolute(path?: string): string {
    const origin = this.document.location.origin;
    // Query parameters are filter state, not identity, so they are dropped.
    return `${origin}${path ?? this.document.location.pathname}`;
  }

  /** Search results truncate around 160 characters; do it deliberately. */
  private clamp(text: string, max = 158): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
  }

  private day(value: string): string {
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
