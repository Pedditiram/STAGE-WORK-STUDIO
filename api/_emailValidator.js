/**
 * Email syntax, disposable domain, and DNS MX existence validator.
 * Rejects invalid, non-existent, fake, and typo email addresses with: 'invalid mail id'.
 */

import dns from 'dns';

const dnsPromises = dns.promises;

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

export async function validateEmail(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || email.length < 6 || email.length > 254) {
    return { valid: false, error: 'invalid mail id' };
  }

  // Practical RFC 5322 regex
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'invalid mail id' };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { valid: false, error: 'invalid mail id' };
  }
  const [localPart, domain] = parts;
  if (!localPart || !domain || localPart.length > 64) {
    return { valid: false, error: 'invalid mail id' };
  }

  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..')
  ) {
    return { valid: false, error: 'invalid mail id' };
  }

  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return { valid: false, error: 'invalid mail id' };
  }

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valid: false, error: 'invalid mail id' };
  }

  // Check known fake / disposable domains
  if (FAKE_DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, error: 'invalid mail id' };
  }

  // DNS MX & A record verification (checks if domain actually exists and receives mail)
  try {
    const mxPromise = dnsPromises.resolveMx(domain);
    const mx = await Promise.race([
      mxPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 2500))
    ]).catch((err) => err);

    if (Array.isArray(mx) && mx.length > 0) {
      return { valid: true, email, domain };
    }

    // Explicit domain not found
    if (mx?.code === 'ENOTFOUND' || mx?.code === 'NXDOMAIN') {
      return { valid: false, error: 'invalid mail id' };
    }

    // Fallback: check A records if MX returned ENODATA
    const aPromise = dnsPromises.resolve4(domain);
    const a = await Promise.race([
      aPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 2000))
    ]).catch((err) => err);

    if (Array.isArray(a) && a.length > 0) {
      return { valid: true, email, domain };
    }

    if (a?.code === 'ENOTFOUND' || a?.code === 'NXDOMAIN' || (mx?.code === 'ENODATA' && a?.code === 'ENODATA')) {
      return { valid: false, error: 'invalid mail id' };
    }

    return { valid: true, email, domain };
  } catch {
    // If DNS resolution is restricted by local network or timed out, allow legitimate format
    return { valid: true, email, domain };
  }
}
