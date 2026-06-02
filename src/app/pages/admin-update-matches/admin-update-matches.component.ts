import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import {
  AdminTournamentListItem,
  AdminTournamentMatch,
  AdminUpdateMatchPayload,
  MatchApiStatus
} from '../../models/tournament.model';

interface QueuedAdminMatchUpdate extends AdminUpdateMatchPayload {
  code: string;
  homeTeamName: string;
  awayTeamName: string;
  currentStatus: MatchApiStatus;
}

@Component({
  selector: 'app-admin-update-matches',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
  templateUrl: './admin-update-matches.component.html',
  styleUrl: './admin-update-matches.component.scss'
})
export class AdminUpdateMatchesComponent implements OnInit {
  username = 'Usuario';
  tournaments: AdminTournamentListItem[] = [];
  selectedTournamentId = '';
  matches: AdminTournamentMatch[] = [];

  selectedMatchId = '';
  targetStatus: MatchApiStatus = 'NOT_STARTED';
  homeGoals: number | null = null;
  awayGoals: number | null = null;
  homePenalties: number | null = null;
  awayPenalties: number | null = null;
  homeQuota: number | null = null;
  awayQuota: number | null = null;
  drawQuota: number | null = null;
  hasMultiplier = false;

  queuedUpdates: QueuedAdminMatchUpdate[] = [];
  isFormOpen = true;
  isLoading = true;
  isLoadingMatches = false;
  isSaving = false;
  loadError: string | null = null;
  saveError: string | null = null;
  saveSuccess: string | null = null;

  readonly statusLabels: Record<MatchApiStatus, string> = {
    NOT_STARTED: 'No iniciado',
    IN_PROGRESS: 'En curso',
    FINISHED: 'Finalizado'
  };

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {
    const st = history.state as { username?: string } | undefined;
    if (st?.username) this.username = st.username;
  }

  ngOnInit(): void {
    this.tournamentService.getAdminTournaments().subscribe({
      next: list => {
        this.tournaments = list;
        this.selectedTournamentId = list[0]?.id ?? '';
        this.isLoading = false;
        if (this.selectedTournamentId) this.loadMatches();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'No se pudieron cargar los torneos.';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin'], { state: { username: this.username } });
  }

  onTournamentSelect(): void {
    this.selectedMatchId = '';
    this.queuedUpdates = [];
    this.resetEditableFields();
    this.loadMatches();
  }

  private loadMatches(): void {
    if (!this.selectedTournamentId) return;
    this.isLoadingMatches = true;
    this.loadError = null;
    this.tournamentService.getAdminTournamentMatches(this.selectedTournamentId).subscribe({
      next: matches => {
        this.matches = [...matches].sort((a, b) => {
          const at = a.startedAt ?? '';
          const bt = b.startedAt ?? '';
          if (at !== bt) return at.localeCompare(bt);
          return a.code.localeCompare(b.code);
        });
        this.selectedMatchId = this.availableMatches[0]?.id ?? '';
        this.onMatchSelect();
        this.isLoadingMatches = false;
      },
      error: () => {
        this.matches = [];
        this.isLoadingMatches = false;
        this.loadError = 'No se pudieron cargar los partidos.';
      }
    });
  }

  /** Matches that are not already queued and so still available to be added */
  get availableMatches(): AdminTournamentMatch[] {
    const queued = new Set(this.queuedUpdates.map(q => q.matchId));
    return this.matches.filter(m => !queued.has(m.id));
  }

  get selectedMatch(): AdminTournamentMatch | undefined {
    return this.matches.find(m => m.id === this.selectedMatchId);
  }

  /**
   * Allowed target statuses for the selected match. A match can never
   * transition into IN_PROGRESS — that status only stays for matches that
   * are already live so the admin can update goals/penalties.
   */
  get availableTargetStatuses(): MatchApiStatus[] {
    const current = this.selectedMatch?.status;
    if (!current) return [];
    if (current === 'NOT_STARTED') return ['NOT_STARTED', 'FINISHED'];
    if (current === 'IN_PROGRESS') return ['IN_PROGRESS', 'FINISHED'];
    return ['FINISHED'];
  }

  get targetIsNotStarted(): boolean { return this.targetStatus === 'NOT_STARTED'; }
  get targetIsInProgress(): boolean { return this.targetStatus === 'IN_PROGRESS'; }
  get targetIsFinished(): boolean { return this.targetStatus === 'FINISHED'; }

  onMatchSelect(): void {
    const match = this.selectedMatch;
    if (!match) {
      this.resetEditableFields();
      return;
    }
    const targets = this.availableTargetStatuses;
    this.targetStatus = targets.includes(match.status) ? match.status : targets[0] ?? 'NOT_STARTED';
    this.populateFormFromMatch(match);
  }

  onTargetStatusChange(): void {
    const match = this.selectedMatch;
    if (match) this.populateFormFromMatch(match);
  }

  private populateFormFromMatch(match: AdminTournamentMatch): void {
    this.homeGoals = match.homeGoals ?? null;
    this.awayGoals = match.awayGoals ?? null;
    this.homePenalties = match.homePenalties ?? null;
    this.awayPenalties = match.awayPenalties ?? null;
    this.homeQuota = match.homeQuota ?? null;
    this.awayQuota = match.awayQuota ?? null;
    this.drawQuota = match.drawQuota ?? null;
    this.hasMultiplier = match.hasMultiplier;
  }

  private resetEditableFields(): void {
    this.targetStatus = 'NOT_STARTED';
    this.homeGoals = null;
    this.awayGoals = null;
    this.homePenalties = null;
    this.awayPenalties = null;
    this.homeQuota = null;
    this.awayQuota = null;
    this.drawQuota = null;
    this.hasMultiplier = false;
  }

  openForm(): void {
    this.isFormOpen = true;
    this.saveError = null;
    this.saveSuccess = null;
    this.selectedMatchId = this.availableMatches[0]?.id ?? '';
    this.onMatchSelect();
  }

  canAddUpdate(): boolean {
    const match = this.selectedMatch;
    if (!match) return false;
    if (this.targetIsFinished) {
      return this.homeGoals !== null && this.homeGoals >= 0 && this.awayGoals !== null && this.awayGoals >= 0;
    }
    return true;
  }

  addUpdate(): void {
    const match = this.selectedMatch;
    if (!this.canAddUpdate() || !match) return;

    const payload: QueuedAdminMatchUpdate = {
      matchId: match.id,
      status: this.targetStatus,
      code: match.code,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      currentStatus: match.status
    };

    if (this.targetIsNotStarted) {
      if (this.homeQuota !== null) payload.homeQuota = this.homeQuota;
      if (this.awayQuota !== null) payload.awayQuota = this.awayQuota;
      if (this.drawQuota !== null) payload.drawQuota = this.drawQuota;
      payload.hasMultiplier = this.hasMultiplier;
    } else if (this.targetIsInProgress) {
      if (this.homeGoals !== null) payload.homeGoals = this.homeGoals;
      if (this.awayGoals !== null) payload.awayGoals = this.awayGoals;
      if (this.homePenalties !== null) payload.homePenalties = this.homePenalties;
      if (this.awayPenalties !== null) payload.awayPenalties = this.awayPenalties;
    } else {
      payload.homeGoals = this.homeGoals ?? 0;
      payload.awayGoals = this.awayGoals ?? 0;
      if (this.homePenalties !== null) payload.homePenalties = this.homePenalties;
      if (this.awayPenalties !== null) payload.awayPenalties = this.awayPenalties;
    }

    this.queuedUpdates = [...this.queuedUpdates, payload];
    this.isFormOpen = false;
    this.saveError = null;
    this.saveSuccess = null;
  }

  removeQueuedUpdate(index: number): void {
    this.queuedUpdates = this.queuedUpdates.filter((_, i) => i !== index);
  }

  canSaveUpdates(): boolean {
    return this.queuedUpdates.length > 0 && !this.isSaving;
  }

  submitUpdates(): void {
    if (!this.canSaveUpdates()) return;
    this.isSaving = true;
    this.saveError = null;
    this.saveSuccess = null;

    const cleanPayload: AdminUpdateMatchPayload[] = this.queuedUpdates.map(q => {
      const { code, homeTeamName, awayTeamName, currentStatus, ...rest } = q;
      return rest;
    });

    this.tournamentService.updateAdminMatches(this.selectedTournamentId, cleanPayload).subscribe({
      next: () => {
        this.isSaving = false;
        this.saveSuccess = 'Partidos actualizados correctamente.';
        this.queuedUpdates = [];
        this.isFormOpen = true;
        this.loadMatches();
      },
      error: (e: Error) => {
        this.isSaving = false;
        this.saveError = e.message ?? 'No se pudieron actualizar los partidos.';
      }
    });
  }

  describeMatch(match: AdminTournamentMatch): string {
    return `${match.code} · ${match.homeTeam.name} vs ${match.awayTeam.name} (${this.statusLabels[match.status]})`;
  }

  describeQueuedFields(queued: QueuedAdminMatchUpdate): string {
    const parts: string[] = [];
    if (queued.status === 'NOT_STARTED') {
      if (queued.homeQuota !== undefined) parts.push(`Local: ${queued.homeQuota}`);
      if (queued.drawQuota !== undefined) parts.push(`Empate: ${queued.drawQuota}`);
      if (queued.awayQuota !== undefined) parts.push(`Visitante: ${queued.awayQuota}`);
      parts.push(`Destacado: ${queued.hasMultiplier ? 'Sí' : 'No'}`);
    } else {
      if (queued.homeGoals !== undefined || queued.awayGoals !== undefined) {
        parts.push(`Goles ${queued.homeGoals ?? '-'} - ${queued.awayGoals ?? '-'}`);
      }
      if (queued.homePenalties !== undefined || queued.awayPenalties !== undefined) {
        parts.push(`Penales ${queued.homePenalties ?? '-'} - ${queued.awayPenalties ?? '-'}`);
      }
    }
    return parts.join(' · ');
  }
}
