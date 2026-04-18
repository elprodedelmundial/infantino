import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { 
  TournamentStandings, 
  TournamentPlayer, 
  PredictionResult,
  UserPredictions,
  MatchPrediction,
  GroupRole
} from '../../models/tournament.model';
import { isSwitzerland } from '../../utils/flag.utils';
import { MemberDisplayPreferenceService } from '../../services/member-display-preference.service';

@Component({
  selector: 'app-tournament-standings',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
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
      // If navigated directly to predictions tab (e.g. back from edit), load immediately
      if (this.activeTab === 'predictions') {
        this.loadPredictions();
      }
    });
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

  editAllPredictions(): void {
    this.router.navigate(['/tournament', this.tournamentId, 'edit'], {
      state: { username: this.username }
    });
  }

  editPrediction(prediction: MatchPrediction): void {
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

  getPredictionClass(result: PredictionResult): string {
    switch (result) {
      case 'correct': return 'prediction correct';
      case 'incorrect': return 'prediction incorrect';
      case 'half': return 'prediction half';
      case 'bonus': return 'prediction bonus';
      default: return 'prediction';
    }
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
}
