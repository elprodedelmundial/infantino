import { Provider } from '@angular/core';
import { MatchService } from './match.service';
import { MockedMatchService } from './mocks/mocked-match.service';
import { IMatchService, MATCH_SERVICE } from './match-service.interface';
import { ENVIRONMENT_CONFIG, EnvironmentConfig } from '../config/environment.config';

export function matchServiceFactory(config: EnvironmentConfig): IMatchService {
  if (config.mockedMatchService) {
    console.log('🧪 Using MockedMatchService');
    return new MockedMatchService();
  } else {
    console.log('🔌 Using real MatchService');
    return new MatchService();
  }
}

export const matchServiceProvider: Provider = {
  provide: MATCH_SERVICE,
  useFactory: matchServiceFactory,
  deps: [ENVIRONMENT_CONFIG]
};
