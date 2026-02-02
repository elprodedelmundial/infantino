import { Injectable } from '@angular/core';
import { Observable, of, delay, BehaviorSubject } from 'rxjs';
import { 
  Tournament, 
  JoinedTournament, 
  TournamentStandings, 
  TournamentPlayer,
  PredictionResult,
  UserPredictions,
  MatchPrediction,
  Country,
  TournamentStage,
  TournamentStageInfo,
  AllPredictionsData,
  MatchScore,
  MatchOdds,
  Player,
  TournamentAwardPrediction,
  LiveMatch,
  MemberPrediction,
  MatchWithPredictions,
  DashboardLiveData
} from '../models/tournament.model';

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  
  private currentUserId = 'user-1';
  private currentUsername = 'Usuario';
  
  // Mocked available tournaments
  private availableTournaments: Tournament[] = [
    {
      id: 'tournament-1',
      name: 'EPO',
      participantsCount: 14,
      maxParticipants: 25,
      startDate: new Date('2026-02-15')
    },
    {
      id: 'tournament-2',
      name: 'Maldolar',
      participantsCount: 4,
      maxParticipants: 10,
      startDate: new Date('2026-02-20')
    },
    {
      id: 'tournament-3',
      name: 'Baldosa',
      participantsCount: 16,
      maxParticipants: 37,
      startDate: new Date('2026-03-01')
    },
  ];

  // Extended country data for 48 teams (12 groups of 4)
  private countries: Country[] = [
    // South America
    { code: 'ARG', name: 'Argentina', flagUrl: 'https://flagcdn.com/w40/ar.png' },
    { code: 'BRA', name: 'Brasil', flagUrl: 'https://flagcdn.com/w40/br.png' },
    { code: 'URU', name: 'Uruguay', flagUrl: 'https://flagcdn.com/w40/uy.png' },
    { code: 'COL', name: 'Colombia', flagUrl: 'https://flagcdn.com/w40/co.png' },
    { code: 'CHI', name: 'Chile', flagUrl: 'https://flagcdn.com/w40/cl.png' },
    { code: 'PAR', name: 'Paraguay', flagUrl: 'https://flagcdn.com/w40/py.png' },
    { code: 'PER', name: 'Perú', flagUrl: 'https://flagcdn.com/w40/pe.png' },
    { code: 'ECU', name: 'Ecuador', flagUrl: 'https://flagcdn.com/w40/ec.png' },
    { code: 'VEN', name: 'Venezuela', flagUrl: 'https://flagcdn.com/w40/ve.png' },
    { code: 'BOL', name: 'Bolivia', flagUrl: 'https://flagcdn.com/w40/bo.png' },
    // Europe
    { code: 'ESP', name: 'España', flagUrl: 'https://flagcdn.com/w40/es.png' },
    { code: 'GER', name: 'Alemania', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'FRA', name: 'Francia', flagUrl: 'https://flagcdn.com/w40/fr.png' },
    { code: 'ITA', name: 'Italia', flagUrl: 'https://flagcdn.com/w40/it.png' },
    { code: 'ENG', name: 'Inglaterra', flagUrl: 'https://flagcdn.com/w40/gb-eng.png' },
    { code: 'POR', name: 'Portugal', flagUrl: 'https://flagcdn.com/w40/pt.png' },
    { code: 'NED', name: 'Países Bajos', flagUrl: 'https://flagcdn.com/w40/nl.png' },
    { code: 'BEL', name: 'Bélgica', flagUrl: 'https://flagcdn.com/w40/be.png' },
    { code: 'CRO', name: 'Croacia', flagUrl: 'https://flagcdn.com/w40/hr.png' },
    { code: 'SUI', name: 'Suiza', flagUrl: 'https://flagcdn.com/w40/ch.png' },
    { code: 'DEN', name: 'Dinamarca', flagUrl: 'https://flagcdn.com/w40/dk.png' },
    { code: 'SWE', name: 'Suecia', flagUrl: 'https://flagcdn.com/w40/se.png' },
    { code: 'POL', name: 'Polonia', flagUrl: 'https://flagcdn.com/w40/pl.png' },
    { code: 'AUT', name: 'Austria', flagUrl: 'https://flagcdn.com/w40/at.png' },
    { code: 'SRB', name: 'Serbia', flagUrl: 'https://flagcdn.com/w40/rs.png' },
    { code: 'UKR', name: 'Ucrania', flagUrl: 'https://flagcdn.com/w40/ua.png' },
    // Africa
    { code: 'MAR', name: 'Marruecos', flagUrl: 'https://flagcdn.com/w40/ma.png' },
    { code: 'SEN', name: 'Senegal', flagUrl: 'https://flagcdn.com/w40/sn.png' },
    { code: 'NGA', name: 'Nigeria', flagUrl: 'https://flagcdn.com/w40/ng.png' },
    { code: 'CMR', name: 'Camerún', flagUrl: 'https://flagcdn.com/w40/cm.png' },
    { code: 'GHA', name: 'Ghana', flagUrl: 'https://flagcdn.com/w40/gh.png' },
    { code: 'EGY', name: 'Egipto', flagUrl: 'https://flagcdn.com/w40/eg.png' },
    // Asia
    { code: 'JPN', name: 'Japón', flagUrl: 'https://flagcdn.com/w40/jp.png' },
    { code: 'KOR', name: 'Corea del Sur', flagUrl: 'https://flagcdn.com/w40/kr.png' },
    { code: 'AUS', name: 'Australia', flagUrl: 'https://flagcdn.com/w40/au.png' },
    { code: 'IRN', name: 'Irán', flagUrl: 'https://flagcdn.com/w40/ir.png' },
    { code: 'KSA', name: 'Arabia Saudita', flagUrl: 'https://flagcdn.com/w40/sa.png' },
    { code: 'QAT', name: 'Catar', flagUrl: 'https://flagcdn.com/w40/qa.png' },
    // North/Central America
    { code: 'MEX', name: 'México', flagUrl: 'https://flagcdn.com/w40/mx.png' },
    { code: 'USA', name: 'Estados Unidos', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'CAN', name: 'Canadá', flagUrl: 'https://flagcdn.com/w40/ca.png' },
    { code: 'CRC', name: 'Costa Rica', flagUrl: 'https://flagcdn.com/w40/cr.png' },
    // Additional teams
    { code: 'WAL', name: 'Gales', flagUrl: 'https://flagcdn.com/w40/gb-wls.png' },
    { code: 'SCO', name: 'Escocia', flagUrl: 'https://flagcdn.com/w40/gb-sct.png' },
    { code: 'TUN', name: 'Túnez', flagUrl: 'https://flagcdn.com/w40/tn.png' },
    { code: 'ALG', name: 'Argelia', flagUrl: 'https://flagcdn.com/w40/dz.png' },
    { code: 'NZL', name: 'Nueva Zelanda', flagUrl: 'https://flagcdn.com/w40/nz.png' },
    { code: 'JAM', name: 'Jamaica', flagUrl: 'https://flagcdn.com/w40/jm.png' },
  ];

  // Mocked players for awards
  private players: Player[] = [
    { id: 'p1', name: 'Lionel Messi', country: this.countries[0], position: 'Delantero' },
    { id: 'p2', name: 'Kylian Mbappé', country: this.countries[12], position: 'Delantero' },
    { id: 'p3', name: 'Erling Haaland', country: this.countries[21], position: 'Delantero' },
    { id: 'p4', name: 'Vinícius Jr.', country: this.countries[1], position: 'Delantero' },
    { id: 'p5', name: 'Jude Bellingham', country: this.countries[14], position: 'Mediocampista' },
    { id: 'p6', name: 'Kevin De Bruyne', country: this.countries[17], position: 'Mediocampista' },
    { id: 'p7', name: 'Rodri', country: this.countries[10], position: 'Mediocampista' },
    { id: 'p8', name: 'Florian Wirtz', country: this.countries[11], position: 'Mediocampista' },
    { id: 'p9', name: 'Lamine Yamal', country: this.countries[10], position: 'Delantero' },
    { id: 'p10', name: 'Pedri', country: this.countries[10], position: 'Mediocampista' },
    { id: 'p11', name: 'Phil Foden', country: this.countries[14], position: 'Mediocampista' },
    { id: 'p12', name: 'Harry Kane', country: this.countries[14], position: 'Delantero' },
    // Goalkeepers
    { id: 'gk1', name: 'Thibaut Courtois', country: this.countries[17], position: 'Portero' },
    { id: 'gk2', name: 'Alisson Becker', country: this.countries[1], position: 'Portero' },
    { id: 'gk3', name: 'Emiliano Martínez', country: this.countries[0], position: 'Portero' },
    { id: 'gk4', name: 'Marc-André ter Stegen', country: this.countries[11], position: 'Portero' },
    { id: 'gk5', name: 'Gianluigi Donnarumma', country: this.countries[13], position: 'Portero' },
    // Young players (U23)
    { id: 'y1', name: 'Lamine Yamal', country: this.countries[10], position: 'Delantero' },
    { id: 'y2', name: 'Florian Wirtz', country: this.countries[11], position: 'Mediocampista' },
    { id: 'y3', name: 'Jamal Musiala', country: this.countries[11], position: 'Mediocampista' },
    { id: 'y4', name: 'Endrick', country: this.countries[1], position: 'Delantero' },
    { id: 'y5', name: 'Alejandro Garnacho', country: this.countries[0], position: 'Delantero' },
  ];

  // Tournament stages configuration
  private stagesConfig: TournamentStageInfo[] = [
    { id: 'group_stage', name: 'Fase de Grupos', order: 1, hasStarted: true, matchCount: 72 },
    { id: 'round_of_16', name: '16vos de Final', order: 2, hasStarted: false, matchCount: 16 },
    { id: 'quarter_finals', name: '8vos de Final', order: 3, hasStarted: false, matchCount: 8 },
    { id: 'semi_finals', name: '4tos de Final', order: 4, hasStarted: false, matchCount: 4 },
    { id: 'third_place', name: 'Tercer Puesto', order: 5, hasStarted: false, matchCount: 1 },
    { id: 'final', name: 'Final', order: 6, hasStarted: false, matchCount: 1 },
  ];

  // Cache for all matches per tournament
  private allMatchesCache: Map<string, MatchPrediction[]> = new Map();
  
  // Mocked joined tournaments
  private joinedTournamentIds: Set<string> = new Set();

  // User award predictions
  private userAwardPredictions: Map<string, TournamentAwardPrediction> = new Map();

  private generateOdds(homeTeam: Country, awayTeam: Country): MatchOdds {
    // Strong teams have lower odds (favorites)
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

    // Base odds calculation
    let homeOdds: number, drawOdds: number, awayOdds: number;

    if (diff > 1) {
      // Home is much stronger
      homeOdds = 1.1 + Math.random() * 0.3;
      drawOdds = 3.5 + Math.random() * 1.5;
      awayOdds = 5.0 + Math.random() * 3.0;
    } else if (diff > 0) {
      // Home is slightly stronger
      homeOdds = 1.4 + Math.random() * 0.4;
      drawOdds = 3.0 + Math.random() * 1.0;
      awayOdds = 3.5 + Math.random() * 2.0;
    } else if (diff === 0) {
      // Equal strength
      homeOdds = 2.0 + Math.random() * 0.6;
      drawOdds = 2.8 + Math.random() * 0.8;
      awayOdds = 2.2 + Math.random() * 0.6;
    } else if (diff > -2) {
      // Away is slightly stronger
      homeOdds = 3.0 + Math.random() * 1.5;
      drawOdds = 2.8 + Math.random() * 0.8;
      awayOdds = 1.6 + Math.random() * 0.4;
    } else {
      // Away is much stronger
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

  private generateGroupStageMatches(): MatchPrediction[] {
    const matches: MatchPrediction[] = [];
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const shuffledCountries = [...this.countries].sort(() => Math.random() - 0.5).slice(0, 48);
    
    let matchIndex = 1;
    const baseDate = new Date('2026-02-15');
    
    // 40 matches already played, 32 upcoming
    const playedMatchCount = 40;
    
    groups.forEach((group, groupIndex) => {
      // Get 4 teams for this group
      const groupTeams = shuffledCountries.slice(groupIndex * 4, (groupIndex + 1) * 4);
      
      // Generate all 6 matches for this group (round-robin)
      const groupMatches: [number, number][] = [
        [0, 1], [2, 3], // Matchday 1
        [0, 2], [1, 3], // Matchday 2
        [0, 3], [1, 2], // Matchday 3
      ];
      
      groupMatches.forEach(([homeIdx, awayIdx], matchDayOffset) => {
        const isPlayed = matchIndex <= playedMatchCount;
        const matchDate = new Date(baseDate);
        matchDate.setDate(baseDate.getDate() + Math.floor(matchDayOffset / 2) * 4 + groupIndex % 3);
        
        if (!isPlayed) {
          matchDate.setDate(matchDate.getDate() + 15); // Future matches
        }
        
        const homeTeam = groupTeams[homeIdx];
        const awayTeam = groupTeams[awayIdx];
        
        const predictedHome = Math.floor(Math.random() * 4);
        const predictedAway = Math.floor(Math.random() * 4);
        
        let actualScore: MatchScore | undefined;
        let result: PredictionResult | undefined;
        
        if (isPlayed) {
          const actualHome = Math.floor(Math.random() * 4);
          const actualAway = Math.floor(Math.random() * 4);
          actualScore = { home: actualHome, away: actualAway };
          
          // Calculate result
          if (predictedHome === actualHome && predictedAway === actualAway) {
            result = 'correct';
          } else if (
            (predictedHome > predictedAway && actualHome > actualAway) ||
            (predictedHome < predictedAway && actualHome < actualAway) ||
            (predictedHome === predictedAway && actualHome === actualAway)
          ) {
            result = 'half';
          } else {
            result = 'incorrect';
          }
        }
        
        const odds = !isPlayed ? this.generateOdds(homeTeam, awayTeam) : undefined;
        
        matches.push({
          id: `match-${matchIndex}`,
          matchCode: `G${group}${String(matchDayOffset + 1).padStart(2, '0')}`,
          homeTeam,
          awayTeam,
          predictedScore: { home: predictedHome, away: predictedAway },
          actualScore,
          isPlayed,
          matchDate,
          result,
          stage: 'group_stage',
          group,
          odds
        });
        
        matchIndex++;
      });
    });
    
    return matches;
  }

  private getAllMatches(tournamentId: string): MatchPrediction[] {
    if (!this.allMatchesCache.has(tournamentId)) {
      this.allMatchesCache.set(tournamentId, this.generateGroupStageMatches());
    }
    return this.allMatchesCache.get(tournamentId)!;
  }

  private generateMockPredictions(tournamentId: string): UserPredictions {
    const allMatches = this.getAllMatches(tournamentId);
    
    const pastPredictions = allMatches
      .filter(m => m.isPlayed)
      .sort((a, b) => b.matchDate.getTime() - a.matchDate.getTime())
      .slice(0, 5);
    
    const upcomingPredictions = allMatches
      .filter(m => !m.isPlayed)
      .sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime())
      .slice(0, 5);

    return { pastPredictions, upcomingPredictions };
  }

  // Mocked standings data
  private generateMockPlayers(tournamentId: string): TournamentPlayer[] {
    const names = [
      'Carlos_M', 'María_G', 'Juan_P', 'Ana_R', 'Pedro_S',
      'Lucía_F', 'Diego_L', 'Sofía_V', 'Martín_C', 'Valentina_H',
      'Lucas_B', 'Camila_D', 'Nicolás_A', 'Paula_E', 'Mateo_O'
    ];

    const players: TournamentPlayer[] = names.map((name, index) => {
      const predictions: PredictionResult[] = [];
      for (let i = 0; i < 5; i++) {
        const rand = Math.random();
        if (rand < 0.4) predictions.push('correct');
        else if (rand < 0.7) predictions.push('half');
        else predictions.push('incorrect');
      }

      return {
        id: `player-${index + 1}`,
        username: name,
        position: index + 1,
        points: Math.floor(Math.random() * 50) + 30,
        lastPredictions: predictions,
        avatarInitials: name.substring(0, 2).toUpperCase()
      };
    });

    // Sort by points descending
    players.sort((a, b) => b.points - a.points);
    
    // Reassign positions after sorting
    players.forEach((player, index) => {
      player.position = index + 1;
    });

    // Insert current user at a random position
    const userPosition = Math.floor(Math.random() * 10) + 3;
    const userPredictions: PredictionResult[] = [];
    for (let i = 0; i < 5; i++) {
      const rand = Math.random();
      if (rand < 0.5) userPredictions.push('correct');
      else if (rand < 0.8) userPredictions.push('half');
      else userPredictions.push('incorrect');
    }

    const currentUser: TournamentPlayer = {
      id: this.currentUserId,
      username: this.currentUsername,
      position: userPosition,
      points: players[userPosition - 1]?.points || 45,
      lastPredictions: userPredictions,
      avatarInitials: this.currentUsername.substring(0, 2).toUpperCase()
    };

    // Replace player at user position with current user
    players.splice(userPosition - 1, 0, currentUser);
    
    // Reassign positions
    players.forEach((player, index) => {
      player.position = index + 1;
    });

    return players.slice(0, 15);
  }

  setCurrentUser(username: string): void {
    this.currentUsername = username;
  }

  getAvailableTournaments(): Observable<Tournament[]> {
    const tournaments = this.availableTournaments.map(t => ({
      ...t,
      isJoined: this.joinedTournamentIds.has(t.id)
    }));
    return of(tournaments).pipe(delay(300));
  }

  getJoinedTournaments(): Observable<JoinedTournament[]> {
    const joined = this.availableTournaments
      .filter(t => this.joinedTournamentIds.has(t.id))
      .map(tournament => ({
        tournament,
        userRanking: Math.floor(Math.random() * 20) + 1,
        userPoints: Math.floor(Math.random() * 50) + 30
      }));
    return of(joined).pipe(delay(200));
  }

  joinTournament(tournamentId: string): Observable<boolean> {
    this.joinedTournamentIds.add(tournamentId);
    const tournament = this.availableTournaments.find(t => t.id === tournamentId);
    if (tournament) {
      tournament.participantsCount++;
    }
    return of(true).pipe(delay(300));
  }

  leaveTournament(tournamentId: string): Observable<boolean> {
    this.joinedTournamentIds.delete(tournamentId);
    const tournament = this.availableTournaments.find(t => t.id === tournamentId);
    if (tournament && tournament.participantsCount > 0) {
      tournament.participantsCount--;
    }
    // Clear cache
    this.allMatchesCache.delete(tournamentId);
    this.userAwardPredictions.delete(tournamentId);
    return of(true).pipe(delay(300));
  }

  getTournamentStandings(tournamentId: string): Observable<TournamentStandings | null> {
    const tournament = this.availableTournaments.find(t => t.id === tournamentId);
    if (!tournament) {
      return of(null);
    }

    const standings: TournamentStandings = {
      tournament,
      players: this.generateMockPlayers(tournamentId),
      currentUserId: this.currentUserId
    };

    return of(standings).pipe(delay(400));
  }

  getUserPredictions(tournamentId: string): Observable<UserPredictions> {
    return of(this.generateMockPredictions(tournamentId)).pipe(delay(300));
  }

  getAllPredictions(tournamentId: string): Observable<AllPredictionsData> {
    const matches = this.getAllMatches(tournamentId);
    const stages = this.stagesConfig.map(stage => ({
      ...stage,
      // Only group stage has started for now
      hasStarted: stage.id === 'group_stage'
    }));

    return of({ matches, stages }).pipe(delay(400));
  }

  updatePrediction(tournamentId: string, matchId: string, newScore: MatchScore): Observable<boolean> {
    const matches = this.getAllMatches(tournamentId);
    const match = matches.find(m => m.id === matchId);
    
    if (match && !match.isPlayed) {
      match.predictedScore = newScore;
      return of(true).pipe(delay(200));
    }
    
    return of(false).pipe(delay(200));
  }

  updateMultiplePredictions(tournamentId: string, updates: { matchId: string; score: MatchScore }[]): Observable<boolean> {
    const matches = this.getAllMatches(tournamentId);
    
    updates.forEach(update => {
      const match = matches.find(m => m.id === update.matchId);
      if (match && !match.isPlayed) {
        match.predictedScore = update.score;
      }
    });
    
    return of(true).pipe(delay(300));
  }

  getTournamentById(tournamentId: string): Observable<Tournament | null> {
    const tournament = this.availableTournaments.find(t => t.id === tournamentId);
    return of(tournament || null).pipe(delay(100));
  }

  // Award predictions
  getCountriesForAwards(): Observable<Country[]> {
    return of(this.countries.slice(0, 32)).pipe(delay(200));
  }

  getPlayersForAwards(): Observable<Player[]> {
    return of(this.players).pipe(delay(200));
  }

  getGoalkeepersForAwards(): Observable<Player[]> {
    return of(this.players.filter(p => p.position === 'Portero')).pipe(delay(200));
  }

  getYoungPlayersForAwards(): Observable<Player[]> {
    return of(this.players.filter(p => p.id.startsWith('y'))).pipe(delay(200));
  }

  getUserAwardPredictions(tournamentId: string): Observable<TournamentAwardPrediction | null> {
    const predictions = this.userAwardPredictions.get(tournamentId);
    return of(predictions || null).pipe(delay(200));
  }

  saveAwardPredictions(tournamentId: string, predictions: TournamentAwardPrediction): Observable<boolean> {
    this.userAwardPredictions.set(tournamentId, predictions);
    return of(true).pipe(delay(300));
  }

  // Live Matches and Member Predictions
  private generateLiveMatches(): LiveMatch[] {
    const matches: LiveMatch[] = [];
    const joinedIds = Array.from(this.joinedTournamentIds);
    
    if (joinedIds.length === 0) return matches;

    // Generate 2 live matches
    const liveMatchTimes = ["45'+2", "67'", "23'", "HT"];
    for (let i = 0; i < 2; i++) {
      const homeTeam = this.countries[Math.floor(Math.random() * 20)];
      let awayTeam = this.countries[Math.floor(Math.random() * 20)];
      while (awayTeam.code === homeTeam.code) {
        awayTeam = this.countries[Math.floor(Math.random() * 20)];
      }

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
        userPrediction: {
          home: Math.floor(Math.random() * 4),
          away: Math.floor(Math.random() * 4)
        },
        tournamentIds: joinedIds
      });
    }

    return matches;
  }

  private generateUpcomingMatches(count: number): LiveMatch[] {
    const matches: LiveMatch[] = [];
    const joinedIds = Array.from(this.joinedTournamentIds);
    
    if (joinedIds.length === 0) return matches;

    const baseDate = new Date();
    
    for (let i = 0; i < count; i++) {
      const homeTeam = this.countries[Math.floor(Math.random() * 20)];
      let awayTeam = this.countries[Math.floor(Math.random() * 20)];
      while (awayTeam.code === homeTeam.code) {
        awayTeam = this.countries[Math.floor(Math.random() * 20)];
      }

      const matchDate = new Date(baseDate);
      matchDate.setHours(matchDate.getHours() + (i + 1) * 3); // Every 3 hours

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
        userPrediction: Math.random() > 0.3 ? {
          home: Math.floor(Math.random() * 4),
          away: Math.floor(Math.random() * 4)
        } : undefined,
        tournamentIds: joinedIds
      });
    }

    return matches;
  }

  getDashboardLiveData(): Observable<DashboardLiveData> {
    const liveMatches = this.generateLiveMatches();
    const upcomingMatches = this.generateUpcomingMatches(3);
    
    return of({ liveMatches, upcomingMatches }).pipe(delay(300));
  }

  getMemberPredictions(matchId: string, tournamentId?: string): Observable<MatchWithPredictions | null> {
    const joinedIds = Array.from(this.joinedTournamentIds);
    
    // Generate mock member predictions
    const memberNames = [
      'Carlos_M', 'María_G', 'Juan_P', 'Ana_R', 'Pedro_S',
      'Lucía_F', 'Diego_L', 'Sofía_V', 'Martín_C', 'Valentina_H'
    ];

    // Find or generate the match
    const isLive = matchId.startsWith('live');
    let match: LiveMatch;

    if (isLive) {
      const liveMatches = this.generateLiveMatches();
      const foundMatch = liveMatches.find(m => m.id === matchId);
      if (!foundMatch) return of(null);
      match = foundMatch;
    } else {
      const upcomingMatches = this.generateUpcomingMatches(3);
      const foundMatch = upcomingMatches.find(m => m.id === matchId);
      if (!foundMatch) return of(null);
      match = foundMatch;
    }

    // Generate member predictions
    const membersToShow = tournamentId 
      ? memberNames.slice(0, 8) // Specific tournament - fewer members
      : memberNames; // All tournaments

    const memberPredictions: MemberPrediction[] = membersToShow.map((name, index) => ({
      oddsId: `pred-${index}`,
      username: name,
      avatarInitials: name.substring(0, 2).toUpperCase(),
      predictedScore: {
        home: Math.floor(Math.random() * 4),
        away: Math.floor(Math.random() * 4)
      },
      isCurrentUser: index === 0 // First one is always the current user for demo
    }));

    // Add current user prediction
    memberPredictions[0] = {
      oddsId: 'pred-current',
      username: this.currentUsername,
      avatarInitials: this.currentUsername.substring(0, 2).toUpperCase(),
      predictedScore: match.userPrediction || { home: 0, away: 0 },
      isCurrentUser: true
    };

    const result: MatchWithPredictions = {
      match,
      memberPredictions,
      totalPredictions: memberPredictions.length
    };

    return of(result).pipe(delay(300));
  }

  getLiveMatchesForTournament(tournamentId: string): Observable<LiveMatch[]> {
    if (!this.joinedTournamentIds.has(tournamentId)) {
      return of([]);
    }
    
    const liveMatches = this.generateLiveMatches().filter(m => 
      m.tournamentIds.includes(tournamentId)
    );
    
    return of(liveMatches).pipe(delay(200));
  }

  getJoinedTournamentIds(): string[] {
    return Array.from(this.joinedTournamentIds);
  }
}
