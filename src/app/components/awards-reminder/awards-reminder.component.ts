import { Component, EventEmitter, Inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ITournamentService, TOURNAMENT_SERVICE } from '../../services/tournament-service.interface';
import { IUserService, USER_SERVICE } from '../../services/user-service.interface';
import { JoinedTournament } from '../../models/tournament.model';

type ReminderMode = 'single' | 'unique' | 'select';

/**
 * Post-login reminder asking the user to submit their awards predictions before
 * the tournament starts. Layout mirrors the "Predicciones únicas" modal.
 *
 * The CTA routes to the awards edit screen depending on the user's situation:
 * - one group → that group's awards page
 * - many groups + unique predictions → the master group's awards page in
 *   generic mode (no group-name subtitle)
 * - many groups + per-group predictions → a group selector picks the target
 */
@Component({
  selector: 'app-awards-reminder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './awards-reminder.component.html',
  styleUrl: './awards-reminder.component.scss'
})
export class AwardsReminderComponent implements OnInit {
  @Input() username = 'Usuario';
  @Output() closed = new EventEmitter<void>();

  /** Only render the overlay once we know there's something to show. */
  ready = false;
  mode: ReminderMode = 'single';

  groups: JoinedTournament[] = [];
  /** Target for single/unique modes (group/tournament id). */
  private targetId: string | null = null;
  /** Selected group id for the select mode. */
  selectedGroupId: string | null = null;
  isGroupSelectorOpen = false;

  constructor(
    private router: Router,
    @Inject(TOURNAMENT_SERVICE) private tournamentService: ITournamentService,
    @Inject(USER_SERVICE) private userService: IUserService
  ) {}

  ngOnInit(): void {
    forkJoin({
      groups: this.tournamentService.getJoinedTournaments().pipe(catchError(() => of([] as JoinedTournament[]))),
      profile: this.userService.getUserProfile().pipe(catchError(() => of(null)))
    }).subscribe(({ groups, profile }) => {
      // CANDIDATE members can't submit predictions, so they don't count.
      const predictable = groups.filter(g => g.role !== 'CANDIDATE');
      if (predictable.length === 0) {
        this.close();
        return;
      }

      this.groups = predictable;

      const isUnique =
        profile?.uniquePredictions ??
        localStorage.getItem('prode_prediction_mode_v1') === 'unique';

      if (predictable.length === 1) {
        this.mode = 'single';
        this.targetId = predictable[0].tournament.id;
      } else if (isUnique) {
        this.mode = 'unique';
        const master = predictable.find(g => g.tournament.id === profile?.uniquePredictionsMaster);
        this.targetId = (master ?? predictable[0]).tournament.id;
      } else {
        this.mode = 'select';
        this.selectedGroupId = predictable[0].tournament.id;
      }

      this.ready = true;
    });
  }

  get selectedGroup(): JoinedTournament | null {
    return this.groups.find(g => g.tournament.id === this.selectedGroupId) ?? null;
  }

  get selectableGroups(): JoinedTournament[] {
    return this.groups.filter(g => g.tournament.id !== this.selectedGroupId);
  }

  toggleGroupSelector(): void {
    this.isGroupSelectorOpen = !this.isGroupSelectorOpen;
  }

  selectGroup(group: JoinedTournament): void {
    this.selectedGroupId = group.tournament.id;
    this.isGroupSelectorOpen = false;
  }

  goToAwards(): void {
    const targetId = this.mode === 'select' ? this.selectedGroupId : this.targetId;
    if (!targetId) {
      return;
    }
    const generic = this.mode === 'unique';
    this.closed.emit();
    this.router.navigate(['/tournament', targetId, 'awards'], {
      state: { username: this.username, generic }
    });
  }

  close(): void {
    this.closed.emit();
  }
}
