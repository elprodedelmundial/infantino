import { Injectable } from '@angular/core';

/**
 * Tracks whether the post-login "submit your awards predictions" reminder banner
 * should still be shown. State is kept in localStorage (per browser, keyed by
 * username) as requested.
 */
@Injectable({ providedIn: 'root' })
export class AwardsReminderService {
  private static readonly SUBMITTED_KEY = 'prode_awards_submitted_v1';

  /**
   * Hard cutoff: after this instant the banner is never shown to anyone.
   * Set to 2026-06-11 15:00 Buenos Aires time (UTC-3).
   */
  private static readonly CUTOFF = new Date('2026-06-11T15:00:00-03:00');

  isPastCutoff(now: number = Date.now()): boolean {
    return now > AwardsReminderService.CUTOFF.getTime();
  }

  hasSubmitted(username: string): boolean {
    const key = this.normalize(username);
    if (!key) return false;
    return this.readSubmitted().includes(key);
  }

  markSubmitted(username: string): void {
    const key = this.normalize(username);
    if (!key) return;
    const submitted = new Set(this.readSubmitted());
    submitted.add(key);
    try {
      localStorage.setItem(AwardsReminderService.SUBMITTED_KEY, JSON.stringify([...submitted]));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }

  /** Banner is eligible only before the cutoff and while the user hasn't submitted. */
  canShow(username: string): boolean {
    return !this.isPastCutoff() && !this.hasSubmitted(username);
  }

  private normalize(username: string): string {
    return (username ?? '').trim().toLowerCase();
  }

  private readSubmitted(): string[] {
    try {
      const raw = localStorage.getItem(AwardsReminderService.SUBMITTED_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}
