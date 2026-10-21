export const metadata = { title: "Privacy Policy — Nkuku Companion" };
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email, phone number, organisation membership and role.</li>
        <li>Farm data you enter: flocks, feed/growth/health records, sales and financial
          records, uploaded documents.</li>
        <li>Technical data: IP address, device/browser type, and usage events needed to
          operate and secure the Service.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>Provide and maintain the Service, including sync between web and mobile.</li>
        <li>Send transactional email (verification, password reset, invitations,
          billing reminders) and push notifications you configure.</li>
        <li>Process subscription payments via our payment providers.</li>
        <li>Monitor reliability and security (self-hosted error tracking).</li>
      </ul>
      <h2>Sharing</h2>
      <p>We do not sell your data. Data is shared only with the processors needed to run
        the Service: our hosting provider (Hetzner, EU), payment providers (Flutterwave,
        Lenco, DPO Pay), and — when configured — error monitoring (Sentry).</p>
      <h2>Retention and your rights</h2>
      <p>Your data is retained while your account is active. You may request an export or
        deletion of your organisation's data at any time by emailing us; deletion removes
        live data within 30 days and backups within the retention window.</p>
      <h2>Security</h2>
      <p>Data is encrypted in transit (TLS). Access is restricted by role within your
        organisation. See the Data Processing Addendum for processor commitments.</p>
    </>
  );
}
