/**
 * Strict Email validation for user-facing forms (Signup, Desktop Trial, Collab Login).
 * Detects invalid syntax, malformed domains, and known fake/disposable providers.
 */

export const FAKE_DISPOSABLE_DOMAINS = new Set([
  'test.com',
  'example.com',
  'example.org',
  'example.net',
  'fake.com',
  'asdf.com',
  'invalid.com',
  'none.com',
  'null.com',
  'dummy.com',
  'sample.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.com',
  'throwawaymail.com',
  'yopmail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'dispostable.com',
  'trashmail.com',
  '10minutemail.com',
  'fakeinbox.com',
  'spamgourmet.com',
  'getairmail.com',
  'mytemp.email',
  'gmai.com',
  'gamil.com',
  'gmial.com',
  'hotmial.com',
  'yaho.com',
  'yaho.co',
  'outlok.com'
]);

export function isValidEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') return false;
  const email = rawEmail.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return false;

  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!EMAIL_REGEX.test(email)) return false;

  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [localPart, domain] = parts;
  if (!localPart || !domain || localPart.length > 64) return false;

  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..')
  ) {
    return false;
  }

  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) return false;

  if (FAKE_DISPOSABLE_DOMAINS.has(domain)) return false;

  return true;
}

export function validateClientEmail(rawEmail) {
  if (!isValidEmail(rawEmail)) {
    return { valid: false, error: 'invalid mail id' };
  }
  return { valid: true, email: String(rawEmail || '').trim().toLowerCase() };
}
