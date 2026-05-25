import { Component, OnDestroy, OnInit, Inject, NgZone, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, interval, Subscription } from 'rxjs';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { MatchMultiplierBadgeComponent } from '../../components/match-multiplier-badge/match-multiplier-badge.component';
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
  imports: [CommonModule, UserToolbarComponent, MatchMultiplierBadgeComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss'
})
export class ResultsComponent implements OnInit, OnDestroy {
  private static readonly MATCH_REFRESH_MS = 10_000;
  private static readonly MULTIPLIER_TOAST_AUTO_DISMISS_MS = 15_000;
  private static readonly MULTIPLIER_TOAST_HEADER_SAFE_ZONE = 90;
  private static readonly MULTIPLIER_TOAST_GAP = 10;

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

  private resultsLayoutMql: MediaQueryList | null = null;
  private resultsLayoutMqlListener: (() => void) | null = null;

  /**
   * True when the results match cards use tap-on-row instead of footer buttons
   * (viewports ≤768px). Drives *ngIf on `.match-action` so Predicciones/Predecir
   * are not in the DOM on phone layouts.
   */
  resultsLayoutIsMobile =
    typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;

  // Modal states
  showPredictionsModal: boolean = false;
  showTournamentSelector: boolean = false;
  selectedMatch: LiveMatch | null = null;
  matchPredictionsByTournament: MatchPredictionsByTournament | null = null;
  isLoadingPredictions: boolean = false;
  expandedTournaments: Set<string> = new Set();

  /** Floating banner explaining the x1.5 multiplier on featured matches. */
  multiplierToast: {
    matchId: string;
    before: string;
    after: string;
    top: number;
    left: number;
    arrowOffset: number;
    placement: 'above' | 'below';
  } | null = null;
  private multiplierToastAnchor: { top: number; bottom: number; center: number } | null = null;
  private multiplierToastTimer: ReturnType<typeof setTimeout> | null = null;
  private multiplierToastDismissOnScroll: (() => void) | null = null;
  private multiplierToastDocumentClick: ((event: Event) => void) | null = null;

  @ViewChild('multiplierToastEl') private multiplierToastEl?: ElementRef<HTMLElement>;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    @Inject(MATCH_SERVICE) private matchService: IMatchService,
    readonly memberDisplay: MemberDisplayPreferenceService
  ) {}

  predictionLabel(pred: MemberPrediction): string {
    return this.memberDisplay.displayName(pred.username, pred.fullName);
  }

  /**
   * Maps `predictionStatus` to modifier classes on `.member-prediction` (used on
   * mobile to color the score; badges stay on desktop).
   */
  memberPredictionStatusClasses(pred: MemberPrediction): { [key: string]: boolean } {
    if (!pred.hasPrediction) {
      return {};
    }
    const s = pred.predictionStatus;
    return {
      'member-prediction--status-correct': s === 'CORRECT',
      'member-prediction--status-partial': s === 'PARTIAL',
      'member-prediction--status-incorrect': s === 'INCORRECT',
      'member-prediction--status-bonus': s === 'BONUS'
    };
  }

  ngOnInit(): void {
    const historyState = history.state as { username: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }
    
    this.loadData();
    this.initResultsLayoutMediaQuery();
  }

  ngOnDestroy(): void {
    this.matchRefreshSub?.unsubscribe();
    this.resultsLayoutMqlListener?.();
    this.resultsLayoutMqlListener = null;
    this.resultsLayoutMql = null;
    this.dismissMultiplierToast();
  }

  private initResultsLayoutMediaQuery(): void {
    if (typeof matchMedia === 'undefined') {
      return;
    }
    this.resultsLayoutMql = matchMedia('(max-width: 768px)');
    this.resultsLayoutIsMobile = this.resultsLayoutMql.matches;
    const handler = (): void => {
      this.ngZone.run(() => {
        this.resultsLayoutIsMobile = this.resultsLayoutMql!.matches;
      });
    };
    this.resultsLayoutMql.addEventListener('change', handler);
    this.resultsLayoutMqlListener = () => {
      this.resultsLayoutMql?.removeEventListener('change', handler);
    };
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

  /**
   * True when the viewport matches the same breakpoint as mobile CSS (≤768px).
   * Used to route taps on the whole match card while desktop keeps the footer buttons.
   */
  isResultsMobileLayout(): boolean {
    return this.resultsLayoutIsMobile;
  }

  /**
   * On mobile, footer buttons are hidden; tapping the card opens the same flow
   * as the old buttons: live/past → predicciones modal; upcoming → edit (group
   * picker or direct navigation if only one group).
   */
  onResultsMatchCardClick(
    _event: Event,
    match: LiveMatch,
    section: 'live' | 'upcoming' | 'past'
  ): void {
    if (!this.isResultsMobileLayout()) {
      return;
    }
    if (!this.hasJoinedTournaments()) {
      return;
    }
    if (section === 'upcoming') {
      this.predictMatch(match);
    } else {
      this.viewPredictions(match);
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard'], {
      state: { username: this.username }
    });
  }

  hasJoinedTournaments(): boolean {
    return this.joinedTournaments.length > 0;
  }

  /**
   * Groups eligible for editing predictions: CANDIDATE members are pending
   * approval and cannot submit predictions, so they're excluded from the
   * group selector and direct-navigation shortcuts.
   */
  get predictableTournaments(): JoinedTournament[] {
    return this.joinedTournaments.filter(j => j.role !== 'CANDIDATE');
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

  private isUniquePredictionsMode(): boolean {
    return localStorage.getItem('prode_prediction_mode_v1') === 'unique';
  }

  // Predict for upcoming match
  predictMatch(match: LiveMatch): void {
    const eligible = this.predictableTournaments;
    if (eligible.length === 0) return;

    this.selectedMatch = match;

    // When unique-predictions mode is active, skip the group selector and go
    // directly to the first eligible group's edit page.
    if (this.isUniquePredictionsMode()) {
      this.goToPredictions(eligible[0].tournament.id);
      return;
    }

    if (eligible.length === 1) {
      this.goToPredictions(eligible[0].tournament.id);
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
        highlightMatch: this.selectedMatch?.id,
        fromResults: true
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

  /**
   * Tap on the ★ badge → reveal a banner explaining the x1,5 multiplier.
   * Re-tapping the same badge toggles it off; click outside, scroll, resize,
   * or timeout dismisses it.
   */
  showMultiplierToast(event: Event, match: LiveMatch): void {
    event.stopPropagation();

    if (this.multiplierToast?.matchId === match.id) {
      this.dismissMultiplierToast();
      return;
    }

    const anchor =
      (event.target as HTMLElement | null)?.closest('.match-multiplier-badge-host') ??
      (event.target as HTMLElement | null);
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const badgeCenter = rect.left + rect.width / 2;
    this.multiplierToastAnchor = { top: rect.top, bottom: rect.bottom, center: badgeCenter };

    const estimatedHeight = this.estimatedMultiplierToastHeight();
    const placement = this.pickMultiplierToastPlacement(rect.top, estimatedHeight);
    const initialLeft = this.clampMultiplierToastLeft(badgeCenter, this.estimatedMultiplierToastWidth());
    const initialTop = placement === 'above'
      ? rect.top - ResultsComponent.MULTIPLIER_TOAST_GAP
      : rect.bottom + ResultsComponent.MULTIPLIER_TOAST_GAP;

    this.multiplierToast = {
      matchId: match.id,
      before: 'Partido destacado,',
      after: 'tus puntos se multiplican por x1,5.',
      top: initialTop,
      left: initialLeft,
      arrowOffset: badgeCenter - initialLeft,
      placement
    };

    this.clearMultiplierToastTimer();
    this.multiplierToastTimer = setTimeout(
      () => this.dismissMultiplierToast(),
      ResultsComponent.MULTIPLIER_TOAST_AUTO_DISMISS_MS
    );
    this.addMultiplierToastDismissListeners();

    requestAnimationFrame(() => this.refineMultiplierToastPosition());
  }

  private clampMultiplierToastLeft(badgeCenter: number, width: number): number {
    const viewportPadding = 12;
    const minLeft = viewportPadding;
    const maxLeft = Math.max(minLeft, window.innerWidth - viewportPadding - width);
    return Math.max(minLeft, Math.min(maxLeft, badgeCenter - width / 2));
  }

  private estimatedMultiplierToastWidth(): number {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 769;
    const max = isDesktop ? 640 : 320;
    return Math.min(max, window.innerWidth - 24);
  }

  private estimatedMultiplierToastHeight(): number {
    return typeof window !== 'undefined' && window.innerWidth < 769 ? 80 : 60;
  }

  private pickMultiplierToastPlacement(anchorTop: number, toastHeight: number): 'above' | 'below' {
    if (typeof window !== 'undefined' && window.innerWidth >= 769) {
      return 'above';
    }
    const room = anchorTop - ResultsComponent.MULTIPLIER_TOAST_GAP - toastHeight;
    return room >= ResultsComponent.MULTIPLIER_TOAST_HEADER_SAFE_ZONE ? 'above' : 'below';
  }

  private refineMultiplierToastPosition(): void {
    if (!this.multiplierToast || !this.multiplierToastAnchor) {
      return;
    }
    const el = this.multiplierToastEl?.nativeElement;
    if (!el) {
      return;
    }
    const measured = el.getBoundingClientRect();
    const arrowSafeZone = 18;
    const { top: anchorTop, bottom: anchorBottom, center: badgeCenter } = this.multiplierToastAnchor;
    const placement = this.pickMultiplierToastPlacement(anchorTop, measured.height);
    const top = placement === 'above'
      ? anchorTop - ResultsComponent.MULTIPLIER_TOAST_GAP
      : anchorBottom + ResultsComponent.MULTIPLIER_TOAST_GAP;
    const left = this.clampMultiplierToastLeft(badgeCenter, measured.width);
    const arrowOffset = Math.max(
      arrowSafeZone,
      Math.min(measured.width - arrowSafeZone, badgeCenter - left)
    );
    this.multiplierToast = { ...this.multiplierToast, top, left, arrowOffset, placement };
  }

  dismissMultiplierToast(): void {
    this.clearMultiplierToastTimer();
    this.removeMultiplierToastDismissListeners();
    this.multiplierToast = null;
    this.multiplierToastAnchor = null;
  }

  private clearMultiplierToastTimer(): void {
    if (this.multiplierToastTimer !== null) {
      clearTimeout(this.multiplierToastTimer);
      this.multiplierToastTimer = null;
    }
  }

  private addMultiplierToastDismissListeners(): void {
    if (!this.multiplierToastDismissOnScroll) {
      const handler = () => this.dismissMultiplierToast();
      this.multiplierToastDismissOnScroll = handler;
      window.addEventListener('scroll', handler, { passive: true, capture: true });
      window.addEventListener('resize', handler);
    }
    if (!this.multiplierToastDocumentClick) {
      const clickHandler = (e: Event) => {
        const el = this.multiplierToastEl?.nativeElement;
        if (el && el.contains(e.target as Node)) {
          return;
        }
        this.dismissMultiplierToast();
      };
      this.multiplierToastDocumentClick = clickHandler;
      setTimeout(() => {
        if (this.multiplierToastDocumentClick === clickHandler) {
          document.addEventListener('click', clickHandler);
        }
      }, 0);
    }
  }

  private removeMultiplierToastDismissListeners(): void {
    if (this.multiplierToastDismissOnScroll) {
      window.removeEventListener('scroll', this.multiplierToastDismissOnScroll, true);
      window.removeEventListener('resize', this.multiplierToastDismissOnScroll);
      this.multiplierToastDismissOnScroll = null;
    }
    if (this.multiplierToastDocumentClick) {
      document.removeEventListener('click', this.multiplierToastDocumentClick);
      this.multiplierToastDocumentClick = null;
    }
  }

}
