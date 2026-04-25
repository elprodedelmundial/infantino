import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import {
  LiveMatch,
  Country,
  MatchScore
} from '../models/tournament.model';
import {
  IMatchService,
  TournamentMatchListsPayload,
  TournamentPredictions,
  MatchPredictionsByTournament
} from './match-service.interface';
import { EnvironmentConfig } from '../config/environment.config';

export const WORLD_CUP_ID = '28652183-a2d6-4f33-a624-0d24645ce3cd';

interface TeamResponse {
  id: string;
  name: string;
  code: string;
  icon: string;
}

interface TournamentMatchResponse {
  id: string;
  code: string;
  home_team: TeamResponse;
  away_team: TeamResponse;
  home_quota: number;
  away_quota: number;
  draw_quota: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
  substatus?: string;
  started_at?: string;
  finished_at?: string;
  home_goals?: number;
  away_goals?: number;
  home_penalties?: number;
  away_penalties?: number;
  has_multiplier?: boolean;
}

interface TournamentMatchesResponse {
  tournament_id: string;
  tournament_name: string;
  past_matches: TournamentMatchResponse[];
  live_matches: TournamentMatchResponse[];
  next_matches: TournamentMatchResponse[];
  total_past_matches: number;
  total_live_matches: number;
  total_next_matches: number;
}

// Not using @Injectable since this is created via factory
export class MatchService implements IMatchService {

  private baseUrl: string;
  private token: string | null = null;

  private matchesCache$: Observable<TournamentMatchesResponse> | null = null;

  constructor(
    private http: HttpClient,
    private config: EnvironmentConfig
  ) {
    this.baseUrl = config.grondonaUrl || '';
    this.token = localStorage.getItem('auth_token');
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (this.token) {
      headers = headers.set('Authorization', `Bearer ${this.token}`);
    }
    return headers;
  }

  private mapTeam(team: TeamResponse): Country {
    return {
      code: team.code,
      name: team.name,
      flagUrl: team.icon
    };
  }

  private mapMatch(match: TournamentMatchResponse): LiveMatch {
    const status: LiveMatch['status'] =
      match.status === 'IN_PROGRESS' ? 'live' :
      match.status === 'FINISHED'    ? 'finished' :
                                       'upcoming';

    const substatus = match.substatus
      ? match.substatus.replace(/\s+/g, ' ').trim()
      : undefined;

    const result: LiveMatch = {
      id: match.id,
      matchCode: match.code,
      homeTeam: this.mapTeam(match.home_team),
      awayTeam: this.mapTeam(match.away_team),
      matchDate: match.started_at ? new Date(match.started_at) : new Date(),
      matchTime: substatus,
      status,
      stage: 'group_stage',
      odds: {
        home: match.home_quota,
        draw: match.draw_quota,
        away: match.away_quota
      },
      tournamentIds: [WORLD_CUP_ID],
      hasMultiplier: match.has_multiplier === true
    };

    if (match.home_goals !== undefined && match.away_goals !== undefined) {
      result.currentScore = { home: match.home_goals, away: match.away_goals };
    }

    // Penalty shoot-out: surfaced only when the backend reports both sides. We
    // use `!= null` so both `undefined` and `null` are treated as "no data".
    if (match.home_penalties != null && match.away_penalties != null) {
      result.penaltyScore = {
        home: match.home_penalties,
        away: match.away_penalties
      };
    }

    return result;
  }

  private getInitialTournamentMatches(): Observable<TournamentMatchesResponse> {
    if (!this.matchesCache$) {
      this.token = localStorage.getItem('auth_token');
      const params = new HttpParams().set('next', '5').set('past', '10');
      this.matchesCache$ = this.http.get<TournamentMatchesResponse>(
        `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/matches`,
        { headers: this.getAuthHeaders(), params }
      ).pipe(
        shareReplay(1),
        catchError(error => {
          this.matchesCache$ = null;
          console.error('Error fetching tournament matches:', error);
          return throwError(() => new Error('Error al obtener los partidos'));
        })
      );
    }
    return this.matchesCache$;
  }

  private mapResponseToPayload(r: TournamentMatchesResponse): TournamentMatchListsPayload {
    return {
      liveMatches: (r.live_matches ?? []).map(m => this.mapMatch(m)),
      upcomingMatches: (r.next_matches ?? []).map(m => this.mapMatch(m)),
      pastMatches: (r.past_matches ?? []).map(m => this.mapMatch(m)),
      totalPastMatches: r.total_past_matches ?? 0,
      totalLiveMatches: r.total_live_matches ?? 0,
      totalNextMatches: r.total_next_matches ?? 0
    };
  }

  getTournamentMatchLists(): Observable<TournamentMatchListsPayload> {
    return this.getInitialTournamentMatches().pipe(map(r => this.mapResponseToPayload(r)));
  }

  loadAllPastTournamentMatchLists(): Observable<TournamentMatchListsPayload> {
    this.token = localStorage.getItem('auth_token');
    const params = new HttpParams().set('next', '5');
    return this.http
      .get<TournamentMatchesResponse>(`${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/matches`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(
        map(r => this.mapResponseToPayload(r)),
        catchError(error => {
          console.error('Error fetching all past tournament matches:', error);
          return throwError(() => new Error('Error al cargar los partidos'));
        })
      );
  }

  getLiveMatches(): Observable<LiveMatch[]> {
    return this.getTournamentMatchLists().pipe(map(p => p.liveMatches));
  }

  getUpcomingMatches(): Observable<LiveMatch[]> {
    return this.getTournamentMatchLists().pipe(map(p => p.upcomingMatches));
  }

  getPastMatches(): Observable<LiveMatch[]> {
    return this.getTournamentMatchLists().pipe(map(p => p.pastMatches));
  }

  getMatchById(matchId: string): Observable<LiveMatch | null> {
    return this.getInitialTournamentMatches().pipe(
      map(response => {
        const all = [
          ...(response.live_matches ?? []),
          ...(response.next_matches ?? []),
          ...(response.past_matches ?? [])
        ];
        const found = all.find(m => m.id === matchId);
        return found ? this.mapMatch(found) : null;
      })
    );
  }

  getMatchPredictionsByTournament(
    matchId: string,
    joinedTournaments: { id: string; name: string }[],
    currentUsername: string
  ): Observable<MatchPredictionsByTournament | null> {
    return of(null);
  }

  getUserPredictionForMatch(matchId: string, tournamentId: string): Observable<MatchScore | null> {
    return of(null);
  }

  clearCache(): void {
    this.matchesCache$ = null;
  }
}
