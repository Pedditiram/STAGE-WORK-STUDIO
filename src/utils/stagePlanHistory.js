/**
 * Stage plan undo/redo. Snapshots are JSON clones of SHOT DIRECTOR plan.
 */

export function cloneStagePlan(plan) {
  try {
    return JSON.parse(JSON.stringify(plan || {}));
  } catch {
    return plan || {};
  }
}

export function createStagePlanHistory(limit = 40) {
  return { past: [], future: [], limit };
}

export function pushStagePlan(hist, plan) {
  if (!hist || plan == null) return hist;
  hist.past.push(cloneStagePlan(plan));
  if (hist.past.length > hist.limit) hist.past.shift();
  hist.future = [];
  return hist;
}

export function undoStagePlan(hist, current) {
  if (!hist?.past?.length) return null;
  hist.future.unshift(cloneStagePlan(current));
  return hist.past.pop();
}

export function redoStagePlan(hist, current) {
  if (!hist?.future?.length) return null;
  hist.past.push(cloneStagePlan(current));
  return hist.future.shift();
}
