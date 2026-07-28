import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/errorReporting';

/**
 * Catches render errors so a crash shows something honest instead of a blank
 * white page — and tells us it happened.
 *
 * Class component because React has no hook equivalent: componentDidCatch is
 * still the only way to catch an error thrown during render.
 */
interface Props { children: ReactNode }
interface State { crashed: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The component stack says which component blew up, which the JS stack
    // alone often doesn't once the bundle is minified.
    reportError(error, `render${info.componentStack ? ` ${info.componentStack.trim().split('\n')[0]?.trim()}` : ''}`);
  }

  render(): ReactNode {
    if (!this.state.crashed) return this.props.children;

    return (
      <main className="min-h-[70vh] grid place-items-center dotgrid">
        <div className="text-center px-5 py-24 max-w-[46ch]">
          <p className="font-doto text-6xl md:text-7xl leading-none">
            5oo<span className="text-[--red]">●</span>
          </p>
          <p className="mt-4 eyebrow eyebrow-dot inline-block">Something broke</p>
          <p className="mt-3 text-[--ink-soft]">
            This page hit an error and stopped rendering. That's on us — it's already been
            reported, and nothing you were doing was lost.
          </p>
          <div className="mt-8 flex gap-3 justify-center flex-wrap">
            {/* A full reload, not a router navigation: the React tree is in an
                unknown state and re-rendering it is what just failed. */}
            <button onClick={() => window.location.reload()} className="btn-ink px-6 py-3">
              Reload the page
            </button>
            <a href="/" className="btn-ghost px-6 py-3">Back home</a>
          </div>
          <p className="mt-8 text-sm text-[--ink-soft]">
            Still stuck? <a href="/contact" className="link-underline text-[--ink]">Tell us what you were doing</a> and
            we'll dig into it.
          </p>
        </div>
      </main>
    );
  }
}
