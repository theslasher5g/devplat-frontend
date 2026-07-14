import { useEffect, useState } from 'react';
import Home from '@/components/site/Home';
import Technik from '@/components/site/Technik';
import { Preise, Compliance } from '@/components/site/PreiseCompliance';
import Auth from '@/components/site/Auth';
import Dashboard from '@/components/site/Dashboard';
import { Footer, Nav, type Page } from '@/components/site/Shared';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const go = (p: Page) => setPage(p);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);

  if (page === 'auth') return <Auth go={go} />;
  if (page === 'app') return <Dashboard go={go} />;

  return (
    <div>
      <Nav page={page} go={go} />
      {page === 'home' && <Home go={go} />}
      {page === 'technik' && <Technik go={go} />}
      {page === 'preise' && <Preise go={go} />}
      {page === 'compliance' && <Compliance />}
      <Footer go={go} />
    </div>
  );
}
