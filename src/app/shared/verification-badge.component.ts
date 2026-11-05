import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IconComponent } from './icon.component';
import { VerificationStatus } from '../core/onboarding.service';
import { IconName } from './icons';

interface Presentation {
  label: string;
  icon: IconName;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
}

/**
 * Where a registration stands, as a badge (Onboarding §11, §14, §23).
 *
 * Status is carried three ways on purpose, because §23 forbids relying on
 * colour alone: the words say it, the icon is a distinct shape per state, and
 * the colour is the thing you notice last. The words are the plain-English
 * ones a reviewer would say out loud rather than the enum - "Waiting for
 * review", not PENDING_VERIFICATION - while the enum stays in the DOM as a
 * title for anyone matching a screen against an API response.
 */
@Component({
  selector: 'app-verification-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    <span class="vbadge" [class]="'tone-' + shown().tone" [attr.title]="status()">
      <app-icon [name]="shown().icon" [size]="14" />
      {{ shown().label }}
    </span>
  `,
  styles: [
    `
      .vbadge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.22rem 0.6rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
        border: 1px solid transparent;
      }
      .tone-neutral {
        background: var(--surface-alt);
        color: var(--text-muted);
        border-color: var(--border);
      }
      .tone-info {
        background: var(--info-bg);
        color: var(--info);
      }
      .tone-warning {
        background: var(--warning-bg);
        color: var(--warning);
      }
      .tone-success {
        background: var(--success-bg);
        color: var(--success);
      }
      .tone-danger {
        background: var(--danger-bg);
        color: var(--danger);
      }
    `,
  ],
})
export class VerificationBadgeComponent {
  readonly status = input.required<VerificationStatus | null>();

  private static readonly MAP: Record<VerificationStatus, Presentation> = {
    DRAFT: { label: 'Unfinished draft', icon: 'create-outline', tone: 'neutral' },
    PENDING_VERIFICATION: { label: 'Waiting for review', icon: 'time-outline', tone: 'info' },
    ADDITIONAL_INFO_REQUIRED: {
      label: 'Information requested',
      icon: 'alert-circle-outline',
      tone: 'warning',
    },
    VERIFIED: { label: 'Verified', icon: 'checkmark-circle-outline', tone: 'success' },
    REJECTED: { label: 'Rejected', icon: 'close-outline', tone: 'danger' },
    SUSPENDED: { label: 'Suspended', icon: 'ban-outline', tone: 'danger' },
  };

  /**
   * A null status is not a state in the lifecycle: it means the shop never
   * went through review at all, which is every shop our own team created
   * (§15). Saying so is more useful than an empty badge, and stops a reviewer
   * reading a blank as "nobody has looked at this yet".
   */
  readonly shown = computed<Presentation>(
    () =>
      VerificationBadgeComponent.MAP[this.status() as VerificationStatus] ?? {
        label: 'Created by our team',
        icon: 'shield-checkmark-outline',
        tone: 'neutral',
      },
  );
}
