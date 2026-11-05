import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IconComponent } from './icon.component';

export interface WizardStep {
  /** Stable key, used for tracking and for deep links. */
  key: string;
  label: string;
  /** Shown as "optional" so nobody fills it in out of obligation (§4). */
  optional?: boolean;
}

/**
 * Progress through a multi-step form (Self-Service Onboarding §4, §23).
 *
 *   <app-stepper
 *     [steps]="steps" [current]="index()" [furthest]="furthest()"
 *     (stepSelected)="goTo($event)" />
 *
 * Two jobs, and the second is the one that matters: it says where you are,
 * and it lets you go back without losing what you typed. §4 asks for progress
 * to be visible and each step validated before continuing, which only works
 * if returning to a finished step is free - otherwise "validate before
 * continuing" reads as "you cannot fix the thing you just got wrong".
 *
 * Forward movement is deliberately not offered here. A step is reachable once
 * it has been reached, and `furthest` is owned by the wizard, because only the
 * wizard knows whether the current step validates.
 *
 * On a narrow screen the labels collapse to a counter and the current step's
 * name. A shopkeeper filling this in on a phone needs the room for the form,
 * and six labels wrapped over three lines is not progress, it is a header.
 */
@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="stepper" [attr.aria-label]="ariaLabel()">
      <p class="counter">
        Step {{ current() + 1 }} of {{ steps().length }}
        <span class="counter-label">· {{ steps()[current()]?.label }}</span>
      </p>

      <ol>
        @for (step of steps(); track step.key; let i = $index) {
          <li
            [class.done]="i < current()"
            [class.active]="i === current()"
            [class.reachable]="i <= furthest()"
          >
            @if (i <= furthest() && i !== current()) {
              <button type="button" (click)="stepSelected.emit(i)">
                <ng-container
                  *ngTemplateOutlet="marker; context: { $implicit: step, i: i }"
                />
              </button>
            } @else {
              <span [attr.aria-current]="i === current() ? 'step' : null">
                <ng-container
                  *ngTemplateOutlet="marker; context: { $implicit: step, i: i }"
                />
              </span>
            }
          </li>
        }
      </ol>
    </nav>

    <!--
      Status is carried three ways on purpose (§23: do not rely on colour
      alone): the tick or number is a shape, the state word is read out, and
      the colour is the thing you notice last.
    -->
    <ng-template #marker let-step let-i="i">
      <span class="dot" aria-hidden="true">
        @if (i < current()) {
          <app-icon name="checkmark-outline" [size]="13" />
        } @else {
          {{ i + 1 }}
        }
      </span>
      <span class="label">
        {{ step.label }}
        @if (step.optional) {
          <span class="optional">optional</span>
        }
      </span>
      <span class="sr-only">
        @if (i < current()) { — completed }
        @else if (i === current()) { — current step }
        @else { — not started }
      </span>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .counter {
        margin: 0 0 0.75rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text);
      }
      .counter-label {
        font-weight: 400;
        color: var(--text-muted);
      }

      ol {
        display: flex;
        gap: 0.25rem;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      li {
        flex: 1 1 0;
        min-width: 0;
      }

      li button,
      li span.dot + .label,
      li > span {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        min-width: 0;
      }

      li > button,
      li > span {
        background: none;
        border: 0;
        padding: 0.5rem 0.25rem 0;
        text-align: left;
        font: inherit;
        /* The rule above the step is the progress bar; it is the only thing
           that has to survive the labels being hidden on a phone. */
        border-top: 3px solid var(--border);
        color: var(--text-muted);
      }

      li.reachable > button {
        cursor: pointer;
      }
      li.done > button,
      li.done > span {
        border-top-color: var(--success);
        color: var(--text);
      }
      li.active > span,
      li.active > button {
        border-top-color: var(--brand);
        color: var(--text);
        font-weight: 600;
      }

      li > button:focus-visible,
      li > span:focus-visible {
        outline: 2px solid var(--brand);
        outline-offset: 3px;
        border-radius: var(--radius-sm);
      }

      .dot {
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 50%;
        border: 1px solid currentColor;
        font-size: 0.7rem;
        font-variant-numeric: tabular-nums;
      }
      li.done .dot {
        background: var(--success);
        border-color: var(--success);
        color: #fff;
      }
      li.active .dot {
        background: var(--brand);
        border-color: var(--brand);
        color: var(--brand-ink);
      }

      .label {
        font-size: 0.8rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .optional {
        font-weight: 400;
        font-size: 0.7rem;
        color: var(--text-muted);
        margin-left: 0.3rem;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }

      /* Below this the labels cost more than they tell you; the counter above
         already names the step you are on. */
      @media (max-width: 720px) {
        li span.dot + .label,
        li .label,
        li .optional {
          display: none;
        }
        li > button,
        li > span {
          justify-content: center;
          padding-inline: 0;
        }
      }
    `,
  ],
})
export class StepperComponent {
  readonly steps = input.required<WizardStep[]>();
  readonly current = input.required<number>();

  /**
   * The furthest step reached so far. Steps up to it are navigable; beyond it
   * they are not, because the wizard has not validated the way there yet.
   */
  readonly furthest = input<number>(0);

  readonly stepSelected = output<number>();

  readonly ariaLabel = computed(
    () => `Registration progress: step ${this.current() + 1} of ${this.steps().length}`,
  );
}
