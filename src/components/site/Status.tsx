import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, LEVEL_META, type StatusLevel, type StatusPost, type StatusSummary } from '@/lib/api';
import { Logo } from './Shared';

export function StatusDot({ level }: { level: StatusLevel }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: LEVEL_META[level].color }} />;
}

const TYPE_LABEL: Record<StatusPost['type'], string> = {
  incident: 'Incident', maintenance: 'Maintenance', announcement: 'Announcement',
};

function fmt(ts: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** One incident/maintenance/announcement card with its update thread. Exported
 *  so the dashboard panel renders posts identically. */
export function PostCard({ post }: { post: StatusPost }) {
  return (
    <div className="border hairline p-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink-soft] border hairline px-2 py-0.5">{TYPE_LABEL[post.type]}</span>
        <span className="font-mono2 text-[11px] uppercase tracking-widest text-[--ink-soft]">{post.state.replace(/_/g, ' ')}</span>
        <span className="ml-auto text-xs text-[--ink-soft]">{fmt(post.updatedAt)}</span>
      </div>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{post.title}</h3>
      {post.body && <p className="mt-1.5 text-sm text-[--ink-soft] whitespace-pre-wrap">{post.body}</p>}
      {(post.scheduledStart || post.scheduledEnd) && (
        <p className="mt-2 text-xs text-[--ink-soft]">
          Window: <span className="text-[--ink]">{fmt(post.scheduledStart)}</span>
          {post.scheduledEnd ? <> → <span className="text-[--ink]">{fmt(post.scheduledEnd)}</span></> : null}
        </p>
      )}
      {post.updates.length > 0 && (
        <ol className="mt-4 space-y-3 border-l-2 border-[--line] pl-4">
          {post.updates.map((u) => (
            <li key={u.id}>
              <div className="flex items-baseline gap-2">
                {u.state && <span className="font-mono2 text-[10px] uppercase tracking-widest text-[--ink]">{u.state.replace(/_/g, ' ')}</span>}
                <span className="text-[11px] text-[--ink-soft]">{fmt(u.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-[--ink-soft] whitespace-pre-wrap">{u.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function Status() {
  const [data, setData] = useState<StatusSummary | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => api<StatusSummary>('/status').then((d) => { if (alive) { setData(d); setErr(false); } }).catch(() => { if (alive) setErr(true); });
    void load();
    const t = setInterval(load, 60_000); // keep it fresh during an incident
    return () => { alive = false; clearInterval(t); };
  }, []);

  const overall = data?.overall.status ?? 'operational';
  return (
    <main className="min-h-screen bg-[--paper]">
      <header className="border-b hairline">
        <div className="mx-auto max-w-3xl px-5 py-5 flex items-center justify-between">
          <Logo onClick={() => { window.location.href = '/'; }} />
          <Link to="/" className="text-sm text-[--ink-soft] link-underline">← devplat.ch</Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow eyebrow-dot mb-4">System status</p>
        {err && !data ? (
          <div className="border hairline p-6">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: LEVEL_META.major_outage.color }}>Status unavailable</h1>
            <p className="mt-2 text-sm text-[--ink-soft]">We couldn't reach the status service. The API itself may be affected — try again shortly.</p>
          </div>
        ) : (
          <div className="border hairline p-6 flex items-center gap-3" style={{ borderLeftColor: LEVEL_META[overall].color, borderLeftWidth: 3 }}>
            <StatusDot level={overall} />
            <h1 className="text-2xl font-semibold tracking-tight">{data?.overall.label ?? 'Loading…'}</h1>
          </div>
        )}

        {data && (
          <>
            <section className="mt-10">
              <h2 className="eyebrow mb-3">Components</h2>
              <div className="border hairline divide-y divide-[--line]">
                {data.components.map((c) => (
                  <div key={c.key} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="flex items-center gap-2 text-sm text-[--ink-soft]">
                      {LEVEL_META[c.status].label} <StatusDot level={c.status} />
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {data.active.length > 0 && (
              <section className="mt-10 space-y-3">
                <h2 className="eyebrow">Active</h2>
                {data.active.map((p) => <PostCard key={p.id} post={p} />)}
              </section>
            )}

            {data.upcoming.length > 0 && (
              <section className="mt-10 space-y-3">
                <h2 className="eyebrow">Scheduled maintenance</h2>
                {data.upcoming.map((p) => <PostCard key={p.id} post={p} />)}
              </section>
            )}

            <section className="mt-10 space-y-3">
              <h2 className="eyebrow">Past incidents</h2>
              {data.recent.length === 0
                ? <p className="text-sm text-[--ink-soft]">No incidents in recent history.</p>
                : data.recent.map((p) => <PostCard key={p.id} post={p} />)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
