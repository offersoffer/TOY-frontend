import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { Branch, Offer, OpeningHours, Service, Shop } from './models';

/**
 * JSON-LD structured data for the public pages (§27).
 *
 * The meta tags in SeoService tell a search engine how to *describe* a page.
 * This tells it what the page is *about* in a form it can act on: a price, a
 * validity window, an address, opening hours, a rating. That is the difference
 * between a plain blue link and a result carrying the discount and the shop's
 * hours - which is most of the reason a local-offers site gets clicked.
 *
 * Three rules, all of them Google's and all of them easy to break:
 *
 *   1. Only mark up what the page actually shows. Structured data that
 *      describes something the visitor cannot see is a manual-action risk, not
 *      a shortcut, so every value here comes from the same object the template
 *      renders.
 *   2. Never invent a rating. `aggregateRating` with no reviews behind it is an
 *      error in Search Console and a lie in the results, so it is emitted only
 *      when a real count backs it.
 *   3. Omit rather than guess. A null price is left out; it is not zero, and
 *      "Buy 3 Get 3 Free" has no price at all.
 *
 * This is a SPA, so the markup for the page the visitor just left has to go:
 * SeoService.apply() clears before each page writes its own, which means a page
 * that never calls into this service ends up with none rather than inheriting
 * the last one's.
 */

/** The tag every page-scoped block carries, so clearing finds exactly those. */
const PAGE_SCOPED = 'data-ld-page';

/** Prices are INR throughout; the platform is India-only (§23). */
const CURRENCY = 'INR';

const DAY_NAMES: Record<keyof OpeningHours, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

type Node = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class StructuredDataService {
  private readonly document = inject(DOCUMENT);

  // ---- Page builders -------------------------------------------------------

  /**
   * An offer, as a Product when it has a price and a bare Offer when it does
   * not.
   *
   * The nesting is what Google reads for a rich result: `Product.offers` is
   * where the price, the currency and the validity window belong. A percentage
   * or buy-x-get-y promotion often has neither price filled in, and a Product
   * whose offer has no price is invalid - so those are published as the Offer
   * alone, which still carries the seller, the window and the description.
   */
  offer(offer: Offer): void {
    const price = offer.discountedPrice ?? offer.originalPrice;
    const seller = this.sellerOf(offer.shop);
    const url = this.absolute(`/offers/${offer.id}`);

    const offerNode: Node = {
      '@type': 'Offer',
      url,
      availability: 'https://schema.org/InStock',
      priceCurrency: price === null ? undefined : CURRENCY,
      price: price ?? undefined,
      validFrom: offer.startDate,
      validThrough: offer.endDate,
      seller,
    };

    const product: Node = price !== null
      ? {
          '@type': 'Product',
          name: offer.productName || offer.title,
          description: offer.description ?? offer.offerText ?? undefined,
          image: offer.imageUrl ?? undefined,
          // The discounted price is what the customer pays, so that is the
          // offer's price; the original is what it is marked down from.
          offers: {
            ...offerNode,
            priceSpecification:
              offer.originalPrice !== null && offer.discountedPrice !== null
                ? {
                    '@type': 'UnitPriceSpecification',
                    priceType: 'https://schema.org/ListPrice',
                    price: offer.originalPrice,
                    priceCurrency: CURRENCY,
                  }
                : undefined,
          },
        }
      : { ...offerNode, name: offer.title, description: offer.description ?? offer.offerText ?? undefined };

    this.set([
      product,
      // Mirrors the breadcrumb the page actually renders: Offers › Category › Title.
      this.breadcrumb([
        ['Offers', '/offers'],
        ...(offer.category ? ([[offer.category.name, `/offers/c/${offer.category.slug}`]] as [string, string][]) : []),
        [offer.title, `/offers/${offer.id}`],
      ]),
    ]);
  }

  /**
   * A service, with its price only when there is one to state.
   *
   * `price_on_enquiry` is exactly the case rule 3 is about: the page shows no
   * number, so neither does the markup.
   */
  service(service: Service): void {
    const priced = service.pricingType !== 'price_on_enquiry' && service.price !== null;

    this.set([
      {
        '@type': 'Service',
        name: service.name,
        description: service.description ?? undefined,
        image: service.imageUrl ?? undefined,
        url: this.absolute(`/services/${service.id}`),
        provider: this.sellerOf(service.shop),
        areaServed: service.serviceArea ?? undefined,
        offers: priced
          ? {
              '@type': 'Offer',
              url: this.absolute(`/services/${service.id}`),
              price: service.price,
              priceCurrency: CURRENCY,
              availability: 'https://schema.org/InStock',
              validThrough: service.endDate ?? undefined,
            }
          : undefined,
      },
      this.breadcrumb([
        ['Services', '/services'],
        [service.name, `/services/${service.id}`],
      ]),
    ]);
  }

  /**
   * A shop, as a LocalBusiness - the type that carries an address, a phone
   * number and opening hours into the result.
   *
   * The primary branch is the one described. A shop with six branches is six
   * places, and LocalBusiness describes one; picking the primary matches what
   * the page leads with, and the rest are listed on the page as plain content.
   */
  shop(shop: Shop): void {
    const branch = shop.branches?.find((item) => item.isPrimary) ?? shop.branches?.[0] ?? null;
    const hours = branch?.openingHours ?? shop.openingHours ?? null;

    this.set([
      {
        '@type': 'LocalBusiness',
        name: shop.name,
        description: shop.description ?? undefined,
        image: shop.logoUrl ?? shop.coverUrl ?? undefined,
        url: this.absolute(`/shops/${shop.slug ?? shop.id}`),
        telephone: shop.contactNumber ?? branch?.contactNumber ?? undefined,
        email: shop.email ?? undefined,
        address: this.addressOf(branch),
        geo:
          branch?.latitude != null && branch?.longitude != null
            ? { '@type': 'GeoCoordinates', latitude: branch.latitude, longitude: branch.longitude }
            : undefined,
        openingHoursSpecification: this.hoursOf(hours),
        // Rule 2: only when reviews exist. `average` is null until the first one.
        aggregateRating:
          shop.rating && shop.rating.count > 0 && shop.rating.average !== null
            ? {
                '@type': 'AggregateRating',
                ratingValue: shop.rating.average,
                reviewCount: shop.rating.count,
              }
            : undefined,
        sameAs: shop.socialLinks ? Object.values(shop.socialLinks).filter(Boolean) : undefined,
      },
      this.breadcrumb([
        ['Shops', '/shops'],
        [shop.name, `/shops/${shop.slug ?? shop.id}`],
      ]),
    ]);
  }

  // ---- Site-wide -----------------------------------------------------------

  /**
   * The site's own identity, written once at startup and never cleared.
   *
   * `SearchAction` is what lets Google offer a search box scoped to the site in
   * its own results. It names the listing's search parameter, so it has to stay
   * in step with what OfferListComponent reads.
   */
  site(): void {
    const origin = this.origin();
    this.write(
      [
        {
          '@type': 'Organization',
          '@id': `${origin}/#organization`,
          name: 'OffersOffer',
          url: origin,
          logo: `${origin}/icon-512.png`,
        },
        {
          '@type': 'WebSite',
          '@id': `${origin}/#website`,
          name: 'OffersOffer',
          url: origin,
          publisher: { '@id': `${origin}/#organization` },
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${origin}/offers?search={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        },
      ],
      'data-ld-site',
    );
  }

  /** Drops the page-scoped markup. Called before each page writes its own. */
  clear(): void {
    this.document.head
      .querySelectorAll(`script[${PAGE_SCOPED}]`)
      .forEach((element) => element.remove());
  }

  // ---- Plumbing ------------------------------------------------------------

  private set(nodes: Node[]): void {
    this.clear();
    this.write(nodes, PAGE_SCOPED);
  }

  private write(nodes: Node[], marker: string): void {
    const graph = nodes.map((node) => prune(node)).filter((node) => node !== undefined);
    if (graph.length === 0) return;

    const script = this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute(marker, '');
    // `<` is escaped so a shop named "</script>" cannot close the tag early.
    // JSON.stringify alone would emit it verbatim, which is an XSS hole, not a
    // formatting problem.
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
      /</g,
      '\\u003c',
    );
    this.document.head.appendChild(script);
  }

  private breadcrumb(trail: [string, string][]): Node {
    return {
      '@type': 'BreadcrumbList',
      itemListElement: trail.map(([name, path], index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: this.absolute(path),
      })),
    };
  }

  private sellerOf(shop: { name: string; slug?: string | null; id: number }): Node {
    return {
      '@type': 'Organization',
      name: shop.name,
      url: this.absolute(`/shops/${shop.slug ?? shop.id}`),
    };
  }

  private addressOf(branch: Branch | null): Node | undefined {
    if (!branch) return undefined;
    return {
      '@type': 'PostalAddress',
      streetAddress: [branch.address, branch.addressLine2].filter(Boolean).join(', ') || undefined,
      addressLocality: branch.city ?? undefined,
      addressRegion: branch.state ?? undefined,
      postalCode: branch.pincode ?? undefined,
      addressCountry: branch.country ?? 'IN',
    };
  }

  /**
   * Opening hours, one specification per day that has them.
   *
   * A day may hold several windows - a shop that shuts for lunch - and each is
   * its own specification, which is how the vocabulary expresses it. `'closed'`
   * days are left out entirely: absence is what closed means here.
   */
  private hoursOf(hours: OpeningHours | null): Node[] | undefined {
    if (!hours) return undefined;

    const specs: Node[] = [];
    for (const [day, windows] of Object.entries(hours) as [keyof OpeningHours, OpeningHours[keyof OpeningHours]][]) {
      if (!windows || windows === 'closed' || !Array.isArray(windows)) continue;
      for (const window of windows) {
        if (!window?.open || !window?.close) continue;
        specs.push({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: `https://schema.org/${DAY_NAMES[day]}`,
          opens: window.open,
          closes: window.close,
        });
      }
    }
    return specs.length > 0 ? specs : undefined;
  }

  private absolute(path: string): string {
    return `${this.origin()}${path}`;
  }

  private origin(): string {
    return this.document.location.origin;
  }
}

/**
 * Drops every empty branch, recursively.
 *
 * The builders above are written as plain object literals with `undefined` for
 * "no value", because that reads far better than assembling each node key by
 * key. JSON.stringify already omits an `undefined` property, but not an object
 * left empty once its properties went - `address: {}` would ship, and a
 * PostalAddress with no fields is worse than no address.
 */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Node)
      .map(([key, item]) => [key, prune(item)] as const)
      .filter(([, item]) => item !== undefined);
    // A node that is only its own @type says nothing worth publishing.
    const meaningful = entries.filter(([key]) => key !== '@type');
    return meaningful.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  if (value === null || value === '') return undefined;
  return value;
}
