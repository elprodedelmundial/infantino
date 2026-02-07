import { Provider } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserService } from './user.service';
import { MockedUserService } from './mocks/mocked-user.service';
import { IUserService, USER_SERVICE } from './user-service.interface';
import { ENVIRONMENT_CONFIG, EnvironmentConfig } from '../config/environment.config';

export function userServiceFactory(
  config: EnvironmentConfig,
  http: HttpClient
): IUserService {
  if (config.mockedUserService) {
    console.log('🧪 Using MockedUserService');
    return new MockedUserService();
  } else {
    console.log('🔌 Using real UserService with API:', config.grondonaUrl);
    return new UserService(http, config);
  }
}

export const userServiceProvider: Provider = {
  provide: USER_SERVICE,
  useFactory: userServiceFactory,
  deps: [ENVIRONMENT_CONFIG, HttpClient]
};
