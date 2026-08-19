# Nkuku Companion — Enterprise Support & License Agreement Template

**Document version:** 1.0
**Date:** 2026-08-19

> This is a template. Replace all `[BRACKETED]` placeholders with actual
> values before signing. Have legal counsel review before use.

---

## 1. Parties

**Licensor:** [Company Name], a company registered in [Jurisdiction]
(company number [REGISTRATION NUMBER]), whose registered address is
[ADDRESS] ("Licensor", "we", "us").

**Licensee:** [Customer Company Name], a company registered in
[Jurisdiction] (company number [REGISTRATION NUMBER]), whose registered
address is [ADDRESS] ("Licensee", "you").

## 2. Software License

### 2.1 Grant of License

Licensor grants Licensee a non-exclusive, non-transferable, perpetual
license to install and operate the Nkuku Companion software ("the
Software") on Licensee's own infrastructure, for Licensee's internal
business purposes, subject to the terms of this Agreement.

### 2.2 License Scope

- **Deployment:** Self-hosted on Licensee's infrastructure using the
  provided Docker Compose production configuration.
- **Users:** Up to [MAX_USERS] named users.
- **Organizations:** Up to [MAX_ORGS] organizations/tenants.
- **White-label:** [YES/NO] — if YES, Licensee may customize branding
  (app name, logo, colors, support contact) via environment configuration.

### 2.3 Restrictions

Licensee shall not:
- Reverse engineer, decompile, or disassemble the Software.
- Redistribute, resell, or sublicense the Software to third parties.
- Remove or alter copyright notices or license keys.
- Use the Software to provide a competing hosted service.

### 2.4 License Key

Licensor will provide a license key that must be configured via the
`LICENSE_KEY` environment variable. The Software validates this key on
startup. If the key is invalid or expired, the Software will continue
to operate but will display a license warning in the admin dashboard.

## 3. Support Services

### 3.1 Support Tiers

| Tier | Response Time (Critical) | Response Time (Major) | Response Time (Minor) | Channels |
|------|--------------------------|-----------------------|-----------------------|----------|
| Standard | 4 business hours | 8 business hours | 2 business days | Email |
| Premium | 1 business hour | 4 business hours | 1 business day | Email + Phone |
| Enterprise | 30 minutes | 2 business hours | 4 business hours | Email + Phone + Slack |

**Severity definitions:**
- **Critical:** Software is completely non-functional; no workaround exists.
- **Major:** Core functionality is impaired; a workaround exists but is impractical.
- **Minor:** Non-core functionality is impaired; a reasonable workaround exists.

### 3.2 Support Coverage

Support hours: [9x5 / 24x7] in [TIMEZONE] timezone.

Support includes:
- Bug diagnosis and resolution.
- Guidance on configuration and deployment.
- Assistance with database migrations and upgrades.
- Access to software updates and security patches.

Support does NOT include:
- Custom feature development (quoted separately).
- Training for new staff (quoted separately).
- Issues caused by Licensee's infrastructure, network, or third-party services.
- Issues arising from unauthorized modifications to the Software.

### 3.3 Support Contact

- **Email:** [support@yourcompany.com]
- **Phone:** [+XXX XXX XXXX] (Premium/Enterprise only)
- **Slack:** [Channel name] (Enterprise only)

## 4. Updates and Upgrades

### 4.1 Updates

Licensor will provide software updates (bug fixes, security patches,
minor feature improvements) at no additional cost during the support
term. Updates will be delivered via the Git repository or Docker image
registry.

### 4.2 Upgrades

Major version upgrades (new features, significant changes) will be
provided at no additional cost if included in the support tier. Licensee
is responsible for testing upgrades in a staging environment before
applying to production.

### 4.3 Upgrade Assistance

Licensor will provide remote assistance for one (1) production upgrade
per year at no additional cost. Additional upgrade assistance will be
quoted at [HOURLY_RATE] per hour.

## 5. Service Level Agreement

### 5.1 Uptime

The Software is self-hosted; uptime is dependent on Licensee's
infrastructure. Licensor does not guarantee uptime but will assist with
diagnosing and resolving Software-related issues that affect availability.

### 5.2 Backup and Recovery

Licensee is responsible for:
- Configuring and testing database backups.
- Configuring and testing S3/MinIO storage backups.
- Documenting and testing disaster recovery procedures.

Licensor will provide guidance on backup best practices upon request.

## 6. Fees and Payment

### 6.1 License Fee

- **One-time license fee:** [AMOUNT] [CURRENCY], due within 30 days of
  signing.
- **Annual support fee:** [AMOUNT] [CURRENCY] per year, due on each
  anniversary of the effective date.

### 6.2 Renewal

Support services will automatically renew annually unless either party
gives written notice of non-renewal at least 60 days before the renewal
date.

### 6.3 Fee Adjustment

Licensor may adjust the annual support fee on each renewal date by the
greater of (a) the change in the Consumer Price Index for [JURISDICTION]
or (b) 5%.

## 7. Confidentiality

Each party shall keep confidential all non-public information received
from the other party, including license keys, API credentials, and
technical documentation. Confidentiality obligations survive termination
for 3 years.

## 8. Warranties and Disclaimers

### 8.1 Licensor Warranty

Licensor warrants that the Software will, for 30 days after installation,
substantially conform to the documentation provided. Licensor's sole
obligation for breach of this warranty is to, at its option, repair or
replace the Software or refund the license fee.

### 8.2 Disclaimer

EXCEPT AS EXPRESSLY STATED IN THIS AGREEMENT, THE SOFTWARE IS PROVIDED
"AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE, OR NON-INFRINGEMENT. LICENSOR DOES NOT WARRANT THAT THE SOFTWARE
WILL BE ERROR-FREE OR UNINTERRUPTED.

## 9. Limitation of Liability

EXCEPT FOR LIABILITY FOR (A) BREACH OF CONFIDENTIALITY, (B) INFRINGEMENT
OF INTELLECTUAL PROPERTY, OR (C) GROSS NEGLIGENCE OR WILLFUL MISCONDUCT,
EACH PARTY'S TOTAL LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE
FEES PAID BY LICENSEE IN THE 12 MONTHS PRECEDING THE CLAIM.

IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR INDIRECT, INCIDENTAL,
SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR
BUSINESS INTERRUPTION.

## 10. Term and Termination

### 10.1 Term

This Agreement begins on the Effective Date and continues for 12 months,
then renews annually as described in Section 6.2.

### 10.2 Termination for Cause

Either party may terminate this Agreement on 30 days' written notice if
the other party materially breaches this Agreement and fails to cure the
breach within 30 days of notice.

### 10.3 Effect of Termination

Upon termination:
- The license granted in Section 2.1 shall continue in perpetuity
  (the Software is self-hosted and does not phone home).
- Support services will cease.
- Licensee shall pay all fees accrued up to the termination date.
- Each party shall return or destroy the other's confidential information.

## 11. Data Protection

### 11.1 Data Ownership

Licensee owns all data stored in the Software. Licensor does not have
access to Licensee's data in a self-hosted deployment.

### 11.2 Compliance

Licensee is responsible for compliance with applicable data protection
laws, including the Zambia Data Protection Act No. 3 of 2021 and the
EU General Data Protection Regulation (GDPR) if applicable.

## 12. General Provisions

### 12.1 Governing Law

This Agreement is governed by the laws of [JURISDICTION]. Disputes shall
be resolved in the courts of [JURISDICTION].

### 12.2 Entire Agreement

This Agreement, including any schedules and appendices, constitutes the
entire agreement between the parties regarding the Software.

### 12.3 Amendment

Amendments must be in writing and signed by both parties.

### 12.4 Assignment

Neither party may assign this Agreement without the other's written
consent.

---

## Signatures

**Licensor:**

Name: ___________________________
Title: ___________________________
Date: ___________________________

**Licensee:**

Name: ___________________________
Title: ___________________________
Date: ___________________________
