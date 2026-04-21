import { Provider } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatchService } from './match.service';
import { IMatchService, MATCH_SERVICE } from './match-service.interface';
import { ENVIRONMENT_CONFIG, EnvironmentConfig } from '../config/environment.config';

export function matchServiceFactory(http: HttpClient, config: EnvironmentConfig): IMatchService {
  return new MatchService(http, config);
}

export const matchServiceProvider: Provider = {
  provide: MATCH_SERVICE,
  useFactory: matchServiceFactory,
  deps: [HttpClient, ENVIRONMENT_CONFIG]
};
