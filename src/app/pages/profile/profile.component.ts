import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import {
  PredictionsProfile,
  ProfileMatchSummary,
  QuotaProfile,
  UserGroupPerformance,
  UserProfile
} from '../../models/user.model';
import { isSwitzerland } from '../../utils/flag.utils';

interface PredictionStat {
  key: keyof PredictionsProfile;
  label: string;
  modifier: string;
}

type QuotaHighlight = 'succeeded' | 'failed';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  readonly isSwitzerland = isSwitzerland;

  username = 'Usuario';
  profile: UserProfile | null = null;
  isLoading = true;

  /** When set, the page shows another group member's profile instead of the current user's */
  isOtherMember = false;
  private memberName = '';
  private memberUsername = '';

  profiles: UserGroupPerformance[] = [];
  selectedGroupId = '';
  openQuota: QuotaHighlight | null = null;

  /** Display order requested for the predictions breakdown */
  readonly predictionStats: PredictionStat[] = [
    { key: 'partial', label: 'Parcial', modifier: 'partial' },
    { key: 'correct', label: 'Correcto', modifier: 'correct' },
    { key: 'bonus', label: 'Bonus', modifier: 'bonus' },
    { key: 'incorrect', label: 'Incorrecto', modifier: 'incorrect' },
    { key: 'missing', label: 'Faltante', modifier: 'missing' }
  ];

  constructor(@Inject(USER_SERVICE) private userService: IUserService) {}

  ngOnInit(): void {
    const historyState = history.state as {
      username?: string;
      memberId?: string;
      groupId?: string;
      memberFullName?: string;
      memberUsername?: string;
    } | undefined;

    if (historyState?.username) {
      this.username = historyState.username;
      this.userService.setUsername(this.username);
    }

    if (historyState?.memberId && historyState?.groupId) {
      this.loadMemberProfile(historyState);
      return;
    }

    this.userService.getUserProfile().subscribe({
      next: profile => {
        this.profile = profile;
        this.username = profile.username;
        this.profiles = profile.profiles ?? [];
        this.selectedGroupId = this.profiles[0]?.groupId ?? '';
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  private loadMemberProfile(state: {
    memberId?: string;
    groupId?: string;
    memberFullName?: string;
    memberUsername?: string;
  }): void {
    this.isOtherMember = true;
    this.memberName = state.memberFullName?.trim() || state.memberUsername?.trim() || '';
    this.memberUsername = state.memberUsername?.trim() || '';

    this.userService.getGroupMemberProfile(state.groupId!, state.memberId!).subscribe({
      next: perf => {
        this.profiles = perf ? [perf] : [];
        this.selectedGroupId = this.profiles[0]?.groupId ?? '';
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  get displayName(): string {
    if (this.isOtherMember) {
      return this.memberName || this.memberUsername || 'Usuario';
    }
    return this.profile?.fullName || this.userService.getCachedFullNameForUsername(this.username) || this.username;
  }

  get handle(): string {
    if (this.isOtherMember) {
      return `@${this.memberUsername || this.memberName}`;
    }
    const value = this.profile?.username || this.username;
    return `@${value}`;
  }

  get initials(): string {
    return this.displayName.substring(0, 2).toUpperCase();
  }

  get selectedProfile(): UserGroupPerformance | null {
    return this.profiles.find(p => p.groupId === this.selectedGroupId) ?? this.profiles[0] ?? null;
  }

  selectGroup(groupId: string): void {
    if (groupId === this.selectedGroupId) return;
    this.selectedGroupId = groupId;
    this.openQuota = null;
  }

  formatPoints(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }

  /** Awards points show a hyphen when null instead of 0 */
  formatAwardsPoints(value: number | null): string {
    return value === null || value === undefined ? '-' : this.formatPoints(value);
  }

  openQuotaModal(type: QuotaHighlight): void {
    const profile = type === 'succeeded' ? this.selectedProfile?.topQuotaSucceeded : this.selectedProfile?.topQuotaFailed;
    if (!profile) return;
    this.openQuota = type;
  }

  closeQuotaModal(): void {
    this.openQuota = null;
  }

  get openQuotaProfile(): QuotaProfile | null {
    if (!this.openQuota) return null;
    return this.openQuota === 'succeeded'
      ? this.selectedProfile?.topQuotaSucceeded ?? null
      : this.selectedProfile?.topQuotaFailed ?? null;
  }

  /** Final result score, e.g. "5 - 3" (with penalties when present) */
  formatScore(match: ProfileMatchSummary): string {
    const hasGoals = match.homeGoals !== undefined && match.awayGoals !== undefined;
    if (!hasGoals) return '–';
    let score = `${match.homeGoals} - ${match.awayGoals}`;
    if (match.homePenalties !== undefined && match.awayPenalties !== undefined) {
      score += ` (${match.homePenalties} - ${match.awayPenalties})`;
    }
    return score;
  }

  /** Predicted score, e.g. "3 - 0" */
  formatPrediction(quota: QuotaProfile): string {
    const { predictedHome, predictedAway } = quota.prediction;
    if (predictedHome === null || predictedAway === null) return '–';
    return `${predictedHome} - ${predictedAway}`;
  }

  /** Small status badge shown at the top of the modal (substatus or "FT") */
  matchStatusLabel(match: ProfileMatchSummary): string {
    if (match.substatus) return match.substatus;
    if (match.status === 'FINISHED') return 'FT';
    return match.code;
  }
}
