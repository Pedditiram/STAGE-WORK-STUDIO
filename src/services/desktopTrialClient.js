function origin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export async function requestDesktopTrial({ name, email, org, why }) {
  const res = await fetch('/api/desktop-trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'request',
      name,
      email,
      org,
      why,
      origin: origin(),
    }),
  });
  return res.json().catch(() => ({ success: false, error: 'Bad response' }));
}

export async function fetchDesktopTrialPublic() {
  const res = await fetch('/api/desktop-trial?action=public', { cache: 'no-store' });
  return res.json().catch(() => ({ success: false }));
}

export async function listDesktopTrialRequests(actor) {
  const res = await fetch('/api/desktop-trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list', actor, origin: origin() }),
  });
  return res.json().catch(() => ({ success: false, error: 'Bad response' }));
}

export async function decideDesktopTrial({ actor, requestId, action }) {
  const res = await fetch('/api/desktop-trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, actor, requestId, origin: origin() }),
  });
  return res.json().catch(() => ({ success: false, error: 'Bad response' }));
}

export async function setDesktopReleaseUrl({ actor, releaseUrl }) {
  const res = await fetch('/api/desktop-trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set-release-url', actor, releaseUrl, origin: origin() }),
  });
  return res.json().catch(() => ({ success: false, error: 'Bad response' }));
}
