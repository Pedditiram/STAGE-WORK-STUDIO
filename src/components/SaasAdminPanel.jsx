import React, { useMemo, useState, useEffect } from 'react';
import {
  SAAS_PLANS,
  CREDIT_PACKS,
  CREDIT_LOW_WATER,
  getAllLicenses,
  getLicense,
  setPlan,
  setLicenseStatus,
  setDeviceStatus,
  setLicenseFlag,
  setApiMode,
  forceLogout,
  saasSummary,
  getUsage,
  addCredits,
  saasLicensesToCsv,
  OWNER_EMAIL,
} from '../utils/saasControl';
import { getAuthorizedUsers, getCurrentUserEmail } from '../utils/projectPermissions';
import { checkoutCreditPack, grantCreditPack } from '../services/saasGenerateClient';
import { summarizeAllGenerationJobs } from '../utils/generationJobs';
import ExportLifecycleHub from './ExportLifecycleHub';
import {
  fetchCloudSyncHealth,
  fetchKvMigrationStatus,
  readCloudSyncHealth,
  runKvMigration,
  syncBackendLabel
} from '../utils/cloudSyncHealth';
import { exportDownloadText, EXPORT_LIFECYCLE } from '../utils/exportGate';
import { resolveActiveProjectTitle } from '../utils/creativeAuditLog';
import { estimateLocalStorageUsage, pruneLocalStoragePressure } from '../utils/safeStorage';

export default function SaasAdminPanel() {
  const users = getAuthorizedUsers();
  const actor = getCurrentUserEmail();
  const [email, setEmail] = useState(() => users[0]?.email || 'pedditiram@gmail.com');
  const [note, setNote] = useState('');
  const [tick, bump] = useState(0);
  const [syncHealth, setSyncHealth] = useState(() => readCloudSyncHealth());
  const [kvMigration, setKvMigration] = useState(null);
  const [migrateMsg, setMigrateMsg] = useState('');
  const [storage, setStorage] = useState(() => estimateLocalStorageUsage());
  const [ledgerPlanFilter, setLedgerPlanFilter] = useState('all');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('all');
  const [ledgerEmailQuery, setLedgerEmailQuery] = useState('');
  const [ledgerPlanPulse, setLedgerPlanPulse] = useState('');
  const [ledgerStatusPulse, setLedgerStatusPulse] = useState('');
  const [emailNoMatchPulse, setEmailNoMatchPulse] = useState(false);
  const refresh = () => bump((n) => n + 1);
  const refreshStorage = () => setStorage(estimateLocalStorageUsage());
  const lic = getLicense(email);
  const summary = saasSummary(email);
  const usage = getUsage();
  const ledger = useMemo(() => getAllLicenses(), [email, lic.status, lic.plan, lic.credits, tick]);
  const filteredLedger = useMemo(() => {
    const q = String(ledgerEmailQuery || '').trim().toLowerCase();
    return ledger.filter((row) => {
      if (ledgerPlanFilter !== 'all' && String(row?.plan || '').toLowerCase() !== ledgerPlanFilter) {
        return false;
      }
      if (ledgerStatusFilter !== 'all') {
        const st = String(row?.status || 'ACTIVE').toUpperCase();
        if (st !== ledgerStatusFilter) return false;
      }
      if (q && !String(row?.email || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledger, ledgerPlanFilter, ledgerStatusFilter, ledgerEmailQuery]);
  const ledgerStatusCounts = useMemo(() => {
    const q = String(ledgerEmailQuery || '').trim().toLowerCase();
    const base = ledger.filter((row) => {
      if (ledgerPlanFilter !== 'all' && String(row?.plan || '').toLowerCase() !== ledgerPlanFilter) {
        return false;
      }
      if (q && !String(row?.email || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const counts = { all: base.length, ACTIVE: 0, DISABLED: 0, REVOKED: 0 };
    for (const row of base) {
      const st = String(row?.status || 'ACTIVE').toUpperCase();
      if (st in counts && st !== 'all') counts[st] += 1;
    }
    return counts;
  }, [ledger, ledgerPlanFilter, ledgerEmailQuery]);
  const lowCreditLicenses = useMemo(
    () =>
      ledger.filter(
        (row) =>
          String(row?.apiMode || '').toLowerCase() === 'managed' &&
          Number(row?.credits || 0) <= CREDIT_LOW_WATER
      ),
    [ledger]
  );
  const jobLedger = useMemo(() => summarizeAllGenerationJobs({ limit: 10 }), [tick]);

  useEffect(() => {
    const onSync = () => setSyncHealth(readCloudSyncHealth());
    const onJobs = () => refresh();
    const onStorage = () => refreshStorage();
    window.addEventListener('sps_cloud_sync_health_updated', onSync);
    window.addEventListener('sps_cloud_sync_health', onSync);
    window.addEventListener('sps_generation_job_updated', onJobs);
    window.addEventListener('sps_storage_pressure', onStorage);
    return () => {
      window.removeEventListener('sps_cloud_sync_health_updated', onSync);
      window.removeEventListener('sps_cloud_sync_health', onSync);
      window.removeEventListener('sps_generation_job_updated', onJobs);
      window.removeEventListener('sps_storage_pressure', onStorage);
    };
  }, []);

  const refreshSync = async () => {
    const next = await fetchCloudSyncHealth();
    setSyncHealth(next);
    const mig = await fetchKvMigrationStatus();
    setKvMigration(mig);
  };

  useEffect(() => {
    fetchKvMigrationStatus().then(setKvMigration).catch(() => {});
  }, []);

  return (
    <div className="p-3 rounded-lg bg-zinc-950 border border-amber-500/30 space-y-4">
      <div>
        <p className="text-[11px] font-bold text-amber-300 m-0 uppercase tracking-wide">SaaS control</p>
        <p className="text-[11px] text-zinc-400 m-0 mt-1 leading-relaxed">
          Account, license, device, and features only. Stage Work Studio never controls the user&apos;s computer or files.
        </p>
      </div>

      <div className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 m-0">Cloud sync backend</p>
          <p className="text-[12px] font-mono text-zinc-200 m-0 mt-0.5">
            {syncBackendLabel(syncHealth?.backend)}
            {syncHealth?.kvConfigured ? ' · KV configured' : ''}
          </p>
          <p className="text-[10px] text-zinc-500 m-0 mt-0.5">
            {syncHealth?.checkedAt
              ? `Checked ${new Date(syncHealth.checkedAt).toLocaleString()}`
              : 'Not probed yet'}
          </p>
        </div>
        <button type="button" className="sps-btn text-[10px]" onClick={refreshSync}>
          Probe sync
        </button>
      </div>

      {kvMigration?.kvConfigured ? (
        <div className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 m-0">KV migration</p>
            <p className="text-[12px] font-mono text-zinc-200 m-0 mt-0.5">
              {kvMigration.ready ? 'KV populated' : kvMigration.needsMigration ? 'JSONBlob → KV needed' : 'Checking stores…'}
            </p>
            <p className="text-[10px] text-zinc-500 m-0 mt-0.5">
              {kvMigration.checkedAt
                ? `Checked ${new Date(kvMigration.checkedAt).toLocaleString()}`
                : 'Run migrate after KV env vars are live'}
            </p>
          </div>
          <button
            type="button"
            className="sps-btn text-[10px]"
            disabled={!kvMigration.needsMigration && kvMigration.ready}
            onClick={async () => {
              setMigrateMsg('Migrating…');
              const result = await runKvMigration({ force: false });
              setKvMigration(result.status || kvMigration);
              setMigrateMsg(
                result.ok
                  ? `Migrated ${(result.results || []).filter((r) => r.migrated).length} store(s)`
                  : result.error || 'Migration failed or nothing to copy'
              );
              await refreshSync();
            }}
          >
            Migrate to KV
          </button>
        </div>
      ) : null}
      {migrateMsg ? <p className="text-[11px] text-amber-300 m-0">{migrateMsg}</p> : null}

      <div className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 m-0">Local storage pressure</p>
          <p className="text-[12px] font-mono text-zinc-200 m-0 mt-0.5">
            {storage.mb} MB · ~{storage.pctOf5mb}% of 5 MB · {storage.keys} keys
          </p>
          <p className="text-[10px] text-zinc-500 m-0 mt-0.5">
            Prunes cloud caches, backups, old audits/jobs — never deletes project files on disk.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className="sps-btn text-[10px]" onClick={refreshStorage}>
            Refresh
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            onClick={() => {
              const result = pruneLocalStoragePressure({ keepVersions: 1 });
              refreshStorage();
              setNote(
                result.ok
                  ? `Pruned ${result.removed} cache key(s) · ${result.after?.mb ?? '?'} MB now`
                  : 'Prune failed'
              );
            }}
          >
            Prune cache
          </button>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">User</span>
        <select
          className="w-full bg-zinc-900 border border-zinc-700 text-amber-200 text-[11px] font-mono rounded-lg px-2 py-1.5"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        >
          {users.map((u) => (
            <option key={u.email} value={String(u.email).toLowerCase()}>
              {u.name || u.email} — {u.email}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono text-zinc-300">
        <p className="m-0">License: {summary.license}</p>
        <p className="m-0">Status: {summary.status}</p>
        <p className="m-0">Devices: {summary.devices}</p>
        <p className="m-0">API: {summary.apiMode}</p>
        <p className="m-0">Credits: {summary.credits}</p>
        <p className="m-0">Rate: {SAAS_PLANS[lic.plan]?.rateGeneratePerMin || 8}/min</p>
        <p className="m-0">Usage: {usage.generate || 0} gen / {usage.calls || 0} calls</p>
      </div>

      {lowCreditLicenses.length ? (
        <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-950/20 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-amber-400 m-0">
            Managed credits ≤ {CREDIT_LOW_WATER}
          </p>
          {lowCreditLicenses.map((row) => (
            <button
              key={row.email}
              type="button"
              className="block w-full text-left text-[11px] font-mono text-amber-100/90 m-0 truncate"
              onClick={() => setEmail(row.email)}
            >
              {row.email} · {row.credits ?? 0} cr · {row.status || '—'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/80 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 m-0">Generation job ledger</p>
          <p className="text-[10px] font-mono text-zinc-400 m-0">
            {jobLedger.pending} pending · {jobLedger.succeeded} done · {jobLedger.failed} failed
          </p>
        </div>
        {jobLedger.recent.length === 0 ? (
          <p className="text-[11px] text-zinc-500 m-0">No durable jobs on this device yet.</p>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {jobLedger.recent.map((j) => (
              <p key={j.id} className="text-[10px] font-mono text-zinc-400 m-0 truncate">
                {j.type}
                {j.engine ? ` · ${j.engine}` : ''}
                {' · '}
                {j.projectTitle || '—'} / {j.sceneShotId || j.id}
                {' · '}
                <span className="text-zinc-500">{j.status}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <ExportLifecycleHub />

      <div className="flex flex-wrap gap-2">
        <select
          className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] rounded-lg px-2 py-1"
          value={lic.plan}
          onChange={(e) => {
            setPlan(email, e.target.value);
            refresh();
          }}
        >
          {Object.values(SAAS_PLANS).map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <select
          className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] rounded-lg px-2 py-1"
          value={lic.apiMode || 'byok'}
          onChange={(e) => {
            setApiMode(email, e.target.value);
            refresh();
          }}
        >
          <option value="byok">BYOK — user pays provider</option>
          <option value="managed">Managed — Stage Work Studio credits</option>
        </select>
      </div>

      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase m-0 mb-2">Credit packs</p>
        <div className="flex flex-wrap gap-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className="sps-btn text-xs"
              onClick={async () => {
                const res = await checkoutCreditPack(pack.id);
                if (res.url) {
                  window.open(res.url, '_blank', 'noopener');
                  setNote('Stripe checkout opened.');
                  return;
                }
                if (String(actor).toLowerCase() === 'pedditiram@gmail.com') {
                  addCredits(email, pack.credits);
                  const grant = await grantCreditPack(email, pack.id, actor);
                  setNote(grant.success
                    ? `Granted ${pack.label} (ledger + local). Stripe not configured.`
                    : `Local +${pack.credits} credits. ${grant.error || res.message || ''}`);
                  refresh();
                  return;
                }
                setNote(res.message || 'Ask the owner to grant credits, or set STRIPE_SECRET_KEY.');
              }}
            >
              {pack.label} · ${pack.usd}
            </button>
          ))}
        </div>
        {note ? (
          note.includes('Clear to reset') ? (
            <p className="text-[11px] text-amber-300 m-0 mt-2">
              No licenses match email filter —{' '}
              <button
                type="button"
                className="text-amber-200 underline hover:text-amber-100 bg-transparent border-0 p-0 m-0 cursor-pointer font-inherit text-[11px]"
                title={(() => {
                  // P164 — after clear = plan + status scope (no email)
                  const n = ledger.filter((row) => {
                    if (
                      ledgerPlanFilter !== 'all' &&
                      String(row?.plan || '').toLowerCase() !== ledgerPlanFilter
                    ) {
                      return false;
                    }
                    if (ledgerStatusFilter !== 'all') {
                      const st = String(row?.status || 'ACTIVE').toUpperCase();
                      if (st !== ledgerStatusFilter) return false;
                    }
                    return true;
                  }).length;
                  return `Clear email filter · ${n} license${n === 1 ? '' : 's'} after clear`;
                })()}
                onClick={() => {
                  setLedgerEmailQuery('');
                  setEmailNoMatchPulse(false);
                  setLedgerPlanPulse('all');
                  window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                  setLedgerStatusPulse('all');
                  window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                  // P151 — top-note Clear uses no-match dismissed note
                  const msg = 'Email filter cleared (no-match dismissed)';
                  setNote(msg);
                  // P160 — top-note Clear sps_toast (parity with email Clear)
                  try {
                    window.dispatchEvent(
                      new CustomEvent('sps_toast', { detail: { message: msg } })
                    );
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Clear
              </button>{' '}
              to reset
            </p>
          ) : (
            <p className="text-[11px] text-amber-300 m-0 mt-2">{note}</p>
          )
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="sps-btn text-xs" onClick={() => { setLicenseStatus(email, lic.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'); refresh(); }}>
          {lic.status === 'ACTIVE' ? 'Disable account' : 'Activate account'}
        </button>
        <button type="button" className="sps-btn text-xs" onClick={() => { setLicenseStatus(email, 'REVOKED'); refresh(); }}>
          Revoke license
        </button>
        <button type="button" className="sps-btn text-xs" onClick={() => { forceLogout(email); refresh(); }}>
          Force logout
        </button>
        <button type="button" className="sps-btn text-xs" onClick={() => { setLicenseFlag(email, 'generate', lic.flags?.generate === false ? null : false); refresh(); }}>
          {lic.flags?.generate === false ? 'Enable generation' : 'Disable generation'}
        </button>
        <button type="button" className="sps-btn text-xs" onClick={() => { setLicenseFlag(email, 'export', lic.flags?.export === false ? null : false); refresh(); }}>
          {lic.flags?.export === false ? 'Enable export' : 'Disable export'}
        </button>
        <button type="button" className="sps-btn text-xs" onClick={() => { setLicenseFlag(email, 'collab', lic.flags?.collab === false ? null : false); refresh(); }}>
          {lic.flags?.collab === false ? 'Enable collab' : 'Disable collab'}
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase m-0 mb-2">Devices</p>
        <div className="space-y-1">
          {(lic.devices || []).length === 0 ? (
            <p className="text-[11px] text-zinc-500 m-0">No device has signed in yet.</p>
          ) : (
            (lic.devices || []).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-400 border border-zinc-800 rounded-lg px-2 py-1.5">
                <span className="truncate">{d.label || 'Device'} · {d.id.slice(0, 18)} · {d.status}{d.lastSeen ? ` · last ${new Date(d.lastSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                <button
                  type="button"
                  className="sps-btn text-[10px]"
                  onClick={() => {
                    setDeviceStatus(email, d.id, d.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED');
                    refresh();
                  }}
                >
                  {d.status === 'DISABLED' ? 'Activate device' : 'Deactivate device'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p
            className="text-[10px] text-zinc-600 m-0"
            title={`${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            }${
              filteredLedger.length !== ledger.length ? ` of ${ledger.length}` : ''
            } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
              ledgerEmailQuery.trim() || '—'
            }`}
            aria-label={`${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            }${
              filteredLedger.length !== ledger.length ? ` of ${ledger.length}` : ''
            } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
              ledgerEmailQuery.trim() || '—'
            }`}
          >
            {filteredLedger.length}
            {filteredLedger.length !== ledger.length ? ` of ${ledger.length}` : ''} license
            {filteredLedger.length === 1 ? '' : 's'}
            {ledgerPlanFilter !== 'all' || ledgerStatusFilter !== 'all' || ledgerEmailQuery.trim()
              ? ' (filtered)'
              : ''}
            . Heartbeats also write to storage/cloud when the API is up.
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className="sps-btn text-[10px]"
              title={`Download license ledger CSV · ${filteredLedger.length} license${
                filteredLedger.length === 1 ? '' : 's'
              } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
                ledgerEmailQuery.trim() || '—'
              } — one row per license`}
              aria-label={`Download license ledger CSV · ${filteredLedger.length} license${
                filteredLedger.length === 1 ? '' : 's'
              } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
                ledgerEmailQuery.trim() || '—'
              } — one row per license`}
              onClick={() => {
                const result = exportDownloadText(
                  'sps_saas_licenses_ledger.csv',
                  saasLicensesToCsv(filteredLedger),
                  {
                    projectTitle: resolveActiveProjectTitle() || 'StageWorks SaaS',
                    auditLabel: 'saas_licenses_csv',
                    auditFormat: 'csv',
                    mime: 'text/csv;charset=utf-8',
                    lifecycleMode: EXPORT_LIFECYCLE.NONE,
                    shots: [],
                    note: `${filteredLedger.length} licenses · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${ledgerEmailQuery.trim() || '—'} · actor:${actor || '—'}`
                  }
                );
                setNote(
                  result?.ok === false
                    ? result.message || 'Ledger export blocked'
                    : `Exported ${filteredLedger.length} license row${filteredLedger.length === 1 ? '' : 's'}`
                );
              }}
            >
              Ledger CSV
            </button>
            <button
              type="button"
              className="sps-btn text-[10px]"
              title={(() => {
                const deviceRows = filteredLedger.reduce(
                  (n, licRow) =>
                    n + Math.max(1, Array.isArray(licRow?.devices) ? licRow.devices.length : 0),
                  0
                );
                return `Download expanded ledger · ${filteredLedger.length} license${
                  filteredLedger.length === 1 ? '' : 's'
                } · ~${deviceRows} device row${deviceRows === 1 ? '' : 's'} · plan:${
                  ledgerPlanFilter
                } · status:${ledgerStatusFilter} · email:${ledgerEmailQuery.trim() || '—'}`;
              })()}
              aria-label={(() => {
                const deviceRows = filteredLedger.reduce(
                  (n, licRow) =>
                    n + Math.max(1, Array.isArray(licRow?.devices) ? licRow.devices.length : 0),
                  0
                );
                return `Download expanded ledger · ${filteredLedger.length} license${
                  filteredLedger.length === 1 ? '' : 's'
                } · ~${deviceRows} device row${deviceRows === 1 ? '' : 's'} · plan:${
                  ledgerPlanFilter
                } · status:${ledgerStatusFilter} · email:${ledgerEmailQuery.trim() || '—'}`;
              })()}
              onClick={() => {
                const deviceRows = filteredLedger.reduce(
                  (n, licRow) => n + Math.max(1, Array.isArray(licRow?.devices) ? licRow.devices.length : 0),
                  0
                );
                const result = exportDownloadText(
                  'sps_saas_licenses_devices.csv',
                  saasLicensesToCsv(filteredLedger, { expandDevices: true }),
                  {
                    projectTitle: resolveActiveProjectTitle() || 'StageWorks SaaS',
                    auditLabel: 'saas_licenses_devices_csv',
                    auditFormat: 'csv',
                    mime: 'text/csv;charset=utf-8',
                    lifecycleMode: EXPORT_LIFECYCLE.NONE,
                    shots: [],
                    note: `${deviceRows} device rows · ${filteredLedger.length} licenses · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${ledgerEmailQuery.trim() || '—'} · actor:${actor || '—'}`
                  }
                );
                setNote(
                  result?.ok === false
                    ? result.message || 'Device ledger export blocked'
                    : `Exported ${deviceRows} device row${deviceRows === 1 ? '' : 's'}`
                );
              }}
            >
              Devices CSV
            </button>
            <button
              type="button"
              className="sps-btn text-[10px]"
              title={(() => {
                const emails = filteredLedger
                  .map((row) => String(row?.email || '').trim())
                  .filter(Boolean);
                return `Copy filtered license emails · ${emails.length} email${
                  emails.length === 1 ? '' : 's'
                } · ${filteredLedger.length} license${
                  filteredLedger.length === 1 ? '' : 's'
                } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
                  ledgerEmailQuery.trim() || '—'
                }`;
              })()}
              aria-label={(() => {
                const emails = filteredLedger
                  .map((row) => String(row?.email || '').trim())
                  .filter(Boolean);
                return `Copy filtered license emails · ${emails.length} email${
                  emails.length === 1 ? '' : 's'
                } · ${filteredLedger.length} license${
                  filteredLedger.length === 1 ? '' : 's'
                } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
                  ledgerEmailQuery.trim() || '—'
                }`;
              })()}
              onClick={async () => {
                const emails = filteredLedger
                  .map((row) => String(row?.email || '').trim())
                  .filter(Boolean);
                if (!emails.length) {
                  setNote('No emails in the current filter');
                  return;
                }
                try {
                  await navigator.clipboard.writeText(emails.join('\n'));
                  setNote(`Copied ${emails.length} email${emails.length === 1 ? '' : 's'}`);
                } catch {
                  setNote('Clipboard copy failed');
                }
              }}
            >
              Copy emails
            </button>
            <button
              type="button"
              className="sps-btn text-[10px]"
              title={(() => {
                const emails = filteredLedger
                  .map((row) => String(row?.email || '').trim())
                  .filter(Boolean);
                return `Download filtered license emails as .txt · ${emails.length} email${
                  emails.length === 1 ? '' : 's'
                } · ${filteredLedger.length} license${
                  filteredLedger.length === 1 ? '' : 's'
                } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
                  ledgerEmailQuery.trim() || '—'
                } (export-gated)`;
              })()}
              aria-label={(() => {
                const emails = filteredLedger
                  .map((row) => String(row?.email || '').trim())
                  .filter(Boolean);
                return `Download filtered license emails as .txt · ${emails.length} email${
                  emails.length === 1 ? '' : 's'
                } · ${filteredLedger.length} license${
                  filteredLedger.length === 1 ? '' : 's'
                } · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${
                  ledgerEmailQuery.trim() || '—'
                } (export-gated)`;
              })()}
              onClick={() => {
                const emails = filteredLedger
                  .map((row) => String(row?.email || '').trim())
                  .filter(Boolean);
                if (!emails.length) {
                  setNote('No emails in the current filter');
                  return;
                }
                const result = exportDownloadText(
                  'sps_saas_licenses_emails.txt',
                  `${emails.join('\n')}\n`,
                  {
                    projectTitle: resolveActiveProjectTitle() || 'StageWorks SaaS',
                    auditLabel: 'saas_licenses_emails_txt',
                    auditFormat: 'txt',
                    mime: 'text/plain;charset=utf-8',
                    lifecycleMode: EXPORT_LIFECYCLE.NONE,
                    shots: [],
                    note: `${emails.length} emails · plan:${ledgerPlanFilter} · status:${ledgerStatusFilter} · email:${ledgerEmailQuery.trim() || '—'} · actor:${actor || '—'}`
                  }
                );
                setNote(
                  result?.ok === false
                    ? result.message || 'Emails export blocked'
                    : `Exported ${emails.length} email${emails.length === 1 ? '' : 's'} (.txt)`
                );
              }}
            >
              Emails TXT
            </button>
            <button
              type="button"
              className="sps-btn text-[10px]"
              title={(() => {
                const n = filteredLedger.filter((row) => {
                  const st = String(row?.status || '').toUpperCase();
                  if (st !== 'DISABLED') return false;
                  const em = String(row?.email || '').trim().toLowerCase();
                  return em && em !== OWNER_EMAIL;
                }).length;
                return `Revoke filtered · ${n} revokable DISABLED license${
                  n === 1 ? '' : 's'
                } in scope (owner skipped)`;
              })()}
              aria-label={(() => {
                const n = filteredLedger.filter((row) => {
                  const st = String(row?.status || '').toUpperCase();
                  if (st !== 'DISABLED') return false;
                  const em = String(row?.email || '').trim().toLowerCase();
                  return em && em !== OWNER_EMAIL;
                }).length;
                return `Revoke filtered · ${n} revokable DISABLED license${
                  n === 1 ? '' : 's'
                } in scope (owner skipped)`;
              })()}
              onClick={() => {
                const targets = filteredLedger.filter((row) => {
                  const st = String(row?.status || '').toUpperCase();
                  if (st !== 'DISABLED') return false;
                  const em = String(row?.email || '').trim().toLowerCase();
                  if (!em || em === OWNER_EMAIL) return false;
                  return true;
                });
                if (!targets.length) {
                  setNote('No DISABLED licenses in the current filter (owner never revoked)');
                  return;
                }
                const preview = targets
                  .slice(0, 5)
                  .map((r) => r.email)
                  .join(', ');
                const ok = window.confirm(
                  `Revoke ${targets.length} DISABLED license${targets.length === 1 ? '' : 's'}?\n\n${preview}${
                    targets.length > 5 ? '…' : ''
                  }\n\nThis blocks sign-in until restored.`
                );
                if (!ok) return;
                let n = 0;
                for (const row of targets) {
                  setLicenseStatus(row.email, 'REVOKED');
                  n += 1;
                }
                refresh();
                setNote(`Revoked ${n} license${n === 1 ? '' : 's'} from filter`);
              }}
            >
              Revoke filtered
            </button>
            <button
              type="button"
              className="sps-btn text-[10px]"
              title={(() => {
                const n = filteredLedger.filter((row) => {
                  const st = String(row?.status || '').toUpperCase();
                  if (st !== 'REVOKED') return false;
                  const em = String(row?.email || '').trim().toLowerCase();
                  return em && em !== OWNER_EMAIL;
                }).length;
                return `Restore filtered · ${n} revokable REVOKED license${
                  n === 1 ? '' : 's'
                } in scope (owner skipped)`;
              })()}
              aria-label={(() => {
                const n = filteredLedger.filter((row) => {
                  const st = String(row?.status || '').toUpperCase();
                  if (st !== 'REVOKED') return false;
                  const em = String(row?.email || '').trim().toLowerCase();
                  return em && em !== OWNER_EMAIL;
                }).length;
                return `Restore filtered · ${n} revokable REVOKED license${
                  n === 1 ? '' : 's'
                } in scope (owner skipped)`;
              })()}
              onClick={() => {
                const targets = filteredLedger.filter((row) => {
                  const st = String(row?.status || '').toUpperCase();
                  if (st !== 'REVOKED') return false;
                  const em = String(row?.email || '').trim().toLowerCase();
                  if (!em || em === OWNER_EMAIL) return false;
                  return true;
                });
                if (!targets.length) {
                  setNote('No REVOKED licenses in the current filter');
                  return;
                }
                const preview = targets
                  .slice(0, 5)
                  .map((r) => r.email)
                  .join(', ');
                const ok = window.confirm(
                  `Restore ${targets.length} REVOKED license${targets.length === 1 ? '' : 's'} to ACTIVE?\n\n${preview}${
                    targets.length > 5 ? '…' : ''
                  }`
                );
                if (!ok) return;
                let n = 0;
                for (const row of targets) {
                  setLicenseStatus(row.email, 'ACTIVE');
                  n += 1;
                }
                refresh();
                setNote(`Restored ${n} license${n === 1 ? '' : 's'} to ACTIVE`);
              }}
            >
              Restore filtered
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span
            className="text-[9px] uppercase tracking-widest text-zinc-500 mr-1"
            title={`Filter ledger by email · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in current scope`}
            aria-label={`Filter ledger by email · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in current scope`}
          >
            Email
          </span>
          <input
            type="search"
            value={ledgerEmailQuery}
            onChange={(e) => {
              setLedgerEmailQuery(e.target.value);
              // P148 — email typing clears emailNoMatchPulse
              if (emailNoMatchPulse) setEmailNoMatchPulse(false);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              // P135/P136 — Enter clears focus; pulse All status only when query empty
              e.currentTarget.blur();
              const q = String(ledgerEmailQuery || '').trim();
              if (!q) {
                setLedgerStatusPulse('all');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                setNote(
                  `Email cleared · ${filteredLedger.length} license${
                    filteredLedger.length === 1 ? '' : 's'
                  } in scope`
                );
                return;
              }
              if (filteredLedger.length === 0) {
                // P137 — no-match Enter pulses All plan chip (not status)
                setLedgerPlanPulse('all');
                window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                // P138 — note suggests Clear
                setNote('No licenses match email filter — Clear to reset');
                // P141 — pulse near-email No match — Clear link
                setEmailNoMatchPulse(true);
                window.setTimeout(() => setEmailNoMatchPulse(false), 3000);
              } else {
                setNote(
                  `Email filter · ${filteredLedger.length} license${
                    filteredLedger.length === 1 ? '' : 's'
                  }`
                );
              }
            }}
            placeholder="Search email…"
            className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 min-w-[10rem]"
            title={`Filter ledger by email substring · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in scope — Enter confirms`}
            aria-label={`Filter ledger by email substring · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in scope — Enter confirms`}
          />
          {ledgerEmailQuery.trim() ? (
            <button
              type="button"
              className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-zinc-700 text-zinc-500"
              title={(() => {
                // P164 — email Clear title includes license count after clear scope
                const n = ledger.filter((row) => {
                  if (
                    ledgerPlanFilter !== 'all' &&
                    String(row?.plan || '').toLowerCase() !== ledgerPlanFilter
                  ) {
                    return false;
                  }
                  if (ledgerStatusFilter !== 'all') {
                    const st = String(row?.status || 'ACTIVE').toUpperCase();
                    if (st !== ledgerStatusFilter) return false;
                  }
                  return true;
                }).length;
                return `Clear email filter · ${n} license${n === 1 ? '' : 's'} after clear`;
              })()}
              aria-label={(() => {
                const n = ledger.filter((row) => {
                  if (
                    ledgerPlanFilter !== 'all' &&
                    String(row?.plan || '').toLowerCase() !== ledgerPlanFilter
                  ) {
                    return false;
                  }
                  if (ledgerStatusFilter !== 'all') {
                    const st = String(row?.status || 'ACTIVE').toUpperCase();
                    if (st !== ledgerStatusFilter) return false;
                  }
                  return true;
                }).length;
                return `Clear email filter · ${n} license${n === 1 ? '' : 's'} after clear`;
              })()}
              onClick={() => {
                const hadNoMatchPulse = emailNoMatchPulse;
                setLedgerEmailQuery('');
                // P134 — email Clear also pulses All plan + status chips
                // P143 — also clears emailNoMatchPulse
                setEmailNoMatchPulse(false);
                setLedgerPlanPulse('all');
                window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                setLedgerStatusPulse('all');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                // P149 — note when clearing after no-match pulse
                const msg = hadNoMatchPulse
                  ? 'Email filter cleared (no-match dismissed)'
                  : 'Email filter cleared';
                setNote(msg);
                // P159 — email Clear sps_toast
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              Clear
            </button>
          ) : null}
          {/* P140/P141 — no-match Clear link near email; pulses after Enter */}
          {ledgerEmailQuery.trim() && filteredLedger.length === 0 ? (
            <button
              type="button"
              className={`text-[9px] font-mono text-amber-300/90 hover:underline ${
                emailNoMatchPulse ? 'ring-1 ring-amber-400 animate-pulse rounded px-1' : ''
              }`}
              title={(() => {
                const n = ledger.filter((row) => {
                  if (
                    ledgerPlanFilter !== 'all' &&
                    String(row?.plan || '').toLowerCase() !== ledgerPlanFilter
                  ) {
                    return false;
                  }
                  if (ledgerStatusFilter !== 'all') {
                    const st = String(row?.status || 'ACTIVE').toUpperCase();
                    if (st !== ledgerStatusFilter) return false;
                  }
                  return true;
                }).length;
                return `Clear email filter — no licenses match · ${n} license${
                  n === 1 ? '' : 's'
                } after clear`;
              })()}
              aria-label={(() => {
                const n = ledger.filter((row) => {
                  if (
                    ledgerPlanFilter !== 'all' &&
                    String(row?.plan || '').toLowerCase() !== ledgerPlanFilter
                  ) {
                    return false;
                  }
                  if (ledgerStatusFilter !== 'all') {
                    const st = String(row?.status || 'ACTIVE').toUpperCase();
                    if (st !== ledgerStatusFilter) return false;
                  }
                  return true;
                }).length;
                return `Clear email filter — no licenses match · ${n} license${
                  n === 1 ? '' : 's'
                } after clear`;
              })()}
              onClick={() => {
                setLedgerEmailQuery('');
                setEmailNoMatchPulse(false);
                setLedgerPlanPulse('all');
                window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                setLedgerStatusPulse('all');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                // P150 — No match — Clear uses no-match dismissed note
                const msg = 'Email filter cleared (no-match dismissed)';
                setNote(msg);
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              No match — Clear
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span
            className="text-[9px] uppercase tracking-widest text-zinc-500 mr-1"
            title={`Filter ledger by SaaS plan · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in current scope`}
            aria-label={`Filter ledger by SaaS plan · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in current scope`}
          >
            Plan
          </span>
          {[
            { id: 'all', label: 'All' },
            ...Object.values(SAAS_PLANS).map((p) => ({ id: p.id, label: p.label }))
          ].map((opt) => (
            <button
              key={`plan-${opt.id}`}
              type="button"
              className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                ledgerPlanFilter === opt.id
                  ? 'border-amber-500/60 text-amber-300'
                  : 'border-zinc-700 text-zinc-500'
              } ${ledgerPlanPulse === opt.id ? 'ring-1 ring-amber-400 animate-pulse' : ''}`}
              title={(() => {
                const q = String(ledgerEmailQuery || '').trim().toLowerCase();
                const count = ledger.filter((row) => {
                  if (
                    opt.id !== 'all' &&
                    String(row?.plan || '').toLowerCase() !== opt.id
                  ) {
                    return false;
                  }
                  if (
                    ledgerStatusFilter !== 'all' &&
                    String(row?.status || 'ACTIVE').toUpperCase() !== ledgerStatusFilter
                  ) {
                    return false;
                  }
                  if (q && !String(row?.email || '').toLowerCase().includes(q)) return false;
                  return true;
                }).length;
                if (opt.id === 'all' && ledgerPlanFilter === 'all') {
                  return `Already All — click again to clear email + status · ${ledger.length} license${
                    ledger.length === 1 ? '' : 's'
                  }`;
                }
                // P166 — plan chip title includes license count in scope
                return `Filter ledger by plan: ${opt.label} · ${count} license${
                  count === 1 ? '' : 's'
                } in scope`;
              })()}
              aria-label={(() => {
                const q = String(ledgerEmailQuery || '').trim().toLowerCase();
                const count = ledger.filter((row) => {
                  if (
                    opt.id !== 'all' &&
                    String(row?.plan || '').toLowerCase() !== opt.id
                  ) {
                    return false;
                  }
                  if (
                    ledgerStatusFilter !== 'all' &&
                    String(row?.status || 'ACTIVE').toUpperCase() !== ledgerStatusFilter
                  ) {
                    return false;
                  }
                  if (q && !String(row?.email || '').toLowerCase().includes(q)) return false;
                  return true;
                }).length;
                if (opt.id === 'all' && ledgerPlanFilter === 'all') {
                  return `Already All — click again to clear email + status · ${ledger.length} license${
                    ledger.length === 1 ? '' : 's'
                  }`;
                }
                return `Filter ledger by plan: ${opt.label} · ${count} license${
                  count === 1 ? '' : 's'
                } in scope`;
              })()}
              onClick={() => {
                // P125 — re-click All plan clears email + status (+ pulse)
                if (opt.id === 'all' && ledgerPlanFilter === 'all') {
                  setLedgerStatusFilter('all');
                  setLedgerEmailQuery('');
                  setLedgerPlanPulse('all');
                  window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                  // P147 — plan select clears emailNoMatchPulse
                  setEmailNoMatchPulse(false);
                  const msg = `Plan All · email + status cleared · ${ledger.length} licenses`;
                  setNote(msg);
                  // P168 — plan select sps_toast with license count
                  try {
                    window.dispatchEvent(
                      new CustomEvent('sps_toast', { detail: { message: msg } })
                    );
                  } catch {
                    /* ignore */
                  }
                  return;
                }
                setLedgerPlanFilter(opt.id);
                // P130 — pulse plan chip when selecting a plan (incl. All from another filter)
                setLedgerPlanPulse(opt.id);
                window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                // P147 — plan select clears emailNoMatchPulse
                setEmailNoMatchPulse(false);
                // P133 — plan select note includes license count in scope
                const q = String(ledgerEmailQuery || '').trim().toLowerCase();
                const count = ledger.filter((row) => {
                  if (
                    opt.id !== 'all' &&
                    String(row?.plan || '').toLowerCase() !== opt.id
                  ) {
                    return false;
                  }
                  if (
                    ledgerStatusFilter !== 'all' &&
                    String(row?.status || 'ACTIVE').toUpperCase() !== ledgerStatusFilter
                  ) {
                    return false;
                  }
                  if (q && !String(row?.email || '').toLowerCase().includes(q)) return false;
                  return true;
                }).length;
                const msg = `Plan · ${opt.label} · ${count} license${count === 1 ? '' : 's'} in scope`;
                setNote(msg);
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span
            className="text-[9px] uppercase tracking-widest text-zinc-500 mr-1"
            title={`Filter ledger by license status · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in current scope`}
            aria-label={`Filter ledger by license status · ${filteredLedger.length} license${
              filteredLedger.length === 1 ? '' : 's'
            } in current scope`}
          >
            Status
          </span>
          {[
            { id: 'all', label: 'All' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'DISABLED', label: 'Disabled' },
            { id: 'REVOKED', label: 'Revoked' }
          ].map((opt) => {
            const count =
              opt.id === 'all'
                ? ledgerStatusCounts.all
                : ledgerStatusCounts[opt.id] ?? 0;
            return (
              <button
                key={`status-${opt.id}`}
                type="button"
                className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                  ledgerStatusFilter === opt.id
                    ? 'border-amber-500/60 text-amber-300'
                    : 'border-zinc-700 text-zinc-500'
                } ${ledgerStatusPulse === opt.id ? 'ring-1 ring-amber-400 animate-pulse' : ''}`}
                onClick={() => {
                  // P126 — re-click All status clears email + plan (+ pulse plan All)
                  if (opt.id === 'all' && ledgerStatusFilter === 'all') {
                    setLedgerPlanFilter('all');
                    setLedgerEmailQuery('');
                    setLedgerPlanPulse('all');
                    window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                    // P146 — status select clears emailNoMatchPulse
                    setEmailNoMatchPulse(false);
                    const msg = `Status All · email + plan cleared · ${ledger.length} licenses`;
                    setNote(msg);
                    // P169 — status select sps_toast with license count
                    try {
                      window.dispatchEvent(
                        new CustomEvent('sps_toast', { detail: { message: msg } })
                      );
                    } catch {
                      /* ignore */
                    }
                    return;
                  }
                  setLedgerStatusFilter(opt.id);
                  // P131 — pulse status chip on select (parity with Jump)
                  setLedgerStatusPulse(opt.id);
                  window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                  // P146 — status select clears emailNoMatchPulse
                  setEmailNoMatchPulse(false);
                  // P132 — note includes count when selecting a status chip
                  const msg = `Status · ${opt.label} · ${count} license${count === 1 ? '' : 's'} in scope`;
                  setNote(msg);
                  try {
                    window.dispatchEvent(
                      new CustomEvent('sps_toast', { detail: { message: msg } })
                    );
                  } catch {
                    /* ignore */
                  }
                }}
                title={
                  opt.id === 'all' && ledgerStatusFilter === 'all'
                    ? `Already All — click again to clear email + plan · ${count} license${
                        count === 1 ? '' : 's'
                      }`
                    : // P167 — status chip title includes license count in scope
                      `Filter ledger by status: ${opt.label} · ${count} license${
                        count === 1 ? '' : 's'
                      } in scope`
                }
                aria-label={
                  opt.id === 'all' && ledgerStatusFilter === 'all'
                    ? `Already All — click again to clear email + plan · ${count} license${
                        count === 1 ? '' : 's'
                      }`
                    : `Filter ledger by status: ${opt.label} · ${count} license${
                        count === 1 ? '' : 's'
                      } in scope`
                }
              >
                {opt.label} · {count}
              </button>
            );
          })}
          {ledgerStatusCounts.DISABLED > 0 && ledgerStatusFilter !== 'DISABLED' ? (
            <button
              type="button"
              className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-amber-500/60 text-amber-300"
              title={`Jump Disabled · ${ledgerStatusCounts.DISABLED} license${
                ledgerStatusCounts.DISABLED === 1 ? '' : 's'
              } in current plan/email scope`}
              aria-label={`Jump Disabled · ${ledgerStatusCounts.DISABLED} license${
                ledgerStatusCounts.DISABLED === 1 ? '' : 's'
              } in current plan/email scope`}
              onClick={() => {
                setLedgerStatusFilter('DISABLED');
                // P129 — pulse target status chip
                setLedgerStatusPulse('DISABLED');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                // P145 — Jump chips clear emailNoMatchPulse
                setEmailNoMatchPulse(false);
                // P154 — Jump Disabled note includes license count
                const n = ledgerStatusCounts.DISABLED;
                const msg = `Jump Disabled · ${n} license${n === 1 ? '' : 's'}`;
                setNote(msg);
                // P156 — sps_toast with count
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              Jump Disabled · {ledgerStatusCounts.DISABLED}
            </button>
          ) : null}
          {ledgerStatusCounts.REVOKED > 0 && ledgerStatusFilter !== 'REVOKED' ? (
            <button
              type="button"
              className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-amber-500/60 text-amber-300"
              title={`Jump Revoked · ${ledgerStatusCounts.REVOKED} license${
                ledgerStatusCounts.REVOKED === 1 ? '' : 's'
              } in current plan/email scope`}
              aria-label={`Jump Revoked · ${ledgerStatusCounts.REVOKED} license${
                ledgerStatusCounts.REVOKED === 1 ? '' : 's'
              } in current plan/email scope`}
              onClick={() => {
                setLedgerStatusFilter('REVOKED');
                setLedgerStatusPulse('REVOKED');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                setEmailNoMatchPulse(false);
                // P155 — Jump Revoked note includes license count
                const n = ledgerStatusCounts.REVOKED;
                const msg = `Jump Revoked · ${n} license${n === 1 ? '' : 's'}`;
                setNote(msg);
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              Jump Revoked · {ledgerStatusCounts.REVOKED}
            </button>
          ) : null}
          {(ledgerStatusFilter === 'DISABLED' || ledgerStatusFilter === 'REVOKED') &&
          ledgerStatusCounts.ACTIVE > 0 ? (
            <button
              type="button"
              className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-amber-500/60 text-amber-300"
              title={`Jump Active · ${ledgerStatusCounts.ACTIVE} license${
                ledgerStatusCounts.ACTIVE === 1 ? '' : 's'
              } in current plan/email scope`}
              aria-label={`Jump Active · ${ledgerStatusCounts.ACTIVE} license${
                ledgerStatusCounts.ACTIVE === 1 ? '' : 's'
              } in current plan/email scope`}
              onClick={() => {
                setLedgerStatusFilter('ACTIVE');
                setLedgerStatusPulse('ACTIVE');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                setEmailNoMatchPulse(false);
                // P155 — Jump Active note includes license count
                const n = ledgerStatusCounts.ACTIVE;
                const msg = `Jump Active · ${n} license${n === 1 ? '' : 's'}`;
                setNote(msg);
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              Jump Active · {ledgerStatusCounts.ACTIVE}
            </button>
          ) : null}
          {ledgerStatusFilter !== 'all' ? (
            <button
              type="button"
              className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-zinc-600 text-zinc-300"
              title={
                (() => {
                  const n = ledgerStatusCounts.all;
                  return `Jump All · ${n} license${n === 1 ? '' : 's'} — Alt+click also clears plan + email`;
                })()
              }
              aria-label={(() => {
                const n = ledgerStatusCounts.all;
                return `Jump All · ${n} license${n === 1 ? '' : 's'} — Alt+click also clears plan + email`;
              })()}
              onClick={(e) => {
                const hadNoMatchPulse = emailNoMatchPulse;
                setLedgerStatusFilter('all');
                // P128 — pulse All status chip on Jump All
                setLedgerStatusPulse('all');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                // P144 — Jump All clears emailNoMatchPulse
                setEmailNoMatchPulse(false);
                const dismiss = hadNoMatchPulse ? ' (no-match dismissed)' : '';
                const n = ledgerStatusCounts.all;
                // P161 — Jump All sps_toast uses Jump All · count (parity with other Jump chips)
                const msg = e.altKey
                  ? `Jump All · ${n} license${n === 1 ? '' : 's'} · plan + email cleared${dismiss}`
                  : `Jump All · ${n} license${n === 1 ? '' : 's'}${dismiss}`;
                if (e.altKey) {
                  setLedgerPlanFilter('all');
                  setLedgerEmailQuery('');
                  // P124 — pulse All plan chip when Alt+Jump All clears plan
                  setLedgerPlanPulse('all');
                  window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                }
                setNote(msg);
                // P157 — Jump All sps_toast with license count
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              Jump All · {ledgerStatusCounts.all}
            </button>
          ) : null}
          {ledgerPlanFilter !== 'all' ||
          ledgerStatusFilter !== 'all' ||
          ledgerEmailQuery.trim() ? (
            <button
              type="button"
              className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-zinc-600 text-zinc-400"
              title={`Clear plan, status, and email filters · ${ledger.length} license${
                ledger.length === 1 ? '' : 's'
              }`}
              aria-label={`Clear plan, status, and email filters · ${ledger.length} license${
                ledger.length === 1 ? '' : 's'
              }`}
              onClick={() => {
                const hadNoMatchPulse = emailNoMatchPulse;
                setLedgerPlanFilter('all');
                setLedgerStatusFilter('all');
                setLedgerEmailQuery('');
                // P142 — Clear filters clears emailNoMatchPulse
                setEmailNoMatchPulse(false);
                // P123 — flash All plan chip so reset is visible
                setLedgerPlanPulse('all');
                window.setTimeout(() => setLedgerPlanPulse(''), 3000);
                // P127 — also pulse All status chip
                setLedgerStatusPulse('all');
                window.setTimeout(() => setLedgerStatusPulse(''), 3000);
                // P152 — note mentions no-match dismissed when pulse was on
                const msg = hadNoMatchPulse
                  ? `All ledger filters cleared · ${ledger.length} licenses (no-match dismissed)`
                  : `All ledger filters cleared · ${ledger.length} licenses`;
                setNote(msg);
                // P158 — Clear filters sps_toast with license count
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', { detail: { message: msg } })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
