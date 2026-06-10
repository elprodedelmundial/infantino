import { Injectable } from '@angular/core';

/**
 * Tiny in-memory signal that the user was just bounced to the login screen
 * because their session/JWT expired. Kept in memory (not history.state or
 * localStorage) so it does NOT survive a page reload — a fresh visit should
 * never show the "session expired" notice.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private expired = false;

  flagExpired(): void {
    this.expired = true;
  }

  /** Returns whether the session expired and clears the flag (consume-once). */
  consumeExpired(): boolean {
    const wasExpired = this.expired;
    this.expired = false;
    return wasExpired;
  }
}
