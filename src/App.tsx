import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Activate from '@/components/site/Activate';
import Admin from '@/components/site/Admin';
import Auth, { InviteAccept, ResetPassword, VerifyEmail } from '@/components/site/Auth';
import Contact from '@/components/site/Contact';
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
  return (
    <div>
      <ScrollProgress />
      <Nav page={page} go={go} />
      {children}
      <Footer go={go} />
    </div>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
