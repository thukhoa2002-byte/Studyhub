const INITIAL_CALLS = 850;
let remaining = INITIAL_CALLS;

export function consumeAiCall() {
  if (remaining < 1) return null;
  remaining -= 1;
  return remaining;
}

export function getAiCallsRemaining() {
  return remaining;
}
