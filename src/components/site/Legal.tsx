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
        General: hello@devplat.ch<br />
        Legal &amp; data protection: admin@devplat.ch<br />
        Security reports: security@devplat.ch
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
    <LegalShell eyebrow="Legal" title="Terms of Service" updated="2026-07-27">
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
        upgrade. Prices are quoted excluding VAT; we are not currently VAT-registered.
      </p>
      <p>
        <strong>Failed payments.</strong> If a charge fails we email the team owner and Stripe retries
        over the following days. If no payment succeeds, the subscription is cancelled and the team
        returns to the free tier — which means new environments stop starting. Your account, data and
        settings remain intact and are restored as soon as a payment goes through.
      </p>
      <p>
        <strong>Refunds.</strong> Charges already incurred are non-refundable, since the capacity was
        reserved for you. If you believe you were billed in error, write to admin@devplat.ch — we will
        look at it and put genuine mistakes right.
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
        Our Privacy Policy describes what account and billing data we process, who our sub-processors
        are, and how long we keep things. If you need a Data Processing Agreement under Art. 28 GDPR,
        contact admin@devplat.ch and we will provide one.
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
      <p>
        You can delete your account yourself at any time from Profile in the dashboard. On deletion
        your account and team data are removed, except records we are legally required to retain (see
        Retention in the Privacy Policy). Export your data first if you want a copy — Profile has a
        one-click download.
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
      <p>hello@devplat.ch (general) · admin@devplat.ch (legal and billing)</p>
    </LegalShell>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy Policy" updated="2026-07-27">
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
      <p>These are the third parties that process personal data on our behalf:</p>
      <ul>
        <li>
          <strong>Infomaniak Network SA</strong> (Geneva, Switzerland) — hosting of the control plane:
          the servers running our API and database, which hold account, team, billing-reference and
          usage data. Data centres are located in Switzerland.
        </li>
        <li><strong>Stripe</strong> (Stripe Payments Europe, Ltd.) — payment processing and invoicing.</li>
        <li><strong>Resend</strong> — transactional email (verification, invitations, password reset, billing and trial notices, contact-form notifications).</li>
      </ul>
      <p>
        Each is contractually bound to process data only on our instructions. We will announce new
        sub-processors before they start processing your data, so you have a chance to object.
      </p>
      <p>
        That list is exhaustive for the website too. Fonts, icons and scripts are served from our own
        domain &mdash; there is no CDN, no font service and no analytics provider, so simply loading a
        page here does not disclose your IP address to anyone but us.
      </p>
      <h2>5. Where your data is processed</h2>
      <p>
        <strong>Test environments</strong> — the microVMs your containers run in — execute exclusively on
        our own hardware in Basel, Switzerland. No third-party cloud sits in that path.
      </p>
      <p>
        <strong>Account and platform data</strong> — the database behind your account — is hosted with
        Infomaniak in Switzerland. Switzerland holds an EU adequacy decision, so transfers from the
        EU/EEA need no additional safeguards.
      </p>
      <p>
        Stripe and Resend may process account and billing metadata outside Switzerland (including in
        the US). Where they do, this happens under Standard Contractual Clauses or an equivalent
        adequacy mechanism.
      </p>
      <h2>6. Retention</h2>
      <p>
        Account and team data is kept while your account is active. When you delete your account it is
        removed immediately, except where we must keep records to meet legal obligations — invoices
        and the billing data on them are retained for <strong>10 years</strong> under Swiss accounting
        law (Art. 958f CO). Usage/metering records are kept for <strong>24 months</strong> for billing
        accuracy and capacity planning, then deleted.
      </p>
      <p>
        Environment content has a retention period of effectively zero: the microVM and its storage
        are destroyed when the run ends. We keep no backup of it, because none is created.
      </p>
      <p>
        If your team configures outgoing webhooks, the delivery log keeps the event payload we sent
        so you can see what left our systems: <strong>30 days</strong> for deliveries that succeeded,
        <strong> 90 days</strong> for ones that failed, since a failure is what someone comes back to
        investigate. The team&rsquo;s audit trail is kept for as long as the team exists and is deleted
        with it &mdash; it is the record you would need to answer a question about your own account.
      </p>
      <h2>7. Your rights</h2>
      <p>
        Under GDPR and the Swiss FADP you have the right to access, correct, delete, and export your
        personal data, to restrict or object to certain processing, and to withdraw consent at any time.
      </p>
      <p>
        Two of these are self-service in the dashboard, so you don&rsquo;t have to wait on us: under{' '}
        <strong>Profile</strong> you can download a machine-readable export of your data (right of
        access and portability) and delete your account outright. For anything else, write to
        admin@devplat.ch — we respond within 30 days.
      </p>
      <p>
        If you are in the EU/EEA or Switzerland, you also have the right to lodge a complaint with
        your data protection authority (in Switzerland: the Federal Data Protection and Information
        Commissioner, FDPIC).
      </p>
      <h2>7a. Data processing agreement</h2>
      <p>
        If you use devplat as a business and need a data processing agreement under Art. 28 GDPR,
        contact admin@devplat.ch and we will provide one.
      </p>
      <h2>8. Cookies and local storage</h2>
      <p>
        We use a single essential, httpOnly session cookie to keep you signed in. We set no
        third-party advertising or analytics cookies, and we do not track you across other sites.
      </p>
      <p>
        Your browser&rsquo;s local storage is also used for small interface preferences — which
        notices you have dismissed, for example. That data never leaves your device and is not
        personal data we receive.
      </p>
      <h2>8a. Automated decision-making</h2>
      <p>
        We do not use your personal data for automated decision-making or profiling with legal or
        similarly significant effects.
      </p>
      <h2>9. Security</h2>
      <p>
        Passwords are stored only as bcrypt hashes and are checked against known breach corpora;
        two-factor authentication is available; each customer&rsquo;s environments are isolated by a
        hypervisor boundary. The Security page documents the specific mechanisms. To report a
        vulnerability, write to security@devplat.ch — see our bug bounty page.
      </p>
      <h2>10. Data breaches</h2>
      <p>
        If a breach occurs that is likely to result in a risk to your rights and freedoms, we will
        notify the competent supervisory authority within 72 hours of becoming aware of it, and
        inform affected customers without undue delay.
      </p>
      <h2>11. Changes</h2>
      <p>
        We may update this policy from time to time. The date at the top always reflects the current
        version, and material changes will be announced by email before they take effect.
      </p>
      <h2>12. Contact</h2>
      <p>
        Data protection matters: admin@devplat.ch<br />
        General enquiries: hello@devplat.ch<br />
        Security reports: security@devplat.ch
      </p>
    </LegalShell>
  );
}
