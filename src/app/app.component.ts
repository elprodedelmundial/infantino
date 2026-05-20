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
    <router-outlet></router-outlet>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  private readonly location = inject(Location);
  private readonly minSwipeDistance = 70;
  private readonly maxVerticalOffset = 80;
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;

  title = 'prode-homepage';

  ngOnInit(): void {
    if (this.isStandaloneApp()) {
      document.documentElement.classList.add('standalone-app');
    }
  }

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (!this.isStandaloneApp() || event.touches.length !== 1 || this.startedOnInteractiveElement(event.target)) {
      this.resetTouch();
      return;
    }

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
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

  private resetTouch(): void {
    this.touchStartX = null;
    this.touchStartY = null;
  }
}
