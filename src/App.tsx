import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Activate from '@/components/site/Activate';
import Admin from '@/components/site/Admin';
import Auth, { InviteAccept, ResetPassword, VerifyEmail } from '@/components/site/Auth';
import Contact from '@/components/site/Contact';
import CookieNotice from '@/components/site/CookieNotice';
import Dashboard from '@/components/site/Dashboard';
import Docs from '@/components/site/Docs';
import Download from '@/components/site/Download';
import Home from '@/components/site/Home';
import { Imprint, PrivacyPolicy, Terms } from '@/components/site/Legal';
import { Preise, Compliance } from '@/components/site/PreiseCompliance';
import Security from '@/components/site/Security';
import { Footer, Nav, type Page, ScrollProgress } from '@/components/site/Shared';
import Status, { StatusConfirmPage, StatusUnsubscribePage } from '@/components/site/Status';
import Technik from '@/components/site/Technik';
import { AuthProvider, RequireAuth } from '@/lib/auth';

export const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  technik: '/how-it-works',
  security: '/security',
  preise: '/pricing',
  download: '/download',
  docs: '/docs',
  compliance: '/legal',
  contact: '/contact',
  imprint: '/legal/imprint',
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  auth: '/auth',
  app: '/app',
};

/** Adapter so the existing components' `go(page)` navigation keeps working. */
export function useGo(): (p: Page) => void {
  const navigate = useNavigate();
  return (p: Page) => navigate(PAGE_PATHS[p]);
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

// Per-page <title> + meta description for SEO/social. This is a client-rendered
// SPA, so this sets the tags on navigation (Google executes JS and picks them
// up); the static defaults in index.html cover non-JS crawlers. Keyed to the
// page the marketing router resolved.
const PAGE_META: Partial<Record<Page, { title: string; description: string }>> = {
  home: { title: 'devplat — Remote Testcontainers backend, hosted in Switzerland', description: 'Run integration-test containers on remote Firecracker microVMs — zero code changes, flat pricing by parallelism, hosted in Basel.' },
  technik: { title: 'How it works — devplat', description: 'One tunnel, one scheduler, one microVM per test run. How devplat redirects the Docker endpoint so your tests run unchanged against remote containers.' },
  security: { title: 'Security model — devplat', description: 'KVM isolation, per-VM networking, egress caps, WireGuard-only control plane, and a hard server-side TTL. The exact mechanisms behind each boundary.' },
  preise: { title: 'Pricing — devplat', description: 'Flat pricing by parallelism, no per-minute bills, no overages. Plans from CHF 19 to CHF 249 per month. 14-day free trial, no card.' },
  download: { title: 'Download the CLI — devplat', description: 'One static Go binary. Install on Linux, Windows, or CI in one line — then run your tests against remote containers.' },
  docs: { title: 'Docs — devplat', description: 'Install, authenticate, connect, and run your tests against a remote Testcontainers backend. CLI reference, CI setup, and troubleshooting.' },
  compliance: { title: 'Privacy & Legal — devplat', description: 'GDPR and Swiss FADP compliance, a downloadable DPA, and data processed exclusively on our own hardware in Basel, Switzerland.' },
  contact: { title: 'Contact — devplat', description: 'Get in touch with the devplat team.' },
  imprint: { title: 'Imprint — devplat', description: 'Legal disclosure and operator details for devplat, Basel, Switzerland.' },
  terms: { title: 'Terms of Service — devplat', description: 'The terms governing use of devplat’s remote Testcontainers backend.' },
  privacy: { title: 'Privacy Policy — devplat', description: 'How devplat processes personal data under GDPR and the Swiss FADP — on our own hardware in Basel.' },
};

// Absolute site origin used for canonical + og:url. The apex is canonical (www
// is only accepted, not preferred), so every page points its canonical here.
const SITE_ORIGIN = 'https://devplat.ch';

function usePageMeta(page: Page) {
  useEffect(() => {
    const meta = PAGE_META[page];
    if (!meta) return;
    document.title = meta.title;
    const set = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector<HTMLMetaElement>(selector);
      if (el) el.setAttribute(attr, value);
    };
    const canonical = `${SITE_ORIGIN}${PAGE_PATHS[page]}`;
    set('meta[name="description"]', 'content', meta.description);
    set('meta[property="og:title"]', 'content', meta.title);
    set('meta[property="og:description"]', 'content', meta.description);
    // Keep canonical + og:url in sync with the current route so shares and
    // crawlers attribute each page to its own URL, not the static index one.
    set('meta[property="og:url"]', 'content', canonical);
    set('link[rel="canonical"]', 'href', canonical);
  }, [page]);
}

/**
 * Section-level scroll reveal for the content marketing pages. Rather than
 * wrapping every section by hand, this observes each <main> > section once
 * after mount and fades it in as it enters the viewport. Sections already on
 * screen at load are shown immediately (no flash), and the home page opts out
 * entirely — it has its own hand-tuned, staggered Reveal components. Honors
 * prefers-reduced-motion purely through the CSS (.reveal collapses there).
 */
function useSectionReveals(enabled: boolean) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section'));
    const viewportH = window.innerHeight;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            observer.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    for (const s of sections) {
      // Above-the-fold sections start visible so nothing flashes on load;
      // only sections below the initial viewport get the reveal treatment.
      if (s.getBoundingClientRect().top < viewportH * 0.9) continue;
      s.classList.add('reveal');
      observer.observe(s);
    }
    return () => observer.disconnect();
  }, [enabled, pathname]);
}

function MarketingLayout({ page, children }: { page: Page; children: React.ReactNode }) {
  const go = useGo();
  useSectionReveals(page !== 'home' && page !== 'docs');
  usePageMeta(page);
  return (
    <div>
      <ScrollProgress />
      <Nav page={page} go={go} />
      {children}
      <Footer go={go} />
    </div>
  );
}

function NotFound() {
  const go = useGo();
  return (
    <MarketingLayout page="home">
      <main className="min-h-[70vh] grid place-items-center dotgrid border-b hairline">
        <div className="text-center px-5 py-24">
          <p className="font-doto text-7xl md:text-8xl leading-none">404<span className="text-[--red]">●</span></p>
          <p className="mt-4 eyebrow eyebrow-dot inline-block">Page not found</p>
          <p className="mt-3 text-[--ink-soft] max-w-[42ch] mx-auto">That page doesn't exist — or was torn down like one of our microVMs. Let's get you back.</p>
          <div className="mt-8 flex gap-3 justify-center flex-wrap">
            <button onClick={() => go('home')} className="btn-ink px-6 py-3">Back home</button>
            <button onClick={() => go('docs')} className="btn-ghost px-6 py-3">Read the docs</button>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}

function MarketingPage({ page }: { page: Exclude<Page, 'auth' | 'app'> }) {
  const go = useGo();
  const body =
    page === 'home' ? <Home go={go} /> :
    page === 'technik' ? <Technik go={go} /> :
    page === 'security' ? <Security go={go} /> :
    page === 'preise' ? <Preise go={go} /> :
    page === 'download' ? <Download go={go} /> :
    page === 'docs' ? <Docs go={go} /> :
    page === 'contact' ? <Contact /> :
    page === 'imprint' ? <Imprint /> :
    page === 'terms' ? <Terms /> :
    page === 'privacy' ? <PrivacyPolicy /> :
    <Compliance />;
  return <MarketingLayout page={page}>{body}</MarketingLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<MarketingPage page="home" />} />
          <Route path="/how-it-works" element={<MarketingPage page="technik" />} />
          <Route path="/security" element={<MarketingPage page="security" />} />
          <Route path="/pricing" element={<MarketingPage page="preise" />} />
          <Route path="/download" element={<MarketingPage page="download" />} />
          <Route path="/docs" element={<MarketingPage page="docs" />} />
          <Route path="/legal" element={<MarketingPage page="compliance" />} />
          <Route path="/contact" element={<MarketingPage page="contact" />} />
          <Route path="/legal/imprint" element={<MarketingPage page="imprint" />} />
          <Route path="/legal/terms" element={<MarketingPage page="terms" />} />
          <Route path="/legal/privacy" element={<MarketingPage page="privacy" />} />
          <Route path="/status" element={<Status />} />
          <Route path="/status/confirm" element={<StatusConfirmPage />} />
          <Route path="/status/unsubscribe" element={<StatusUnsubscribePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite" element={<InviteAccept />} />
          <Route path="/activate" element={<RequireAuth><Activate /></RequireAuth>} />
          <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/app/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <CookieNotice />
      </AuthProvider>
    </BrowserRouter>
  );
}
