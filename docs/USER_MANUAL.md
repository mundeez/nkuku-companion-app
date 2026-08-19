# Nkuku Companion — User Manual

## Getting Started

### Logging In
1. Navigate to your Nkuku app URL
2. Enter your email and password
3. Click "Login"

### Dashboard Overview
The dashboard shows:
- **Active Flocks:** Number of flocks currently being raised
- **Total Birds:** Total birds across all active flocks
- **Mortality Rate:** Average mortality percentage
- **Diseases:** Quick link to disease database
- **Quick Actions:** Links to common tasks

## Broiler Flock Management

### Creating a New Flock
1. Go to **Broiler Flocks** in the navigation
2. Click **New Flock**
3. Fill in the details:
   - **Flock Name:** e.g., "Flock A - June 2026"
   - **Breed:** Select Ross 308 (primary) or Cobb 500
   - **Start Date:** Day 0 for the flock (chick arrival date)
   - **Initial Count:** Number of day-old chicks
   - **Target Weight:** Expected harvest weight in kg (e.g., 2.5)
   - **Target Age:** Expected harvest age in days (e.g., 42)
   - **Feed Transition Day:** Day to switch from Starter to Grower (default: 11)
4. Click **Create Flock**

### Managing a Flock
Click on any flock card to open the **Flock Detail** page. This page has tabs for:

#### Overview Tab
- Quick stats (birds, latest weight, mortality, profit)
- Recent activity feed
- Flock summary (total feed, water, costs)

#### Growth Tab
- Record weight checks by sampling birds
- Enter sample size and average weight
- Compare against Ross 308 targets

#### Feed Tab
- Record daily feed consumption
- Select feed type: Starter, Grower, or Finisher
- Enter cost in ZMW
- View feed summary by type

#### Water Tab
- Record daily water consumption
- Track pH levels (optimal: 6.0-7.5)
- Track water temperature

#### Mortality Tab
- Record deaths with cause
- View running mortality rate
- Track causes of death

#### Vaccination Tab
- Record administered vaccines
- View vaccination history
- Track upcoming vaccinations

#### Financial Tab
- Record expenses (feed, chicks, vaccines, etc.)
- Record revenue (sales)
- View profit/loss in ZMW

### Analysis Pages
From the flock detail page, you can navigate to:
- **Growth Analysis** — Compare actual growth vs Ross 308 targets
- **Feed Calculator** — Estimate feed requirements and costs
- **Mortality Analysis** — View cause breakdown and age distribution
- **Financial Projection** — Calculate break-even and projected profit

## Disease Database

### Browsing Diseases
1. Go to **Diseases** in the navigation
2. Use the search bar to find diseases by name or symptom
3. Filter by category (Viral, Bacterial, Parasitic)

### Disease Details
Click any disease card to view:
- **Symptoms:** What to look for
- **Prevention:** How to avoid the disease
- **Treatment:** Standard veterinary treatments
- **Organic Treatments:** Natural remedies (where applicable)

## Alerts

### Viewing Alerts
1. Go to **Alerts** in the navigation or click the bell icon
2. Filter by: Open, Resolved, or All

### Alert Types
- **Temperature Adjustment:** Weekly temperature changes for brooders
- **Vaccination Due:** Upcoming vaccinations based on schedule
- **Feed Transition:** Reminder to switch feed types
- **Mortality Threshold:** Warning if mortality exceeds normal rates

### Generating Alerts
Click **Generate Alerts** to scan your active flocks and create alerts for pending actions.

## Settings

### Appearance
- Toggle between Light, Dark, or System theme
- Click the sun/moon icon in the navbar for quick toggle

### Breed Configuration
View primary breed settings (Ross 308) and performance targets.

### Currency
All financial data is displayed in ZMW (Zambian Kwacha).

## Double-Entry Ledger

The app includes a full double-entry bookkeeping system for accurate, GAAP-compliant financial tracking. All ledger pages are found under **Ledger** in the navigation (web pages at `/ledger/*`).

### Chart of Accounts
- Go to **Ledger → Accounts** (`/ledger/accounts`) to view the chart of accounts
- Accounts are organized into six categories: Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Revenue (4xxx), COGS (5xxx), and Operating Expenses (6xxx)
- Click any account to view its general ledger and running balance (`/ledger/accounts/[code]`)
- The tree is collapsible — expand header accounts to see detail accounts underneath

### Journal Entries
- Go to **Ledger → Journal** (`/ledger/journal`) to view all journal entries
- Click **New Entry** (`/ledger/journal/new`) to create a manual journal entry
- Add multiple debit and credit lines — the form shows a live balance indicator so you can confirm debits equal credits before posting
- Once posted, a journal entry **cannot be edited or deleted** (this is enforced for audit integrity)
- To correct a mistake, open the entry (`/ledger/journal/[id]`) and click **Reverse** — this creates a reversal entry that cancels out the original

### Trial Balance
- Go to **Ledger** (`/ledger`) to view the trial balance
- The trial balance lists every account with its debit or credit balance
- A green indicator confirms that total debits equal total credits

### Income Statement
- Go to **Ledger → Income Statement** (`/ledger/income-statement`) to view your profit & loss statement
- Shows revenue, cost of goods sold (COGS), gross profit, operating expenses, and net income
- Filter by date range as needed

### Balance Sheet
- Go to **Ledger → Balance Sheet** (`/ledger/balance-sheet`) to view your statement of financial position
- Shows assets, liabilities, and equity as of a selected date
- Verifies the accounting equation: Assets = Liabilities + Equity

### Cash Flow Statement
- Go to **Ledger → Cash Flow** (`/ledger/cash-flow`) to view your cash flow statement
- Uses the indirect method, starting from net income and adjusting for non-cash items and working capital changes

### Period Close & Year-End Close
- Go to **Ledger → Close** (`/ledger/close`) to run the year-end close wizard
- **Period Close** finalizes a reporting period — no new entries can be back-dated into a closed period
- **Year-End Close** automatically posts closing journal entries that zero out all revenue and expense accounts into Retained Earnings, preparing the books for the new fiscal year

## Document Attachments

You can upload documents (receipts, invoices, photos, etc.) and attach them to financial records, journal entries, sale records, and flocks.

### Uploading a Document
1. Open the record you want to attach a document to (e.g., a financial record, journal entry, or sale record)
2. Look for the **Attachments** panel
3. Click **Upload** and select a file
4. Supported file types: PDF, JPG, PNG, WebP, DOC, DOCX, CSV, XLSX, XLS
5. Maximum file size: 25 MB
6. Up to 20 attachments per record

### Virus Scanning
- Every uploaded file is automatically scanned for viruses by ClamAV before it is stored
- If a file is flagged as infected, the upload is rejected immediately

### OCR & Text Extraction
- When you upload a document, the system automatically extracts text from it:
  - **PDF** files — text extracted directly
  - **DOCX** files — text extracted via document parser
  - **Images** (JPG, PNG, WebP) — text extracted via OCR (Tesseract)
  - **CSV/XLSX** — plain text content extracted
- Extracted text is indexed for full-text search, so you can search across all your documents by keyword

### Viewing & Downloading
- Click any attachment to view it inline in your browser
- Use the **Download** button to save a copy to your device
- Owners and managers can delete attachments; other roles have view-only access

## Bulk Operations

When you need to enter or remove many records at once (e.g., logging several days of feed data), use bulk operations to save time.

### Bulk Create
1. Navigate to the relevant record section (Growth, Feed, Water, Mortality, Vaccination, or Financial)
2. Click **Bulk Add** (or **Bulk Create**)
3. Fill in multiple rows in the form — each row is one record
4. Click **Submit** to create all records at once
5. You can add up to 500 records in a single bulk request

### Bulk Delete
1. Navigate to the relevant record section
2. Select the records you want to delete (or provide a list of record IDs)
3. Click **Bulk Delete**
4. Confirm the deletion

### Supported Record Types
| Record Type | Bulk Actions |
|-------------|-------------|
| Growth records | Create, Delete |
| Feed records | Create, Delete |
| Water records | Create, Delete |
| Mortality events | Create, Delete |
| Vaccination events | Create, Delete |
| Financial records | Create, Delete |
| Alerts | Mark Read, Mark Resolved, Delete |

### Who Can Use Bulk Operations
- **Bulk create:** Owners and Managers
- **Bulk delete:** Owners only
- Bulk operations are rate-limited to prevent accidental mass changes

## Billing & Monetization

The app offers subscription tiers so you can choose the plan that fits your operation.

### Subscription Tiers
- **Free** — For smallholders and trial use: 1 active flock, 1 user, 2 cycles of history, core tracking (growth/feed/water/mortality/vaccination), disease database, and basic alerts. Does not include the financial ledger or data exports.
- **Starter** — For growing farms: multiple flocks, more users, access to the financial ledger, and data exports.
- **Pro** — For established operations: unlimited flocks, full ledger, document attachments, and advanced analytics.
- **Enterprise** — For agribusinesses, co-ops, and NGOs: unlimited users, white-label branding, dedicated onboarding, SLA, and optional self-hosted deployment. Custom-quoted.

### Managing Your Subscription
1. Go to **Settings → Billing** (`/billing`) on the web app
2. View your current plan, billing cycle, and renewal date
3. Upgrade or downgrade your plan as needed
4. Payments are processed via Flutterwave (supports mobile money and cards)

### Billing Cycles
- **Monthly** — billed every month
- **Per production cycle (3 months)** — discounted (~13% savings)
- **Annual** — billed once per year

### When You Hit a Plan Limit
- If you try to create a flock, invite a user, or upload a document beyond your plan's limits, you'll see an upgrade prompt
- Follow the prompt to the billing page to upgrade your plan

## Tips for Best Results

1. **Record daily:** Log feed, water, and mortality daily for accurate tracking
2. **Weigh weekly:** Sample and weigh birds at least once per week
3. **Vaccinate on schedule:** Follow the Ross 308 vaccination schedule
4. **Monitor mortality:** Investigate causes if mortality exceeds 5%
5. **Track costs:** Record all expenses to calculate true profit/loss
