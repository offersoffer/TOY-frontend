import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { Page, PageMeta } from './models';
import { Registration, VerificationStatus } from './onboarding.service';

/** One row of the review queue (§14's list columns). */
export interface RegistrationRow {
  shopId: number;
  name: string;
  slug: string;
  contactNumber: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  categories: string[];
  owner: { id: number; name: string; email: string } | null;
  registrationSource: string | null;
  verificationStatus: VerificationStatus;
  /** The shop's public listing, which §11 keeps separate from verification. */
  status: 'active' | 'inactive';
  submittedAt: string | null;
  decidedAt: string | null;
  reviewer: { id: number; name: string } | null;
  createdAt: string;
}

/** One previous round on a registration, read from the audit trail (§25). */
export interface ReviewHistoryEntry {
  id: number;
  action: string;
  to: VerificationStatus | null;
  reason: string | null;
  at: string;
  by: { id: number; name: string } | null;
}

export interface RegistrationDetail extends Registration {
  listingStatus: 'active' | 'inactive';
  owner: { id: number; name: string; email: string; phone: string | null } | null;
  members: { id: number; name: string; email: string; designation: string | null }[];
  reviewer: { id: number; name: string; email: string } | null;
  history: ReviewHistoryEntry[];
}

export interface RegistrationQuery {
  page?: number;
  limit?: number;
  status?: VerificationStatus | '';
  source?: string;
  listingStatus?: 'active' | 'inactive' | '';
  city?: string;
  pincode?: string;
  q?: string;
}

interface Envelope<T> {
  data: T;
  meta?: PageMeta;
}

/**
 * Seller Management → Registrations (Self-Service Onboarding §14).
 *
 * Separate from `OnboardingService`, which is the seller's own view of their
 * own registration. These endpoints need a global grant and return things a
 * seller may not see - who else is on the shop, and the full review history -
 * so keeping the two clients apart stops a seller-facing screen reaching for
 * a reviewer-only call by autocomplete.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationReviewService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seller-registrations`;

  private params(query: RegistrationQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return params;
  }

  list(query: RegistrationQuery = {}): Observable<Page<RegistrationRow>> {
    return this.http
      .get<Envelope<RegistrationRow[]>>(this.base, { params: this.params(query) })
      .pipe(
        map((response) => ({
          items: response.data,
          meta: response.meta ?? {
            page: 1,
            limit: response.data.length,
            total: response.data.length,
            totalPages: 1,
            hasNext: false,
          },
        })),
      );
  }

  get(shopId: number): Observable<RegistrationDetail> {
    return this.http
      .get<Envelope<RegistrationDetail>>(`${this.base}/${shopId}`)
      .pipe(map((response) => response.data));
  }

  /** §11: approving may also put the shop live, but does not have to. */
  approve(shopId: number, activate = true): Observable<RegistrationDetail> {
    return this.decide(shopId, 'approve', { activate });
  }

  reject(shopId: number, reason: string): Observable<RegistrationDetail> {
    return this.decide(shopId, 'reject', { reason });
  }

  requestInfo(shopId: number, reason: string): Observable<RegistrationDetail> {
    return this.decide(shopId, 'request-info', { reason });
  }

  suspend(shopId: number, reason: string): Observable<RegistrationDetail> {
    return this.decide(shopId, 'suspend', { reason });
  }

  reactivate(shopId: number, reason?: string): Observable<RegistrationDetail> {
    return this.decide(shopId, 'reactivate', { reason: reason ?? '' });
  }

  /** The listing on its own, verification untouched (§11). */
  setListing(shopId: number, status: 'active' | 'inactive'): Observable<RegistrationDetail> {
    return this.http
      .put<Envelope<RegistrationDetail>>(`${this.base}/${shopId}/listing`, { status })
      .pipe(map((response) => response.data));
  }

  private decide(
    shopId: number,
    action: string,
    body: Record<string, unknown>,
  ): Observable<RegistrationDetail> {
    return this.http
      .post<Envelope<RegistrationDetail>>(`${this.base}/${shopId}/${action}`, body)
      .pipe(map((response) => response.data));
  }
}
