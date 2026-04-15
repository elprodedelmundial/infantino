import { Observable, of, delay } from 'rxjs';
import { 
  LiveMatch,
  Country,
  MatchScore,
  MatchOdds,
  MemberPrediction
} from '../../models/tournament.model';
import { IMatchService, TournamentPredictions, MatchPredictionsByTournament } from '../match-service.interface';
import { WORLD_CUP_ID } from '../match.service';

// Not using @Injectable since this is created via factory
export class MockedMatchService implements IMatchService {
  
  // Country data
  private countries: Country[] = [
    { code: 'ARG', name: 'Argentina', flagUrl: 'https://flagcdn.com/w40/ar.png' },
    { code: 'BRA', name: 'Brasil', flagUrl: 'https://flagcdn.com/w40/br.png' },
    { code: 'URU', name: 'Uruguay', flagUrl: 'https://flagcdn.com/w40/uy.png' },
    { code: 'COL', name: 'Colombia', flagUrl: 'https://flagcdn.com/w40/co.png' },
    { code: 'ESP', name: 'España', flagUrl: 'https://flagcdn.com/w40/es.png' },
    { code: 'GER', name: 'Alemania', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'FRA', name: 'Francia', flagUrl: 'https://flagcdn.com/w40/fr.png' },
    { code: 'ITA', name: 'Italia', flagUrl: 'https://flagcdn.com/w40/it.png' },
    { code: 'ENG', name: 'Inglaterra', flagUrl: 'https://flagcdn.com/w40/gb-eng.png' },
    { code: 'POR', name: 'Portugal', flagUrl: 'https://flagcdn.com/w40/pt.png' },
    { code: 'NED', name: 'Países Bajos', flagUrl: 'https://flagcdn.com/w40/nl.png' },
    { code: 'BEL', name: 'Bélgica', flagUrl: 'https://flagcdn.com/w40/be.png' },
    { code: 'CRO', name: 'Croacia', flagUrl: 'https://flagcdn.com/w40/hr.png' },
    { code: 'MEX', name: 'México', flagUrl: 'https://flagcdn.com/w40/mx.png' },
    { code: 'USA', name: 'Estados Unidos', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'JPN', name: 'Japón', flagUrl: 'https://flagcdn.com/w40/jp.png' },
    { code: 'KOR', name: 'Corea del Sur', flagUrl: 'https://flagcdn.com/w40/kr.png' },
    { code: 'MAR', name: 'Marruecos', flagUrl: 'https://flagcdn.com/w40/ma.png' },
    { code: 'SEN', name: 'Senegal', flagUrl: 'https://flagcdn.com/w40/sn.png' },
    { code: 'AUS', name: 'Australia', flagUrl: 'https://flagcdn.com/w40/au.png' },
  ];

  // Cache for consistent match data
  private liveMatchesCache: LiveMatch[] | null = null;
  private upcomingMatchesCache: LiveMatch[] | null = null;

  private logApiCall(method: string, endpoint: string, body?: object, headers?: object): void {
    console.log('========================================');
    console.log(`🔌 MOCK API CALL - ${method} ${endpoint}`);
    console.log('========================================');
    if (headers) {
      console.log('Headers:', JSON.stringify(headers, null, 2));
    }
    if (body) {
      console.log('Request Body:', JSON.stringify(body, null, 2));
    }
    console.log('========================================');
  }

  private generateOdds(homeTeam: Country, awayTeam: Country): MatchOdds {
    const strongTeams = ['ARG', 'BRA', 'FRA', 'ENG', 'ESP', 'GER', 'POR', 'NED'];
    const mediumTeams = ['URU', 'COL', 'BEL', 'CRO', 'ITA', 'MEX', 'USA', 'JPN', 'KOR', 'MAR'];
    
    const getTeamStrength = (country: Country): number => {
      if (strongTeams.includes(country.code)) return 1;
      if (mediumTeams.includes(country.code)) return 2;
      return 3;
    };

    const homeStrength = getTeamStrength(homeTeam);
    const awayStrength = getTeamStrength(awayTeam);
    const diff = awayStrength - homeStrength;

    let homeOdds: number, drawOdds: number, awayOdds: number;

    if (diff > 1) {
      homeOdds = 1.1 + Math.random() * 0.3;
      drawOdds = 3.5 + Math.random() * 1.5;
      awayOdds = 5.0 + Math.random() * 3.0;
    } else if (diff > 0) {
      homeOdds = 1.4 + Math.random() * 0.4;
      drawOdds = 3.0 + Math.random() * 1.0;
      awayOdds = 3.5 + Math.random() * 2.0;
    } else if (diff === 0) {
      homeOdds = 2.0 + Math.random() * 0.6;
      drawOdds = 2.8 + Math.random() * 0.8;
      awayOdds = 2.2 + Math.random() * 0.6;
    } else if (diff > -2) {
      homeOdds = 3.0 + Math.random() * 1.5;
      drawOdds = 2.8 + Math.random() * 0.8;
      awayOdds = 1.6 + Math.random() * 0.4;
    } else {
      homeOdds = 4.5 + Math.random() * 2.5;
      drawOdds = 3.2 + Math.random() * 1.2;
      awayOdds = 1.2 + Math.random() * 0.3;
    }

    return {
      home: Math.round(homeOdds * 10) / 10,
      draw: Math.round(drawOdds * 10) / 10,
      away: Math.round(awayOdds * 10) / 10
    };
  }

  private getRandomCountry(exclude?: string): Country {
    let country: Country;
    do {
      country = this.countries[Math.floor(Math.random() * this.countries.length)];
    } while (exclude && country.code === exclude);
    return country;
  }

  private generateLiveMatches(): LiveMatch[] {
    if (this.liveMatchesCache) return this.liveMatchesCache;

    const matches: LiveMatch[] = [];
    const liveMatchTimes = ["45'+2", "67'", "23'", "HT", "78'", "31'"];

    for (let i = 0; i < 2; i++) {
      const homeTeam = this.getRandomCountry();
      const awayTeam = this.getRandomCountry(homeTeam.code);

      matches.push({
        id: `live-${i + 1}`,
        matchCode: `L${String(i + 1).padStart(2, '0')}`,
        homeTeam,
        awayTeam,
        currentScore: {
          home: Math.floor(Math.random() * 3),
          away: Math.floor(Math.random() * 3)
        },
        matchTime: liveMatchTimes[Math.floor(Math.random() * liveMatchTimes.length)],
        matchDate: new Date(),
        status: 'live',
        stage: 'group_stage',
        group: String.fromCharCode(65 + Math.floor(Math.random() * 8)),
        odds: this.generateOdds(homeTeam, awayTeam),
        tournamentIds: []
      });
    }

    this.liveMatchesCache = matches;
    return matches;
  }

  private generateUpcomingMatches(): LiveMatch[] {
    if (this.upcomingMatchesCache) return this.upcomingMatchesCache;

    const matches: LiveMatch[] = [];
    const baseDate = new Date();

    for (let i = 0; i < 3; i++) {
      const homeTeam = this.getRandomCountry();
      const awayTeam = this.getRandomCountry(homeTeam.code);

      const matchDate = new Date(baseDate);
      matchDate.setHours(matchDate.getHours() + (i + 1) * 3);

      matches.push({
        id: `upcoming-${i + 1}`,
        matchCode: `U${String(i + 1).padStart(2, '0')}`,
        homeTeam,
        awayTeam,
        matchDate,
        status: 'upcoming',
        stage: 'group_stage',
        group: String.fromCharCode(65 + Math.floor(Math.random() * 8)),
        odds: this.generateOdds(homeTeam, awayTeam),
        tournamentIds: []
      });
    }

    this.upcomingMatchesCache = matches;
    return matches;
  }

  getLiveMatches(): Observable<LiveMatch[]> {
    this.logApiCall('GET', `/api/tournaments/${WORLD_CUP_ID}/matches (live_matches)`);
    return of(this.generateLiveMatches()).pipe(delay(200));
  }

  getUpcomingMatches(): Observable<LiveMatch[]> {
    this.logApiCall('GET', `/api/tournaments/${WORLD_CUP_ID}/matches (next_matches)`);
    return of(this.generateUpcomingMatches()).pipe(delay(200));
  }

  getPastMatches(): Observable<LiveMatch[]> {
    this.logApiCall('GET', `/api/tournaments/${WORLD_CUP_ID}/matches (past_matches)`);
    return of([]).pipe(delay(200));
  }

  getMatchById(matchId: string): Observable<LiveMatch | null> {
    this.logApiCall('GET', `/api/tournaments/${WORLD_CUP_ID}/matches (id: ${matchId})`);
    const allMatches = [...this.generateLiveMatches(), ...this.generateUpcomingMatches()];
    const match = allMatches.find(m => m.id === matchId);
    return of(match || null).pipe(delay(100));
  }

  private mockFullNameForUsername(username: string): string {
    const map: Record<string, string> = {
      Carlos_M: 'Carlos Martínez',
      María_G: 'María García',
      Juan_P: 'Juan Pérez',
      Ana_R: 'Ana Rodríguez',
      Pedro_S: 'Pedro Sánchez',
      Lucía_F: 'Lucía Fernández',
      Diego_L: 'Diego López',
      Sofía_V: 'Sofía Vargas',
      Martín_C: 'Martín Castro',
      Valentina_H: 'Valentina Herrera',
      Usuario: 'Usuario Demo'
    };
    return map[username] ?? username.replace(/_/g, ' ');
  }

  getMatchPredictionsByTournament(
    matchId: string, 
    joinedTournaments: { id: string; name: string }[],
    currentUsername: string
  ): Observable<MatchPredictionsByTournament | null> {
    this.logApiCall('GET', `/api/matches/${matchId}/predictions`, {
      tournamentIds: joinedTournaments.map(t => t.id)
    }, {
      'Authorization': 'Bearer <jwt-token>'
    });

    const allMatches = [...this.generateLiveMatches(), ...this.generateUpcomingMatches()];
    const match = allMatches.find(m => m.id === matchId);
    
    if (!match) return of(null);

    const memberNames = [
      'Carlos_M', 'María_G', 'Juan_P', 'Ana_R', 'Pedro_S',
      'Lucía_F', 'Diego_L', 'Sofía_V', 'Martín_C', 'Valentina_H'
    ];

    const tournamentPredictions: TournamentPredictions[] = joinedTournaments.map(tournament => {
      const memberCount = 5 + Math.floor(Math.random() * 5);
      const selectedMembers = memberNames.slice(0, memberCount);

      const predictions: MemberPrediction[] = selectedMembers.map((name, index) => ({
        oddsId: `pred-${tournament.id}-${index}`,
        username: name,
        fullName: this.mockFullNameForUsername(name),
        avatarInitials: name.substring(0, 2).toUpperCase(),
        predictedScore: {
          home: Math.floor(Math.random() * 4),
          away: Math.floor(Math.random() * 4)
        },
        isCurrentUser: false
      }));

      predictions.unshift({
        oddsId: `pred-${tournament.id}-current`,
        username: currentUsername,
        fullName: this.mockFullNameForUsername(currentUsername),
        avatarInitials: currentUsername.substring(0, 2).toUpperCase(),
        predictedScore: {
          home: Math.floor(Math.random() * 4),
          away: Math.floor(Math.random() * 4)
        },
        isCurrentUser: true
      });

      return {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        predictions
      };
    });

    const result: MatchPredictionsByTournament = {
      match,
      tournamentPredictions
    };

    return of(result).pipe(delay(300));
  }

  getUserPredictionForMatch(matchId: string, tournamentId: string): Observable<MatchScore | null> {
    this.logApiCall('GET', `/api/matches/${matchId}/predictions/me?tournamentId=${tournamentId}`, undefined, {
      'Authorization': 'Bearer <jwt-token>'
    });

    if (Math.random() > 0.3) {
      return of({
        home: Math.floor(Math.random() * 4),
        away: Math.floor(Math.random() * 4)
      }).pipe(delay(100));
    }
    return of(null).pipe(delay(100));
  }

  clearCache(): void {
    this.logApiCall('LOCAL', 'clearCache');
    this.liveMatchesCache = null;
    this.upcomingMatchesCache = null;
  }
}
