export const metadata = { title: "Data Processing Addendum — Nkuku Companion" };
export default function DpaPage() {
  return (
    <>
      <h1>Data Processing Addendum</h1>
      <p>This Addendum applies when your organisation acts as data controller and we act
        as processor for personal data stored in Nkuku Companion.</p>
      <h2>Processing details</h2>
      <ul>
        <li><strong>Subject matter:</strong> farm and business records entered by your
          team, including staff contact details.</li>
        <li><strong>Duration:</strong> for the life of your subscription plus a 30-day
          deletion window.</li>
        <li><strong>Purpose:</strong> providing the Service and related billing/support.</li>
      </ul>
      <h2>Our commitments</h2>
      <ul>
        <li>Process personal data only on your documented instructions.</li>
        <li>Keep data confidential; restrict access to personnel who need it.</li>
        <li>Maintain encryption in transit and role-based access controls.</li>
        <li>Notify you without undue delay of any personal data breach.</li>
        <li>Assist with data-subject requests (access, export, deletion).</li>
      </ul>
      <h2>Sub-processors</h2>
      <ul>
        <li>Hetzner Online (hosting, EU data centres)</li>
        <li>Flutterwave, Lenco, DPO Pay (payment processing — billing data only)</li>
        <li>Sentry (error monitoring — when enabled by the operator)</li>
      </ul>
      <h2>Deletion</h2>
      <p>On request or account termination we delete live data within 30 days; encrypted
        backups expire per the backup retention schedule.</p>
    </>
  );
}
