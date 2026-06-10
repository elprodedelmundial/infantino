import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authExpiryInterceptor } from './interceptors/auth-expiry.interceptor';
import { ENVIRONMENT_CONFIG, loadEnvironmentConfig } from './config/environment.config';
import { userServiceProvider } from './services/user-service.provider';
import { tournamentServiceProvider } from './services/tournament-service.provider';
import { matchServiceProvider } from './services/match-service.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([authExpiryInterceptor])),
    { provide: ENVIRONMENT_CONFIG, useFactory: loadEnvironmentConfig },
    userServiceProvider,
    tournamentServiceProvider,
    matchServiceProvider
  ]
};
