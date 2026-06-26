import { useState, useEffect } from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { fetchDataFreshness } from '../services/api.js';

/**
 * Surfaces how current the live CTHRU data is. Shows a prominent warning
 * banner during the Comptroller's publishing outage (spending feed stalled),
 * and otherwise a quiet "data current as of" line. Self-contained: fetches
 * its own freshness on mount and fails silent if the API is unreachable.
 */
const fmt = (iso) => {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (isNaN(d)) return 'unknown';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function DataFreshnessBanner() {
  const [fresh, setFresh] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchDataFreshness()
      .then((f) => { if (alive) setFresh(f); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!fresh || dismissed) return null;

  const sp = fresh.sources?.spending || {};
  const qz = fresh.sources?.quasi || {};

  if (fresh.outage) {
    return (
      <div role="alert" style={{
        background: '#7f1d1d', color: '#fff', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12, lineHeight: 1.4,
        fontSize: 14, borderBottom: '2px solid #fca5a5',
      }}>
        <AlertTriangle size={20} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong>Heads up: state data is stale.</strong>{' '}
          The MA Comptroller's CTHRU feed has not published new Statewide
          Spending or Payroll data in {fresh.spendingStaleDays} days
          (latest transaction: {fmt(sp.latest)}). Figures below reflect the
          last published snapshot, not today's totals. Quasi-government and
          federal data are unaffected.{' '}
          <a href="https://www.macomptroller.org/cthru/" target="_blank"
             rel="noreferrer" style={{ color: '#fecaca', textDecoration: 'underline' }}>
            Comptroller status
          </a>
        </div>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0f291f', color: '#a7f3d0', padding: '7px 16px',
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
      borderBottom: '1px solid #134e4a',
    }}>
      <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
      <span>
        Data current as of — Spending: {fmt(sp.latest)}
        {qz.latest ? ` · Quasi-gov: ${fmt(qz.latest)}` : ''}
        {fresh.sources?.payroll?.latestYear ? ` · Payroll: CY${fresh.sources.payroll.latestYear}` : ''}
      </span>
    </div>
  );
}
