import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'member_display_mode';

@Injectable({ providedIn: 'root' })
export class MemberDisplayPreferenceService {
  readonly useFullName = signal<boolean>(this.readInitial());

  setUseFullName(value: boolean): void {
    this.useFullName.set(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'fullName' : 'username');
    } catch {
      /* ignore */
    }
  }

  /** Prefer full name when enabled and non-empty; otherwise username. */
  displayName(username: string, fullName?: string | null): string {
    const preferFull = this.useFullName();
    const fn = (fullName ?? '').trim();
    if (preferFull && fn) return fn;
    return username;
  }

  private readInitial(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default is fullName unless the user has explicitly chosen username
      return stored !== 'username';
    } catch {
      return true;
    }
  }
}
