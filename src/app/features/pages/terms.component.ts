import { Component, inject } from '@angular/core';

import { SeoService } from '../../core/seo.service';
import { LegalShellComponent } from './legal-shell.component';
import { POLICY_LAST_UPDATED, TERMS_SECTIONS } from './content';

/**
 * Terms & Conditions.
 *
 * Added alongside the Privacy Policy rather than after it: the registration
 * form already asks people to accept "the terms and conditions", and a
 * checkbox agreeing to a document that does not exist is worse than no
 * checkbox at all.
 */
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [LegalShellComponent],
  template: `
    <app-legal-shell
      heading="Terms & Conditions"
      intro="These terms cover your use of OffersOffer — what you can expect from us, and what we ask of you."
      [lastUpdated]="lastUpdated"
      [sections]="sections"
    />
  `,
})
export class TermsComponent {
  private readonly seo = inject(SeoService);

  readonly sections = TERMS_SECTIONS;
  readonly lastUpdated = POLICY_LAST_UPDATED;

  constructor() {
    this.seo.apply({
      title: 'Terms & Conditions',
      description:
        'The terms covering use of OffersOffer: accounts, claim codes, what shops are responsible for, acceptable use and merchant obligations.',
      path: '/terms',
    });
  }
}
