import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import {
  LiveMatch,
  Country,
  MatchScore
} from '../models/tournament.model';
import { IMatchService, TournamentPredictions, MatchPredictionsByTournament } from './match-service.interface';
import { EnvironmentConfig } from '../config/environment.config';
import { MockedMatchService } from './mocks/mocked-match.service';

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
  tie_quota: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
  substatus?: string;
  started_at?: string;
  finished_at?: string;
  home_goals?: number;
  away_goals?: number;
  home_penalties?: number;
  away_penalties?: number;
}

interface TournamentMatchesResponse {
  tournament_id: string;
  tournament_name: string;
  past_matches: TournamentMatchResponse[];
  live_matches: TournamentMatchResponse[];
  next_matches: TournamentMatchResponse[];
}

// Not using @Injectable since this is created via factory
export class MatchService implements IMatchService {

  private baseUrl: string;
  private token: string | null = null;
  private mock = new MockedMatchService();

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

    const result: LiveMatch = {
      id: match.id,
      matchCode: match.code,
      homeTeam: this.mapTeam(match.home_team),
      awayTeam: this.mapTeam(match.away_team),
      matchDate: match.started_at ? new Date(match.started_at) : new Date(),
      matchTime: match.substatus,
      status,
      stage: 'group_stage',
      odds: {
        home: match.home_quota,
        draw: match.tie_quota,
        away: match.away_quota
      },
      tournamentIds: [WORLD_CUP_ID]
    };

    if (match.home_goals !== undefined && match.away_goals !== undefined) {
      result.currentScore = { home: match.home_goals, away: match.away_goals };
    }

    return result;
  }

  private fetchTournamentMatches(): Observable<TournamentMatchesResponse> {
    if (!this.matchesCache$) {
      this.token = localStorage.getItem('auth_token');
      this.matchesCache$ = this.http.get<TournamentMatchesResponse>(
        `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/matches`,
        { headers: this.getAuthHeaders() }
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

  getLiveMatches(): Observable<LiveMatch[]> {
    return this.fetchTournamentMatches().pipe(
      map(response => (response.live_matches ?? []).map(m => this.mapMatch(m)))
    );
  }

  getUpcomingMatches(): Observable<LiveMatch[]> {
    return this.fetchTournamentMatches().pipe(
      map(response => (response.next_matches ?? []).map(m => this.mapMatch(m)))
    );
  }

  getPastMatches(): Observable<LiveMatch[]> {
    return this.fetchTournamentMatches().pipe(
      map(response => (response.past_matches ?? []).map(m => this.mapMatch(m)))
    );
  }

  getMatchById(matchId: string): Observable<LiveMatch | null> {
    return this.fetchTournamentMatches().pipe(
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
    return this.mock.getMatchPredictionsByTournament(matchId, joinedTournaments, currentUsername);
  }

  getUserPredictionForMatch(matchId: string, tournamentId: string): Observable<MatchScore | null> {
    return this.mock.getUserPredictionForMatch(matchId, tournamentId);
  }

  clearCache(): void {
    this.matchesCache$ = null;
    this.mock.clearCache();
  }
}
