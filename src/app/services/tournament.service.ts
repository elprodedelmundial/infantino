import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { WORLD_CUP_ID } from './match.service';
import {
  Tournament,
  JoinedTournament,
  TournamentStandings,
  UserPredictions,
  MatchScore,
  MatchPrediction,
  MatchApiStatus,
  Country,
  Player,
  TournamentAwardPrediction,
  LiveMatch,
  MatchWithPredictions,
  DashboardLiveData,
  AllPredictionsData,
  GroupRole
} from '../models/tournament.model';
import { ITournamentService } from './tournament-service.interface';
import { TournamentPredictions, MatchPredictionsByTournament } from './match-service.interface';
import { MemberPrediction } from '../models/tournament.model';
import { EnvironmentConfig } from '../config/environment.config';
import { MockedTournamentService } from './mocks/mocked-tournament.service';

// Prediction API response interfaces
interface TeamApiResponse {
  id: string;
  name: string;
  code: string;
  icon: string;
}

interface MatchApiResponse {
  id: string;
  code?: string;
  home_team: TeamApiResponse;
  away_team: TeamApiResponse;
  home_quota?: number;
  away_quota?: number;
  tie_quota?: number;
  status: MatchApiStatus;
  substatus?: string;
  started_at?: string;
  home_goals?: number;
  away_goals?: number;
}

interface UserApiResponse {
  id: string;
  username: string;
  fullname: string;
  email: string;
}

interface ScorePredictionResponse {
  home_goals: number;
  away_goals: number;
  status?: 'PENDING' | 'CORRECT' | 'PARTIAL' | 'INCORRECT';
}

interface MatchPredictionApiResponse {
  id?: string;
  user: UserApiResponse;
  match: MatchApiResponse;
  prediction?: ScorePredictionResponse;
}

interface GroupPredictionsApiResponse {
  group_id: string;
  group_name: string;
  predictions: MatchPredictionApiResponse[];
}

interface SubmitBulkPredictionsRequest {
  predictions: { match_id: string; home_goals: number; away_goals: number }[];
}

// API Response interfaces (snake_case matching grondona API)
interface GroupResponse {
  id: string;
  tournament_id: string;
  name: string;
  is_private: boolean;
  max_members: number;
}

interface UserGroupResponse {
  group_id: string;
  group_name?: string;
  name?: string;
  tournament_id: string;
  tournament_name?: string;
  member_count: number;
  points: number;
  rank: number | null;
  role: string;
}

// Not using @Injectable since this is created via factory
export class TournamentService implements ITournamentService {

  private baseUrl: string;
  private token: string | null = null;
  private joinedGroupIds: string[] = [];
  private currentUsername: string = '';

  // Delegate methods not yet in the grondona API to the mock for realistic data
  private mock = new MockedTournamentService();

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

  private mapGroupToTournament(group: GroupResponse): Tournament {
    return {
      id: group.id,
      name: group.name,
      participantsCount: 0,
      maxParticipants: group.max_members,
      startDate: new Date(),
      isJoined: false,
      tournamentId: group.tournament_id
    };
  }

  private mapUserGroupToJoined(ug: UserGroupResponse): JoinedTournament {
    return {
      tournament: {
        id: ug.group_id,
        name: ug.group_name ?? ug.name ?? '',
        participantsCount: ug.member_count,
        maxParticipants: 0,
        startDate: new Date(),
        isJoined: true,
        tournamentId: ug.tournament_id
      },
      userRanking: ug.rank ?? null,
      userPoints: ug.points,
      role: ug.role as GroupRole
    };
  }

  setCurrentUser(username: string): void {
    this.token = localStorage.getItem('auth_token');
    this.currentUsername = username;
    this.mock.setCurrentUser(username);
  }

  private mapPredictionToMatchPrediction(p: MatchPredictionApiResponse): MatchPrediction {
    const m = p.match;
    const pred = p.prediction;
    const resultMap: Record<string, 'correct' | 'half' | 'incorrect'> = {
      CORRECT: 'correct',
      PARTIAL: 'half',
      INCORRECT: 'incorrect'
    };
    const status = pred?.status;
    return {
      id: m.id,
      matchCode: m.code ?? '',
      homeTeam: { code: m.home_team.code, name: m.home_team.name, flagUrl: m.home_team.icon },
      awayTeam: { code: m.away_team.code, name: m.away_team.name, flagUrl: m.away_team.icon },
      predictedScore: {
        home: pred?.home_goals ?? 0,
        away: pred?.away_goals ?? 0
      },
      actualScore: (m.home_goals !== undefined && m.away_goals !== undefined)
        ? { home: m.home_goals, away: m.away_goals }
        : undefined,
      isPlayed: m.status === 'FINISHED',
      matchStatus: m.status,
      matchDate: m.started_at ? new Date(m.started_at) : new Date(0),
      result: status && status !== 'PENDING' ? resultMap[status] : undefined,
      stage: 'group_stage',
      odds: (m.home_quota !== undefined)
        ? { home: m.home_quota, draw: m.tie_quota ?? 0, away: m.away_quota ?? 0 }
        : undefined
    };
  }

  private mapToPredictionsMember(p: MatchPredictionApiResponse): MemberPrediction {
    const pred = p.prediction;
    const username = p.user.username;
    return {
      oddsId: p.id ?? `${p.user.id}-${p.match.id}`,
      username,
      avatarInitials: username.substring(0, 2).toUpperCase(),
      predictedScore: {
        home: pred?.home_goals ?? 0,
        away: pred?.away_goals ?? 0
      },
      isCurrentUser: username === this.currentUsername,
      predictionStatus: pred?.status ?? 'PENDING'
    };
  }

  getAvailableTournaments(): Observable<Tournament[]> {
    const params = new HttpParams().set('joined', 'false');
    return this.http.get<GroupResponse[]>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups`,
      { headers: this.getAuthHeaders(), params }
    ).pipe(
      map(groups => groups.map(g => this.mapGroupToTournament(g))),
      catchError(error => {
        console.error('Get available groups error:', error);
        return throwError(() => new Error('Error al obtener los grupos disponibles'));
      })
    );
  }

  getJoinedTournaments(): Observable<JoinedTournament[]> {
    return this.http.get<UserGroupResponse[]>(`${this.baseUrl}/api/users/me/groups`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(groups => {
        this.joinedGroupIds = groups.map(g => g.group_id);
      }),
      map(groups => groups.map(g => this.mapUserGroupToJoined(g))),
      catchError(error => {
        console.error('Get joined groups error:', error);
        return throwError(() => new Error('Error al obtener tus grupos'));
      })
    );
  }

  joinTournament(groupId: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/join`,
      null,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        this.joinedGroupIds = [...this.joinedGroupIds, groupId];
      }),
      map(() => true),
      catchError(error => {
        console.error('Join group error:', error);
        if (error.status === 400) return throwError(() => new Error('Ya eres miembro de este grupo o el grupo está lleno'));
        return throwError(() => new Error('Error al unirse al grupo'));
      })
    );
  }

  leaveTournament(groupId: string): Observable<boolean> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/leave`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        this.joinedGroupIds = this.joinedGroupIds.filter(id => id !== groupId);
      }),
      map(() => true),
      catchError(error => {
        console.error('Leave group error:', error);
        return throwError(() => new Error('Error al abandonar el grupo'));
      })
    );
  }

  getTournamentById(groupId: string): Observable<Tournament | null> {
    return this.http.get<GroupResponse>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(group => this.mapGroupToTournament(group)),
      catchError(error => {
        console.error('Get group error:', error);
        return of(null);
      })
    );
  }

  updateGroup(groupId: string, update: { name?: string; maxMembers?: number; isPrivate?: boolean }): Observable<boolean> {
    const body: Record<string, unknown> = {};
    if (update.name !== undefined) body['name'] = update.name;
    if (update.maxMembers !== undefined) body['max_members'] = update.maxMembers;
    if (update.isPrivate !== undefined) body['is_private'] = update.isPrivate;

    return this.http.patch<GroupResponse>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}`,
      body,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Update group error:', error);
        if (error.status === 409) return throwError(() => new Error('Nombre de grupo ya registrado'));
        return throwError(() => new Error('Error al actualizar el grupo'));
      })
    );
  }

  getJoinedTournamentIds(): string[] {
    return this.joinedGroupIds;
  }

  // Methods below are not yet in the grondona API — delegate to mock for realistic UI data
  getTournamentStandings(tournamentId: string): Observable<TournamentStandings | null> {
    return this.mock.getTournamentStandings(tournamentId);
  }

  private fetchGroupPredictions(groupId: string): Observable<GroupPredictionsApiResponse> {
    this.token = localStorage.getItem('auth_token');
    return this.http.get<GroupPredictionsApiResponse>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions`,
      { headers: this.getAuthHeaders() }
    );
  }

  getAllPredictions(groupId: string): Observable<AllPredictionsData> {
    return this.fetchGroupPredictions(groupId).pipe(
      map(response => {
        const matches = response.predictions.map(p => this.mapPredictionToMatchPrediction(p));
        return {
          matches,
          stages: [{ id: 'group_stage' as const, name: 'Fase de Grupos', order: 1, hasStarted: true, matchCount: matches.length }]
        };
      }),
      catchError(error => {
        console.error('Get predictions error:', error);
        return this.mock.getAllPredictions(groupId);
      })
    );
  }

  getUserPredictions(groupId: string): Observable<UserPredictions> {
    return this.fetchGroupPredictions(groupId).pipe(
      map(response => {
        const all = response.predictions.map(p => this.mapPredictionToMatchPrediction(p));
        return {
          pastPredictions: all.filter(m => m.isPlayed || m.matchStatus === 'IN_PROGRESS'),
          upcomingPredictions: all.filter(m => !m.isPlayed && m.matchStatus !== 'IN_PROGRESS')
        };
      }),
      catchError(error => {
        console.error('Get user predictions error:', error);
        return this.mock.getUserPredictions(groupId);
      })
    );
  }

  updatePrediction(groupId: string, matchId: string, newScore: MatchScore): Observable<boolean> {
    this.token = localStorage.getItem('auth_token');
    const body = { match_id: matchId, home_goals: newScore.home, away_goals: newScore.away };
    return this.http.post<void>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions/matches/${matchId}`,
      body,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Update prediction error:', error);
        if (error.status === 400) return throwError(() => new Error('El partido ya ha comenzado o está bloqueado'));
        if (error.status === 403) return throwError(() => new Error('No perteneces a este grupo'));
        return throwError(() => new Error('Error al guardar la predicción'));
      })
    );
  }

  updateMultiplePredictions(
    groupId: string,
    updates: { matchId: string; score: MatchScore }[]
  ): Observable<boolean> {
    this.token = localStorage.getItem('auth_token');
    const body: SubmitBulkPredictionsRequest = {
      predictions: updates.map(u => ({
        match_id: u.matchId,
        home_goals: u.score.home,
        away_goals: u.score.away
      }))
    };
    return this.http.post<void>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions`,
      body,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Bulk update predictions error:', error);
        if (error.status === 400) return throwError(() => new Error('Algunos partidos ya están bloqueados'));
        if (error.status === 403) return throwError(() => new Error('No perteneces a este grupo'));
        return throwError(() => new Error('Error al guardar las predicciones'));
      })
    );
  }

  getMatchGroupPredictions(groupId: string, matchId: string): Observable<TournamentPredictions | null> {
    this.token = localStorage.getItem('auth_token');
    return this.http.get<GroupPredictionsApiResponse>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions/matches/${matchId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => ({
        tournamentId: groupId,
        tournamentName: response.group_name,
        predictions: response.predictions.map(p => this.mapToPredictionsMember(p))
      })),
      catchError(error => {
        console.error('Get match group predictions error:', error);
        return of(null);
      })
    );
  }

  getCountriesForAwards(): Observable<Country[]> {
    return this.mock.getCountriesForAwards();
  }

  getPlayersForAwards(): Observable<Player[]> {
    return this.mock.getPlayersForAwards();
  }

  getGoalkeepersForAwards(): Observable<Player[]> {
    return this.mock.getGoalkeepersForAwards();
  }

  getYoungPlayersForAwards(): Observable<Player[]> {
    return this.mock.getYoungPlayersForAwards();
  }

  getUserAwardPredictions(tournamentId: string): Observable<TournamentAwardPrediction | null> {
    return this.mock.getUserAwardPredictions(tournamentId);
  }

  saveAwardPredictions(tournamentId: string, predictions: TournamentAwardPrediction): Observable<boolean> {
    return this.mock.saveAwardPredictions(tournamentId, predictions);
  }

  getDashboardLiveData(): Observable<DashboardLiveData> {
    return this.mock.getDashboardLiveData();
  }

  getMemberPredictions(matchId: string, tournamentId?: string): Observable<MatchWithPredictions | null> {
    return this.mock.getMemberPredictions(matchId, tournamentId);
  }

  getLiveMatchesForTournament(tournamentId: string): Observable<LiveMatch[]> {
    return this.mock.getLiveMatchesForTournament(tournamentId);
  }
}
