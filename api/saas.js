/**
 * SaaS license heartbeat, credits, checkout.
 * Does not access the user's filesystem or machine — account/license only.
 */

import {
  CREDIT_PACKS,
  OWNER_EMAIL,
  checkServerRate,
  consumeServerCredits,
  getOrCreateRow,
  grantServerCredits,
  readLedger,
  saveRow,
} from './_saasLedger.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body || {};
    const action = String(body.action || (req.method === 'GET' ? 'status' : 'heartbeat'));
    const email = String(body.email || '').trim().toLowerCase();
    const deviceId = String(body.deviceId || '').trim();

    if (action === 'status' || req.method === 'GET') {
      return res.status(200).json({
        success: true,
        licenses: readLedger().length,
        authority: 'saas',
        packs: CREDIT_PACKS,
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      });
    }

    if (!email) {
      return res.status(400).json({ success: false, error: 'email required' });
    }

    if (action === 'heartbeat' || action === 'register') {
      const { list, idx, row } = getOrCreateRow(email);
      row.lastConnection = new Date().toISOString();
      row.heartbeats = [...(row.heartbeats || []), { at: row.lastConnection, deviceId }].slice(-40);
      if (deviceId) {
        const devices = Array.isArray(row.devices) ? row.devices : [];
        const d = devices.find((x) => x.id === deviceId);
        if (d) d.lastSeen = row.lastConnection;
        else devices.push({ id: deviceId, lastSeen: row.lastConnection, status: 'ACTIVE' });
        row.devices = devices;
      }
      saveRow(list, idx, row);
      return res.status(200).json({
        success: true,
        ok: row.status === 'ACTIVE',
        license: { email: row.email, plan: row.plan, status: row.status, credits: row.credits, apiMode: row.apiMode },
      });
    }

    if (action === 'consume') {
      const rate = checkServerRate(email, getOrCreateRow(email).row.plan);
      if (!rate.ok) {
        return res.status(429).json({ success: false, error: `Rate limit ${rate.max}/min. Wait ${rate.waitSec}s.` });
      }
      const used = consumeServerCredits(email, body.n || 1);
      if (!used.ok) return res.status(402).json({ success: false, error: used.error });
      return res.status(200).json({ success: true, credits: used.credits });
    }

    if (action === 'grant-credits') {
      const actor = String(body.actor || '').trim().toLowerCase();
      if (actor !== OWNER_EMAIL) {
        return res.status(403).json({ success: false, error: 'Only the studio admin can grant credits.' });
      }
      const pack = CREDIT_PACKS.find((p) => p.id === body.packId);
      const amount = pack ? pack.credits : Number(body.credits) || 0;
      if (!amount) return res.status(400).json({ success: false, error: 'packId or credits required' });
      const row = grantServerCredits(email, amount);
      return res.status(200).json({ success: true, credits: row.credits, granted: amount });
    }

    if (action === 'checkout') {
      const pack = CREDIT_PACKS.find((p) => p.id === body.packId) || CREDIT_PACKS[0];
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) {
        return res.status(200).json({
          success: true,
          mode: 'ledger',
          pack,
          message: 'Stripe is not configured. Owner can grant this pack in Settings → SaaS.',
        });
      }
      const origin = String(body.origin || 'https://www.stageworkstudio.com').replace(/\/$/, '');
      const params = new URLSearchParams({
        mode: 'payment',
        success_url: `${origin}/?credits=ok&pack=${pack.id}`,
        cancel_url: `${origin}/?credits=cancel`,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(pack.usd * 100),
        'line_items[0][price_data][product_data][name]': `Stage Work Studio ${pack.label}`,
        'client_reference_id': email,
        'metadata[email]': email,
        'metadata[pack]': pack.id,
      });
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      const data = await stripeRes.json();
      if (!stripeRes.ok || !data.url) {
        return res.status(400).json({ success: false, error: data.error?.message || 'Stripe checkout failed' });
      }
      return res.status(200).json({ success: true, mode: 'stripe', url: data.url, pack });
    }

    return res.status(400).json({ success: false, error: 'unknown action' });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message || 'saas failed' });
  }
}
