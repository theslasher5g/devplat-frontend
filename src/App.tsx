import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import CookieNotice from '@/components/site/CookieNotice';
import Home from '@/components/site/Home';
import PromoBanner from '@/components/site/PromoBanner';
import { Footer, Nav, type Page, ScrollProgress } from '@/components/site/Shared';
import { AuthProvider, RequireAuth } from '@/lib/auth';

/*
 * Route-based code splitting.
 *
 * Everything used to land in one ~535 kB bundle, so a first-time visitor
 * reading the landing page downloaded and parsed the entire dashboard, the
 * admin console, and the QR/chart code along with it — on a phone, before
 * seeing a single word.
 *
 * Only the landing page, the shell (nav/footer/banner) and the cookie notice
 * stay in the entry chunk, because they render on the first paint of the most
 * common entry point. Everything else is fetched when its route is actually
 * visited, then warmed during idle time (see usePrefetch) so navigating around
 * the marketing site still feels instant.
 *
 * `lazy` needs a default export, hence the `.then` unwrapping for the modules
 * that export several pages.
 */
const Technik = lazy(() => import('@/components/site/Technik'));
const Security = lazy(() => import('@/components/site/Security'));
const Download = lazy(() => import('@/components/site/Download'));
const Docs = lazy(() => import('@/components/site/Docs'));
const Faq = lazy(() => import('@/components/site/Faq'));
const BugBounty = lazy(() => import('@/components/site/BugBounty'));
const Contact = lazy(() => import('@/components/site/Contact'));
const Preise = lazy(() => import('@/components/site/PreiseCompliance').then((m) => ({ default: m.Preise })));
const Imprint = lazy(() => import('@/components/site/Legal').then((m) => ({ default: m.Imprint })));
const Terms = lazy(() => import('@/components/site/Legal').then((m) => ({ default: m.Terms })));
const PrivacyPolicy = lazy(() => import('@/components/site/Legal').then((m) => ({ default: m.PrivacyPolicy })));

const Status = lazy(() => import('@/components/site/Status'));
const StatusConfirmPage = lazy(() => import('@/components/site/Status').then((m) => ({ default: m.StatusConfirmPage })));
const StatusUnsubscribePage = lazy(() => import('@/components/site/Status').then((m) => ({ default: m.StatusUnsubscribePage })));

const Auth = lazy(() => import('@/components/site/Auth'));
const VerifyEmail = lazy(() => import('@/components/site/Auth').then((m) => ({ default: m.VerifyEmail })));
const ConfirmEmailChange = lazy(() => import('@/components/site/Auth').then((m) => ({ default: m.ConfirmEmailChange })));
const ResetPassword = lazy(() => import('@/components/site/Auth').then((m) => ({ default: m.ResetPassword })));
const InviteAccept = lazy(() => import('@/components/site/Auth').then((m) => ({ default: m.InviteAccept })));

// The signed-in half of the product. A logged-out visitor never needs any of it.
const Activate = lazy(() => import('@/components/site/Activate'));
const Dashboard = lazy(() => import('@/components/site/Dashboard'));
const Admin = lazy(() => import('@/components/site/Admin'));

export const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  technik: '/how-it-works',
  security: '/security',
  preise: '/pricing',
  download: '/download',
  docs: '/docs',
  faq: '/faq',
  bugBounty: '/bug-bounty',
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

/**
 * Placeholder while a route chunk loads. It reserves roughly a viewport of
 * height so the footer doesn't jump up and then back down, and stays visually
 * quiet — on a normal connection the chunk arrives before this is perceptible,
 * and a spinner that flashes for 80ms reads as jank rather than progress.
 */
function PageFallback() {
  return <main className="min-h-[70vh]" aria-busy="true" />;
}

/**
 * Warms the route chunks during idle time after the first paint.
 *
 * Splitting trades one big up-front download for a small download per
 * navigation, and on a marketing site that second cost lands exactly when a
 * visitor is deciding whether the product feels fast. Prefetching on idle gets
 * both: a small entry chunk, and chunks already in cache by the time anyone
 * clicks. Ordered by how likely each page is to be the next click.
 *
 * The signed-in bundles are deliberately excluded — they're the largest, and a
 * visitor who hasn't logged in will never open them.
 */
function usePrefetch() {
  useEffect(() => {
    // Never spend a metered or slow connection's budget on speculation.
    const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || (conn?.effectiveType && /2g/.test(conn.effectiveType))) return;

    const load = () => {
      void import('@/components/site/PreiseCompliance');
      void import('@/components/site/Technik');
      void import('@/components/site/Docs');
      void import('@/components/site/Download');
      void import('@/components/site/Auth');
      void import('@/components/site/Security');
    };
    const ric = window.requestIdleCallback;
    if (ric) {
      const handle = ric(load, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(load, 2000);
    return () => window.clearTimeout(timer);
  }, []);
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
  faq: { title: 'Community & FAQ — devplat', description: 'Answers to the questions developers ask before they sign up — plus the community and support channels for when yours isn’t here.' },
  bugBounty: { title: 'Bug bounty — devplat', description: 'Break our tenant isolation, auth, or control plane and earn free months of devplat plus a Hall of Fame spot. Scope, rewards, and safe harbor.' },
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
      <PromoBanner go={go} />
      <Nav page={page} go={go} />
      {/* Suspense sits inside the shell so the nav and footer stay painted
          while a page chunk loads — the page swaps, the frame doesn't blink. */}
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
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
    page === 'faq' ? <Faq go={go} /> :
    page === 'bugBounty' ? <BugBounty go={go} /> :
    page === 'contact' ? <Contact /> :
    page === 'imprint' ? <Imprint /> :
    page === 'terms' ? <Terms /> :
    <PrivacyPolicy />;
  return <MarketingLayout page={page}>{body}</MarketingLayout>;
}

function AppRoutes() {
  usePrefetch();
  return (
    <>
      <ScrollToTop />
      {/* Outer boundary for the routes that render outside MarketingLayout
          (status, auth, and the signed-in app), which have no shell to keep. */}
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<MarketingPage page="home" />} />
          <Route path="/how-it-works" element={<MarketingPage page="technik" />} />
          <Route path="/security" element={<MarketingPage page="security" />} />
          <Route path="/pricing" element={<MarketingPage page="preise" />} />
          <Route path="/download" element={<MarketingPage page="download" />} />
          <Route path="/docs" element={<MarketingPage page="docs" />} />
          <Route path="/faq" element={<MarketingPage page="faq" />} />
          <Route path="/bug-bounty" element={<MarketingPage page="bugBounty" />} />
          <Route path="/contact" element={<MarketingPage page="contact" />} />
          <Route path="/legal/imprint" element={<MarketingPage page="imprint" />} />
          <Route path="/legal/terms" element={<MarketingPage page="terms" />} />
          <Route path="/legal/privacy" element={<MarketingPage page="privacy" />} />
          <Route path="/status" element={<Status />} />
          <Route path="/status/confirm" element={<StatusConfirmPage />} />
          <Route path="/status/unsubscribe" element={<StatusUnsubscribePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite" element={<InviteAccept />} />
          <Route path="/activate" element={<RequireAuth><Activate /></RequireAuth>} />
          <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/app/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <CookieNotice />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
