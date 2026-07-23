import { Eyebrow } from './Shared';

function LegalShell({ eyebrow, title, updated, children }: {
  eyebrow: string; title: string; updated: string; children: React.ReactNode;
}) {
  return (
    <main>
      <section className="border-b hairline dotgrid">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-4 font-mono2 text-xs text-[--ink-soft]">Last updated: {updated}</p>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-[70ch] px-5 py-16 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-10 [&>h2]:mb-3 [&>h2]:first:mt-0 [&>p]:text-sm [&>p]:text-[--ink-soft] [&>p]:leading-relaxed [&>p]:mb-4 [&>ul]:text-sm [&>ul]:text-[--ink-soft] [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1.5 [&>ul]:mb-4">
          {children}
        </div>
      </section>
    </main>
  );
}

export function Imprint() {
  return (
    <LegalShell eyebrow="Legal notice" title="Imprint" updated="2026-07-23">
      <h2>Operator</h2>
      <p>
        This website and service are operated by:<br />
        Timo Schmidt, trading as devplat<br />
        Duggingerhof 54<br />
        4053 Basel, Switzerland
      </p>
      <h2>Contact</h2>
      <p>
        Email: admin@devplat.ch
      </p>
      <h2>VAT / UID</h2>
      <p>
        Not currently VAT-registered (small business).
      </p>
      <h2>Responsible for content</h2>
      <p>Timo Schmidt (as above).</p>
      <h2>Dispute resolution</h2>
      <p>
        We are not obligated and generally do not participate in dispute resolution proceedings
        before a consumer arbitration board.
      </p>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell eyebrow="Legal" title="Terms of Service" updated="2026-07-23">
      <p>
        These Terms govern use of devplat (the "Service"), operated by Timo Schmidt{' '}
        ("we", "us"). By creating an account or using the Service you agree to these Terms.
      </p>
      <h2>1. The Service</h2>
      <p>
        devplat provides on-demand, ephemeral Docker environments (Firecracker microVMs) reachable
        over a secured tunnel, for use with Testcontainers and compatible tooling. Environments and
        their contents are destroyed at the end of each run or session; the Service does not provide
        persistent storage.
      </p>
      <h2>2. Accounts</h2>
      <p>
        You must provide accurate registration information and keep your credentials and API tokens
        confidential. You are responsible for activity under your account and team, including usage
        by members you invite.
      </p>
      <h2>3. Plans, billing &amp; payment</h2>
      <p>
        Paid plans are billed monthly or annually in CHF via our payment processor (Stripe) and
        auto-renew until cancelled. You can cancel or change plans at any time through the billing
        portal; cancellation takes effect at the end of the current billing period. The free trial
        converts to no plan (not a paid plan) automatically at the end of the trial period unless you
        upgrade.
      </p>
      <h2>4. Acceptable use</h2>
      <p>You must not use the Service to:</p>
      <ul>
        <li>run workloads unrelated to software testing/development (e.g. cryptocurrency mining, generic compute rental);</li>
        <li>attempt to access another customer's environment, data, or credentials;</li>
        <li>probe, scan, or attack our infrastructure, other customers, or third parties;</li>
        <li>upload or process content that is illegal in Switzerland or the EU.</li>
      </ul>
      <p>
        We enforce per-environment bandwidth caps, deny unsolicited inbound connections, and may
        suspend an environment or account without notice if we reasonably believe it is being used
        to abuse the Service or attack third parties.
      </p>
      <h2>5. Data &amp; privacy</h2>
      <p>
        Our Privacy Policy describes what account and billing data we process. A Data Processing
        Agreement (DPA) is available on the Privacy &amp; Legal page for customers who need one under
        Art. 28 GDPR.
      </p>
      <h2>6. Availability</h2>
      <p>
        We aim for high availability but the Service is provided without an uptime guarantee except
        where a specific SLA is stated in your plan or a separate written agreement. Scheduled
        maintenance will be announced where practical.
      </p>
      <h2>7. Intellectual property</h2>
      <p>
        We retain all rights to the Service, including the CLI client and control-plane software.
        You retain all rights to your own code, containers, and test data.
      </p>
      <h2>8. Limitation of liability</h2>
      <p>
        To the extent permitted by applicable law, we are not liable for indirect, incidental, or
        consequential damages, or for lost data given the Service's ephemeral-by-design nature — keep
        your own source of truth for anything you cannot afford to lose.
      </p>
      <h2>9. Termination</h2>
      <p>
        Either party may terminate at any time; paid fees already due remain payable. We may suspend
        or terminate accounts that violate Section 4 (Acceptable use).
      </p>
      <h2>10. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be announced by email or
        in-product notice before they take effect.
      </p>
      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by Swiss law. Place of jurisdiction is Basel,
        Switzerland, to the extent permitted by mandatory consumer-protection law.
      </p>
      <h2>12. Contact</h2>
      <p>hello@devplat.ch</p>
    </LegalShell>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy Policy" updated="2026-07-23">
      <h2>1. Controller</h2>
      <p>
        Timo Schmidt, Duggingerhof 54, 4053 Basel,
        Switzerland — admin@devplat.ch.
      </p>
      <h2>2. What we process</h2>
      <p>We process the following categories of personal data:</p>
      <ul>
        <li><strong>Account data</strong> — email address, hashed password, team membership and role.</li>
        <li><strong>Billing data</strong> — handled by Stripe as our payment processor; we store the plan, subscription status, and Stripe customer/subscription IDs, not full card numbers.</li>
        <li><strong>Usage/metering data</strong> — environment start/stop events, timestamps, and which host served them, used for billing accuracy and capacity planning.</li>
        <li><strong>Support &amp; contact data</strong> — anything you send us via the contact form or email.</li>
      </ul>
      <p>
        We do <strong>not</strong> process the contents of your test environments as personal data on
        our side: each environment is destroyed, storage included, at the end of its run — see the
        security model on the How it works page.
      </p>
      <h2>3. Legal basis</h2>
      <p>
        Processing account and billing data is necessary to perform our contract with you (Art. 6(1)(b)
        GDPR / Art. 31 FADP). Where we send optional product updates, we rely on your consent, which
        you can withdraw at any time.
      </p>
      <h2>4. Sub-processors</h2>
      <p>We use the following sub-processors:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Resend</strong> — transactional email (verification, invites, password reset, contact-form notifications).</li>
      </ul>
      <p>
        Both are contractually bound to process data only on our instructions. A full, current
        sub-processor list is available on request via hello@devplat.ch.
      </p>
      <h2>5. International transfers</h2>
      <p>
        Your test-environment infrastructure runs exclusively on our own hardware in Basel,
        Switzerland. Stripe and Resend may process account/billing metadata outside Switzerland
        (including the US); where they do, this happens under Standard Contractual Clauses or an
        equivalent adequacy mechanism.
      </p>
      <h2>6. Retention</h2>
      <p>
        Account data is kept for as long as your account is active, plus a limited period afterward
        for legal/accounting obligations. Environment content has a retention period of effectively
        zero — it is destroyed when the environment is destroyed.
      </p>
      <h2>7. Your rights</h2>
      <p>
        Under GDPR and the Swiss FADP you have the right to access, correct, delete, or export your
        personal data, and to object to certain processing. Contact hello@devplat.ch to exercise any
        of these rights. If you are in the EU/EEA or Switzerland, you also have the right to lodge a
        complaint with your local data protection authority (in Switzerland: the FDPIC).
      </p>
      <h2>8. Cookies</h2>
      <p>
        We use a single essential, httpOnly session cookie to keep you signed in. We do not use
        third-party advertising or analytics cookies.
      </p>
      <h2>9. Security</h2>
      <p>
        See the Security model section on the How it works page for the technical measures protecting
        your account and environments.
      </p>
      <h2>10. Changes</h2>
      <p>We may update this policy from time to time; material changes will be announced by email.</p>
      <h2>11. Contact</h2>
      <p>hello@devplat.ch</p>
    </LegalShell>
  );
}
