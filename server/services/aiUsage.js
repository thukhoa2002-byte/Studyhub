const DAILY_CALLS = Number.parseInt(process.env.GEMINI_DAILY_REQUEST_LIMIT || "500", 10);
let usageDate = getPacificDate();
let remaining = DAILY_CALLS;

function getPacificDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function resetForNewQuotaDay() {
  const today = getPacificDate();
  if (today === usageDate) return;
  usageDate = today;
  remaining = DAILY_CALLS;
}

export function consumeAiCall() {
  resetForNewQuotaDay();
  if (remaining < 1) return null;
  remaining -= 1;
  return remaining;
}

export function getAiCallsRemaining() {
  resetForNewQuotaDay();
  return remaining;
}
