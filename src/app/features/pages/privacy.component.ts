import { Component, inject } from '@angular/core';

import { SeoService } from '../../core/seo.service';
import { LegalShellComponent } from './legal-shell.component';
import { POLICY_LAST_UPDATED, PRIVACY_SECTIONS } from './content';

/**
 * Privacy Policy. Reachable from the footer, the sign-up form, Settings and
 * Support, and readable without an account — a policy behind a login is not a
 * policy anyone can consult before deciding whether to sign up.
 */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [LegalShellComponent],
  template: `
    <app-legal-shell
      heading="Privacy Policy"
      intro="This policy explains what information OffersOffer collects, why we collect it, and what you can do about it."
      [lastUpdated]="lastUpdated"
      [sections]="sections"
    />
  `,
})
export class PrivacyComponent {
  private readonly seo = inject(SeoService);

  readonly sections = PRIVACY_SECTIONS;
  readonly lastUpdated = POLICY_LAST_UPDATED;

  constructor() {
    this.seo.apply({
      title: 'Privacy Policy',
      description:
        'What information OffersOffer collects, how location and claim data are used, who it is shared with, and how to ask us about your own.',
      path: '/privacy',
    });
  }
}
