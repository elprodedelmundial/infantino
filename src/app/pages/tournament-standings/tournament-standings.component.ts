import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { MatchMultiplierBadgeComponent } from '../../components/match-multiplier-badge/match-multiplier-badge.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { 
  TournamentStandings, 
  TournamentPlayer, 
  PredictionResult,
  UserPredictions,
  MatchPrediction,
  GroupRole,
  LastStandingPrediction,
  LastStandingPredictionResult,
  GroupCandidate
} from '../../models/tournament.model';
import { isSwitzerland } from '../../utils/flag.utils';
import { MemberDisplayPreferenceService } from '../../services/member-display-preference.service';

@Component({
  selector: 'app-tournament-standings',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent, MatchMultiplierBadgeComponent],
  templateUrl: './tournament-standings.component.html',
  styleUrl: './tournament-standings.component.scss'
})
export class TournamentStandingsComponent implements OnInit {
  readonly isSwitzerland = isSwitzerland;

  username: string = 'Usuario';
  standings: TournamentStandings | null = null;
  predictions: UserPredictions | null = null;
  isLoading: boolean = true;
  tournamentId: string = '';
  activeTab: 'standings' | 'predictions' = 'standings';
  showPastPredictions: boolean = false;
  isLoadingPredictions: boolean = false;
  showLeaveConfirm: boolean = false;
  isLeaving: boolean = false;

  liveMode: boolean = false;
  isRefreshingLive: boolean = false;

  // Group role & edit
  userRole: GroupRole | null = null;
  showEditGroup: boolean = false;
  editGroupName: string = '';
  editGroupMaxMembers: number = 0;
  editGroupIsPrivate: boolean = false;
  isSavingGroup: boolean = false;
  editGroupError: string = '';

  // Candidates (pending join requests — admins only)
  candidates: GroupCandidate[] = [];
  isLoadingCandidates: boolean = false;
  candidateActionInProgress: Set<string> = new Set();

  // Kick member (admins only): double-click on desktop / long-press on mobile
  showKickConfirm: boolean = false;
  kickTarget: TournamentPlayer | null = null;
  isKicking: boolean = false;
  kickError: string = '';

  /** Differentiates a single click (open profile) from a double click (kick). */
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  /** Long-press detection for touch devices. */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTriggered: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private readonly singleClickDelayMs = 250;
  private readonly longPressMs = 550;
  private readonly touchMoveTolerance = 12;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    readonly memberDisplay: MemberDisplayPreferenceService
  ) {}

  playerLabel(player: TournamentPlayer): string {
    return this.memberDisplay.displayName(player.username, player.fullName);
  }

  ngOnInit(): void {
    const historyState = history.state as { username: string; role?: GroupRole; activeTab?: 'standings' | 'predictions' } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }
    if (historyState?.role) {
      this.userRole = historyState.role;
    }
    if (historyState?.activeTab) {
      this.activeTab = historyState.activeTab;
    }

    this.route.params.subscribe(params => {
      this.tournamentId = params['id'];
      this.loadData();
    });
  }

  get tournamentHasStarted(): boolean {
    return this.standings?.tournament?.hasStarted === true;
  }

  loadData(): void {
    this.isLoading = true;
    this.tournamentService.getTournamentStandings(this.tournamentId, this.liveMode).subscribe(standings => {
      this.standings = standings;
      this.isLoading = false;
      this.isRefreshingLive = false;
      if (this.activeTab === 'predictions') {
        this.loadPredictions();
      }
      if (this.canEditGroup()) {
        this.loadCandidates();
      }
    });
  }

  loadCandidates(): void {
    this.isLoadingCandidates = true;
    this.tournamentService.getCandidates(this.tournamentId).subscribe({
      next: candidates => {
        this.candidates = candidates;
        this.isLoadingCandidates = false;
      },
      error: () => {
        this.isLoadingCandidates = false;
      }
    });
  }

  acceptCandidate(candidate: GroupCandidate): void {
    if (this.candidateActionInProgress.has(candidate.id)) return;
    this.candidateActionInProgress.add(candidate.id);
    this.tournamentService.acceptCandidate(this.tournamentId, candidate.id).subscribe({
      next: () => {
        this.candidates = this.candidates.filter(c => c.id !== candidate.id);
        this.candidateActionInProgress.delete(candidate.id);
        this.loadData();
      },
      error: () => {
        this.candidateActionInProgress.delete(candidate.id);
      }
    });
  }

  rejectCandidate(candidate: GroupCandidate): void {
    if (this.candidateActionInProgress.has(candidate.id)) return;
    this.candidateActionInProgress.add(candidate.id);
    this.tournamentService.rejectCandidate(this.tournamentId, candidate.id).subscribe({
      next: () => {
        this.candidates = this.candidates.filter(c => c.id !== candidate.id);
        this.candidateActionInProgress.delete(candidate.id);
      },
      error: () => {
        this.candidateActionInProgress.delete(candidate.id);
      }
    });
  }

  isCandidateActionInProgress(candidateId: string): boolean {
    return this.candidateActionInProgress.has(candidateId);
  }

  toggleLiveMode(): void {
    this.liveMode = !this.liveMode;
    this.isRefreshingLive = true;
    this.tournamentService.getTournamentStandings(this.tournamentId, this.liveMode).subscribe(standings => {
      this.standings = standings;
      this.isRefreshingLive = false;
    });
  }

  loadPredictions(): void {
    if (this.predictions || this.isLoadingPredictions) return;
    this.isLoadingPredictions = true;
    this.tournamentService.getUserPredictions(this.tournamentId).subscribe(predictions => {
      this.predictions = predictions;
      this.isLoadingPredictions = false;
    });
  }

  setActiveTab(tab: 'standings' | 'predictions'): void {
    this.activeTab = tab;
    if (tab === 'predictions') {
      this.loadPredictions();
    }
  }

  goBack(): void {
    this.router.navigate(['/my-tournaments'], {
      state: { username: this.username }
    });
  }

  /**
   * So browser Back from Editar Predicciones returns to this URL with
   * history.state (Mis Predicciones / predictions tab) restored.
   */
  private setHistoryStateForReturnFromEdit(): void {
    const s: { username: string; role?: GroupRole; activeTab: 'standings' | 'predictions' } = {
      ...(typeof history !== 'undefined' && history.state && typeof history.state === 'object'
        ? (history.state as object)
        : {}),
      username: this.username,
      activeTab: 'predictions'
    };
    if (this.userRole) {
      s.role = this.userRole;
    }
    history.replaceState(s, '', this.router.url);
  }

  editAllPredictions(): void {
    this.setHistoryStateForReturnFromEdit();
    this.router.navigate(['/tournament', this.tournamentId, 'edit'], {
      state: { username: this.username }
    });
  }

  editPrediction(prediction: MatchPrediction): void {
    this.setHistoryStateForReturnFromEdit();
    this.router.navigate(['/tournament', this.tournamentId, 'edit'], {
      state: { 
        username: this.username,
        highlightMatch: prediction.id
      }
    });
  }

  goToAwards(): void {
    this.router.navigate(['/tournament', this.tournamentId, 'awards'], {
      state: {
        username: this.username,
        ...(this.tournamentHasStarted ? { openGroupAwardsBrowse: true } : {})
      }
    });
  }

  promptLeaveTournament(): void {
    this.showLeaveConfirm = true;
  }

  cancelLeave(): void {
    this.showLeaveConfirm = false;
  }

  confirmLeaveTournament(): void {
    this.isLeaving = true;
    this.tournamentService.leaveTournament(this.tournamentId).subscribe(() => {
      this.isLeaving = false;
      this.showLeaveConfirm = false;
      this.router.navigate(['/dashboard'], {
        state: { username: this.username }
      });
    });
  }

  canEditGroup(): boolean {
    return this.userRole === 'OWNER' || this.userRole === 'ADMIN';
  }

  openEditGroup(): void {
    if (!this.standings) return;
    this.editGroupName = this.standings.tournament.name;
    this.editGroupMaxMembers = this.standings.tournament.maxParticipants;
    this.editGroupIsPrivate = false;
    this.editGroupError = '';
    this.showEditGroup = true;
  }

  closeEditGroup(): void {
    this.showEditGroup = false;
    this.editGroupError = '';
  }

  saveGroupChanges(): void {
    if (!this.editGroupName.trim()) {
      this.editGroupError = 'El nombre del grupo no puede estar vacío';
      return;
    }
    if (this.editGroupMaxMembers < 1) {
      this.editGroupError = 'El máximo de miembros debe ser al menos 1';
      return;
    }

    this.isSavingGroup = true;
    this.editGroupError = '';

    this.tournamentService.updateGroup(this.tournamentId, {
      name: this.editGroupName.trim(),
      maxMembers: this.editGroupMaxMembers,
      isPrivate: this.editGroupIsPrivate
    }).subscribe({
      next: () => {
        this.isSavingGroup = false;
        if (this.standings) {
          this.standings.tournament.name = this.editGroupName.trim();
          this.standings.tournament.maxParticipants = this.editGroupMaxMembers;
        }
        this.showEditGroup = false;
      },
      error: (err: Error) => {
        this.isSavingGroup = false;
        this.editGroupError = err.message || 'Error al guardar los cambios';
      }
    });
  }

  isCurrentUser(player: TournamentPlayer): boolean {
    return this.standings?.currentUserId === player.id;
  }

  goToPlayerProfile(player: TournamentPlayer): void {
    if (this.isCurrentUser(player)) {
      this.router.navigate(['/profile'], { state: { username: this.username } });
      return;
    }
    this.router.navigate(['/profile'], {
      state: {
        username: this.username,
        memberId: player.id,
        groupId: this.tournamentId,
        memberFullName: player.fullName ?? '',
        memberUsername: player.username
      }
    });
  }

  /** A member can be kicked when the current user is a group admin and it isn't themselves. */
  isMemberKickable(player: TournamentPlayer): boolean {
    return this.canEditGroup() && !this.isCurrentUser(player);
  }

  /**
   * Single click → open profile. For kickable rows the navigation is deferred a
   * moment so a double click can cancel it and open the kick banner instead.
   */
  onPlayerClick(player: TournamentPlayer): void {
    if (this.longPressTriggered) {
      // The click that follows a long-press release must not also open the profile.
      this.longPressTriggered = false;
      return;
    }
    if (!this.isMemberKickable(player)) {
      this.goToPlayerProfile(player);
      return;
    }
    if (this.clickTimer) {
      // Second click of a double click — let onPlayerDblClick handle it.
      return;
    }
    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
      this.goToPlayerProfile(player);
    }, this.singleClickDelayMs);
  }

  /** Desktop: double click on a member opens the kick confirmation. */
  onPlayerDblClick(player: TournamentPlayer): void {
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    if (this.isMemberKickable(player)) {
      this.openKickConfirm(player);
    }
  }

  /** Mobile: start the long-press timer that opens the kick confirmation. */
  onPlayerTouchStart(event: TouchEvent, player: TournamentPlayer): void {
    this.longPressTriggered = false;
    this.clearLongPress();
    if (!this.isMemberKickable(player) || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.longPressTriggered = true;
      this.openKickConfirm(player);
    }, this.longPressMs);
  }

  onPlayerTouchMove(event: TouchEvent): void {
    if (!this.longPressTimer || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    if (
      Math.abs(touch.clientX - this.touchStartX) > this.touchMoveTolerance ||
      Math.abs(touch.clientY - this.touchStartY) > this.touchMoveTolerance
    ) {
      this.clearLongPress();
    }
  }

  onPlayerTouchEnd(): void {
    this.clearLongPress();
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  get kickTargetLabel(): string {
    return this.kickTarget ? this.playerLabel(this.kickTarget) : '';
  }

  openKickConfirm(player: TournamentPlayer): void {
    this.kickTarget = player;
    this.kickError = '';
    this.showKickConfirm = true;
  }

  cancelKick(): void {
    if (this.isKicking) return;
    this.showKickConfirm = false;
    this.kickTarget = null;
    this.kickError = '';
  }

  confirmKick(): void {
    if (!this.kickTarget || this.isKicking) return;
    const member = this.kickTarget;
    this.isKicking = true;
    this.kickError = '';
    this.tournamentService.kickMember(this.tournamentId, member.id).subscribe({
      next: () => {
        this.isKicking = false;
        this.showKickConfirm = false;
        this.kickTarget = null;
        this.loadData();
      },
      error: (err: Error) => {
        this.isKicking = false;
        this.kickError = err?.message || 'No se pudo expulsar al miembro del grupo';
      }
    });
  }

  getPredictionClass(result: LastStandingPredictionResult): string {
    switch (result) {
      case 'correct': return 'prediction correct';
      case 'incorrect': return 'prediction incorrect';
      case 'half': return 'prediction half';
      case 'bonus': return 'prediction bonus';
      case 'missing': return 'prediction missing';
      default: return 'prediction';
    }
  }

  lastPredictionTitle(dot: LastStandingPrediction): string {
    if (dot.result === 'missing') {
      return 'Sin predicción';
    }
    const base =
      dot.result === 'correct'
        ? 'Correcto'
        : dot.result === 'half'
          ? 'Parcial'
          : dot.result === 'bonus'
            ? 'Bonus'
            : 'Incorrecto';
    return dot.hasMultiplier ? `${base} · Multiplicador` : base;
  }

  getPositionClass(position: number): string {
    if (position === 1) return 'position gold';
    if (position === 2) return 'position silver';
    if (position === 3) return 'position bronze';
    return 'position';
  }

  getResultBadgeClass(prediction: MatchPrediction): string {
    if (prediction.matchStatus === 'IN_PROGRESS') return 'result-badge live';
    if (prediction.result === 'bonus') return 'result-badge bonus';
    if (!prediction.result) return '';
    return `result-badge ${prediction.result}`;
  }

  formatMatchDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  }

  /**
   * Color for predicted score in mobile past-match cards (status badge removed;
   * correct=green, half=orange, incorrect=red, bonus=blue, live=muted).
   */
  getPredictionLineToneClass(pred: MatchPrediction): string {
    if (pred.matchStatus === 'IN_PROGRESS') return 'pred-line-tone--live';
    switch (pred.result) {
      case 'correct': return 'pred-line-tone--correct';
      case 'half': return 'pred-line-tone--half';
      case 'bonus': return 'pred-line-tone--bonus';
      case 'incorrect': return 'pred-line-tone--incorrect';
      default: return 'pred-line-tone--muted';
    }
  }
}
