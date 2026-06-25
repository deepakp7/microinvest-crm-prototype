-- ==========================================
-- SUPABASE / POSTGRES DATABASE SCHEMA
-- For project: ffg2026
-- Date: 2026-06-18
-- Includes tables: feedback, leads, opportunities, loans, audit_logs, notifications
-- ==========================================

-- Clean up existing tables if you are doing a clean reset (Optional, uncomment if needed)
-- DROP TABLE IF EXISTS public.notifications CASCADE;
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.loans CASCADE;
-- DROP TABLE IF EXISTS public.opportunities CASCADE;
-- DROP TABLE IF EXISTS public.leads CASCADE;
-- DROP TABLE IF EXISTS public.feedback CASCADE;

-- Enable UUID extension just in case
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. FEEDBACK TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.feedback (
    id            bigint        PRIMARY KEY, -- Uses Date.now() millisecond timestamp from Svelte frontend
    path          text          NOT NULL,
    generic       text,
    page_specific text,
    user_agent    text,
    incorporated  boolean       NOT NULL DEFAULT false,
    comment       text,
    deleted       boolean       NOT NULL DEFAULT false,
    ts            timestamptz   NOT NULL DEFAULT now(),
    created_at    timestamptz   NOT NULL DEFAULT now()
);

-- ==========================================
-- 2. LEADS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.leads (
    id                  text          PRIMARY KEY, -- e.g., 'ld-1'
    company_name        text          NOT NULL,
    contact_name        text          NOT NULL,
    email               text          NOT NULL,
    phone               text,
    investment_facility text          NOT NULL,
    deal_size           numeric,
    esg_rating          text,
    status              text          NOT NULL DEFAULT 'active', -- 'active', 'converted'
    created_at          timestamptz   NOT NULL DEFAULT now()
);

-- ==========================================
-- 3. OPPORTUNITIES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.opportunities (
    id                  text          PRIMARY KEY, -- e.g., 'opp-1'
    company_name        text          NOT NULL,
    contact_name        text          NOT NULL,
    email               text          NOT NULL,
    phone               text,
    investment_facility text          NOT NULL,
    deal_size           numeric,
    esg_rating          text,
    stage               text          NOT NULL DEFAULT 'prospect', -- 'prospect', 'qualified', 'proposal', 'won', 'lost'
    probability         integer       NOT NULL DEFAULT 10,
    emails_triggered    jsonb         NOT NULL DEFAULT '[]'::jsonb, -- JSON logs of triggered emails
    notes               text,
    booked              boolean       NOT NULL DEFAULT false,
    loan_id             text,
    margill_synced      boolean       NOT NULL DEFAULT false,
    accounting_synced   boolean       NOT NULL DEFAULT false,
    created_at          timestamptz   NOT NULL DEFAULT now()
);

-- ==========================================
-- 4. LOANS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.loans (
    id                  text          PRIMARY KEY, -- e.g., 'loan-1101'
    opportunity_id      text          REFERENCES public.opportunities(id) ON DELETE SET NULL,
    company_name        text          NOT NULL,
    loan_id             text          NOT NULL UNIQUE, -- e.g., '1101'
    facility            text          NOT NULL,
    amount              numeric       NOT NULL,
    esg_rating          text          NOT NULL,
    status              text          NOT NULL DEFAULT 'Active',
    booked_at           timestamptz   NOT NULL DEFAULT now(),
    interest_rate       text          NOT NULL,
    term_months         integer       NOT NULL,
    remaining_balance   numeric,
    next_payment_num    integer       NOT NULL DEFAULT 1,
    origination_date    text,
    first_payment_date  text,
    fund                text,
    creditor            text,
    compounding_period  text,
    payment_frequency   text,
    payment_method      text,
    sub_status          text,
    accounting_id       text,
    file_no             text,
    max_credit          numeric,
    unique_identifier1  text,
    unique_identifier2  text,
    other_info          text,
    borrower            jsonb,
    custom_fields       jsonb,
    modifications       jsonb         NOT NULL DEFAULT '[]'::jsonb
);

-- ==========================================
-- 5. AUDIT LOGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id         bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp  timestamptz   NOT NULL DEFAULT now(),
    role       text          NOT NULL,
    action     text          NOT NULL
);

-- ==========================================
-- 6. NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id          text          PRIMARY KEY, -- e.g., 'not-1'
    type        text          NOT NULL, -- e.g., 'KYC Check'
    client      text          NOT NULL,
    message     text          NOT NULL,
    urgent      boolean       NOT NULL DEFAULT false,
    created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ==========================================
-- 7. NCM FUNDS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ncm_funds (
    fund_code             text          PRIMARY KEY, -- e.g. 'ACCESS2'
    name                  text          NOT NULL,
    total_fund_value      numeric       NOT NULL,
    admin_fee_rate        text          NOT NULL,
    custodian_bank        text          NOT NULL,
    last_valuation_sync   timestamptz   NOT NULL DEFAULT now()
);

-- ==========================================
-- 8. COVENANTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.covenants (
    id                    text          PRIMARY KEY, -- e.g. 'cov-1'
    loan_id               text          REFERENCES public.loans(loan_id) ON DELETE CASCADE,
    company_name          text          NOT NULL,
    manager               text          NOT NULL,
    type                  text          NOT NULL, -- 'Covenant' or 'Condition Subsequent'
    title                 text          NOT NULL,
    description           text,
    due_date              text          NOT NULL,
    status                text          NOT NULL DEFAULT 'Pending', -- 'Pending', 'Overdue', 'Collected'
    collected_date        timestamptz,
    attached_file         text,
    notes                 text,
    created_at            timestamptz   NOT NULL DEFAULT now()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS feedback_path_idx ON public.feedback (path);
CREATE INDEX IF NOT EXISTS feedback_ts_idx ON public.feedback (ts DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads (status);
CREATE INDEX IF NOT EXISTS opportunities_stage_idx ON public.opportunities (stage);
CREATE INDEX IF NOT EXISTS loans_opportunity_id_idx ON public.loans (opportunity_id);
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS notifications_urgent_idx ON public.notifications (urgent);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncm_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covenants ENABLE ROW LEVEL SECURITY;

-- feedback policies
CREATE POLICY "Allow anon feedback insert" ON public.feedback FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon feedback select" ON public.feedback FOR SELECT TO anon USING (true);

-- leads policies
CREATE POLICY "Allow authenticated leads manage" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon leads manage" ON public.leads FOR ALL TO anon USING (true) WITH CHECK (true); -- Useful for prototype; restrict in real prod settings!

-- opportunities policies
CREATE POLICY "Allow authenticated opportunities manage" ON public.opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon opportunities manage" ON public.opportunities FOR ALL TO anon USING (true) WITH CHECK (true);

-- loans policies
CREATE POLICY "Allow authenticated loans manage" ON public.loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon loans manage" ON public.loans FOR ALL TO anon USING (true) WITH CHECK (true);

-- audit_logs policies
CREATE POLICY "Allow authenticated audit_logs manage" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon audit_logs manage" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- notifications policies
CREATE POLICY "Allow authenticated notifications manage" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon notifications manage" ON public.notifications FOR ALL TO anon USING (true) WITH CHECK (true);

-- ncm_funds policies
CREATE POLICY "Allow authenticated ncm_funds manage" ON public.ncm_funds FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon ncm_funds manage" ON public.ncm_funds FOR ALL TO anon USING (true) WITH CHECK (true);

-- covenants policies
CREATE POLICY "Allow authenticated covenants manage" ON public.covenants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon covenants manage" ON public.covenants FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==========================================
-- SEED DATA (FROM store.js PROTOTYPE DEFAULTS)
-- ==========================================

-- Seed Leads
INSERT INTO public.leads (id, company_name, contact_name, email, phone, investment_facility, deal_size, esg_rating, created_at, status)
VALUES
  ('ld-1', 'SolarTech Solutions', 'Alice Vane', 'alice@solartech.io', '+44 20 7946 2631', 'Renewable Energy Dev Loan', 1200000, 'AAA (Exceptional)', '2026-06-10T10:14:00Z', 'converted'),
  ('ld-2', 'Apex Housing Group', 'Bob Miller', 'bob@apexhousing.com', '+44 20 7946 9012', 'Urban Housing Fund', 4500000, 'AA (High Impact)', '2026-06-11T14:30:00Z', 'active'),
  ('ld-3', 'NextGen Bio', 'Clara Chen', 'clara@nextgenbio.co', '+44 20 7946 4432', 'Tech Innovation Venture', 850000, 'A (Moderate)', '2026-06-12T09:00:00Z', 'converted'),
  ('ld-4', 'Ecotech Microgrid', 'Elena Rostova', 'elena@ecotech.net', '+44 20 7946 0958', 'Renewable Energy Dev Loan', 620000, 'AAA (Exceptional)', '2026-06-14T08:15:00Z', 'active')
ON CONFLICT (id) DO NOTHING;

-- Seed Opportunities
INSERT INTO public.opportunities (id, company_name, contact_name, email, phone, investment_facility, deal_size, esg_rating, stage, probability, emails_triggered, notes, booked, loan_id, margill_synced, accounting_synced)
VALUES
  ('opp-1', 'SolarTech Solutions', 'Alice Vane', 'alice@solartech.io', '+44 20 7946 2631', 'Renewable Energy Dev Loan', 1200000, 'AAA (Exceptional)', 'prospect', 10, '[{"date": "2026-06-10T10:15:00Z", "subject": "Welcome to MicroInvest Lead Portal", "recipient": "alice@solartech.io"}]'::jsonb, 'Initial discussion on funding solar microgrid expansion in California.', false, NULL, false, false),
  ('opp-2', 'NextGen Bio', 'Clara Chen', 'clara@nextgenbio.co', '+44 20 7946 4432', 'Tech Innovation Venture', 850000, 'A (Moderate)', 'proposal', 60, '[{"date": "2026-06-12T09:05:00Z", "subject": "Welcome to MicroInvest Lead Portal", "recipient": "clara@nextgenbio.co"}, {"date": "2026-06-13T11:00:00Z", "subject": "Investment Proposal Request - NextGen Bio", "recipient": "clara@nextgenbio.co"}]'::jsonb, 'Proposal submitted. Executive committee reviewing alignment with regional tech dev directives.', false, NULL, false, false),
  ('opp-3', 'Greenfield Wind Farm', 'David Wright', 'david@greenfieldwind.com', '+44 20 7946 0144', 'Renewable Energy Dev Loan', 8000000, 'AAA (Exceptional)', 'won', 100, '[{"date": "2026-06-01T08:00:00Z", "subject": "Welcome to MicroInvest Lead Portal", "recipient": "david@greenfieldwind.com"}, {"date": "2026-06-05T15:30:00Z", "subject": "Investment Proposal Request", "recipient": "david@greenfieldwind.com"}, {"date": "2026-06-09T09:12:00Z", "subject": "Loan Booking Confirmation - Greenfield Wind Farm", "recipient": "david@greenfieldwind.com"}]'::jsonb, 'Loan confirmed and booked. Handed over to operations for disbursement.', true, 'LN-2026-0043', true, true),
  ('opp-4', 'Apex Housing Group', 'Bob Miller', 'bob@apexhousing.com', '+44 20 7946 9012', 'Urban Housing Fund', 4500000, 'AA (High Impact)', 'won', 100, '[{"date": "2026-06-11T14:30:00Z", "subject": "Welcome to MicroInvest Lead Portal", "recipient": "bob@apexhousing.com"}, {"date": "2026-06-13T10:00:00Z", "subject": "Investment Proposal Request - Apex Housing Group", "recipient": "bob@apexhousing.com"}, {"date": "2026-06-14T16:45:00Z", "subject": "Deal Won - Loan Booking Confirmation Pending", "recipient": "bob@apexhousing.com"}]'::jsonb, 'Deal successfully closed. Awaiting Operations to book and disburse via Margill.', false, NULL, false, false)
ON CONFLICT (id) DO NOTHING;

-- Seed Loans
INSERT INTO public.loans (
    id, opportunity_id, company_name, loan_id, facility, amount, esg_rating, status, booked_at, interest_rate, term_months,
    remaining_balance, next_payment_num, origination_date, first_payment_date, fund, creditor, compounding_period,
    payment_frequency, payment_method, sub_status, accounting_id, file_no, max_credit, unique_identifier1, unique_identifier2,
    other_info, borrower, custom_fields
)
VALUES
  (
    'loan-1101', 'opp-3', 'Laing Project Limited', '1101', 'Urban Housing Fund', 58734, 'AA (High Impact)', 'Active', '2021-09-09T09:12:00Z', '6.00%', 54,
    49936.91, 32, '09/09/2021', '18/09/2021', 'ACCESS2', 'Big Issue Invest', 'Annually', 'Monthly', 'Normal (Principal + Interest)', 'AUTO',
    'ACC-1101', 'F-2021-101', 100000, 'LN-1101-M', 'CO-982138', 'This is the Laing Project affordable housing development.',
    '{"firstName": "Jane", "lastName": "Laing", "businessName": "Laing Project Limited", "address": "12 High Street", "city": "London", "stateProv": "Greater London", "postcode": "SW1A 1AA", "country": "United Kingdom", "phone": "+44 20 7946 0122", "mobile": "+44 7700 900077", "email": "jane@laingproject.co.uk", "socialSec": "QQ 12 34 56 A", "birthDate": "1978-04-12", "maritalStatus": "Married", "uniqueIdentifier1": "B-9921", "uniqueIdentifier2": "09812421", "ownerCreator": "Linda Wickstrom"}',
    '{"investmentManager": "Linda Wickstrom", "grant": 6000, "rateType": "Fixed"}'
  ),
  (
    'loan-1102', 'opp-1', 'SolarTech Solutions', '1102', 'Renewable Energy Dev Loan', 30000, 'AAA (Exceptional)', 'Active', '2021-09-09T10:14:00Z', '6.00%', 60,
    22000, 12, '09/09/2021', '18/09/2021', 'ACCESS2', 'Big Issue Invest', 'Annually', 'Monthly', 'Normal (Principal + Interest)', 'AUTO',
    'ACC-1102', 'F-2021-102', 50000, 'LN-1102-M', 'CO-110239', 'Solar array expansion on community center.',
    '{"firstName": "Alice", "lastName": "Vane", "businessName": "SolarTech Solutions", "address": "1 Broad Street", "city": "Birmingham", "stateProv": "West Midlands", "postcode": "B1 1BB", "country": "United Kingdom", "phone": "+44 121 496 0199", "email": "alice@solartech.io", "socialSec": "AB 98 76 54 C", "maritalStatus": "Single", "uniqueIdentifier1": "B-4412", "uniqueIdentifier2": "11023912", "ownerCreator": "Linda Wickstrom"}',
    '{"investmentManager": "Linda Wickstrom", "grant": 0, "rateType": "Fixed"}'
  ),
  (
    'loan-1103', 'opp-2', 'NextGen Bio', '1103', 'Tech Innovation Venture', 65000, 'A (Moderate)', 'Active', '2021-09-23T11:00:00Z', '6.00%', 48,
    41212.99, 22, '23/09/2021', '01/10/2021', 'ACCESS2', 'Big Issue Invest', 'Annually', 'Monthly', 'Normal (Principal + Interest)', 'AUTO',
    'ACC-1103', 'F-2021-103', 100000, 'LN-1103-M', 'CO-223912', 'Bio-waste processing facility expansion.',
    '{"firstName": "Clara", "lastName": "Chen", "businessName": "NextGen Bio", "address": "Science Park Rd", "city": "Cambridge", "stateProv": "Cambridgeshire", "postcode": "CB4 0EY", "country": "United Kingdom", "phone": "+44 1223 496011", "email": "clara@nextgenbio.co", "uniqueIdentifier1": "B-2891", "uniqueIdentifier2": "22391231", "ownerCreator": "Linda Wickstrom"}',
    '{"investmentManager": "Linda Wickstrom", "grant": 0, "rateType": "Fixed"}'
  ),
  (
    'loan-1104', NULL, 'Newton Community Trust', '1104', 'Urban Housing Fund', 42000, 'AA (High Impact)', 'Active', '2021-09-28T09:00:00Z', '6.00%', 72,
    35000, 15, '28/09/2021', '05/10/2021', 'PFP', 'Big Issue Invest', 'Annually', 'Monthly', 'Normal (Principal + Interest)', 'AUTO',
    'ACC-1104', 'F-2021-104', 50000, 'LN-1104-M', 'CO-771239', 'Community hall renovation loan.',
    '{"firstName": "Isaac", "lastName": "Newton", "businessName": "Newton Community Trust", "address": "Gravity Lane", "city": "Woolsthorpe", "stateProv": "Lincolnshire", "postcode": "NG33 5PD", "country": "United Kingdom", "email": "isaac@newtoncommunity.org", "ownerCreator": "Linda Wickstrom"}',
    '{"investmentManager": "Linda Wickstrom", "grant": 0, "rateType": "Fixed"}'
  ),
  (
    'loan-1106', 'opp-4', 'Apex Housing Group', '1106', 'Urban Housing Fund', 50000, 'AA (High Impact)', 'Bad debt', '2021-09-30T15:30:00Z', '6.00%', 60,
    50000, 1, '30/09/2021', '15/10/2021', 'ACCESS2', 'Big Issue Invest', 'Annually', 'Monthly', 'Normal (Principal + Interest)', 'AUTO',
    'ACC-1106', 'F-2021-106', 50000, 'LN-1106-M', 'CO-998811', 'Defaulted housing project. In collections.',
    '{"firstName": "Bob", "lastName": "Miller", "businessName": "Apex Housing Group", "address": "Construction Way", "city": "Leeds", "stateProv": "West Yorkshire", "postcode": "LS1 1BA", "country": "United Kingdom", "email": "bob@apexhousing.com", "ownerCreator": "Linda Wickstrom"}',
    '{"investmentManager": "Linda Wickstrom", "grant": 0, "rateType": "Fixed"}'
  ),
  (
    'loan-1107', NULL, 'Southend Cooperative', '1107', 'Urban Housing Fund', 63000, 'A (Moderate)', 'Closed', '2021-09-30T10:00:00Z', '6.00%', 60,
    0, 61, '30/09/2021', '10/10/2021', 'ACCESS2', 'Big Issue Invest', 'Annually', 'Monthly', 'Normal (Principal + Interest)', 'AUTO',
    'ACC-1107', 'F-2021-107', 75000, 'LN-1107-M', 'CO-112233', 'Fully repaid community store loan.',
    '{"firstName": "George", "lastName": "Coop", "businessName": "Southend Cooperative", "address": "Retail Row", "city": "Southend-on-Sea", "stateProv": "Essex", "postcode": "SS1 1AA", "country": "United Kingdom", "email": "george@southendcoop.org.uk", "ownerCreator": "Linda Wickstrom"}',
    '{"investmentManager": "Linda Wickstrom", "grant": 0, "rateType": "Fixed"}'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Audit Logs
INSERT INTO public.audit_logs (timestamp, role, action)
VALUES
  ('2026-06-09T09:12:00Z', 'Operations', 'Booked Loan LN-2026-0043 in servicing system (Amount: £8,000,000)'),
  ('2026-06-09T09:12:05Z', 'Operations', 'Created accounting ledger entries: DR Asset (Loans Receivable), CR Cash'),
  ('2026-06-10T10:14:00Z', 'Sales Rep', 'Captured new lead "SolarTech Solutions" via online Zoho Webhook'),
  ('2026-06-11T14:30:00Z', 'Sales Rep', 'Manually logged lead "Apex Housing Group"'),
  ('2026-06-12T09:00:00Z', 'Sales Rep', 'Promoted "NextGen Bio" to Qualified Stage'),
  ('2026-06-14T08:15:00Z', 'Sales Rep', 'Captured new lead "Ecotech Microgrid" via manual entry');

-- Seed Notifications
INSERT INTO public.notifications (id, type, client, message, urgent, created_at)
VALUES
  ('not-1', 'KYC Check', 'SolarTech Solutions', 'Annual KYC check due in 30 days', false, now()),
  ('not-2', 'KYC Check', 'Apex Housing Group', 'AML validation query flagged on address matching', true, now()),
  ('not-3', 'Operations Task', 'NextGen Bio', 'Upload signed facility letter', false, now())
ON CONFLICT (id) DO NOTHING;

-- Seed NCM Funds
INSERT INTO public.ncm_funds (fund_code, name, total_fund_value, admin_fee_rate, custodian_bank)
VALUES
  ('ACCESS2', 'Access 2 Growth Fund', 10000000, '0.95%', 'Royal Bank of Scotland'),
  ('PFP', 'People''s Fund Portfolio', 5000000, '1.20%', 'HSBC UK'),
  ('ESM', 'Enterprise Social Microfinance', 4000000, '1.10%', 'Barclays Bank'),
  ('BIIGLA', 'Big Issue Growth Loan Admin', 3000000, '0.85%', 'Lloyds Bank'),
  ('RGFBII2', 'Regional Growth Fund II', 2000000, '1.00%', 'NatWest')
ON CONFLICT (fund_code) DO NOTHING;

-- Seed Covenants
INSERT INTO public.covenants (id, loan_id, company_name, manager, type, title, description, due_date, status, collected_date, attached_file, notes)
VALUES
  ('cov-1', '1101', 'Laing Project Limited', 'Linda Wickstrom', 'Covenant', 'Q1 2026 Management Accounts', 'Submit Q1 unaudited management accounts within 45 days of quarter end.', '2026-06-30', 'Pending', NULL, NULL, ''),
  ('cov-2', '1101', 'Laing Project Limited', 'Linda Wickstrom', 'Covenant', 'Annual Audited Accounts', 'Submit annual audited financial statements within 6 months of financial year end.', '2026-09-30', 'Pending', NULL, NULL, ''),
  ('cov-3', '1102', 'SolarTech Solutions', 'Linda Wickstrom', 'Condition Subsequent', 'Charge Registration with Companies House', 'Register first legal charge over solar asset array with Companies House (Form MR01).', '2026-05-15', 'Overdue', NULL, NULL, ''),
  ('cov-4', '1102', 'SolarTech Solutions', 'Linda Wickstrom', 'Covenant', 'Q2 2026 Management Accounts', 'Submit Q2 unaudited management accounts.', '2026-07-31', 'Pending', NULL, NULL, ''),
  ('cov-5', '1103', 'NextGen Bio', 'Linda Wickstrom', 'Condition Subsequent', 'Proof of Opening Reserve Account', 'Provide bank statement showing opening of the debt service reserve account with £10,000.', '2026-06-20', 'Collected', '2026-06-20T14:30:00Z', 'reserve_acct_statement.pdf', 'Verified statement showing £10,000 balance in RBS reserve account. Confirmed satisfying Condition Subsequent.'),
  ('cov-6', '1103', 'NextGen Bio', 'Linda Wickstrom', 'Covenant', 'Quarterly Environmental Impact Report', 'Submit quarterly bio-waste processing ESG report.', '2026-07-15', 'Pending', NULL, NULL, ''),
  ('cov-7', '1104', 'Newton Community Trust', 'Linda Wickstrom', 'Covenant', 'Q1 2026 Management Accounts', 'Submit Q1 unaudited management accounts.', '2026-05-31', 'Collected', '2026-05-28T10:15:00Z', 'Newton_Q1_26_Accounts.xlsx', 'Received and reviewed. Operating surplus is in line with forecasts.'),
  ('cov-8', '1104', 'Newton Community Trust', 'Linda Wickstrom', 'Condition Subsequent', 'Board Resolution for Grant Allocation', 'Provide signed copy of board resolution approving allocation of grant funds.', '2026-06-10', 'Overdue', NULL, NULL, '')
ON CONFLICT (id) DO NOTHING;

