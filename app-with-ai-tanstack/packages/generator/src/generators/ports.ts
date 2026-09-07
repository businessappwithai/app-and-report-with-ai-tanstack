/**
 * Where a generated application listens by default.
 *
 * 4000 is the app itself — the address someone opens. The API sits beside it on
 * 4001. `port + 1` was the old rule, which put the app one above whatever the
 * API happened to be; naming both makes the pair predictable and keeps them off
 * 3000, where the modelling tool runs.
 */
export const DEFAULT_FRONTEND_PORT = 4000;
export const DEFAULT_BACKEND_PORT = 4001;
