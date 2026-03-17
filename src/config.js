/**
 * Application Runtime Configuration
 * 
 * Edit this file to configure external services and mock behavior.
 * 
 * Service Mocking:
 * - Set the mocked-*-service flags to true to use mock implementations
 * - Mock services simulate API calls locally and log them to console
 * - Set to false to use real services that connect to the grondona API
 */
window.__APP_CONFIG__ = {
  // Base URL for the Grondona API
  'grondona-url': 'http://localhost:8080',
  
  // Service mocking flags (true = use mock, false = use real service)
  'mocked-user-service': false,
  'mocked-tournament-service': false,
  'mocked-match-service': true
};
