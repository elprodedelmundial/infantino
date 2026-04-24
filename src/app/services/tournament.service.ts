import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { WORLD_CUP_ID } from './match.service';
import {
  Tournament,
  JoinedTournament,
  TournamentStandings,
  TournamentPlayer,
  PredictionResult,
  UserPredictions,
  MatchScore,
  MatchPrediction,
  MatchApiStatus,
  Country,
  Player,
  TournamentAwardPrediction,
  GroupAwardPredictionsResult,
  GroupAwardPredictionsLoadPayload,
  TournamentAwardWinners,
  MemberAwardPrediction,
  MemberPrediction,
  PlayerPositionCode,
  PLAYER_POSITION_LABELS,
  LiveMatch,
  MatchWithPredictions,
  DashboardLiveData,
  AllPredictionsData,
  GroupRole,
  AdminTournamentListItem,
  AdminTournamentDetail
} from '../models/tournament.model';
import { ITournamentService } from './tournament-service.interface';
import { TournamentPredictions, MatchPredictionsByTournament } from './match-service.interface';
import { EnvironmentConfig } from '../config/environment.config';
import { getMatchStageInfo, ALL_STAGE_INFOS } from '../utils/match-stage.utils';

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
  status?: 'PENDING' | 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'BONUS';
}

interface MatchPredictionApiResponse {
  id?: string;
  user: UserApiResponse;
  match: MatchApiResponse;
  prediction?: ScorePredictionResponse;
}

/** grondona GroupMatchPredictionsResponse: { group: GroupResponse, predictions[] } */
interface GroupPredictionsApiResponse {
  group: GroupResponse;
  predictions: MatchPredictionApiResponse[];
}

interface SubmitBulkPredictionsRequest {
  predictions: { match_id: string; home_goals: number; away_goals: number }[];
}

// API Response interfaces (snake_case matching grondona API)

/** grondona UserResponse */
interface UserResponseApi {
  id: string;
  fullname: string;
  username: string;
  email?: string;
}

/** grondona GroupStanding: { user: UserResponse, rank, points, last_predictions } */
interface GroupStandingResponse {
  user: UserResponseApi;
  rank: number;
  points: number;
  last_predictions: ('PENDING' | 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'BONUS')[];
}

interface GroupResponse {
  id: string;
  tournament_id: string;
  name: string;
  is_private: boolean;
  max_members: number;
  has_started: boolean;
  standings?: GroupStandingResponse[];
}

/** grondona UserGroupResponse: { group: GroupResponse, tournament_id, tournament_name?, member_count, points, rank, role } */
interface UserGroupResponse {
  group: GroupResponse;
  tournament_id: string;
  tournament_name?: string;
  member_count?: number;
  points: number;
  rank: number | null;
  role: string;
}

interface AwardPlayerApiResponse {
  id: string;
  name: string;
  team: TeamApiResponse;
  position?: PlayerPositionCode;
  /** Legacy API shape */
  is_goalkeeper?: boolean;
  birthdate: string;
}

interface AwardPredictionsApiResponse {
  champions: TeamApiResponse[];
  top_scorers: AwardPlayerApiResponse[];
  best_players: AwardPlayerApiResponse[];
  best_goalkeepers: AwardPlayerApiResponse[];
  best_young_players: AwardPlayerApiResponse[];
}

/**
 * grondona AwardPredictionsResponse: user + SubmittedAwardPredictionsResponse fields
 * (GET .../groups/{id}/predictions/awards → GroupAwardPredictionsResponse.predictions[])
 */
interface AwardPredictionsWithUserRow {
  user: UserResponseApi;
  champions: TeamApiResponse[];
  top_scorers: AwardPlayerApiResponse[];
  best_players: AwardPlayerApiResponse[];
  best_goalkeepers: AwardPlayerApiResponse[];
  best_young_players: AwardPlayerApiResponse[];
}

/** Legacy alternate shapes (pre-official list) */
interface GroupAwardMemberApiResponse {
  user_id?: string;
  user?: { id: string; username: string };
  username?: string;
  awards?: AwardPredictionsApiResponse;
  predictions?: AwardPredictionsApiResponse;
}

interface TournamentTeamsApiResponse {
  teams: TeamApiResponse[];
}

interface TournamentPlayersApiResponse {
  players: AwardPlayerApiResponse[];
}

/** grondona AwardsResponse: true winners published by the API (all fields are singular) */
interface AwardsApiResponse {
  champion?: TeamApiResponse;
  top_scorer?: AwardPlayerApiResponse;
  best_player?: AwardPlayerApiResponse;
  best_goalkeeper?: AwardPlayerApiResponse;
  best_young_player?: AwardPlayerApiResponse;
}

// Not using @Injectable since this is created via factory
export class TournamentService implements ITournamentService {

  private baseUrl: string;
  private token: string | null = null;
  private joinedGroupIds: string[] = [];
  private currentUsername: string = '';

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
      participantsCount: group.standings?.length ?? 0,
      maxParticipants: group.max_members,
      startDate: new Date(),
      isJoined: false,
      tournamentId: group.tournament_id,
      hasStarted: group.has_started
    };
  }

  private mapGroupToStandings(group: GroupResponse): TournamentStandings {
    const predResultMap: Record<string, PredictionResult> = {
      CORRECT: 'correct',
      PARTIAL: 'half',
      INCORRECT: 'incorrect',
      BONUS: 'bonus'
    };

    const players: TournamentPlayer[] = (group.standings ?? []).map(s => {
      const fullName = s.user.fullname?.trim();
      return {
        id: s.user.id,
        username: s.user.username,
        fullName: fullName || undefined,
        position: s.rank,
        points: s.points,
        lastPredictions: s.last_predictions
          .filter(p => p !== 'PENDING')
          .map(p => predResultMap[p] as PredictionResult),
        avatarInitials: s.user.username.substring(0, 2).toUpperCase()
      };
    });

    const currentUser = players.find(p => p.username === this.currentUsername);

    return {
      tournament: {
        ...this.mapGroupToTournament(group),
        isJoined: true,
        participantsCount: group.standings?.length ?? 0
      },
      players,
      currentUserId: currentUser?.id ?? ''
    };
  }

  private mapUserGroupToJoined(ug: UserGroupResponse): JoinedTournament {
    return {
      tournament: {
        id: ug.group.id,
        name: ug.group.name,
        participantsCount: ug.member_count ?? ug.group.standings?.length ?? 0,
        maxParticipants: ug.group.max_members,
        startDate: new Date(),
        isJoined: true,
        tournamentId: ug.tournament_id,
        hasStarted: ug.group.has_started
      },
      userRanking: ug.rank ?? null,
      userPoints: ug.points,
      role: ug.role as GroupRole
    };
  }

  setCurrentUser(username: string): void {
    this.token = localStorage.getItem('auth_token');
    this.currentUsername = username;
  }

  private mapPredictionToMatchPrediction(p: MatchPredictionApiResponse): MatchPrediction {
    const m = p.match;
    const pred = p.prediction;
    const resultMap: Record<string, PredictionResult> = {
      CORRECT: 'correct',
      PARTIAL: 'half',
      INCORRECT: 'incorrect',
      BONUS: 'bonus'
    };
    const status = pred?.status;
    const stageInfo = getMatchStageInfo(m.code ?? '');
    return {
      id: m.id,
      matchCode: m.code ?? '',
      homeTeam: { code: m.home_team.code, name: m.home_team.name, flagUrl: m.home_team.icon },
      awayTeam: { code: m.away_team.code, name: m.away_team.name, flagUrl: m.away_team.icon },
      predictedScore: {
        home: pred?.home_goals ?? 0,
        away: pred?.away_goals ?? 0
      },
      hasPrediction: pred != null,
      actualScore: (m.home_goals !== undefined && m.away_goals !== undefined)
        ? { home: m.home_goals, away: m.away_goals }
        : undefined,
      isPlayed: m.status === 'FINISHED',
      matchStatus: m.status,
      matchDate: m.started_at ? new Date(m.started_at) : new Date(0),
      result: status && status !== 'PENDING' ? resultMap[status] : undefined,
      stage: stageInfo.stage,
      group: stageInfo.group,
      odds: (m.home_quota !== undefined)
        ? { home: m.home_quota, draw: m.tie_quota ?? 0, away: m.away_quota ?? 0 }
        : undefined
    };
  }

  private mapToPredictionsMember(p: MatchPredictionApiResponse): MemberPrediction {
    const pred = p.prediction;
    const username = p.user.username;
    const fullName = p.user.fullname?.trim();
    return {
      oddsId: p.id ?? `${p.user.id}-${p.match.id}`,
      username,
      fullName: fullName || undefined,
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
        this.joinedGroupIds = groups.map(g => g.group.id);
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

  getTournamentStandings(groupId: string, live: boolean = false): Observable<TournamentStandings | null> {
    this.token = localStorage.getItem('auth_token');
    const params = new HttpParams().set('live', String(live));
    return this.http.get<GroupResponse>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}`,
      { headers: this.getAuthHeaders(), params }
    ).pipe(
      map(response => this.mapGroupToStandings(response)),
      catchError(error => {
        console.error('Get group standings error:', error);
        return of(null);
      })
    );
  }

  private mapTeamToCountry(t: TeamApiResponse): Country {
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      flagUrl: t.icon
    };
  }

  private mapAwardPlayerToPlayer(p: AwardPlayerApiResponse): Player {
    const code: PlayerPositionCode =
      p.position ??
      (p.is_goalkeeper ? 'GOALKEEPER' : 'MIDFIELDER');
    return {
      id: p.id,
      name: p.name,
      country: this.mapTeamToCountry(p.team),
      position: PLAYER_POSITION_LABELS[code] ?? code,
      positionCode: code,
      birthdate: p.birthdate
    };
  }

  private mapAwardsApiToWinners(a: AwardsApiResponse): TournamentAwardWinners {
    return {
      champion: a.champion ? this.mapTeamToCountry(a.champion) : null,
      goldenBall: a.best_player ? this.mapAwardPlayerToPlayer(a.best_player) : null,
      goldenBoot: a.top_scorer ? this.mapAwardPlayerToPlayer(a.top_scorer) : null,
      goldenGlove: a.best_goalkeeper ? this.mapAwardPlayerToPlayer(a.best_goalkeeper) : null,
      bestYoungPlayer: a.best_young_player ? this.mapAwardPlayerToPlayer(a.best_young_player) : null
    };
  }

  private emptyAwardApiResponse(): AwardPredictionsApiResponse {
    return {
      champions: [],
      top_scorers: [],
      best_players: [],
      best_goalkeepers: [],
      best_young_players: []
    };
  }

  /** Accepts root body or nested { awards | predictions | data } from API variants */
  private normalizeAwardPredictionsPayload(body: unknown): AwardPredictionsApiResponse {
    if (!body || typeof body !== 'object') return this.emptyAwardApiResponse();
    const o = body as Record<string, unknown>;
    const inner = (o['awards'] ?? o['predictions'] ?? o['award_predictions'] ?? o['data'] ?? o) as unknown;
    if (!inner || typeof inner !== 'object') return this.emptyAwardApiResponse();
    const a = inner as Record<string, unknown>;
    if (
      Array.isArray(a['champions']) ||
      Array.isArray(a['best_players']) ||
      Array.isArray(a['top_scorers'])
    ) {
      return inner as AwardPredictionsApiResponse;
    }
    return this.emptyAwardApiResponse();
  }

  private mapAwardResponseToPredictions(r: AwardPredictionsApiResponse): TournamentAwardPrediction {
    return {
      champion: (r.champions ?? []).map(t => this.mapTeamToCountry(t)),
      goldenBall: (r.best_players ?? []).map(p => this.mapAwardPlayerToPlayer(p)),
      goldenBoot: (r.top_scorers ?? []).map(p => this.mapAwardPlayerToPlayer(p)),
      goldenGlove: (r.best_goalkeepers ?? []).map(p => this.mapAwardPlayerToPlayer(p)),
      bestYoungPlayer: (r.best_young_players ?? []).map(p => this.mapAwardPlayerToPlayer(p))
    };
  }

  private emptyTournamentAwardPrediction(): TournamentAwardPrediction {
    return this.mapAwardResponseToPredictions(this.emptyAwardApiResponse());
  }

  private isAwardPredictionsWithUserRow(item: unknown): item is AwardPredictionsWithUserRow {
    if (!item || typeof item !== 'object') return false;
    const r = item as Record<string, unknown>;
    const u = r['user'];
    if (!u || typeof u !== 'object') return false;
    const user = u as Record<string, unknown>;
    return typeof user['id'] === 'string' && typeof user['username'] === 'string';
  }

  /**
   * grondona GroupAwardPredictionsResponse: { group_id, group_name, predictions: AwardPredictionsResponse[] }
   */
  private parseOfficialGroupAwardPredictionRows(body: unknown): AwardPredictionsWithUserRow[] {
    if (!body || typeof body !== 'object') return [];
    const o = body as Record<string, unknown>;
    const preds = o['predictions'];
    if (!Array.isArray(preds) || preds.length === 0) return [];
    if (!this.isAwardPredictionsWithUserRow(preds[0])) return [];
    return preds as AwardPredictionsWithUserRow[];
  }

  private rowToMemberAwardPrediction(row: AwardPredictionsWithUserRow): MemberAwardPrediction {
    const u = row.user;
    const label = u.username || u.fullname || '??';
    const fullName = u.fullname?.trim();
    return {
      userId: u.id,
      username: u.username,
      fullName: fullName || undefined,
      avatarInitials: label.substring(0, 2).toUpperCase(),
      predictions: this.mapAwardResponseToPredictions({
        champions: row.champions ?? [],
        top_scorers: row.top_scorers ?? [],
        best_players: row.best_players ?? [],
        best_goalkeepers: row.best_goalkeepers ?? [],
        best_young_players: row.best_young_players ?? []
      })
    };
  }

  private orderMembersByStandings(
    members: MemberAwardPrediction[],
    standings: TournamentStandings | null
  ): MemberAwardPrediction[] {
    if (!standings?.players?.length) return members;
    const rank = new Map(standings.players.map((p, i) => [p.id, i]));
    return [...members].sort((a, b) => {
      const ia = rank.get(a.userId) ?? 9999;
      const ib = rank.get(b.userId) ?? 9999;
      return ia - ib;
    });
  }

  /** Legacy: arrays not using official `predictions`+`user` rows (do not read `predictions` key — reserved for GroupAwardPredictionsResponse) */
  private parseLegacyGroupAwardMemberEntries(body: unknown): GroupAwardMemberApiResponse[] {
    if (Array.isArray(body)) return body as GroupAwardMemberApiResponse[];
    if (body && typeof body === 'object') {
      const o = body as Record<string, unknown>;
      const arr =
        o['members'] ?? o['group_awards'] ?? o['users'] ?? o['data'] ?? o['awards'];
      if (Array.isArray(arr)) return arr as GroupAwardMemberApiResponse[];
    }
    return [];
  }

  private mapGroupAwardMembersToMeOthers(
    entries: GroupAwardMemberApiResponse[],
    currentUserId: string,
    currentUsername: string
  ): GroupAwardPredictionsResult {
    const uid = (e: GroupAwardMemberApiResponse) => e.user_id ?? e.user?.id ?? '';
    const uname = (e: GroupAwardMemberApiResponse) =>
      (e.username ?? e.user?.username ?? '').toLowerCase();

    let meEntry: GroupAwardMemberApiResponse | undefined;
    if (currentUserId) {
      meEntry = entries.find(e => uid(e) === currentUserId);
    }
    if (!meEntry && currentUsername) {
      meEntry = entries.find(e => uname(e) === currentUsername.toLowerCase());
    }

    const rawMe =
      meEntry?.awards ?? meEntry?.predictions ?? this.emptyAwardApiResponse();
    const me = this.mapAwardResponseToPredictions(rawMe);

    const others = entries
      .filter(e => e !== meEntry)
      .map(e =>
        this.mapAwardResponseToPredictions(
          e.awards ?? e.predictions ?? this.emptyAwardApiResponse()
        )
      );

    return { me, others };
  }

  private mapPredictionsToSubmitPayload(p: TournamentAwardPrediction): Record<string, string[]> {
    const teamId = (c: Country) => c.id ?? '';
    const playerId = (pl: Player) => pl.id;
    return {
      champions: p.champion.map(teamId).filter(Boolean),
      top_scorers: p.goldenBoot.map(playerId),
      best_players: p.goldenBall.map(playerId),
      best_goalkeepers: p.goldenGlove.map(playerId),
      best_young_players: p.bestYoungPlayer.map(playerId)
    };
  }

  /** Current user's match predictions for the group (Mis Predicciones / edit) */
  private fetchUserMatchPredictionsMe(groupId: string): Observable<GroupPredictionsApiResponse> {
    this.token = localStorage.getItem('auth_token');
    return this.http.get<GroupPredictionsApiResponse>(
      `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions/matches/me`,
      { headers: this.getAuthHeaders() }
    );
  }

  getAllPredictions(groupId: string): Observable<AllPredictionsData> {
    return this.fetchUserMatchPredictionsMe(groupId).pipe(
      map(response => {
        const matches = response.predictions.map(p => this.mapPredictionToMatchPrediction(p));
        // Build stage list from matches present in the response
        const stageMatchCounts = new Map<string, number>();
        const stageHasStarted = new Map<string, boolean>();
        for (const m of matches) {
          stageMatchCounts.set(m.stage, (stageMatchCounts.get(m.stage) ?? 0) + 1);
          if (m.isPlayed || m.matchStatus === 'IN_PROGRESS') {
            stageHasStarted.set(m.stage, true);
          } else {
            stageHasStarted.set(m.stage, stageHasStarted.get(m.stage) ?? false);
          }
        }
        const stages = ALL_STAGE_INFOS.map(s => ({
          ...s,
          matchCount: stageMatchCounts.get(s.id) ?? 0,
          hasStarted: stageHasStarted.get(s.id) ?? false
        }));
        return { matches, stages };
      }),
      catchError(error => {
        console.error('Get predictions error:', error);
        return of({ matches: [], stages: [] });
      })
    );
  }

  getUserPredictions(groupId: string): Observable<UserPredictions> {
    return this.fetchUserMatchPredictionsMe(groupId).pipe(
      map(response => {
        const all = response.predictions.map(p => this.mapPredictionToMatchPrediction(p));
        return {
          pastPredictions: all.filter(m => m.isPlayed || m.matchStatus === 'IN_PROGRESS'),
          upcomingPredictions: all.filter(m => !m.isPlayed && m.matchStatus !== 'IN_PROGRESS')
        };
      }),
      catchError(error => {
        console.error('Get user predictions error:', error);
        return of({ pastPredictions: [], upcomingPredictions: [] });
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
        tournamentId: response.group.id,
        tournamentName: response.group.name,
        predictions: response.predictions.map(p => this.mapToPredictionsMember(p))
      })),
      catchError(error => {
        console.error('Get match group predictions error:', error);
        return of(null);
      })
    );
  }

  getCountriesForAwards(tournamentId: string): Observable<Country[]> {
    return this.http
      .get<TournamentTeamsApiResponse>(`${this.baseUrl}/api/tournaments/${tournamentId}/teams`, {
        headers: this.getAuthHeaders()
      })
      .pipe(
        map(r => r.teams.map(t => this.mapTeamToCountry(t))),
        catchError(error => {
          console.error('Get tournament teams error:', error);
          return of([]);
        })
      );
  }

  getTournamentPlayersForAwards(tournamentId: string): Observable<Player[]> {
    return this.http
      .get<TournamentPlayersApiResponse>(`${this.baseUrl}/api/tournaments/${tournamentId}/players`, {
        headers: this.getAuthHeaders()
      })
      .pipe(
        map(r => r.players.map(p => this.mapAwardPlayerToPlayer(p))),
        catchError(error => {
          console.error('Get tournament players error:', error);
          return of([]);
        })
      );
  }

  getMyAwardPredictions(groupId: string): Observable<TournamentAwardPrediction> {
    this.token = localStorage.getItem('auth_token');
    return this.http
      .get<unknown>(
        `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions/awards/me`,
        { headers: this.getAuthHeaders() }
      )
      .pipe(
        map(body => this.mapAwardResponseToPredictions(this.normalizeAwardPredictionsPayload(body))),
        catchError(error => {
          console.error('Get my award predictions error:', error);
          return of(this.emptyTournamentAwardPrediction());
        })
      );
  }

  getGroupAwardPredictions(groupId: string): Observable<GroupAwardPredictionsLoadPayload> {
    this.token = localStorage.getItem('auth_token');
    return forkJoin({
      standings: this.getTournamentStandings(groupId).pipe(catchError(() => of(null))),
      body: this.http.get<unknown>(
        `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions/awards`,
        { headers: this.getAuthHeaders() }
      )
    }).pipe(
      map(({ standings, body }) => {
        const rawAwards = body && typeof body === 'object'
          ? (body as Record<string, unknown>)['winners'] as AwardsApiResponse | undefined
          : undefined;
        const trueWinners: TournamentAwardWinners | null = rawAwards
          ? this.mapAwardsApiToWinners(rawAwards)
          : null;

        const officialRows = this.parseOfficialGroupAwardPredictionRows(body);
        if (officialRows.length > 0) {
          const membersUnordered = officialRows.map(r => this.rowToMemberAwardPrediction(r));
          const members = this.orderMembersByStandings(membersUnordered, standings);
          const currentId = standings?.currentUserId ?? '';
          const meMember =
            members.find(m => m.userId === currentId) ??
            members.find(
              m => m.username.toLowerCase() === this.currentUsername.toLowerCase()
            );
          const me = meMember?.predictions ?? this.emptyTournamentAwardPrediction();
          const others = members
            .filter(m => m.userId !== meMember?.userId)
            .map(m => m.predictions);
          return { members, awards: { me, others }, standings, trueWinners };
        }

        if (body && typeof body === 'object' && 'me' in (body as object)) {
          const o = body as Record<string, unknown>;
          const meRaw = this.normalizeAwardPredictionsPayload(o['me']);
          const othersRaw = Array.isArray(o['others']) ? o['others'] : [];
          return {
            members: [],
            awards: {
              me: this.mapAwardResponseToPredictions(meRaw),
              others: othersRaw.map(x =>
                this.mapAwardResponseToPredictions(this.normalizeAwardPredictionsPayload(x))
              )
            },
            standings,
            trueWinners
          };
        }

        const entries = this.parseLegacyGroupAwardMemberEntries(body);
        const awards = this.mapGroupAwardMembersToMeOthers(
          entries,
          standings?.currentUserId ?? '',
          this.currentUsername
        );
        return { members: [], awards, standings, trueWinners };
      }),
      catchError(error => {
        console.error('Get group award predictions error:', error);
        const empty = this.emptyTournamentAwardPrediction();
        return of({ members: [], awards: { me: empty, others: [] }, standings: null, trueWinners: null });
      })
    );
  }

  saveAwardPredictions(groupId: string, predictions: TournamentAwardPrediction): Observable<boolean> {
    this.token = localStorage.getItem('auth_token');
    const body = this.mapPredictionsToSubmitPayload(predictions);
    return this.http
      .post<AwardPredictionsApiResponse>(
        `${this.baseUrl}/api/tournaments/${WORLD_CUP_ID}/groups/${groupId}/predictions/awards`,
        body,
        { headers: this.getAuthHeaders() }
      )
      .pipe(
        map(() => true),
        catchError(error => {
          console.error('Post award predictions error:', error);
          return of(false);
        })
      );
  }

  getDashboardLiveData(): Observable<DashboardLiveData> {
    return of({ liveMatches: [], upcomingMatches: [] });
  }

  getMemberPredictions(matchId: string, tournamentId?: string): Observable<MatchWithPredictions | null> {
    return of(null);
  }

  getLiveMatchesForTournament(tournamentId: string): Observable<LiveMatch[]> {
    return of([]);
  }

  /** GET /api/tournaments — superuser; falls back to Mundial if the route is missing. */
  getAdminTournaments(): Observable<AdminTournamentListItem[]> {
    this.token = localStorage.getItem('auth_token');
    return this.http
      .get<unknown>(`${this.baseUrl}/api/tournaments`, { headers: this.getAuthHeaders() })
      .pipe(
        map(body => this.parseAdminTournamentList(body)),
        catchError(() =>
          of<AdminTournamentListItem[]>([{ id: WORLD_CUP_ID, name: 'Copa del Mundo 2026' }])
        )
      );
  }

  /** GET /api/tournaments/{id} — name, status, published awards. */
  getAdminTournamentDetail(tournamentId: string): Observable<AdminTournamentDetail | null> {
    this.token = localStorage.getItem('auth_token');
    return this.http
      .get<unknown>(`${this.baseUrl}/api/tournaments/${tournamentId}`, { headers: this.getAuthHeaders() })
      .pipe(
        map(body => this.parseAdminTournamentDetail(body, tournamentId)),
        catchError(error => {
          console.error('Get admin tournament detail error:', error);
          return of(null);
        })
      );
  }

  /**
   * PATCH /api/tournaments/{id} — grondona updateTournament (name, status, awards as entity ids).
   */
  patchAdminTournament(
    tournamentId: string,
    payload: { name: string; status: string; winners: TournamentAwardWinners }
  ): Observable<boolean> {
    this.token = localStorage.getItem('auth_token');
    const w = payload.winners;
    const hasAnyAward =
      Boolean(w.champion?.id) ||
      Boolean(w.goldenBoot?.id) ||
      Boolean(w.goldenBall?.id) ||
      Boolean(w.goldenGlove?.id) ||
      Boolean(w.bestYoungPlayer?.id);

    const body: Record<string, unknown> = {
      name: payload.name,
      status: payload.status,
      awards: hasAnyAward
        ? {
            champion: w.champion?.id ?? null,
            top_scorer: w.goldenBoot?.id ?? null,
            best_player: w.goldenBall?.id ?? null,
            best_goalkeeper: w.goldenGlove?.id ?? null,
            best_young_player: w.bestYoungPlayer?.id ?? null
          }
        : null
    };
    return this.http
      .patch(`${this.baseUrl}/api/tournaments/${tournamentId}`, body, { headers: this.getAuthHeaders() })
      .pipe(
        map(() => true),
        catchError(error => {
          console.error('Patch admin tournament error:', error);
          return throwError(
            () =>
              new Error(
                typeof error?.error?.message === 'string'
                  ? error.error.message
                  : 'No se pudo actualizar el torneo'
              )
          );
        })
      );
  }

  private parseAdminTournamentList(body: unknown): AdminTournamentListItem[] {
    const raw = Array.isArray(body)
      ? body
      : body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>)['tournaments'])
        ? (body as { tournaments: unknown[] }).tournaments
        : body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>)['data'])
          ? (body as { data: unknown[] }).data
          : null;
    if (!raw?.length) {
      return [{ id: WORLD_CUP_ID, name: 'Copa del Mundo 2026' }];
    }
    return raw.map((r: unknown) => {
      const o = r as Record<string, unknown>;
      return {
        id: String(o['id'] ?? WORLD_CUP_ID),
        name: String(o['name'] ?? 'Torneo'),
        status: o['status'] != null ? String(o['status']) : undefined
      };
    });
  }

  private parseAdminTournamentDetail(body: unknown, fallbackId: string): AdminTournamentDetail | null {
    if (!body || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const id = String(o['id'] ?? fallbackId);
    const name = String(o['name'] ?? '');
    let status = o['status'] != null ? String(o['status']) : '';
    if (!status && typeof o['has_started'] === 'boolean') {
      status = o['has_started'] ? 'IN_PROGRESS' : 'NOT_STARTED';
    }
    if (!status) status = 'NOT_STARTED';
    const rawAwards = o['awards'] as AwardsApiResponse | undefined;
    const awardWinners = rawAwards ? this.mapAwardsApiToWinners(rawAwards) : null;
    return { id, name, status, awardWinners };
  }
}
