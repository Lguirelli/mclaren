// Keep fractional progress throughout the route, including reduced-effects mode.
// Limiting travel per second also prevents cuts after anchor navigation or fast scrolling.
export function advanceCameraProgress(current, target, delta) {
  const dt = Math.max(0, Math.min(delta, 0.05));
  const difference = target - current;
  const easedStep = difference * (1 - Math.exp(-4.5 * dt));
  const maximumStep = 0.85 * dt;
  return current + Math.max(-maximumStep, Math.min(maximumStep, easedStep));
}
