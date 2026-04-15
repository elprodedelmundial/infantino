import { Component, Inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { MemberDisplayPreferenceService } from '../../services/member-display-preference.service';

@Component({
  selector: 'app-user-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-toolbar.component.html',
  styleUrl: './user-toolbar.component.scss'
})
export class UserToolbarComponent implements OnInit {
  @Input() username: string = 'Usuario';

  isDropdownOpen: boolean = false;

  private userFullName: string = '';

  constructor(
    private router: Router,
    @Inject(USER_SERVICE) private userService: IUserService,
    readonly memberDisplay: MemberDisplayPreferenceService
  ) {}

  ngOnInit(): void {
    // Subscribe to any cached/future updates first
    this.userService.user$.subscribe(profile => {
      if (profile?.fullName && profile.fullName !== profile.username) {
        // Only trust fullName when it differs from username (setUsername copies username → fullName)
        this.userFullName = profile.fullName;
      }
      if (profile?.username && profile.username !== 'Usuario' && profile.username !== '') {
        this.username = profile.username;
      }
    });

    // Always fetch the real profile so fullName is populated even after a page navigation
    this.userService.getUserProfile().subscribe({
      next: profile => {
        if (profile?.fullName) {
          this.userFullName = profile.fullName;
        }
        if (profile?.username) {
          this.username = profile.username;
        }
      },
      error: () => { /* keep whatever username was passed as @Input */ }
    });
  }

  get displayedUsername(): string {
    return this.memberDisplay.displayName(this.username, this.userFullName || null);
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.username }
    });
  }

  editProfile(): void {
    this.closeDropdown();
    this.router.navigate(['/profile'], {
      state: { username: this.username }
    });
  }

  logout(): void {
    this.closeDropdown();
    this.router.navigate(['/']);
  }

  get initials(): string {
    return this.username.substring(0, 2).toUpperCase();
  }
}
