import { Component, Inject, Input, OnChanges, OnInit, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { MemberDisplayPreferenceService } from '../../services/member-display-preference.service';
import { UserPermission, UserProfile, UserJoinRequest, JoinRequestUser } from '../../models/user.model';

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
  private readonly joinRequestsState = signal<UserJoinRequest[]>([]);

  /** Same rules as standings: reacts to member display preference + profile full name. */
  readonly displayedUsername = computed(() =>
    this.memberDisplay.displayName(this.usernameState(), this.userFullName() || null)
  );

  readonly isSuperuser = computed(() => this.permissions() === 'SUPERUSER');
  readonly hasJoinRequests = computed(() => this.joinRequestsState().length > 0);
  readonly joinRequests = computed(() => this.joinRequestsState());

  // Join requests overlay
  showJoinRequestsOverlay: boolean = false;
  joinRequestActionInProgress: Set<string> = new Set();

  constructor(
    private router: Router,
    @Inject(USER_SERVICE) private userService: IUserService,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    readonly memberDisplay: MemberDisplayPreferenceService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['username']) {
      this.usernameState.set(this.username);
      this.applyFullNameFromProfileOrCache(this.username, null);
    }
  }

  ngOnInit(): void {
    this.usernameState.set(this.username);
    this.applyFullNameFromProfileOrCache(this.username, null);

    this.userService.user$.subscribe(profile => {
      this.permissions.set(profile.permissions ?? 'USER');
      const un = (profile?.username ?? this.usernameState()).trim();
      if (un && un !== 'Usuario') {
        this.usernameState.set(un);
      }
      this.applyFullNameFromProfileOrCache(un || this.usernameState(), profile);
      if (profile.joinRequests) {
        this.joinRequestsState.set(profile.joinRequests);
      }
    });

    this.userService.getUserProfile().subscribe({
      next: profile => {
        this.permissions.set(profile.permissions ?? 'USER');
        if (profile?.username) {
          this.usernameState.set(profile.username);
        }
        this.applyFullNameFromProfileOrCache(profile.username || this.usernameState(), profile);
        if (profile.joinRequests) {
          this.joinRequestsState.set(profile.joinRequests);
        }
      },
      error: () => {
        this.applyFullNameFromProfileOrCache(this.usernameState(), null);
      }
    });
  }

  /** Prefer API fullName; when missing (e.g. GET /me failed), use last persisted full name for this user. */
  private applyFullNameFromProfileOrCache(username: string, profile: UserProfile | null): void {
    const u = (username ?? '').trim();
    const fromApi = (profile?.fullName ?? '').trim();
    if (fromApi) {
      this.userFullName.set(fromApi);
      return;
    }
    const cached = u ? this.userService.getCachedFullNameForUsername(u) : '';
    if (cached) {
      this.userFullName.set(cached);
    }
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  openJoinRequestsOverlay(): void {
    this.closeDropdown();
    this.showJoinRequestsOverlay = true;
  }

  closeJoinRequestsOverlay(): void {
    this.showJoinRequestsOverlay = false;
  }

  private joinRequestActionKey(groupId: string, userId: string): string {
    return `${groupId}:${userId}`;
  }

  isJoinRequestActionInProgress(groupId: string, userId: string): boolean {
    return this.joinRequestActionInProgress.has(this.joinRequestActionKey(groupId, userId));
  }

  acceptJoinRequest(groupId: string, user: JoinRequestUser): void {
    const key = this.joinRequestActionKey(groupId, user.id);
    if (this.joinRequestActionInProgress.has(key)) return;
    this.joinRequestActionInProgress.add(key);
    this.tournamentService.acceptCandidate(groupId, user.id).subscribe({
      next: () => {
        this.joinRequestActionInProgress.delete(key);
        this.removeUserFromJoinRequests(groupId, user.id);
      },
      error: () => {
        this.joinRequestActionInProgress.delete(key);
      }
    });
  }

  rejectJoinRequest(groupId: string, user: JoinRequestUser): void {
    const key = this.joinRequestActionKey(groupId, user.id);
    if (this.joinRequestActionInProgress.has(key)) return;
    this.joinRequestActionInProgress.add(key);
    this.tournamentService.rejectCandidate(groupId, user.id).subscribe({
      next: () => {
        this.joinRequestActionInProgress.delete(key);
        this.removeUserFromJoinRequests(groupId, user.id);
      },
      error: () => {
        this.joinRequestActionInProgress.delete(key);
      }
    });
  }

  private removeUserFromJoinRequests(groupId: string, userId: string): void {
    const updated = this.joinRequestsState()
      .map(jr => jr.groupId === groupId
        ? { ...jr, users: jr.users.filter(u => u.id !== userId) }
        : jr
      )
      .filter(jr => jr.users.length > 0);
    this.joinRequestsState.set(updated);
    if (updated.length === 0) {
      this.showJoinRequestsOverlay = false;
    }
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
