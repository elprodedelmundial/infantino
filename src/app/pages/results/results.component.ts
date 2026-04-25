import { Component, OnDestroy, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, interval, Subscription } from 'rxjs';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import {
  IMatchService,
  MATCH_SERVICE,
  MatchPredictionsByTournament,
  TournamentMatchListsPayload,
  TournamentPredictions
} from '../../services/match-service.interface';
import { JoinedTournament, LiveMatch } from '../../models/tournament.model';
import { isSwitzerland } from '../../utils/flag.utils';
import { MemberDisplayPreferenceService } from '../../services/member-display-preference.service';
import { MemberPrediction } from '../../models/tournament.model';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, UserToolbarComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss'
})
export class ResultsComponent implements OnInit, OnDestroy {
  private static readonly MATCH_REFRESH_MS = 10_000;

  /** Exposed for template: Swiss flag needs rectangular crop. */
  readonly isSwitzerland = isSwitzerland;

  username: string = 'Usuario';
  joinedTournaments: JoinedTournament[] = [];
  isLoading: boolean = true;
  private matchRefreshSub?: Subscription;
  
  // Match data
  liveMatches: LiveMatch[] = [];
  upcomingMatches: LiveMatch[] = [];
  pastMatches: LiveMatch[] = [];
  totalPastMatches = 0;
  /** True after user chose "mostrar más" — periodic refresh uses full-past request. */
  private useFullPastFetch = false;
  isLoadingMorePast = false;
  
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
    @Inject(MATCH_SERVICE) private matchService: IMatchService,
    readonly memberDisplay: MemberDisplayPreferenceService
  ) {}

  predictionLabel(pred: MemberPrediction): string {
    return this.memberDisplay.displayName(pred.username, pred.fullName);
  }

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }
    
    this.loadData();
  }

  ngOnDestroy(): void {
    this.matchRefreshSub?.unsubscribe();
  }

  /** 10s polling only while there are live matches; stops when the list is empty. */
  private syncMatchRefreshSubscription(): void {
    const hasLive = this.liveMatches.length > 0;
    if (!hasLive) {
      this.matchRefreshSub?.unsubscribe();
      this.matchRefreshSub = undefined;
      return;
    }
    if (this.matchRefreshSub) return;
    this.matchRefreshSub = interval(ResultsComponent.MATCH_REFRESH_MS).subscribe(() =>
      this.refreshMatchLists()
    );
  }

  loadData(): void {
    this.isLoading = true;
    this.useFullPastFetch = false;

    forkJoin({
      tournaments: this.tournamentService.getJoinedTournaments(),
      lists: this.matchService.getTournamentMatchLists()
    }).subscribe(({ tournaments, lists }) => {
      this.joinedTournaments = tournaments;
      this.applyMatchListsPayload(lists);
      this.isLoading = false;
    });
  }

  get showLoadMorePastMatches(): boolean {
    return this.totalPastMatches > 0 && this.pastMatches.length < this.totalPastMatches;
  }

  loadMorePastMatches(): void {
    if (!this.showLoadMorePastMatches || this.isLoadingMorePast) return;
    this.isLoadingMorePast = true;
    this.matchService.loadAllPastTournamentMatchLists().subscribe({
      next: lists => {
        this.useFullPastFetch = true;
        this.applyMatchListsPayload(lists);
        this.isLoadingMorePast = false;
      },
      error: () => {
        this.isLoadingMorePast = false;
      }
    });
  }

  private applyMatchListsPayload(lists: TournamentMatchListsPayload): void {
    this.liveMatches = lists.liveMatches;
    this.upcomingMatches = lists.upcomingMatches;
    this.pastMatches = lists.pastMatches;
    this.totalPastMatches = lists.totalPastMatches;
    this.syncMatchRefreshSubscription();
  }

  /** Clears match cache and refetches live / upcoming / past (one HTTP round-trip). */
  private refreshMatchLists(): void {
    if (this.useFullPastFetch) {
      this.matchService.loadAllPastTournamentMatchLists().subscribe(lists => this.applyMatchListsPayload(lists));
      return;
    }
    this.matchService.clearCache();
    this.matchService.getTournamentMatchLists().subscribe(lists => this.applyMatchListsPayload(lists));
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

}
