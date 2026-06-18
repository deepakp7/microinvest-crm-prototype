import './lib/telemetry.js';

/**
 * SvelteKit server hook — telemetry initializer runs on module import above.
 * Keep a simple pass-through handle so requests behave normally.
 */
export async function handle({ event, resolve }) {
  return await resolve(event);
}
