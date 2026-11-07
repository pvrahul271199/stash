import posthog from 'posthog-js';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const missingConfigurationVariable = !projectToken
  ? 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'
  : !apiHost
    ? 'NEXT_PUBLIC_POSTHOG_HOST'
    : undefined;

if (missingConfigurationVariable) {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      `${missingConfigurationVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingConfigurationVariable} is configured`,
    );
  }
} else if (projectToken && apiHost) {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2025-05-24',
    capture_exceptions: true,
    logs: {
      serviceName: 'stash-web',
      environment: process.env.NODE_ENV,
    },
    debug: process.env.NODE_ENV === 'development',
  });
}
