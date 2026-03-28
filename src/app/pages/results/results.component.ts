import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { IMatchService, MATCH_SERVICE, MatchPredictionsByTournament, TournamentPredictions } from '../../services/match-service.interface';
import { JoinedTournament, LiveMatch, MatchScore } from '../../models/tournament.model';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss'
})
export class ResultsComponent implements OnInit {
  username: string = 'Usuario';
  joinedTournaments: JoinedTournament[] = [];
  isLoading: boolean = true;
  
  // Match data
  liveMatches: LiveMatch[] = [];
  upcomingMatches: LiveMatch[] = [];
  pastMatches: LiveMatch[] = [];
  userPredictions: Map<string, Map<string, MatchScore>> = new Map();
  
  // Modal states
  showPredictionsModal: boolean = false;
  showTournamentSelector: boolean = false;
  selectedMatch: LiveMatch | null = null;
  matchPredictionsByTournament: MatchPredictionsByTournament | null = null;
  isLoadingPredictions: boolean = false;
  expandedTournaments: Set<string> = new Set();

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    @Inject(MATCH_SERVICE) private matchService: IMatchService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }
    
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    
    forkJoin({
      tournaments: this.tournamentService.getJoinedTournaments(),
      liveMatches: this.matchService.getLiveMatches(),
      upcomingMatches: this.matchService.getUpcomingMatches(),
      pastMatches: this.matchService.getPastMatches()
    }).subscribe(({ tournaments, liveMatches, upcomingMatches, pastMatches }) => {
      this.joinedTournaments = tournaments;
      this.liveMatches = liveMatches;
      this.upcomingMatches = upcomingMatches;
      this.pastMatches = pastMatches;
      
      if (tournaments.length > 0) {
        this.loadUserPredictions();
      }
      
      this.isLoading = false;
    });
  }

  loadUserPredictions(): void {
    if (this.joinedTournaments.length === 0) return;

    const predictionRequests = this.joinedTournaments.map(j =>
      this.tournamentService.getAllPredictions(j.tournament.id)
    );

    forkJoin(predictionRequests).subscribe(allGroupPredictions => {
      this.joinedTournaments.forEach((j, idx) => {
        const groupData = allGroupPredictions[idx];
        groupData.matches.forEach(match => {
          if (!this.userPredictions.has(match.id)) {
            this.userPredictions.set(match.id, new Map());
          }
          this.userPredictions.get(match.id)!.set(j.tournament.id, match.predictedScore);
        });
      });
    });
  }

  isMatchActive(match: LiveMatch): boolean {
    if (match.status === 'live' || match.status === 'finished') return true;
    const fifteenMin = 15 * 60 * 1000;
    return new Date(match.matchDate).getTime() - Date.now() <= fifteenMin;
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.username }
    });
  }

  hasJoinedTournaments(): boolean {
    return this.joinedTournaments.length > 0;
  }

  // Active match predictions modal
  viewPredictions(match: LiveMatch): void {
    if (!this.hasJoinedTournaments()) return;
    if (!this.isMatchActive(match)) return;

    this.selectedMatch = match;
    this.isLoadingPredictions = true;
    this.showPredictionsModal = true;
    this.expandedTournaments.clear();
    
    if (this.joinedTournaments.length > 0) {
      this.expandedTournaments.add(this.joinedTournaments[0].tournament.id);
    }

    const groupRequests = this.joinedTournaments.map(j =>
      this.tournamentService.getMatchGroupPredictions(j.tournament.id, match.id)
    );

    forkJoin(groupRequests).subscribe(results => {
      const tournamentPredictions = results.filter((r): r is TournamentPredictions => r !== null);
      this.matchPredictionsByTournament = { match, tournamentPredictions };
      this.isLoadingPredictions = false;
    });
  }

  closePredictionsModal(): void {
    this.showPredictionsModal = false;
    this.selectedMatch = null;
    this.matchPredictionsByTournament = null;
  }

  toggleTournamentExpanded(tournamentId: string): void {
    if (this.expandedTournaments.has(tournamentId)) {
      this.expandedTournaments.delete(tournamentId);
    } else {
      this.expandedTournaments.add(tournamentId);
    }
  }

  isTournamentExpanded(tournamentId: string): boolean {
    return this.expandedTournaments.has(tournamentId);
  }

  // Predict for upcoming match
  predictMatch(match: LiveMatch): void {
    if (!this.hasJoinedTournaments()) return;
    
    this.selectedMatch = match;
    
    if (this.joinedTournaments.length === 1) {
      this.goToPredictions(this.joinedTournaments[0].tournament.id);
    } else {
      this.showTournamentSelector = true;
    }
  }

  selectTournamentForPrediction(tournamentId: string): void {
    this.showTournamentSelector = false;
    this.goToPredictions(tournamentId);
  }

  closeTournamentSelector(): void {
    this.showTournamentSelector = false;
    this.selectedMatch = null;
  }

  goToPredictions(tournamentId: string): void {
    this.router.navigate(['/tournament', tournamentId, 'edit'], {
      state: { 
        username: this.username,
        highlightMatch: this.selectedMatch?.id
      }
    });
    this.selectedMatch = null;
  }

  formatMatchTime(match: LiveMatch): string {
    if (match.status === 'live') {
      return match.matchTime || 'EN VIVO';
    }
    const date = new Date(match.matchDate);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatMatchDate(match: LiveMatch): string {
    const date = new Date(match.matchDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Mañana';
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  hasPrediction(match: LiveMatch): boolean {
    const matchPredictions = this.userPredictions.get(match.id);
    return matchPredictions !== undefined && matchPredictions.size > 0;
  }

  getFirstPrediction(match: LiveMatch): MatchScore | null {
    const matchPredictions = this.userPredictions.get(match.id);
    if (matchPredictions && matchPredictions.size > 0) {
      return matchPredictions.values().next().value;
    }
    return null;
  }
}
