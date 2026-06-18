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
    id             text          PRIMARY KEY, -- e.g., 'loan-1'
    opportunity_id text          REFERENCES public.opportunities(id) ON DELETE SET NULL,
    company_name   text          NOT NULL,
    loan_id        text          NOT NULL UNIQUE, -- e.g., 'LN-2026-0043'
    facility       text          NOT NULL,
    amount         numeric       NOT NULL,
    esg_rating     text          NOT NULL,
    status         text          NOT NULL DEFAULT 'Active', -- 'Disbursed', 'Active', 'Settled'
    booked_at      timestamptz   NOT NULL DEFAULT now(),
    interest_rate  text          NOT NULL, -- e.g., '5.25%'
    term_months    integer       NOT NULL
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
INSERT INTO public.loans (id, opportunity_id, company_name, loan_id, facility, amount, esg_rating, status, booked_at, interest_rate, term_months)
VALUES
  ('loan-1', 'opp-3', 'Greenfield Wind Farm', 'LN-2026-0043', 'Renewable Energy Dev Loan', 8000000, 'AAA (Exceptional)', 'Disbursed', '2026-06-09T09:12:00Z', '5.25%', 60)
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
