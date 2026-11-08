import posthog from 'posthog-js';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const missingConfigurationVariable = !projectToken
  ? 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'
  : !apiHost
    ? 'NEXT_PUBLIC_POSTHOG_HOST'
    : undefined;

if (missingConfigurationVariable) {
  // Warn instead of throwing: a missing analytics key must never stop the app from starting.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`${missingConfigurationVariable} is not set, so PostHog analytics are off. Add it to .env.local to enable them.`);
  }
} else if (projectToken && apiHost) {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2025-05-24',
    capture_exceptions: true,
    logs: {
      serviceName: 'chelav-web',
      environment: process.env.NODE_ENV,
    },
    debug: process.env.NODE_ENV === 'development',
  });
}
