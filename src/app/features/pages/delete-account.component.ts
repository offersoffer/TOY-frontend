import { Component, inject } from '@angular/core';

import { SeoService } from '../../core/seo.service';
import { LegalShellComponent } from './legal-shell.component';
import { DELETE_ACCOUNT_SECTIONS, POLICY_LAST_UPDATED } from './content';

/**
 * The "Data deletion" URL submitted to the Google Play Console.
 *
 * Deliberately public and unauthenticated, like Privacy and Terms: Play
 * requires this page to be readable by somebody who has already uninstalled
 * the app, and by a reviewer who never had an account at all. Putting it
 * behind the login would fail review for exactly the people it is for.
 */
@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [LegalShellComponent],
  template: `
    <app-legal-shell
      heading="Delete Your Account"
      intro="How to permanently delete your OffersOffer account and the data we hold about you, from inside the app or by email."
      [lastUpdated]="lastUpdated"
      [sections]="sections"
    />
  `,
})
export class DeleteAccountComponent {
  private readonly seo = inject(SeoService);

  readonly sections = DELETE_ACCOUNT_SECTIONS;
  readonly lastUpdated = POLICY_LAST_UPDATED;

  constructor() {
    this.seo.apply({
      title: 'Delete Your Account',
      description:
        'Delete your OffersOffer account and personal data — from the app in four steps, or by email if you have already uninstalled it.',
      path: '/delete-account',
    });
  }
}
