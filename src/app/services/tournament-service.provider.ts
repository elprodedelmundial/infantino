import { Provider } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TournamentService } from './tournament.service';
import { ITournamentService, TOURNAMENT_SERVICE } from './tournament-service.interface';
import { ENVIRONMENT_CONFIG, EnvironmentConfig } from '../config/environment.config';

export function tournamentServiceFactory(
  config: EnvironmentConfig,
  http: HttpClient
): ITournamentService {
  return new TournamentService(http, config);
}

export const tournamentServiceProvider: Provider = {
  provide: TOURNAMENT_SERVICE,
  useFactory: tournamentServiceFactory,
  deps: [ENVIRONMENT_CONFIG, HttpClient]
};
