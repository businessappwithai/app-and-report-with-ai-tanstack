-- CRM demo schema: 12 related entities for reporting/analytics exercises
CREATE TABLE sales_reps (
  id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  region TEXT NOT NULL, team TEXT NOT NULL, hire_date DATE NOT NULL,
  quota_annual NUMERIC(12,2) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY, account_name TEXT NOT NULL, industry TEXT NOT NULL,
  segment TEXT NOT NULL, country TEXT NOT NULL, city TEXT NOT NULL,
  employee_count INT NOT NULL, annual_revenue NUMERIC(14,2) NOT NULL,
  owner_rep_id INT REFERENCES sales_reps(id), created_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE contacts (
  id SERIAL PRIMARY KEY, account_id INT NOT NULL REFERENCES accounts(id),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL,
  phone TEXT, job_title TEXT NOT NULL, seniority TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL);

CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY, campaign_name TEXT NOT NULL, channel TEXT NOT NULL,
  start_date DATE NOT NULL, end_date DATE NOT NULL, budget NUMERIC(12,2) NOT NULL,
  target_segment TEXT NOT NULL, status TEXT NOT NULL);

CREATE TABLE leads (
  id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL,
  company TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL,
  score INT NOT NULL, campaign_id INT REFERENCES campaigns(id),
  owner_rep_id INT REFERENCES sales_reps(id), created_at TIMESTAMP NOT NULL,
  converted_at TIMESTAMP);

CREATE TABLE products (
  id SERIAL PRIMARY KEY, sku TEXT UNIQUE NOT NULL, product_name TEXT NOT NULL,
  category TEXT NOT NULL, list_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE opportunities (
  id SERIAL PRIMARY KEY, account_id INT NOT NULL REFERENCES accounts(id),
  opportunity_name TEXT NOT NULL, stage TEXT NOT NULL, amount NUMERIC(12,2) NOT NULL,
  probability INT NOT NULL, owner_rep_id INT REFERENCES sales_reps(id),
  campaign_id INT REFERENCES campaigns(id), created_at TIMESTAMP NOT NULL,
  close_date DATE NOT NULL, is_won BOOLEAN, is_closed BOOLEAN NOT NULL DEFAULT FALSE);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY, account_id INT NOT NULL REFERENCES accounts(id),
  opportunity_id INT REFERENCES opportunities(id), order_number TEXT UNIQUE NOT NULL,
  order_date DATE NOT NULL, status TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD',
  total_amount NUMERIC(12,2) NOT NULL, discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id), quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL, line_total NUMERIC(12,2) NOT NULL);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id),
  invoice_number TEXT UNIQUE NOT NULL, issue_date DATE NOT NULL, due_date DATE NOT NULL,
  paid_date DATE, amount NUMERIC(12,2) NOT NULL, status TEXT NOT NULL);

CREATE TABLE activities (
  id SERIAL PRIMARY KEY, account_id INT REFERENCES accounts(id),
  contact_id INT REFERENCES contacts(id), rep_id INT REFERENCES sales_reps(id),
  activity_type TEXT NOT NULL, subject TEXT NOT NULL, activity_date TIMESTAMP NOT NULL,
  duration_minutes INT NOT NULL, outcome TEXT NOT NULL);

CREATE TABLE support_tickets (
  id SERIAL PRIMARY KEY, account_id INT NOT NULL REFERENCES accounts(id),
  contact_id INT REFERENCES contacts(id), subject TEXT NOT NULL, priority TEXT NOT NULL,
  status TEXT NOT NULL, category TEXT NOT NULL, opened_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP, satisfaction_score INT);
