import { Component, Inject, Input, OnChanges, OnInit, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { MemberDisplayPreferenceService } from '../../services/member-display-preference.service';
import { UserPermission } from '../../models/user.model';

@Component({
  selector: 'app-user-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-toolbar.component.html',
  styleUrl: './user-toolbar.component.scss'
})
export class UserToolbarComponent implements OnInit, OnChanges {
  @Input() username: string = 'Usuario';

  isDropdownOpen: boolean = false;

  private readonly userFullName = signal<string>('');
  private readonly usernameState = signal<string>('Usuario');
  private readonly permissions = signal<UserPermission>('USER');

  /** Same rules as standings: reacts to member display preference + profile full name. */
  readonly displayedUsername = computed(() =>
    this.memberDisplay.displayName(this.usernameState(), this.userFullName() || null)
  );

  readonly isSuperuser = computed(() => this.permissions() === 'SUPERUSER');

  constructor(
    private router: Router,
    @Inject(USER_SERVICE) private userService: IUserService,
    readonly memberDisplay: MemberDisplayPreferenceService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['username']) {
      this.usernameState.set(this.username);
    }
  }

  ngOnInit(): void {
    this.usernameState.set(this.username);
    // Subscribe to any cached/future updates first
    this.userService.user$.subscribe(profile => {
      this.permissions.set(profile.permissions ?? 'USER');
      if (profile?.fullName && profile.fullName !== profile.username) {
        // Only trust fullName when it differs from username (setUsername copies username → fullName)
        this.userFullName.set(profile.fullName);
      }
      if (profile?.username && profile.username !== 'Usuario' && profile.username !== '') {
        this.usernameState.set(profile.username);
      }
    });

    // Always fetch the real profile so fullName is populated even after a page navigation
    this.userService.getUserProfile().subscribe({
      next: profile => {
        this.permissions.set(profile.permissions ?? 'USER');
        if (profile?.fullName) {
          this.userFullName.set(profile.fullName);
        }
        if (profile?.username) {
          this.usernameState.set(profile.username);
        }
      },
      error: () => { /* keep whatever username was passed as @Input */ }
    });
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.usernameState() }
    });
  }

  editProfile(): void {
    this.closeDropdown();
    this.router.navigate(['/profile'], {
      state: { username: this.usernameState() }
    });
  }

  goAdmin(): void {
    this.closeDropdown();
    this.router.navigate(['/admin'], {
      state: { username: this.usernameState() }
    });
  }

  logout(): void {
    this.closeDropdown();
    this.router.navigate(['/']);
  }

  get initials(): string {
    return this.usernameState().substring(0, 2).toUpperCase();
  }
}
