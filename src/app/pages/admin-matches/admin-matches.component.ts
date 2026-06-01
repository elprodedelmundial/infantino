import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserToolbarComponent } from '../../components/user-toolbar/user-toolbar.component';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { AdminCreateMatchPayload, AdminTournamentListItem, Country } from '../../models/tournament.model';
import {
  MatchGroupApi,
  MatchStageApi,
  MATCH_GROUP_API_OPTIONS,
  MATCH_STAGE_API_OPTIONS,
  getMatchGroupApiLabel,
  getMatchStageApiLabel
} from '../../utils/match-stage.utils';

interface QueuedAdminMatch extends AdminCreateMatchPayload {
  homeTeamName: string;
  awayTeamName: string;
  stageLabel: string;
  groupLabel?: string;
}

@Component({
  selector: 'app-admin-matches',
  standalone: true,
  imports: [CommonModule, FormsModule, UserToolbarComponent],
  templateUrl: './admin-matches.component.html',
  styleUrl: './admin-matches.component.scss'
})
export class AdminMatchesComponent implements OnInit {
  username = 'Usuario';
  tournaments: AdminTournamentListItem[] = [];
  teams: Country[] = [];

  selectedTournamentId = '';
  code = '';
  homeTeamId = '';
  awayTeamId = '';
  selectedStage: MatchStageApi = 'GROUP_STAGE';
  selectedGroup: MatchGroupApi = 'GROUP_A';
  hasMultiplier = false;
  startedAtDateInput = '';
  startedAtTimeInput = '';
  selectedTimeZone = this.formatTimeZoneOption(-new Date().getTimezoneOffset());
  timeZones = this.buildTimeZoneOptions();

  queuedMatches: QueuedAdminMatch[] = [];
  isFormOpen = true;
  isLoading = true;
  isLoadingTeams = false;
  isSaving = false;
  loadError: string | null = null;
  saveError: string | null = null;
  saveSuccess: string | null = null;

  readonly matchStageOptions = MATCH_STAGE_API_OPTIONS;
  readonly matchGroupOptions = MATCH_GROUP_API_OPTIONS;

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService
  ) {
    const st = history.state as { username?: string } | undefined;
    if (st?.username) this.username = st.username;

    const now = new Date();
    now.setMinutes(now.getMinutes() >= 30 ? 30 : 0, 0, 0);
    this.startedAtDateInput = this.formatDateInput(now);
    this.startedAtTimeInput = this.formatTimeInput(now);
  }

  ngOnInit(): void {
    this.tournamentService.getAdminTournaments().subscribe({
      next: list => {
        this.tournaments = list;
        this.selectedTournamentId = list[0]?.id ?? '';
        this.isLoading = false;
        if (this.selectedTournamentId) this.loadTeams();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'No se pudieron cargar los torneos.';
      }
    });
  }

  get availableHomeTeams(): Country[] {
    return this.teams.filter(team => team.id !== this.awayTeamId);
  }

  get availableAwayTeams(): Country[] {
    return this.teams.filter(team => team.id !== this.homeTeamId);
  }

  get selectedHomeTeam(): Country | undefined {
    return this.teams.find(team => team.id === this.homeTeamId);
  }

  get selectedAwayTeam(): Country | undefined {
    return this.teams.find(team => team.id === this.awayTeamId);
  }

  get isGroupStageSelected(): boolean {
    return this.selectedStage === 'GROUP_STAGE';
  }

  goBack(): void {
    this.router.navigate(['/admin'], { state: { username: this.username } });
  }

  onTournamentSelect(): void {
    this.homeTeamId = '';
    this.awayTeamId = '';
    this.loadTeams();
  }

  onStageSelect(): void {
    if (!this.isGroupStageSelected) {
      this.selectedGroup = 'GROUP_A';
    }
  }

  openForm(): void {
    this.isFormOpen = true;
    this.saveError = null;
    this.saveSuccess = null;
  }

  private loadTeams(): void {
    if (!this.selectedTournamentId) return;
    this.isLoadingTeams = true;
    this.loadError = null;
    this.tournamentService.getCountriesForAwards(this.selectedTournamentId).subscribe({
      next: teams => {
        this.teams = teams;
        this.homeTeamId = teams[0]?.id ?? '';
        this.awayTeamId = teams.find(team => team.id !== this.homeTeamId)?.id ?? '';
        this.isLoadingTeams = false;
      },
      error: () => {
        this.teams = [];
        this.isLoadingTeams = false;
        this.loadError = 'No se pudieron cargar los equipos.';
      }
    });
  }

  onStartedDateInput(value: string): void {
    this.startedAtDateInput = this.formatDateMask(value);
  }

  onStartedTimeInput(value: string): void {
    this.startedAtTimeInput = this.formatTimeMask(value);
  }

  private buildTimeZoneOptions(): string[] {
    const localOffset = -new Date().getTimezoneOffset();
    const offsets: number[] = [];
    for (let minutes = -12 * 60; minutes <= 14 * 60; minutes += 15) offsets.push(minutes);
    return Array.from(new Set([localOffset, ...offsets])).sort((a, b) => a - b).map(offset => this.formatTimeZoneOption(offset));
  }

  private formatDateInput(date: Date): string {
    return `${this.pad(date.getDate())}/${this.pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  private formatTimeInput(date: Date): string {
    return `${this.pad(date.getHours())}:${this.pad(date.getMinutes())}`;
  }

  private formatDateMask(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits.length === 2 ? `${digits}/` : digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}${digits.length === 4 ? '/' : ''}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  private formatTimeMask(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits.length === 2 ? `${digits}:` : digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  private buildStartedAt(): string | null {
    const parsed = this.parseStartedAtInput();
    if (!parsed) return null;

    const offsetMinutes = this.parseSelectedTimeZoneOffset();
    if (offsetMinutes === null) return null;
    return `${parsed.year}-${this.pad(parsed.month)}-${this.pad(parsed.day)}T${this.pad(parsed.hour)}:${this.pad(parsed.minute)}:00.000${this.formatOffset(offsetMinutes)}`;
  }

  private parseStartedAtInput(): { day: number; month: number; year: number; hour: number; minute: number } | null {
    const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(this.startedAtDateInput);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(this.startedAtTimeInput);
    if (!dateMatch || !timeMatch || !this.selectedTimeZone) return null;

    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const date = new Date(year, month - 1, day);
    const isDateValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    const isTimeValid = hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;

    return isDateValid && isTimeValid ? { day, month, year, hour, minute } : null;
  }

  private parseSelectedTimeZoneOffset(): number | null {
    const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(this.selectedTimeZone);
    if (!match) return null;

    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] === '+' ? minutes : -minutes;
  }

  private formatOffset(minutes: number): string {
    const sign = minutes >= 0 ? '+' : '-';
    const absolute = Math.abs(minutes);
    return `${sign}${this.pad(Math.floor(absolute / 60))}:${this.pad(absolute % 60)}`;
  }

  private formatTimeZoneOption(minutes: number): string {
    return `UTC${this.formatOffset(minutes)}`;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  isCodeDuplicated(): boolean {
    const code = this.code.trim().toLowerCase();
    return !!code && this.queuedMatches.some(match => match.code.toLowerCase() === code);
  }

  isStartedAtInPast(): boolean {
    const startedAt = this.buildStartedAt();
    return !!startedAt && Date.parse(startedAt) < Date.now();
  }

  hasQueuedPastMatches(): boolean {
    return this.queuedMatches.some(match => Date.parse(match.startedAt) < Date.now());
  }

  canAddMatch(): boolean {
    return (
      !!this.selectedTournamentId &&
      !!this.code.trim() &&
      this.code.trim().length <= 10 &&
      !this.isCodeDuplicated() &&
      !!this.homeTeamId &&
      !!this.awayTeamId &&
      this.homeTeamId !== this.awayTeamId &&
      !!this.parseStartedAtInput() &&
      !this.isStartedAtInPast() &&
      !this.isLoadingTeams &&
      (!this.isGroupStageSelected || !!this.selectedGroup)
    );
  }

  addMatch(): void {
    if (!this.canAddMatch()) return;
    const home = this.selectedHomeTeam;
    const away = this.selectedAwayTeam;
    const startedAt = this.buildStartedAt();
    if (!home || !away || !startedAt) return;

    const group = this.isGroupStageSelected ? this.selectedGroup : undefined;

    this.queuedMatches = [
      ...this.queuedMatches,
      {
        code: this.code.trim(),
        homeTeamId: this.homeTeamId,
        awayTeamId: this.awayTeamId,
        startedAt,
        hasMultiplier: this.hasMultiplier,
        stage: this.selectedStage,
        ...(group ? { group } : {}),
        homeTeamName: home.name,
        awayTeamName: away.name,
        stageLabel: getMatchStageApiLabel(this.selectedStage),
        ...(group ? { groupLabel: getMatchGroupApiLabel(group) } : {})
      }
    ];
    this.code = '';
    this.hasMultiplier = false;
    this.isFormOpen = false;
    this.saveError = null;
    this.saveSuccess = null;
  }

  removeQueuedMatch(index: number): void {
    this.queuedMatches = this.queuedMatches.filter((_, i) => i !== index);
  }

  canCreateMatches(): boolean {
    return this.queuedMatches.length > 0 && !this.hasQueuedPastMatches() && !this.isSaving;
  }

  submitMatches(): void {
    if (!this.canCreateMatches()) {
      if (this.hasQueuedPastMatches()) this.saveError = 'No se pueden crear partidos en el pasado.';
      return;
    }
    this.isSaving = true;
    this.saveError = null;
    this.saveSuccess = null;

    this.tournamentService.createAdminMatches(this.selectedTournamentId, this.queuedMatches).subscribe({
      next: () => {
        this.isSaving = false;
        this.saveSuccess = 'Partidos creados correctamente.';
        this.queuedMatches = [];
        this.isFormOpen = true;
      },
      error: (e: Error) => {
        this.isSaving = false;
        this.saveError = e.message ?? 'No se pudieron crear los partidos.';
      }
    });
  }
}
