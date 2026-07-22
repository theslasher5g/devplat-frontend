import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, LEVEL_META, type DayStatus, type StatusComponent, type StatusLevel, type StatusPost, type StatusSummary } from '@/lib/api';
import { Logo } from './Shared';

const HISTORY_DAYS = 90;

// Bars collapse to three buckets: green (operational), amber
// (maintenance/minor degradation — not real downtime), red (partial/major
// outage). Matches how the uptime % is computed server-side.
function barColor(level: StatusLevel): string {
  if (level === 'operational') return LEVEL_META.operational.color;
  if (level === 'partial_outage' || level === 'major_outage') return LEVEL_META.major_outage.color;
  return LEVEL_META.maintenance.color;
}

export function StatusIcon({ level }: { level: StatusLevel }) {
  const op = level === 'operational';
  const red = level === 'partial_outage' || level === 'major_outage';
  const color = op ? LEVEL_META.operational.color : red ? LEVEL_META.major_outage.color : LEVEL_META.maintenance.color;
  return (
    <span className="inline-grid place-items-center w-5 h-5 rounded-full text-white text-[11px] font-bold shrink-0" style={{ background: color }}>
      {op ? '✓' : '!'}
    </span>
  );
}

function UptimeBars({ history }: { history: DayStatus[] }) {
  return (
    <div className="flex gap-[2px] items-stretch h-8 w-full" role="img" aria-label="Daily status, last 90 days">
      {history.map((d) => (
        <div
          key={d.date}
          title={`${d.date} · ${LEVEL_META[d.status].label}`}
          className="flex-1 min-w-[2px] rounded-[1px]"
          style={{ background: barColor(d.status) }}
        />
      ))}
    </div>
  );
}

function since(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.floor(hours / 24)} days`;
}

function fmtDateTime(ts: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function monthRange(w?: { start: string; end: string }): string {
  if (!w) return '';
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return `${fmt(new Date(w.start))} – ${fmt(new Date(new Date(w.end).getTime() - 86400000))}`;
}

/** One incident/maintenance/announcement with its update thread — used in the
 *  issues banner and the history list. */
function PostCard({ post, compact = false }: { post: StatusPost; compact?: boolean }) {
  const affects = post.affectedComponents.length ? ` · Affects ${post.affectedComponents.join(', ')}` : '';
  const ongoing = !post.resolvedAt && post.type !== 'announcement' ? ` · Ongoing for ${since(post.createdAt)}` : '';
  return (
    <div className={compact ? '' : 'border-t hairline pt-4'}>
      <div className="flex items-start gap-2">
        {post.type !== 'announcement' && <StatusIcon level={post.resolvedAt ? 'operational' : 'degraded'} />}
        <div className="min-w-0">
          <p className="font-semibold">{post.title}</p>
          {post.body && <p className="mt-1 text-sm text-[--ink-soft] whitespace-pre-wrap">{post.body}</p>}
          {(post.scheduledStart || post.scheduledEnd) && (
            <p className="mt-1.5 text-xs text-[--ink-soft]">
              Window: {fmtDateTime(post.scheduledStart)}{post.scheduledEnd ? ` → ${fmtDateTime(post.scheduledEnd)}` : ''}
            </p>
          )}
          <p className="mt-1.5 text-xs text-[--ink-soft]">
            {post.resolvedAt ? 'Resolved' : capitalize(post.state.replace(/_/g, ' '))}{ongoing}{affects}
          </p>
          {post.updates.length > 0 && (
            <ol className="mt-3 space-y-2 border-l-2 border-[--line] pl-3">
              {post.updates.map((u) => (
                <li key={u.id} className="text-xs">
                  {u.state && <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink] mr-2">{u.state.replace(/_/g, ' ')}</span>}
                  <span className="text-[--ink-soft]">{fmtDateTime(u.createdAt)} — {u.body}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/** A component row — a leaf, or a group with an expandable member list
 *  ("N components ⌄") whose members each get their own status + uptime bar. */
function ComponentRow({ c }: { c: StatusComponent }) {
  const [open, setOpen] = useState(false);
  const isGroup = !!c.children && c.children.length > 0;
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        <StatusIcon level={c.status} />
        <span className="font-medium">{c.name}</span>
        {isGroup && (
          <button onClick={() => setOpen((o) => !o)} className="text-sm text-[--ink-soft] hover:text-[--ink] inline-flex items-center gap-1">
            {c.children!.length} component{c.children!.length === 1 ? '' : 's'} <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
          </button>
        )}
        <span className="ml-auto text-sm text-[--ink-soft] tabular-nums">
          {c.uptime != null ? `${c.uptime.toFixed(2)}% uptime` : ''}
        </span>
      </div>
      {c.history && c.history.length > 0 && <div className="mt-3"><UptimeBars history={c.history} /></div>}
      {isGroup && open && (
        <div className="mt-4 pl-7 space-y-4">
          {c.children!.map((m) => (
            <div key={m.key}>
              <div className="flex items-center gap-2">
                <StatusIcon level={m.status} />
                <span className="text-sm font-medium">{m.name}</span>
                <span className="ml-auto text-xs text-[--ink-soft] tabular-nums">
                  {m.uptime != null ? `${m.uptime.toFixed(2)}% uptime` : ''}
                </span>
              </div>
              {m.history && m.history.length > 0 && <div className="mt-2"><UptimeBars history={m.history} /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Status() {
  const [offset, setOffset] = useState(0); // 0 = present 90-day window
  const [data, setData] = useState<StatusSummary | null>(null);
  const [err, setErr] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ historyDays: String(HISTORY_DAYS) });
    if (offset > 0) params.set('before', new Date(Date.now() - offset * HISTORY_DAYS * 86400000).toISOString());
    const load = () => api<StatusSummary>(`/status?${params.toString()}`)
      .then((d) => { if (alive) { setData(d); setErr(false); } })
      .catch(() => { if (alive) setErr(true); });
    void load();
    const t = offset === 0 ? setInterval(load, 60000) : undefined; // only the live window auto-refreshes
    return () => { alive = false; if (t) clearInterval(t); };
  }, [offset]);

  const overall = data?.overall.status ?? 'operational';
  const problems = (data?.active ?? []).filter((p) => p.type !== 'announcement');
  const announcements = (data?.active ?? []).filter((p) => p.type === 'announcement');
  const affectedChips = Array.from(new Set(problems.flatMap((p) => p.affectedComponents)));
  const hasIssues = problems.length > 0 || overall !== 'operational';

  return (
    <main className="min-h-screen bg-[--paper]">
      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Logo onClick={() => { window.location.href = '/'; }} />
          <Link to="/contact" className="text-sm border hairline px-4 py-2 bg-[--ink] text-[--paper] hover:opacity-90">Subscribe to updates</Link>
        </div>

        {err && !data ? (
          <div className="border hairline p-6" style={{ borderLeftColor: LEVEL_META.major_outage.color, borderLeftWidth: 3 }}>
            <h1 className="text-xl font-semibold">Status unavailable</h1>
            <p className="mt-2 text-sm text-[--ink-soft]">We couldn't reach the status service. The API itself may be affected — try again shortly.</p>
          </div>
        ) : hasIssues ? (
          <div className="border hairline overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#FCF3D0' }}>
              <StatusIcon level={overall === 'operational' ? 'degraded' : overall} />
              <span className="font-semibold text-[--ink]">We're currently experiencing issues</span>
            </div>
            {affectedChips.length > 0 && (
              <div className="px-5 py-3 border-t hairline flex gap-2 flex-wrap">
                {affectedChips.map((c) => (
                  <span key={c} className="text-sm px-2.5 py-0.5 rounded" style={{ background: '#FCF3D0', color: '#8a6d00' }}>{c}</span>
                ))}
              </div>
            )}
            <div className="px-5 py-4 space-y-4">
              {problems.map((p) => <PostCard key={p.id} post={p} compact />)}
            </div>
          </div>
        ) : (
          <div className="border hairline px-5 py-4 flex items-center gap-2" style={{ borderLeftColor: LEVEL_META.operational.color, borderLeftWidth: 3 }}>
            <StatusIcon level="operational" />
            <span className="font-semibold">All systems operational</span>
          </div>
        )}

        {/* Announcements (neutral, not an outage) */}
        {announcements.length > 0 && (
          <div className="mt-4 border hairline px-5 py-4 space-y-4">
            <p className="eyebrow">Announcements</p>
            {announcements.map((p) => <PostCard key={p.id} post={p} compact />)}
          </div>
        )}

        {/* Scheduled maintenance (upcoming) */}
        {data && data.upcoming.length > 0 && (
          <div className="mt-4 border hairline px-5 py-4 space-y-4" style={{ borderLeftColor: LEVEL_META.maintenance.color, borderLeftWidth: 3 }}>
            <p className="eyebrow">Scheduled maintenance</p>
            {data.upcoming.map((p) => <PostCard key={p.id} post={p} compact />)}
          </div>
        )}

        {/* System status panel */}
        {data && (
          <section className="mt-6 border hairline">
            <div className="px-5 py-4 flex items-center gap-4">
              <h2 className="font-semibold">System status</h2>
              <div className="flex items-center gap-2 text-sm text-[--ink-soft]">
                <button onClick={() => setOffset((o) => o + 1)} aria-label="Earlier" className="hover:text-[--ink] px-1">‹</button>
                <span className="tabular-nums">{monthRange(data.window)}</span>
                <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}
                  aria-label="Later" className="px-1 disabled:opacity-30 hover:text-[--ink]">›</button>
              </div>
            </div>
            <div className="divide-y divide-[--line]">
              {data.components.map((c) => <ComponentRow key={c.key} c={c} />)}
            </div>
          </section>
        )}

        {/* History */}
        {data && (
          <div className="mt-6 text-center">
            <button onClick={() => setShowHistory((s) => !s)} className="border hairline px-4 py-2 text-sm hover:bg-[--ink] hover:text-[--paper]">
              {showHistory ? 'Hide history' : 'View history'}
            </button>
          </div>
        )}
        {showHistory && data && (
          <section className="mt-6 border hairline px-5 py-4">
            <p className="eyebrow mb-2">Past incidents</p>
            {data.recent.length === 0
              ? <p className="text-sm text-[--ink-soft]">No incidents in recent history.</p>
              : <div className="space-y-4">{data.recent.map((p) => <PostCard key={p.id} post={p} />)}</div>}
          </section>
        )}
      </div>
    </main>
  );
}
