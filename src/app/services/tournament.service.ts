import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  Tournament,
  JoinedTournament,
  TournamentStandings,
  UserPredictions,
  MatchScore,
  Country,
  Player,
  TournamentAwardPrediction,
  LiveMatch,
  MatchWithPredictions,
  DashboardLiveData,
  AllPredictionsData
} from '../models/tournament.model';
import { ITournamentService } from './tournament-service.interface';
import { EnvironmentConfig } from '../config/environment.config';

// API Response interfaces (snake_case matching grondona API)
interface GroupResponse {
  id: string;
  name: string;
  private: boolean;
  max_members: number;
  created_at: string;
  updated_at: string;
}

interface UserGroupResponse {
  group_id: string;
  name: string;
  member_count: number;
  joined_at: string;
  points: number;
}

// Not using @Injectable since this is created via factory
export class TournamentService implements ITournamentService {

  private baseUrl: string;
  private token: string | null = null;
  private joinedGroupIds: string[] = [];

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
      startDate: new Date(group.created_at),
      isJoined: false
    };
  }

  private mapUserGroupToJoined(ug: UserGroupResponse): JoinedTournament {
    return {
      tournament: {
        id: ug.group_id,
        name: ug.name,
        participantsCount: ug.member_count,
        maxParticipants: 0,
        startDate: new Date(ug.joined_at),
        isJoined: true
      },
      userRanking: 0,
      userPoints: ug.points
    };
  }

  setCurrentUser(username: string): void {
    // Refresh token from storage in case login happened
    this.token = localStorage.getItem('auth_token');
  }

  getAvailableTournaments(): Observable<Tournament[]> {
    const params = new HttpParams().set('joined', 'false');
    return this.http.get<GroupResponse[]>(`${this.baseUrl}/api/groups`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      map(groups => groups.map(g => this.mapGroupToTournament(g))),
      catchError(error => {
        console.error('Get available groups error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to get available groups'));
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
        return throwError(() => new Error(error.error?.message || 'Failed to get joined groups'));
      })
    );
  }

  joinTournament(tournamentId: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.baseUrl}/api/groups/${tournamentId}/join`,
      null,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        this.joinedGroupIds = [...this.joinedGroupIds, tournamentId];
      }),
      map(() => true),
      catchError(error => {
        console.error('Join group error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to join group'));
      })
    );
  }

  leaveTournament(tournamentId: string): Observable<boolean> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/groups/${tournamentId}/leave`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        this.joinedGroupIds = this.joinedGroupIds.filter(id => id !== tournamentId);
      }),
      map(() => true),
      catchError(error => {
        console.error('Leave group error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to leave group'));
      })
    );
  }

  getTournamentById(tournamentId: string): Observable<Tournament | null> {
    return this.http.get<GroupResponse>(
      `${this.baseUrl}/api/groups/${tournamentId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(group => this.mapGroupToTournament(group)),
      catchError(error => {
        console.error('Get group error:', error);
        return of(null);
      })
    );
  }

  getJoinedTournamentIds(): string[] {
    return this.joinedGroupIds;
  }

  // Methods below are not yet available in the grondona API
  getTournamentStandings(tournamentId: string): Observable<TournamentStandings | null> {
    return of(null);
  }

  getUserPredictions(tournamentId: string): Observable<UserPredictions> {
    return of({ pastPredictions: [], upcomingPredictions: [] });
  }

  getAllPredictions(tournamentId: string): Observable<AllPredictionsData> {
    return of({ matches: [], stages: [] });
  }

  updatePrediction(tournamentId: string, matchId: string, newScore: MatchScore): Observable<boolean> {
    return of(false);
  }

  updateMultiplePredictions(
    tournamentId: string,
    updates: { matchId: string; score: MatchScore }[]
  ): Observable<boolean> {
    return of(false);
  }

  getCountriesForAwards(): Observable<Country[]> {
    return of([]);
  }

  getPlayersForAwards(): Observable<Player[]> {
    return of([]);
  }

  getGoalkeepersForAwards(): Observable<Player[]> {
    return of([]);
  }

  getYoungPlayersForAwards(): Observable<Player[]> {
    return of([]);
  }

  getUserAwardPredictions(tournamentId: string): Observable<TournamentAwardPrediction | null> {
    return of(null);
  }

  saveAwardPredictions(tournamentId: string, predictions: TournamentAwardPrediction): Observable<boolean> {
    return of(false);
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
}
