import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Branch, Role, Shop, ShopMember } from '../../core/models';
import { PERMISSIONS } from '../../core/permissions';
import { applyServerErrors, errorFor } from '../auth/auth-shell';
import { ConfirmComponent, EmptyStateComponent } from '../../shared/ui.components';

/** Shop members: add people, assign a branch, designation and shop-level role (§18). */
@Component({
  selector: 'app-member-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, ConfirmComponent],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <h1>Shop members</h1>
          <p class="subtitle">
            {{ shop()?.name || 'Shop' }} — assign staff and give them the access their role allows.
          </p>
        </div>
        <a routerLink="/admin/shops" class="btn btn-ghost">← Back to shops</a>
      </div>

      <div class="member-layout">
        <div>
          @if (loading()) {
            <div class="skeleton" style="height: 220px"></div>
          } @else if (members().length === 0) {
            <app-empty-state icon="people-outline" title="No members yet" message="Add the first team member." />
          } @else {
            <div class="card">
              <div class="table-wrap">
                <table class="data">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Designation</th>
                      <th>Branch</th>
                      <th>Role</th>
                      <th>Status</th>
                      @if (canManage) {
                        <th></th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (member of members(); track member.id) {
                      <tr>
                        <td>
                          <strong>{{ member.name }}</strong><br />
                          <span class="small muted">{{ member.email }}</span>
                          @if (member.userStatus !== 'active') {
                            <span class="badge badge-danger">Account inactive</span>
                          }
                        </td>
                        <td class="small">{{ member.designation || '—' }}</td>
                        <td class="small">
                          @if (member.branchName) {
                            {{ member.branchName }}
                            @if (member.branchRestricted) {
                              <br /><span class="badge badge-brand">Branch admin</span>
                            } @else {
                              <br /><span class="muted">Works here, runs the shop</span>
                            }
                          } @else {
                            All branches
                          }
                        </td>
                        <td>
                          @if (member.roleName) {
                            <span class="badge badge-brand">{{ member.roleName }}</span>
                          } @else {
                            <span class="small muted">No role</span>
                          }
                        </td>
                        <td>
                          <span
                            class="badge"
                            [class.badge-success]="member.status === 'active'"
                            [class.badge-danger]="member.status !== 'active'"
                          >
                            {{ member.status }}
                          </span>
                        </td>
                        @if (canManage) {
                          <td>
                            <div class="actions-cell">
                              <button type="button" class="btn btn-secondary btn-sm" (click)="startEdit(member)">
                                Edit
                              </button>
                              <button type="button" class="btn btn-ghost btn-sm" (click)="pendingRemove.set(member)">
                                Remove
                              </button>
                            </div>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>

        @if (canManage) {
          <aside>
            <section class="card">
              <div class="card-header">
                <h3>{{ editingId() ? 'Edit member' : 'Add a member' }}</h3>
                @if (editingId()) {
                  <button type="button" class="btn btn-ghost btn-sm" (click)="cancelEdit()">Cancel</button>
                }
              </div>
              <div class="card-body">
                <form [formGroup]="form" (ngSubmit)="save()" novalidate>
                  @if (formError()) {
                    <div class="error-text mb-2">{{ formError() }}</div>
                  }

                  @if (!editingId()) {
                    <div class="field">
                      <label for="email">Email *</label>
                      <input id="email" type="email" formControlName="email" [class.invalid]="error('email', 'Email')" />
                      @if (error('email', 'Email'); as message) {
                        <span class="error-text">{{ message }}</span>
                      }
                      <span class="hint">
                        If no account exists for this address, one is created and the person is emailed a
                        link to set their password.
                      </span>
                    </div>

                    <div class="field">
                      <label for="name">Full name</label>
                      <input id="name" type="text" formControlName="name" />
                      <span class="hint">Required only when inviting someone new.</span>
                    </div>

                    <div class="field">
                      <label for="phone">Phone number</label>
                      <input id="phone" type="tel" formControlName="phone" />
                    </div>
                  }

                  <div class="field">
                    <label for="designation">Designation</label>
                    <input id="designation" type="text" formControlName="designation" placeholder="e.g. Store Manager" />
                  </div>

                  <div class="field">
                    <label for="branchId">Branch</label>
                    <select id="branchId" formControlName="branchId">
                      <option [ngValue]="null">All branches</option>
                      @for (branch of branches(); track branch.id) {
                        <option [ngValue]="branch.id">{{ branch.branchName }}</option>
                      }
                    </select>
                    <span class="hint">
                      Where this person works. On its own this only decides which counter they may
                      redeem claims at — it does not limit anything else.
                    </span>
                  </div>

                  <!--
                    Confinement is a separate, deliberate choice from being
                    attached to a branch. Those two were one field until it
                    became clear that every member a merchant had casually
                    attached to a branch would have lost their shop-wide
                    powers the day it shipped.
                  -->
                  <div class="field">
                    <label class="checkbox">
                      <!--
                        Disabled through the control rather than the
                        attribute: with a reactive form the value accessor
                        owns the element's disabled state, so an
                        attr.disabled binding renders and is then ignored -
                        the box looked greyed out and stayed clickable.
                      -->
                      <input type="checkbox" formControlName="branchRestricted" />
                      <span>Make them a branch admin</span>
                    </label>
                    @if (form.controls.branchId.value === null) {
                      <span class="hint">Pick a branch first — there is nothing to confine them to.</span>
                    } @else {
                      <span class="hint">
                        They will only see and manage this branch: its offers, its claims and its
                        figures. Leave this off for someone who runs the whole shop from one of its
                        branches.
                      </span>
                    }
                  </div>

                  <div class="field">
                    <label for="roleId">Role</label>
                    <select id="roleId" formControlName="roleId">
                      <option [ngValue]="null">No role (view only)</option>
                      @for (role of roles(); track role.id) {
                        <option [ngValue]="role.id">{{ role.name }}</option>
                      }
                    </select>
                    <span class="hint">
                      The role decides what this person may do <em>in this shop</em>.
                    </span>
                  </div>

                  <div class="field">
                    <label for="status">Status</label>
                    <select id="status" formControlName="status">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <button type="submit" class="btn btn-block" [disabled]="saving()">
                    @if (saving()) {
                      <span class="spinner"></span> Saving…
                    } @else {
                      {{ editingId() ? 'Save member' : 'Add member' }}
                    }
                  </button>
                </form>
              </div>
            </section>
          </aside>
        }
      </div>

      <app-confirm
        [open]="pendingRemove() !== null"
        title="Remove this member?"
        [message]="
          'This removes ' +
          (pendingRemove()?.name || 'the member') +
          ' from the shop. Their user account is not deleted.'
        "
        confirmLabel="Remove member"
        (confirm)="confirmRemove()"
        (cancel)="pendingRemove.set(null)"
      />
    </div>
  `,
  styles: [
    `
      .member-layout {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 340px);
        gap: 1.25rem;
        align-items: start;
      }

      .actions-cell {
        display: flex;
        gap: 0.25rem;
        white-space: nowrap;
      }

      @media (max-width: 960px) {
        .member-layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class MemberManageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly shopId = Number(this.route.snapshot.paramMap.get('id'));
  readonly shop = signal<Shop | null>(null);
  readonly members = signal<ShopMember[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly pendingRemove = signal<ShopMember | null>(null);
  readonly formError = signal<string | null>(null);

  readonly canManage = this.auth.hasForShop(this.shopId, PERMISSIONS.MANAGE_SHOP_MEMBERS);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.email]],
    name: [''],
    phone: [''],
    designation: [''],
    branchId: [null as number | null],
    branchRestricted: [false],
    roleId: [null as number | null],
    status: ['active' as 'active' | 'inactive'],
  });

  constructor() {
    // A confinement with no branch confines nobody, so the two controls are
    // kept honest together rather than left to disagree on screen.
    this.syncBranchRestricted(this.form.controls.branchId.value);
    this.form.controls.branchId.valueChanges.subscribe((branchId) =>
      this.syncBranchRestricted(branchId),
    );

    this.api.getShop(this.shopId).subscribe({ next: (shop) => this.shop.set(shop), error: () => undefined });
    this.api.listBranches(this.shopId).subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => undefined,
    });

    // Assigning a role needs the role catalogue, which is Super Admin only.
    if (this.auth.has(PERMISSIONS.MANAGE_ROLES)) {
      this.api.listRoles().subscribe({
        next: (roles) => this.roles.set(roles.filter((role) => role.status === 'active')),
        error: () => undefined,
      });
    }

    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listMembers(this.shopId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  error(control: string, label: string): string | null {
    return errorFor(this.form.get(control), label);
  }

  /** Keeps "branch admin" unavailable, and unticked, while no branch is named. */
  private syncBranchRestricted(branchId: number | null): void {
    const control = this.form.controls.branchRestricted;
    if (branchId === null) {
      if (control.value) control.setValue(false);
      // `emitEvent: false` because nothing should treat this as the user
      // changing their mind - they changed the branch.
      control.disable({ emitEvent: false });
      return;
    }
    control.enable({ emitEvent: false });
  }

  startEdit(member: ShopMember): void {
    this.editingId.set(member.id);
    this.form.patchValue({
      designation: member.designation ?? '',
      branchId: member.branchId,
      roleId: member.roleId,
      status: member.status,
    });
    // After the branch, and after the sync it triggers: a disabled control
    // would otherwise swallow the value, and an enabled one set before the
    // branch would be cleared by the sync.
    this.syncBranchRestricted(member.branchId);
    this.form.controls.branchRestricted.setValue(member.branchRestricted);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ status: 'active' });
    // `reset` re-enables every control, so the toggle has to be put back.
    this.syncBranchRestricted(this.form.controls.branchId.value);
  }

  save(): void {
    this.formError.set(null);
    const value = this.form.getRawValue();
    const id = this.editingId();

    if (!id && !value.email) {
      this.formError.set('Enter the email address of the person you want to add.');
      return;
    }

    this.saving.set(true);
    const payload: Record<string, unknown> = {
      designation: value.designation || null,
      branchId: value.branchId,
      // The server ignores this without a branch, but sending a stale `true`
      // from a form where the branch was just cleared would read as a bug the
      // next time somebody looked at the row.
      branchRestricted: value.branchId === null ? false : value.branchRestricted,
      roleId: value.roleId,
      status: value.status,
    };
    if (!id) {
      payload['email'] = value.email;
      payload['name'] = value.name || undefined;
      payload['phone'] = value.phone || undefined;
    }

    const request = id
      ? this.api.updateMember(this.shopId, id, payload)
      : this.api.addMember(this.shopId, payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(id ? 'Member updated.' : 'Member added.');
        this.cancelEdit();
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(applyServerErrors(this.form, error));
      },
    });
  }

  confirmRemove(): void {
    const member = this.pendingRemove();
    if (!member) return;

    this.api.removeMember(this.shopId, member.id).subscribe({
      next: () => {
        this.members.update((list) => list.filter((item) => item.id !== member.id));
        this.pendingRemove.set(null);
        this.toast.success('Member removed.');
      },
      error: () => this.pendingRemove.set(null),
    });
  }
}
