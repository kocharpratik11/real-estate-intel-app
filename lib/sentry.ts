import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return; // crash reporting is a no-op until a DSN is configured
  Sentry.init({
    dsn,
    // Local Expo dev sessions are noisy and not useful to report — only
    // TestFlight/production builds (where __DEV__ is false) send events.
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export { Sentry };
