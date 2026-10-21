// Client-side Sentry: no-op unless NEXT_PUBLIC_SENTRY_DSN is set at build time.
// Dynamic import keeps @sentry/nextjs out of the main bundle when disabled.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0),
    });
  });
}
