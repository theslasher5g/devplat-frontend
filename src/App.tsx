import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Admin from '@/components/site/Admin';
import Auth, { InviteAccept, ResetPassword, VerifyEmail } from '@/components/site/Auth';
import Dashboard from '@/components/site/Dashboard';
import Home from '@/components/site/Home';
import { Preise, Compliance } from '@/components/site/PreiseCompliance';
import { Footer, Nav, type Page } from '@/components/site/Shared';
import Technik from '@/components/site/Technik';
import { AuthProvider, RequireAuth } from '@/lib/auth';

export const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  technik: '/how-it-works',
  preise: '/pricing',
  compliance: '/legal',
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

function MarketingLayout({ page, children }: { page: Page; children: React.ReactNode }) {
  const go = useGo();
  return (
    <div>
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
    page === 'preise' ? <Preise go={go} /> :
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
          <Route path="/pricing" element={<MarketingPage page="preise" />} />
          <Route path="/legal" element={<MarketingPage page="compliance" />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite" element={<InviteAccept />} />
          <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/app/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
