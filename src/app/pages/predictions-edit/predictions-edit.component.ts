import { Component, ElementRef, OnDestroy, OnInit, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { MatchMultiplierBadgeComponent } from '../../components/match-multiplier-badge/match-multiplier-badge.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { 
  Tournament,
  MatchPrediction, 
  TournamentStageInfo,
  TournamentStage,
  PredictionFilter,
  MatchScore
} from '../../models/tournament.model';
import { isSwitzerland } from '../../utils/flag.utils';

interface EditablePrediction extends MatchPrediction {
  /** `null` = empty in mobile boxed inputs (user cleared to type a new value) */
  editedHomeScore: number | null;
  editedAwayScore: number | null;
  isEditing: boolean;
  hasChanges: boolean;
  /** Value before mobile focus; restored on blur if the field is left empty */
  mobileHomeBackup?: number;
  mobileAwayBackup?: number;
}

@Component({
  selector: 'app-predictions-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent, MatchMultiplierBadgeComponent],
  templateUrl: './predictions-edit.component.html',
  styleUrl: './predictions-edit.component.scss'
})
export class PredictionsEditComponent implements OnInit, OnDestroy {
  /** How long the odds banner stays on screen if the user does nothing. */
  private static readonly ODDS_TOAST_AUTO_DISMISS_MS = 15_000;
  /** Top of the viewport reserved for the user toolbar; popover won't intrude here. */
  private static readonly ODDS_TOAST_HEADER_SAFE_ZONE = 90;
  /** Vertical space between the popover and the badge it points at. */
  private static readonly ODDS_TOAST_GAP = 10;

  readonly isSwitzerland = isSwitzerland;

  username: string = 'Usuario';
  tournament: Tournament | null = null;
  allMatches: EditablePrediction[] = [];
  filteredMatches: EditablePrediction[] = [];
  stages: TournamentStageInfo[] = [];
  isLoading: boolean = true;
  isSaving: boolean = false;
  tournamentId: string = '';
  highlightMatchId: string | null = null;
  fromResults: boolean = false;
  isUniquePredictions: boolean = false;
  
  // Filters
  timeFilter: PredictionFilter = 'future';
  stageFilter: TournamentStage | 'all' = 'all';
  groupFilter: string | 'all' = 'all';
  
  // Available groups
  groups: string[] = [];

  /**
   * Floating banner anchored to the last clicked quota badge.
   *
   * - `top` / `left` are viewport coordinates. When `placement === 'above'`
   *   the popover uses `transform: translateY(-100%)` so its bottom edge sits
   *   at `top`. When `'below'` it uses no translation, so `top` is the top
   *   edge directly. The flip happens when the popover would otherwise cover
   *   the page header.
   * - `arrowOffset` is the px distance from the popover's left edge to where
   *   the arrow tip should fall (the badge's horizontal center).
   *
   * Sizing is driven entirely by CSS (`width: max-content`, single line on
   * desktop, naturally wrapped on mobile). After the popover renders, real
   * dimensions are measured and `top`/`left`/`arrowOffset`/`placement` are
   * refined so it stays glued to the badge.
   */
  oddsToast: {
    message: string;
    top: number;
    left: number;
    arrowOffset: number;
    placement: 'above' | 'below';
  } | null = null;
  /** Cached anchor rect so the post-measure refine can re-decide placement. */
  private oddsToastAnchor: { top: number; bottom: number; center: number } | null = null;
  private oddsToastTimer: ReturnType<typeof setTimeout> | null = null;
  private oddsToastDismissOnScroll: (() => void) | null = null;
  private oddsToastDocumentClick: ((event: MouseEvent) => void) | null = null;

  @ViewChild('oddsToastEl') private oddsToastEl?: ElementRef<HTMLElement>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string; highlightMatch?: string; fromResults?: boolean } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }
    if (historyState?.highlightMatch) {
      this.highlightMatchId = historyState.highlightMatch;
    }
    this.fromResults = historyState?.fromResults === true;
    this.isUniquePredictions = localStorage.getItem('prode_prediction_mode_v1') === 'unique';

    this.route.params.subscribe(params => {
      this.tournamentId = params['id'];
      this.loadData();
    });
  }

  loadData(): void {
    this.isLoading = true;
    
    this.tournamentService.getTournamentById(this.tournamentId).subscribe(tournament => {
      this.tournament = tournament;
      
      this.tournamentService.getAllPredictions(this.tournamentId).subscribe(data => {
        this.allMatches = data.matches.map(m => ({
          ...m,
          editedHomeScore: m.predictedScore.home,
          editedAwayScore: m.predictedScore.away,
          isEditing: false,
          hasChanges: false
        }));
        
        this.stages = data.stages;
        
        // Extract unique groups
        const groupSet = new Set(data.matches.filter(m => m.group).map(m => m.group!));
        this.groups = Array.from(groupSet).sort();
        
        this.applyFilters();
        this.isLoading = false;
        
        // Scroll to highlighted match after a short delay
        if (this.highlightMatchId) {
          setTimeout(() => this.scrollToMatch(this.highlightMatchId!), 300);
        }
      });
    });
  }

  applyFilters(): void {
    let filtered = [...this.allMatches];
    
    // Time filter
    if (this.timeFilter === 'future') {
      filtered = filtered.filter(m => !m.isPlayed);
    }
    
    // Stage filter
    if (this.stageFilter !== 'all') {
      filtered = filtered.filter(m => m.stage === this.stageFilter);
    }
    
    // Group filter (only for group stage)
    if (this.groupFilter !== 'all') {
      filtered = filtered.filter(m => m.group === this.groupFilter);
    }
    
    // Sort by date
    filtered.sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime());
    
    this.filteredMatches = filtered;
  }

  setTimeFilter(filter: PredictionFilter): void {
    this.timeFilter = filter;
    this.applyFilters();
  }

  setStageFilter(stage: TournamentStage | 'all'): void {
    this.stageFilter = stage;
    // Reset group filter when changing stage
    if (stage !== 'group_stage') {
      this.groupFilter = 'all';
    }
    this.applyFilters();
  }

  setGroupFilter(group: string | 'all'): void {
    this.groupFilter = group;
    this.applyFilters();
  }

  isStageAvailable(stage: TournamentStageInfo): boolean {
    return (stage.matchCount ?? 0) > 0;
  }

  isMatchLocked(match: MatchPrediction): boolean {
    if (match.isPlayed) return true;
    if (match.matchStatus === 'IN_PROGRESS') return true;
    const fifteenMin = 15 * 60 * 1000;
    return new Date(match.matchDate).getTime() - Date.now() <= fifteenMin;
  }

  startEditing(match: EditablePrediction): void {
    if (this.isMatchLocked(match)) return;
    match.isEditing = true;
  }

  cancelEditing(match: EditablePrediction): void {
    match.editedHomeScore = match.predictedScore.home;
    match.editedAwayScore = match.predictedScore.away;
    match.mobileHomeBackup = undefined;
    match.mobileAwayBackup = undefined;
    match.isEditing = false;
    match.hasChanges = false;
  }

  saveMatch(match: EditablePrediction): void {
    if (this.isMatchLocked(match)) return;

    const newScore: MatchScore = {
      home: this.effectiveHome(match),
      away: this.effectiveAway(match)
    };
    
    this.tournamentService.updatePrediction(this.tournamentId, match.id, newScore).subscribe(success => {
      if (success) {
        match.predictedScore = { ...newScore };
        match.editedHomeScore = newScore.home;
        match.editedAwayScore = newScore.away;
        match.mobileHomeBackup = undefined;
        match.mobileAwayBackup = undefined;
        match.isEditing = false;
        match.hasChanges = false;
      }
    });
  }

  private scoreNum(v: number | null | undefined): number {
    return v === null || v === undefined ? 0 : v;
  }

  /** Effective value while editing (uses backup if the box is still empty) */
  private effectiveHome(m: EditablePrediction): number {
    if (m.editedHomeScore !== null) {
      return m.editedHomeScore;
    }
    if (m.mobileHomeBackup !== undefined) {
      return m.mobileHomeBackup;
    }
    return 0;
  }

  private effectiveAway(m: EditablePrediction): number {
    if (m.editedAwayScore !== null) {
      return m.editedAwayScore;
    }
    if (m.mobileAwayBackup !== undefined) {
      return m.mobileAwayBackup;
    }
    return 0;
  }

  onScoreChange(match: EditablePrediction): void {
    match.hasChanges =
      this.effectiveHome(match) !== match.predictedScore.home ||
      this.effectiveAway(match) !== match.predictedScore.away;
  }

  /**
   * Strips anything that isn't a digit and caps at 2 chars before clamping
   * to the allowed score range. Writes the canonical value straight back to
   * the input so partially-typed garbage (`93.`, `+10`, `e2`) can never linger
   * on screen — `[value]` binding wouldn't refresh the DOM when clamping
   * collapses to the previously-bound number.
   */
  onMobileBoxScoreInput(
    match: EditablePrediction,
    which: 'home' | 'away',
    input: HTMLInputElement
  ): void {
    if (this.isMatchLocked(match) || match.isPlayed) {
      input.value = '';
      return;
    }
    const sanitized = input.value.replace(/\D/g, '').slice(0, 2);
    if (sanitized === '') {
      if (input.value !== '') {
        input.value = '';
      }
      if (which === 'home') {
        match.editedHomeScore = null;
      } else {
        match.editedAwayScore = null;
      }
      this.onScoreChange(match);
      return;
    }
    const n = this.clampScoreInput(sanitized);
    const display = String(n);
    if (input.value !== display) {
      input.value = display;
    }
    if (which === 'home') {
      match.editedHomeScore = n;
      match.mobileHomeBackup = undefined;
    } else {
      match.editedAwayScore = n;
      match.mobileAwayBackup = undefined;
    }
    this.onScoreChange(match);
  }

  onMobileScoreBoxFocus(match: EditablePrediction, which: 'home' | 'away'): void {
    if (this.isMatchLocked(match) || match.isPlayed) {
      return;
    }
    match.isEditing = true;
    if (which === 'home') {
      match.mobileHomeBackup = this.scoreNum(match.editedHomeScore);
      match.editedHomeScore = null;
    } else {
      match.mobileAwayBackup = this.scoreNum(match.editedAwayScore);
      match.editedAwayScore = null;
    }
    this.onScoreChange(match);
  }

  onMobileBoxBlur(match: EditablePrediction, which: 'home' | 'away'): void {
    if (this.isMatchLocked(match) || match.isPlayed) {
      return;
    }
    if (which === 'home') {
      if (match.editedHomeScore === null && match.mobileHomeBackup !== undefined) {
        match.editedHomeScore = match.mobileHomeBackup;
      }
      match.mobileHomeBackup = undefined;
    } else {
      if (match.editedAwayScore === null && match.mobileAwayBackup !== undefined) {
        match.editedAwayScore = match.mobileAwayBackup;
      }
      match.mobileAwayBackup = undefined;
    }
    this.onScoreChange(match);
  }

  private clampScoreInput(raw: string | number | null | undefined): number {
    if (raw === null || raw === undefined) {
      return 0;
    }
    if (raw === '') {
      return 0;
    }
    const n =
      typeof raw === 'string' ? parseInt(raw, 10) : Math.floor(Number(raw));
    if (Number.isNaN(n) || n < 0) {
      return 0;
    }
    if (n > 9) {
      return 9;
    }
    return n;
  }

  saveAllChanges(): void {
    const changedMatches = this.allMatches.filter(m => m.hasChanges && !this.isMatchLocked(m));
    if (changedMatches.length === 0) return;
    
    this.isSaving = true;
    const updates = changedMatches.map(m => ({
      matchId: m.id,
      score: {
        home: this.effectiveHome(m),
        away: this.effectiveAway(m)
      }
    }));
    
    this.tournamentService.updateMultiplePredictions(this.tournamentId, updates).subscribe(() => {
      changedMatches.forEach(m => {
        const h = this.effectiveHome(m);
        const a = this.effectiveAway(m);
        m.predictedScore = { home: h, away: a };
        m.editedHomeScore = h;
        m.editedAwayScore = a;
        m.mobileHomeBackup = undefined;
        m.mobileAwayBackup = undefined;
        m.hasChanges = false;
        m.isEditing = false;
      });
      this.isSaving = false;
    });
  }

  get hasUnsavedChanges(): boolean {
    return this.allMatches.some(m => m.hasChanges);
  }

  get unsavedCount(): number {
    return this.allMatches.filter(m => m.hasChanges).length;
  }

  ngOnDestroy(): void {
    this.clearOddsToastTimer();
    this.removeOddsToastDismissListeners();
  }

  /**
   * Tap on a quota badge → reveal a banner explaining how many extra points
   * are earned when correctly predicting that outcome. The banner is placed
   * above the badge by default and flips below if it would otherwise cover
   * the page header. It auto-dismisses after a few seconds, on scroll/resize,
   * or when the user clicks anywhere outside it.
   */
  showOddsToast(event: Event, match: EditablePrediction, which: 'home' | 'draw' | 'away'): void {
    if (!match.odds) {
      return;
    }
    event.stopPropagation();
    const anchor = event.currentTarget as HTMLElement | null;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();

    const points = match.odds[which].toFixed(1);
    let message: string;
    if (which === 'home') {
      message = `Si aciertas que gana ${match.homeTeam.name}, ganas +${points} puntos extra.`;
    } else if (which === 'away') {
      message = `Si aciertas que gana ${match.awayTeam.name}, ganas +${points} puntos extra.`;
    } else {
      message = `Si aciertas el empate, ganas +${points} puntos extra.`;
    }

    const badgeCenter = rect.left + rect.width / 2;
    this.oddsToastAnchor = { top: rect.top, bottom: rect.bottom, center: badgeCenter };

    const estimatedHeight = this.estimatedToastHeight();
    const placement = this.pickPlacement(rect.top, estimatedHeight);
    const initialLeft = this.clampToastLeft(badgeCenter, this.estimatedToastWidth());
    const initialTop = placement === 'above'
      ? rect.top - PredictionsEditComponent.ODDS_TOAST_GAP
      : rect.bottom + PredictionsEditComponent.ODDS_TOAST_GAP;

    this.oddsToast = {
      message,
      top: initialTop,
      left: initialLeft,
      arrowOffset: badgeCenter - initialLeft,
      placement
    };

    this.clearOddsToastTimer();
    this.oddsToastTimer = setTimeout(
      () => this.dismissOddsToast(),
      PredictionsEditComponent.ODDS_TOAST_AUTO_DISMISS_MS
    );
    this.addOddsToastDismissListeners();

    requestAnimationFrame(() => this.refineOddsToastPosition());
  }

  /** Centers the popover on `badgeCenter`, clamped to the viewport. */
  private clampToastLeft(badgeCenter: number, width: number): number {
    const viewportPadding = 12;
    const minLeft = viewportPadding;
    const maxLeft = Math.max(minLeft, window.innerWidth - viewportPadding - width);
    return Math.max(minLeft, Math.min(maxLeft, badgeCenter - width / 2));
  }

  /** First-paint width guess so the popover doesn't visibly jump on refine. */
  private estimatedToastWidth(): number {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 769;
    const max = isDesktop ? 640 : 320;
    return Math.min(max, window.innerWidth - 24);
  }

  /** First-paint height guess used only to choose initial placement. */
  private estimatedToastHeight(): number {
    return typeof window !== 'undefined' && window.innerWidth < 769 ? 80 : 60;
  }

  /** "Above" unless that would cover the header zone, in which case "below". */
  private pickPlacement(anchorTop: number, toastHeight: number): 'above' | 'below' {
    const room = anchorTop - PredictionsEditComponent.ODDS_TOAST_GAP - toastHeight;
    return room >= PredictionsEditComponent.ODDS_TOAST_HEADER_SAFE_ZONE ? 'above' : 'below';
  }

  /**
   * After the popover renders, replace the estimated dimensions with the
   * real measured ones and re-decide placement so the arrow stays glued to
   * the badge and the banner never bleeds into the page header.
   */
  private refineOddsToastPosition(): void {
    if (!this.oddsToast || !this.oddsToastAnchor) {
      return;
    }
    const el = this.oddsToastEl?.nativeElement;
    if (!el) {
      return;
    }
    const measured = el.getBoundingClientRect();
    const arrowSafeZone = 18;
    const { top: anchorTop, bottom: anchorBottom, center: badgeCenter } = this.oddsToastAnchor;
    const placement = this.pickPlacement(anchorTop, measured.height);
    const top = placement === 'above'
      ? anchorTop - PredictionsEditComponent.ODDS_TOAST_GAP
      : anchorBottom + PredictionsEditComponent.ODDS_TOAST_GAP;
    const left = this.clampToastLeft(badgeCenter, measured.width);
    const arrowOffset = Math.max(
      arrowSafeZone,
      Math.min(measured.width - arrowSafeZone, badgeCenter - left)
    );
    this.oddsToast = { ...this.oddsToast, top, left, arrowOffset, placement };
  }

  dismissOddsToast(): void {
    this.clearOddsToastTimer();
    this.removeOddsToastDismissListeners();
    this.oddsToast = null;
    this.oddsToastAnchor = null;
  }

  private clearOddsToastTimer(): void {
    if (this.oddsToastTimer !== null) {
      clearTimeout(this.oddsToastTimer);
      this.oddsToastTimer = null;
    }
  }

  private addOddsToastDismissListeners(): void {
    if (!this.oddsToastDismissOnScroll) {
      const handler = () => this.dismissOddsToast();
      this.oddsToastDismissOnScroll = handler;
      window.addEventListener('scroll', handler, { passive: true, capture: true });
      window.addEventListener('resize', handler);
    }
    if (!this.oddsToastDocumentClick) {
      // Click-outside-to-dismiss. Deferred so the current click (the one that
      // opened the popover, or that switched to a different badge) doesn't
      // immediately close the freshly-shown banner.
      const clickHandler = (e: MouseEvent) => {
        const el = this.oddsToastEl?.nativeElement;
        if (el && el.contains(e.target as Node)) {
          return;
        }
        this.dismissOddsToast();
      };
      this.oddsToastDocumentClick = clickHandler;
      setTimeout(() => {
        if (this.oddsToastDocumentClick === clickHandler) {
          document.addEventListener('click', clickHandler);
        }
      }, 0);
    }
  }

  private removeOddsToastDismissListeners(): void {
    if (this.oddsToastDismissOnScroll) {
      window.removeEventListener('scroll', this.oddsToastDismissOnScroll, true);
      window.removeEventListener('resize', this.oddsToastDismissOnScroll);
      this.oddsToastDismissOnScroll = null;
    }
    if (this.oddsToastDocumentClick) {
      document.removeEventListener('click', this.oddsToastDocumentClick);
      this.oddsToastDocumentClick = null;
    }
  }

  goBack(): void {
    if (this.fromResults) {
      this.router.navigate(['/results'], {
        state: { username: this.username }
      });
    } else {
      this.router.navigate(['/tournament', this.tournamentId], {
        state: { username: this.username, activeTab: 'predictions' }
      });
    }
  }

  scrollToMatch(matchId: string): void {
    const element = document.getElementById(`match-${matchId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlighted');
      setTimeout(() => element.classList.remove('highlighted'), 2000);
    }
  }

  formatMatchDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getResultBadgeClass(match: MatchPrediction): string {
    if (!match.result) return '';
    return `result-badge ${match.result}`;
  }

  getStageName(stageId: TournamentStage): string {
    const stage = this.stages.find(s => s.id === stageId);
    return stage?.name || stageId;
  }

  /** Suffix after match code in mobile header (e.g. " · Grupo K") — code is styled separately */
  getMatchHeaderRoundSuffix(match: MatchPrediction): string {
    if (match.group) {
      return ` · Grupo ${match.group}`;
    }
    if (match.stage) {
      return ` · ${this.getStageName(match.stage)}`;
    }
    return '';
  }
}
