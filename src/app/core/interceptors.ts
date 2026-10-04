import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';
import { ToastService } from './toast.service';

const isApiRequest = (request: HttpRequest<unknown>) => request.url.startsWith(environment.apiUrl);
const isAuthEndpoint = (request: HttpRequest<unknown>) =>
  request.url.includes('/auth/login') ||
  request.url.includes('/auth/register') ||
  request.url.includes('/auth/refresh-token');

/** Attaches the bearer token to API calls and sends cookies for the refresh flow. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken;

  if (!isApiRequest(request)) return next(request);

  const withCredentials = request.url.includes('/auth/');
  if (!token) {
    return next(withCredentials ? request.clone({ withCredentials: true }) : request);
  }

  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
      withCredentials,
    }),
  );
};

// A single refresh is shared by every request that 401s while it is in flight,
// so a burst of parallel calls does not trigger a burst of refreshes.
//
// `null` means "still waiting"; `false` means the refresh failed. Waiters need
// that second signal - without it a failed refresh leaves every queued request
// hanging on a token that will never arrive.
let refreshInFlight = false;
const refreshed$ = new BehaviorSubject<string | false | null>(null);

/** Transparently refreshes an expired access token and replays the request. */
export const refreshInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      // A 401 on a non-auth API call is worth one silent refresh: a customer
      // should never meet the login screen because an access token aged out
      // (§20). The refresh cookie can outlive the access token, so a missing
      // token is not on its own a reason to skip the attempt - but there must
      // be *some* sign of a session, or an anonymous visitor's 401 would end in
      // a spurious logout and redirect to the login page.
      const isExpired =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest(request) &&
        !isAuthEndpoint(request) &&
        (Boolean(auth.accessToken) || auth.hasSession);

      if (!isExpired) return throwError(() => error);

      if (refreshInFlight) {
        return refreshed$.pipe(
          filter((token): token is string | false => token !== null),
          take(1),
          switchMap((token) =>
            token === false
              ? throwError(() => error)
              : next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })),
          ),
        );
      }

      refreshInFlight = true;
      refreshed$.next(null);

      return auth.refreshSession().pipe(
        // This catch sits on the refresh itself, deliberately *above* the
        // switchMap that replays the request. Below it, every failure of the
        // replayed call - a plan gate, a validation error, a 500 - would be
        // read as "the session is dead" and log the user out, throwing away
        // the real error before the page that asked could show it.
        catchError((refreshError: unknown) => {
          refreshInFlight = false;
          refreshed$.next(false);
          // The refresh token is gone or revoked - start over.
          auth.logout();
          void router.navigate(['/auth/login'], {
            queryParams: { returnUrl: router.url },
          });
          return throwError(() => refreshError);
        }),
        switchMap((session) => {
          refreshInFlight = false;
          refreshed$.next(session.accessToken);
          return next(request.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } }));
        }),
      ) as Observable<never>;
    }),
  );
};

/**
 * Surfaces server errors as toasts, and keeps the offline state honest (§36).
 *
 * Validation errors (422) are left to the form that raised them, which shows
 * them field by field.
 *
 * Plan gates (403 PLAN_UPGRADE_REQUIRED) are also left alone: they are an
 * expected answer rather than a failure, and the page that asked already
 * renders the contextual upgrade prompt from §31. Toasting them as well just
 * repeats the same sentence over the top of it.
 *
 * Two additions for the graceful-failure work:
 *
 * A status of 0 means the request never left the device, so the network
 * service is told - `navigator.onLine` is often still true when Wi-Fi has
 * dropped its association, and a failed request is the better evidence. No
 * toast is raised for it: the offline banner is already saying it, at the top
 * of every page, and a toast on top would say it twice per failed request.
 *
 * A 5xx carrying a request id gets it appended (§57), so the reference reaches
 * the person who would have to quote it even when the failure happened on a
 * screen with no error panel of its own.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);
  const network = inject(NetworkStatusService);

  return next(request).pipe(
    tap((event) => {
      // Any answer at all - including an error status - proves the network is
      // working, so success here is about reachability, not about the result.
      if (event instanceof HttpResponse && isApiRequest(request)) network.reportRequestSuccess();
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isApiRequest(request)) {
        const message = error.error?.error?.message;
        const code = error.error?.error?.code;
        const requestId = error.error?.error?.requestId;

        if (error.status === 0) {
          network.reportRequestFailure();
          return throwError(() => error);
        }

        network.reportRequestSuccess();

        if (code === 'PLAN_UPGRADE_REQUIRED') {
          return throwError(() => error);
        }

        if (error.status === 403) {
          toast.error(message ?? 'You do not have permission to do that.');
        } else if (error.status === 429) {
          toast.error(message ?? 'Too many requests. Please slow down.');
        } else if (error.status >= 500) {
          // §37 and §38 are two different apologies. A 5xx with nothing in the
          // body means we never reached the API - a dead process, a proxy with
          // no upstream - which is §37's wording. A 5xx that answered with our
          // error envelope is the API itself failing, and it has already chosen
          // §38's words; repeating our own over the top would replace a
          // specific explanation with a vaguer one.
          //
          // The absent envelope is the test, not the status code. Which code a
          // proxy invents for a dead upstream is up to the proxy - nginx says
          // 502, the dev server says 500 - so keying on 502/503/504 alone told
          // a customer "something went wrong on our side" at exactly the moment
          // nothing of ours had been reached at all. Our own 5xx always carries
          // `code`; a proxy's never does.
          const unreachable =
            !code || error.status === 502 || error.status === 503 || error.status === 504;
          const base =
            message ??
            (unreachable
              ? 'We’re having trouble connecting to OffersOffer. Please try again.'
              : 'Something went wrong on our side. Please try again.');
          toast.error(requestId ? `${base} (Reference: ${requestId})` : base);
        } else if (error.status !== 422 && error.status !== 401 && message) {
          toast.error(message);
        }
      }
      return throwError(() => error);
    }),
  );
};
