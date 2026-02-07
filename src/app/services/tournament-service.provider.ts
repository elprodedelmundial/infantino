import { Provider } from '@angular/core';
import { TournamentService } from './tournament.service';
import { MockedTournamentService } from './mocks/mocked-tournament.service';
import { ITournamentService, TOURNAMENT_SERVICE } from './tournament-service.interface';
import { ENVIRONMENT_CONFIG, EnvironmentConfig } from '../config/environment.config';

export function tournamentServiceFactory(config: EnvironmentConfig): ITournamentService {
  if (config.mockedTournamentService) {
    console.log('🧪 Using MockedTournamentService');
    return new MockedTournamentService();
  } else {
    console.log('🔌 Using real TournamentService');
    return new TournamentService();
  }
}

export const tournamentServiceProvider: Provider = {
  provide: TOURNAMENT_SERVICE,
  useFactory: tournamentServiceFactory,
  deps: [ENVIRONMENT_CONFIG]
};
