/**
 * Centralized security tunables. Single source of truth so bumps here
 * propagate everywhere (auth, codes, future hashing).
 */

// 12 rounds ~ ~250ms per hash on modern hardware in 2025 — strong enough
// to slow brute force without destroying p95 sign-up latency.
export const PASSWORD_BCRYPT_ROUNDS = 12;

// 6-digit codes don't need bcrypt's full strength (small search space, short
// TTL, attempt-capped) but we keep the same cost so we have one number to
// reason about.
export const VERIFICATION_CODE_BCRYPT_ROUNDS = 12;
