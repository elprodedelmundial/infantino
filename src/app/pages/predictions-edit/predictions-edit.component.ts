import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
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
  editedHomeScore: number;
  editedAwayScore: number;
  isEditing: boolean;
  hasChanges: boolean;
}

@Component({
  selector: 'app-predictions-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
  templateUrl: './predictions-edit.component.html',
  styleUrl: './predictions-edit.component.scss'
})
export class PredictionsEditComponent implements OnInit {
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
  
  // Filters
  timeFilter: PredictionFilter = 'future';
  stageFilter: TournamentStage | 'all' = 'all';
  groupFilter: string | 'all' = 'all';
  
  // Available groups
  groups: string[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {}

  ngOnInit(): void {
    const historyState = history.state as { username: string; highlightMatch?: string } | undefined;
    if (historyState?.username) {
      this.username = historyState.username;
      this.tournamentService.setCurrentUser(this.username);
    }
    if (historyState?.highlightMatch) {
      this.highlightMatchId = historyState.highlightMatch;
    }

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
    match.isEditing = false;
    match.hasChanges = false;
  }

  saveMatch(match: EditablePrediction): void {
    if (this.isMatchLocked(match)) return;
    
    const newScore: MatchScore = {
      home: match.editedHomeScore,
      away: match.editedAwayScore
    };
    
    this.tournamentService.updatePrediction(this.tournamentId, match.id, newScore).subscribe(success => {
      if (success) {
        match.predictedScore = { ...newScore };
        match.isEditing = false;
        match.hasChanges = false;
      }
    });
  }

  onScoreChange(match: EditablePrediction): void {
    match.hasChanges = 
      match.editedHomeScore !== match.predictedScore.home ||
      match.editedAwayScore !== match.predictedScore.away;
  }

  incrementScore(match: EditablePrediction, team: 'home' | 'away'): void {
    if (team === 'home' && match.editedHomeScore < 9) {
      match.editedHomeScore++;
    } else if (team === 'away' && match.editedAwayScore < 9) {
      match.editedAwayScore++;
    }
    this.onScoreChange(match);
  }

  decrementScore(match: EditablePrediction, team: 'home' | 'away'): void {
    if (team === 'home' && match.editedHomeScore > 0) {
      match.editedHomeScore--;
    } else if (team === 'away' && match.editedAwayScore > 0) {
      match.editedAwayScore--;
    }
    this.onScoreChange(match);
  }

  saveAllChanges(): void {
    const changedMatches = this.allMatches.filter(m => m.hasChanges && !this.isMatchLocked(m));
    if (changedMatches.length === 0) return;
    
    this.isSaving = true;
    const updates = changedMatches.map(m => ({
      matchId: m.id,
      score: { home: m.editedHomeScore, away: m.editedAwayScore }
    }));
    
    this.tournamentService.updateMultiplePredictions(this.tournamentId, updates).subscribe(() => {
      changedMatches.forEach(m => {
        m.predictedScore = { home: m.editedHomeScore, away: m.editedAwayScore };
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

  goBack(): void {
    this.router.navigate(['/tournament', this.tournamentId], {
      state: { username: this.username, activeTab: 'predictions' }
    });
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
}
