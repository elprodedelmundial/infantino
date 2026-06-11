import { Location } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="bg-pattern"></div>
    <div class="grid-overlay"></div>
    <div
      class="ptr"
      [class.ptr--visible]="pullDistance > 0 || isRefreshing"
      [class.ptr--refreshing]="isRefreshing"
      [style.transform]="ptrTransform">
      <span class="ptr__spinner"></span>
    </div>
    <router-outlet></router-outlet>
  `,
  styles: [`
    .ptr {
      position: fixed;
      top: -46px;
      left: 50%;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(10, 10, 11, 0.92);
      border: 1px solid var(--border, #2a2a2d);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
      opacity: 0;
      transform: translate(-50%, 0);
      transition: opacity 0.15s ease;
      pointer-events: none;
    }
    .ptr--visible { opacity: 1; }
    .ptr__spinner {
      width: 18px;
      height: 18px;
      border: 2px solid var(--border, #2a2a2d);
      border-top-color: var(--accent, #e8ff47);
      border-radius: 50%;
    }
    .ptr--refreshing .ptr__spinner { animation: ptr-spin 0.8s linear infinite; }
    @keyframes ptr-spin { to { transform: rotate(360deg); } }
  `]
})
export class AppComponent implements OnInit {
  private readonly location = inject(Location);
  private readonly minSwipeDistance = 70;
  private readonly maxVerticalOffset = 80;
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;

  // Pull-to-refresh: a large downward drag while scrolled to the top reloads
  // the app (refreshing the page, the burger menu, and join requests).
  private readonly pullTriggerDistance = 110;
  private readonly pullMaxIndicator = 70;
  private pullStartX: number | null = null;
  private pullStartY: number | null = null;
  private pullArmed = false;
  pullDistance = 0;
  isRefreshing = false;

  title = 'prode-homepage';

  get ptrTransform(): string {
    const y = this.isRefreshing ? this.pullMaxIndicator : this.pullDistance;
    return `translate(-50%, ${y}px)`;
  }

  ngOnInit(): void {
    if (this.isStandaloneApp()) {
      document.documentElement.classList.add('standalone-app');
    }
  }

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.resetPull();

    if (!this.isStandaloneApp() || event.touches.length !== 1) {
      this.resetTouch();
      return;
    }

    const touch = event.touches[0];

    // Arm pull-to-refresh only when the page is scrolled to the very top. This
    // works even when the gesture starts on a button, since a tap can't reach
    // the (large) trigger distance. Skip when the gesture begins inside a modal
    // (or other scroll container that isn't at its own top) so list scrolling
    // there doesn't reload the page underneath.
    if (
      !this.isRefreshing &&
      this.isAtTop() &&
      !this.startedOnBlockingOverlay(event.target) &&
      !this.hasScrollableAncestorNotAtTop(event.target)
    ) {
      this.pullStartX = touch.clientX;
      this.pullStartY = touch.clientY;
      this.pullArmed = true;
    }

    // Swipe-nav arming intentionally ignores interactive elements so taps on
    // buttons/links aren't hijacked by horizontal navigation.
    if (this.startedOnInteractiveElement(event.target)) {
      this.touchStartX = null;
      this.touchStartY = null;
      return;
    }

    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (this.startedOnBlockingOverlay(event.target) || this.hasScrollableAncestorNotAtTop(event.target)) {
      this.resetPull();
      return;
    }

    if (!this.pullArmed || this.pullStartY === null || this.isRefreshing || event.touches.length !== 1) {
      return;
    }

    const delta = event.touches[0].clientY - this.pullStartY;

    // Cancel the pull if the finger moves up or the page is no longer at the top.
    if (delta <= 0 || !this.isAtTop()) {
      this.pullDistance = 0;
      return;
    }

    // Dampen the indicator travel so it trails the finger, capped at the max.
    this.pullDistance = Math.min(this.pullMaxIndicator, delta * 0.5);
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    // Pull-to-refresh takes priority and is independent of the swipe-nav state.
    if (this.pullArmed && this.pullStartY !== null && !this.isRefreshing) {
      const touch = event.changedTouches[0];
      if (this.startedOnBlockingOverlay(event.target) || this.hasScrollableAncestorNotAtTop(event.target)) {
        this.resetPull();
        this.resetTouch();
        return;
      }
      const deltaY = touch.clientY - this.pullStartY;
      const deltaX = this.pullStartX !== null ? Math.abs(touch.clientX - this.pullStartX) : 0;
      const triggered =
        this.isAtTop() &&
        deltaY >= this.pullTriggerDistance &&
        deltaX < deltaY * 0.5;
      this.resetPull();
      if (triggered) {
        this.triggerRefresh();
        this.resetTouch();
        return;
      }
    } else {
      this.resetPull();
    }

    if (!this.isStandaloneApp() || this.touchStartX === null || this.touchStartY === null) {
      this.resetTouch();
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    this.resetTouch();

    if (
      Math.abs(deltaX) < this.minSwipeDistance ||
      Math.abs(deltaY) > this.maxVerticalOffset ||
      Math.abs(deltaX) < Math.abs(deltaY) * 1.5
    ) {
      return;
    }

    if (deltaX > 0) {
      this.location.back();
      return;
    }

    this.location.forward();
  }

  private isStandaloneApp(): boolean {
    const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      navigatorWithStandalone.standalone === true
    );
  }

  private startedOnInteractiveElement(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]'));
  }

  /** Modals and similar overlays: never pull-to-refresh the page underneath. */
  private startedOnBlockingOverlay(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest('.modal-overlay, .auth-modal-overlay, .quota-modal-overlay'));
  }

  /** True when the touch is inside a nested scroller that isn't at scroll top. */
  private hasScrollableAncestorNotAtTop(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    let el: Element | null = target;
    while (el && el !== document.documentElement) {
      const { overflowY } = window.getComputedStyle(el);
      const scrollable =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 1;
      if (scrollable && el.scrollTop > 0) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  private resetTouch(): void {
    this.touchStartX = null;
    this.touchStartY = null;
  }

  private resetPull(): void {
    this.pullStartX = null;
    this.pullStartY = null;
    this.pullArmed = false;
    this.pullDistance = 0;
  }

  private isAtTop(): boolean {
    const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
    return scrollTop <= 0;
  }

  /**
   * Full reload so the whole app re-initializes: the active page re-fetches its
   * data and the toolbar's ngOnInit re-loads the burger menu and join requests
   * from /me. The auth token (localStorage) and username (history.state) both
   * survive the reload.
   */
  private triggerRefresh(): void {
    this.isRefreshing = true;
    this.pullDistance = 0;
    setTimeout(() => window.location.reload(), 150);
  }
}
