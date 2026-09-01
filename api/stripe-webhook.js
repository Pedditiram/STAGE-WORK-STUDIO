/**
 * Stripe → credit ledger. Does not touch the user's computer.
 * Configure endpoint: POST /api/stripe-webhook
 * Env: STRIPE_WEBHOOK_SECRET
 */

import crypto from 'crypto';
import { grantFromStripeSession } from './_saasLedger.js';

export const config = {
  api: { bodyParser: false },
};

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifyStripeSignature(rawBody, header, secret) {
  const parts = String(header || '').split(',').map((p) => p.trim());
  const ts = parts.find((p) => p.startsWith('t='))?.slice(2);
  const v1 = parts.find((p) => p.startsWith('v1='))?.slice(3);
  if (!ts || !v1 || !secret) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return timingSafeEqual(expected, v1);
}

async function readRaw(req) {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const raw = await readRaw(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const sig = req.headers?.['stripe-signature'] || req.headers?.['Stripe-Signature'] || '';
    if (secret && !verifyStripeSignature(raw, sig, secret)) {
      return res.status(400).json({ success: false, error: 'Invalid Stripe signature' });
    }
    const event = JSON.parse(raw || '{}');
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object || {};
      const granted = grantFromStripeSession(session);
      if (!granted.ok) return res.status(400).json({ success: false, error: granted.error });
      return res.status(200).json({ success: true, ...granted });
    }
    return res.status(200).json({ success: true, ignored: event.type || 'unknown' });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message || 'webhook failed' });
  }
}
