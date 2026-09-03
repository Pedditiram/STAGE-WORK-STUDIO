import React, { useEffect, useState } from 'react';
import {
  BYOK_PROVIDERS,
  CREDIT_PACKS,
  getByokKeys,
  getLicense,
  setApiMode,
  setByokKey
} from '../utils/saasControl';
import { getCurrentUserEmail } from '../utils/projectPermissions';
import { checkoutCreditPack, fetchSaasStatus, syncManagedCredits } from '../services/saasGenerateClient';

export default function ByokKeysPanel() {
  const email = getCurrentUserEmail();
  const [keys, setKeys] = useState(() => getByokKeys(email));
  const [mode, setMode] = useState(() => getLicense(email).apiMode || 'byok');
  const [credits, setCredits] = useState(() => getLicense(email).credits ?? 0);
  const [stripeReady, setStripeReady] = useState(false);
  const [saved, setSaved] = useState('');
  const [packNote, setPackNote] = useState('');

  useEffect(() => {
    fetchSaasStatus().then((data) => {
      if (data?.stripe) setStripeReady(true);
    });
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('credits') === 'ok') {
        setPackNote('Payment received — pulling credits from the ledger…');
        params.delete('credits');
        params.delete('pack');
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({}, '', url);
        syncManagedCredits(email).then((res) => {
          if (res.ok) {
            setCredits(res.credits);
            setPackNote(`Credits updated: ${res.credits} on the ledger.`);
            try {
              window.dispatchEvent(new CustomEvent('sps_saas_changed', { detail: { creditRefresh: true } }));
            } catch {
              /* ignore */
            }
          } else {
            setPackNote(res.message || 'Payment received — credits will appear on the next heartbeat.');
          }
        });
      } else if (params.get('credits') === 'cancel') {
        setPackNote('Checkout cancelled.');
        params.delete('credits');
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({}, '', url);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onSaas = () => {
      const lic = getLicense(email);
      setCredits(lic.credits ?? 0);
      setMode(lic.apiMode || 'byok');
    };
    window.addEventListener('sps_saas_changed', onSaas);
    return () => window.removeEventListener('sps_saas_changed', onSaas);
  }, [email]);

  const buyPack = async (pack) => {
    setPackNote('');
    const res = await checkoutCreditPack(pack.id);
    if (res.url) {
      window.open(res.url, '_blank', 'noopener');
      setPackNote('Stripe checkout opened in a new tab.');
      return;
    }
    setPackNote(res.message || 'Stripe is not configured — ask the studio admin to grant credits.');
  };

  return (
    <div className="p-3 rounded-lg bg-zinc-950 border border-cyan-500/30 space-y-3">
      <p className="text-[11px] font-bold text-cyan-300 m-0 uppercase tracking-wide">AI providers · API keys</p>
      <p className="text-[11px] text-zinc-400 m-0 leading-relaxed">
        BYOK: keys stay on this account. Generation bills the provider, not Stage Work Studio. Managed mode uses studio credits instead.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`sps-btn text-xs ${mode === 'byok' ? 'sps-btn-primary' : ''}`}
          onClick={() => {
            setApiMode(email, 'byok');
            setMode('byok');
          }}
        >
          Bring your own key
        </button>
        <button
          type="button"
          className={`sps-btn text-xs ${mode === 'managed' ? 'sps-btn-primary' : ''}`}
          onClick={() => {
            setApiMode(email, 'managed');
            setMode('managed');
          }}
        >
          Stage Work Studio credits
        </button>
      </div>

      {mode === 'managed' ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-bold text-amber-200 m-0 uppercase tracking-wide">Managed credits</p>
            <span className="text-[11px] font-mono text-amber-100">{credits} credits</span>
          </div>
          <p className="text-[10px] text-zinc-400 m-0 leading-relaxed">
            Still image = 1 credit · video create = 2 credits. {stripeReady ? 'Pay with Stripe below.' : 'Owner grants packs in Settings → SaaS until Stripe is live.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className="sps-btn text-xs flex flex-col items-start gap-0.5 py-2 px-2.5 text-left"
                onClick={() => buyPack(pack)}
              >
                <span className="font-bold text-zinc-100">{pack.label}</span>
                <span className="text-[10px] text-zinc-400">${pack.usd} USD</span>
              </button>
            ))}
          </div>
          {packNote ? <p className="text-[11px] text-amber-300 m-0">{packNote}</p> : null}
        </div>
      ) : null}

      {BYOK_PROVIDERS.map((p) => (
        <label key={p.id} className="block space-y-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">{p.label}</span>
          <input
            type="password"
            autoComplete="off"
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] font-mono rounded-lg px-2 py-1.5"
            value={keys[p.id] || ''}
            placeholder={`${p.label} key`}
            onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
          />
        </label>
      ))}
      <button
        type="button"
        className="sps-btn sps-btn-primary text-xs"
        onClick={() => {
          BYOK_PROVIDERS.forEach((p) => setByokKey(email, p.id, keys[p.id] || ''));
          setSaved('Keys saved on this account only.');
        }}
      >
        Save keys
      </button>
      {saved ? <p className="text-[11px] text-amber-300 m-0">{saved}</p> : null}
    </div>
  );
}
