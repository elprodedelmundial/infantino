import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { TournamentService } from '../../services/tournament.service';
import { 
  TournamentStandings, 
  TournamentPlayer, 
  PredictionResult,
  UserPredictions,
  MatchPrediction
} from '../../models/tournament.model';

@Component({
  selector: 'app-tournament-standings',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './tournament-standings.component.html',
  styleUrl: './tournament-standings.component.scss'
})
export class TournamentStandingsComponent implements OnInit {
  username: string = 'Usuario';
  standings: TournamentStandings | null = null;
  predictions: UserPredictions | null = null;
  isLoading: boolean = true;
  tournamentId: string = '';
  activeTab: 'standings' | 'predictions' = 'standings';
  showLeaveConfirm: boolean = false;
  isLeaving: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tournamentService: TournamentService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }

    this.route.params.subscribe(params => {
      this.tournamentId = params['id'];
      this.loadData();
    });
  }

  loadData(): void {
    this.isLoading = true;
    
    this.tournamentService.getTournamentStandings(this.tournamentId).subscribe(standings => {
      this.standings = standings;
      
      this.tournamentService.getUserPredictions(this.tournamentId).subscribe(predictions => {
        this.predictions = predictions;
        this.isLoading = false;
      });
    });
  }

  setActiveTab(tab: 'standings' | 'predictions'): void {
    this.activeTab = tab;
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], {
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
      state: { username: this.username }
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

  isCurrentUser(player: TournamentPlayer): boolean {
    return this.standings?.currentUserId === player.id;
  }

  getPredictionClass(result: PredictionResult): string {
    switch (result) {
      case 'correct': return 'prediction correct';
      case 'incorrect': return 'prediction incorrect';
      case 'half': return 'prediction half';
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
