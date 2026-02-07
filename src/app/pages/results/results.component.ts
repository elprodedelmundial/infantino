import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { IMatchService, MATCH_SERVICE, MatchPredictionsByTournament } from '../../services/match-service.interface';
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
  
  // Live data
  liveMatches: LiveMatch[] = [];
  upcomingMatches: LiveMatch[] = [];
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
      upcomingMatches: this.matchService.getUpcomingMatches()
    }).subscribe(({ tournaments, liveMatches, upcomingMatches }) => {
      this.joinedTournaments = tournaments;
      this.liveMatches = liveMatches;
      this.upcomingMatches = upcomingMatches;
      
      if (tournaments.length > 0) {
        this.loadUserPredictions();
      }
      
      this.isLoading = false;
    });
  }

  loadUserPredictions(): void {
    this.upcomingMatches.forEach(match => {
      const matchPredictions = new Map<string, MatchScore>();
      this.joinedTournaments.forEach(joined => {
        if (Math.random() > 0.3) {
          matchPredictions.set(joined.tournament.id, {
            home: Math.floor(Math.random() * 4),
            away: Math.floor(Math.random() * 4)
          });
        }
      });
      this.userPredictions.set(match.id, matchPredictions);
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.username }
    });
  }

  hasJoinedTournaments(): boolean {
    return this.joinedTournaments.length > 0;
  }

  // Live match functions
  viewPredictions(match: LiveMatch): void {
    if (!this.hasJoinedTournaments()) return;
    
    this.selectedMatch = match;
    this.isLoadingPredictions = true;
    this.showPredictionsModal = true;
    this.expandedTournaments.clear();
    
    if (this.joinedTournaments.length > 0) {
      this.expandedTournaments.add(this.joinedTournaments[0].tournament.id);
    }
    
    const tournamentInfo = this.joinedTournaments.map(j => ({
      id: j.tournament.id,
      name: j.tournament.name
    }));
    
    this.matchService.getMatchPredictionsByTournament(match.id, tournamentInfo, this.username)
      .subscribe(predictions => {
        this.matchPredictionsByTournament = predictions;
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
