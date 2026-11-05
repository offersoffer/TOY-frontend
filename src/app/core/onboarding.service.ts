import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { LocationSource } from './models';

/** §7's three UI states, decided by the backend so no client can disagree. */
export type LocationState = 'NOT_SELECTED' | 'PIN_SELECTED_NOT_CONFIRMED' | 'CONFIRMED';

export type VerificationStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'ADDITIONAL_INFO_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface RegistrationAddress {
  branchId: number;
  address: string | null;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: LocationSource | null;
  locationState: LocationState;
  locationConfirmedAt: string | null;
}

/**
 * §8's optional evidence. Returned only to the seller themselves or to a
 * reviewer - §19 keeps it off every public shop response.
 */
export interface VerificationEvidence {
  gstin?: string | null;
  googleBusinessUrl?: string | null;
  businessRegistrationNumber?: string | null;
  note?: string | null;
}

export interface Registration {
  shopId: number;
  slug: string;
  name: string;
  description: string | null;
  contactNumber: string | null;
  email: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  categoryIds: number[];
  registrationSource: string | null;
  verificationStatus: VerificationStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  /** Shown to the seller verbatim when more information is needed (§12). */
  decisionReason: string | null;
  verification?: VerificationEvidence;
  canEdit: boolean;
  canSubmit: boolean;
  isPublic: boolean;
  address: RegistrationAddress | null;
}

export interface AddressPayload {
  address?: string | null;
  addressLine2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: LocationSource | null;
  locationAccuracy?: number | null;
  /** Set only when the seller pressed Confirm Shop Location (§7). */
  locationConfirmed?: boolean;
}

export interface RegistrationPayload {
  name?: string;
  description?: string;
  contactNumber?: string;
  email?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  categoryIds?: number[];
  address?: AddressPayload;
}

interface Envelope<T> {
  data: T;
}

/**
 * Self-service seller registration (§4, §21).
 *
 * Stateless on purpose, unlike SubscriptionService: a registration is edited
 * on one screen by one person and the server is the only copy that counts.
 * §4 wants progress to survive the seller leaving, and the way to guarantee
 * that is to save each step to the server rather than hold a client cache
 * that a closed tab takes with it.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/onboarding`;

  private data<T>(source: Observable<Envelope<T>>): Observable<T> {
    return source.pipe(map((response) => response.data));
  }

  /** Everything this seller has in flight; drives the resume prompt (§4). */
  mine(): Observable<Registration[]> {
    return this.data(this.http.get<Envelope<Registration[]>>(`${this.base}/me`));
  }

  get(shopId: number): Observable<Registration> {
    return this.data(this.http.get<Envelope<Registration>>(`${this.base}/${shopId}`));
  }

  start(payload: RegistrationPayload): Observable<Registration> {
    return this.data(this.http.post<Envelope<Registration>>(this.base, payload));
  }

  /** Saves one wizard step. Called on every step change, not just at the end. */
  save(shopId: number, payload: RegistrationPayload): Observable<Registration> {
    return this.data(this.http.patch<Envelope<Registration>>(`${this.base}/${shopId}`, payload));
  }

  /**
   * Submits for review (§10).
   *
   * Safe to retry: the server returns the registration unchanged if it is
   * already pending, so a request that times out after the server accepted it
   * does not show the seller an error for something that worked (§24).
   */
  submit(shopId: number): Observable<Registration> {
    return this.data(
      this.http.post<Envelope<Registration>>(`${this.base}/${shopId}/submit`, {
        acceptedTerms: true,
      }),
    );
  }
}
