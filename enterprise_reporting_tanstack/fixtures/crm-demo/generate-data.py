import random, datetime as dt
random.seed(42)
N = 200
out = []
def q(s):
    return "'" + str(s).replace("'", "''") + "'"

REGIONS = ["North America", "EMEA", "APAC", "LATAM"]
TEAMS = ["Enterprise", "Mid-Market", "SMB", "Strategic"]
INDUSTRIES = ["Manufacturing","Financial Services","Healthcare","Retail","Technology",
              "Logistics","Energy","Education","Public Sector","Telecom"]
SEGMENTS = ["Enterprise", "Mid-Market", "SMB"]
COUNTRIES = [("United States","Chicago"),("United States","Austin"),("Germany","Munich"),
             ("United Kingdom","Manchester"),("France","Lyon"),("Japan","Osaka"),
             ("Singapore","Singapore"),("Brazil","São Paulo"),("Canada","Toronto"),("India","Pune")]
FIRST = ["Amara","Chen","Diego","Elena","Farid","Grace","Hiro","Ingrid","Jonas","Keiko",
         "Lucia","Mateo","Nadia","Omar","Priya","Quentin","Rosa","Samir","Tara","Ulrich",
         "Vera","Wei","Ximena","Yusuf","Zara"]
LAST = ["Adeyemi","Bergström","Costa","Dubois","Eriksen","Ferreira","Gallagher","Haddad",
        "Ibrahim","Jansen","Kowalski","Lindqvist","Moreau","Nakamura","Okonkwo","Petrov",
        "Quintana","Rossi","Silva","Tanaka","Ueda","Varga","Weber","Xu","Yilmaz","Zhang"]
TITLES = [("Chief Financial Officer","C-Level"),("VP Operations","VP"),("Director of IT","Director"),
          ("Procurement Manager","Manager"),("Head of Analytics","Director"),
          ("Operations Analyst","Individual Contributor"),("Chief Technology Officer","C-Level"),
          ("Finance Manager","Manager"),("Supply Chain Lead","Manager"),("Data Engineer","Individual Contributor")]
CHANNELS = ["Email","Paid Search","Webinar","Trade Show","Content Syndication","Partner Referral","Social"]
LEAD_SOURCES = ["Web Form","Cold Outreach","Partner Referral","Trade Show","Webinar","Inbound Call"]
LEAD_STATUS = ["New","Working","Nurture","Qualified","Disqualified","Converted"]
STAGES = ["Prospecting","Discovery","Proposal","Negotiation","Closed Won","Closed Lost"]
CATEGORIES = ["Platform License","Analytics Module","Integration Connector","Support Plan","Professional Services"]
ORDER_STATUS = ["Draft","Confirmed","Fulfilled","Cancelled"]
INV_STATUS = ["Paid","Open","Overdue","Void"]
ACT_TYPES = ["Call","Email","Meeting","Demo","Site Visit"]
OUTCOMES = ["Connected","Left Voicemail","No Answer","Positive","Follow-up Scheduled","Not Interested"]
PRIORITIES = ["Low","Medium","High","Critical"]
TICKET_STATUS = ["Open","In Progress","Waiting on Customer","Resolved","Closed"]
TICKET_CATS = ["Data Import","Performance","Access & Permissions","Billing","Integration","Bug Report"]

BASE = dt.date(2023, 1, 1)
def rdate(start=0, span=900):
    return BASE + dt.timedelta(days=random.randint(start, start + span))
def rts(start=0, span=900):
    d = rdate(start, span)
    return dt.datetime(d.year, d.month, d.day, random.randint(7, 19), random.choice([0,15,30,45]))

# 1. sales_reps
rows = []
for i in range(1, N + 1):
    fn, ln = random.choice(FIRST), random.choice(LAST)
    rows.append(f"({q(fn+' '+ln)},{q(f'{fn.lower()}.{ln.lower()}{i}@northwind-crm.example')},"
                f"{q(random.choice(REGIONS))},{q(random.choice(TEAMS))},{q(rdate(0,700))},"
                f"{random.choice([450000,600000,750000,900000,1200000])},{str(random.random()>0.12).lower()})")
out.append("INSERT INTO sales_reps (full_name,email,region,team,hire_date,quota_annual,is_active) VALUES\n"
           + ",\n".join(rows) + ";")

# 2. accounts
rows = []
for i in range(1, N + 1):
    country, city = random.choice(COUNTRIES)
    seg = random.choice(SEGMENTS)
    emp = {"Enterprise": random.randint(1500, 40000), "Mid-Market": random.randint(250, 1499),
           "SMB": random.randint(15, 249)}[seg]
    rev = round(emp * random.uniform(90000, 260000), 2)
    rows.append(f"({q(random.choice(LAST)+' '+random.choice(['Industries','Group','Holdings','Systems','Labs','Partners','Logistics','Technologies']))} || ' {i}',"
                f"{q(random.choice(INDUSTRIES))},{q(seg)},{q(country)},{q(city)},{emp},{rev},"
                f"{random.randint(1,N)},{q(rts(0,800))},{str(random.random()>0.08).lower()})")
out.append("INSERT INTO accounts (account_name,industry,segment,country,city,employee_count,annual_revenue,owner_rep_id,created_at,is_active) VALUES\n"
           + ",\n".join(rows) + ";")

# 3. contacts
rows = []
for i in range(1, N + 1):
    fn, ln = random.choice(FIRST), random.choice(LAST)
    title, sen = random.choice(TITLES)
    rows.append(f"({random.randint(1,N)},{q(fn)},{q(ln)},{q(f'{fn.lower()}.{ln.lower()}{i}@example.com')},"
                f"{q('+1-555-' + str(random.randint(1000,9999)))},{q(title)},{q(sen)},"
                f"{str(i % 5 == 0).lower()},{q(rts(30,800))})")
out.append("INSERT INTO contacts (account_id,first_name,last_name,email,phone,job_title,seniority,is_primary,created_at) VALUES\n"
           + ",\n".join(rows) + ";")

# 4. campaigns
rows = []
for i in range(1, N + 1):
    s = rdate(0, 800); e = s + dt.timedelta(days=random.randint(14, 120))
    status = "Completed" if e < dt.date(2025, 6, 1) else random.choice(["Active","Planned"])
    rows.append(f"({q(random.choice(['Spring','Summer','Autumn','Winter','Q1','Q2','Q3','Q4'])+' '+random.choice(['Demand Gen','Upsell','Retention','Launch','ABM'])+f' {i}')},"
                f"{q(random.choice(CHANNELS))},{q(s)},{q(e)},{round(random.uniform(5000,180000),2)},"
                f"{q(random.choice(SEGMENTS))},{q(status)})")
out.append("INSERT INTO campaigns (campaign_name,channel,start_date,end_date,budget,target_segment,status) VALUES\n"
           + ",\n".join(rows) + ";")

# 5. leads
rows = []
for i in range(1, N + 1):
    fn, ln = random.choice(FIRST), random.choice(LAST)
    st = random.choice(LEAD_STATUS)
    created = rts(0, 850)
    conv = q(created + dt.timedelta(days=random.randint(3, 90))) if st == "Converted" else "NULL"
    rows.append(f"({q(fn+' '+ln)},{q(f'{fn.lower()}{i}@prospect.example')},"
                f"{q(random.choice(LAST)+' '+random.choice(['Group','Systems','Corp','Labs']))},"
                f"{q(random.choice(LEAD_SOURCES))},{q(st)},{random.randint(1,100)},"
                f"{random.randint(1,N)},{random.randint(1,N)},{q(created)},{conv})")
out.append("INSERT INTO leads (full_name,email,company,source,status,score,campaign_id,owner_rep_id,created_at,converted_at) VALUES\n"
           + ",\n".join(rows) + ";")

# 6. products
rows = []
for i in range(1, N + 1):
    cat = random.choice(CATEGORIES)
    cost = round(random.uniform(40, 4000), 2)
    price = round(cost * random.uniform(1.6, 3.4), 2)
    rows.append(f"({q(f'SKU-{1000+i}')},{q(cat.split()[0]+' '+random.choice(['Core','Pro','Advanced','Team','Enterprise'])+f' {i}')},"
                f"{q(cat)},{price},{cost},{str(random.random()>0.1).lower()})")
out.append("INSERT INTO products (sku,product_name,category,list_price,unit_cost,is_active) VALUES\n"
           + ",\n".join(rows) + ";")

# 7. opportunities
rows = []
for i in range(1, N + 1):
    stage = random.choice(STAGES)
    closed = stage in ("Closed Won", "Closed Lost")
    won = "TRUE" if stage == "Closed Won" else ("FALSE" if stage == "Closed Lost" else "NULL")
    prob = {"Prospecting":10,"Discovery":25,"Proposal":50,"Negotiation":75,"Closed Won":100,"Closed Lost":0}[stage]
    created = rts(0, 800)
    rows.append(f"({random.randint(1,N)},{q(random.choice(['Platform rollout','Analytics expansion','Renewal','Pilot programme','Migration','Upsell'])+f' #{i}')},"
                f"{q(stage)},{round(random.uniform(4000,480000),2)},{prob},{random.randint(1,N)},"
                f"{random.randint(1,N)},{q(created)},{q((created + dt.timedelta(days=random.randint(20,240))).date())},{won},{str(closed).lower()})")
out.append("INSERT INTO opportunities (account_id,opportunity_name,stage,amount,probability,owner_rep_id,campaign_id,created_at,close_date,is_won,is_closed) VALUES\n"
           + ",\n".join(rows) + ";")

# 8. orders
rows = []
for i in range(1, N + 1):
    disc = round(random.choice([0, 0, 0, 5, 7.5, 10, 15]), 2)
    total = round(random.uniform(2000, 320000), 2)
    rows.append(f"({random.randint(1,N)},{random.randint(1,N)},{q(f'ORD-2024-{2000+i}')},"
                f"{q(rdate(120,760))},{q(random.choice(ORDER_STATUS))},'USD',{total},{disc})")
out.append("INSERT INTO orders (account_id,opportunity_id,order_number,order_date,status,currency,total_amount,discount_pct) VALUES\n"
           + ",\n".join(rows) + ";")

# 9. order_items — several per order
rows = []
for oid in range(1, N + 1):
    for _ in range(random.randint(1, 4)):
        qty = random.randint(1, 40)
        price = round(random.uniform(60, 5200), 2)
        rows.append(f"({oid},{random.randint(1,N)},{qty},{price},{round(qty*price,2)})")
out.append("INSERT INTO order_items (order_id,product_id,quantity,unit_price,line_total) VALUES\n"
           + ",\n".join(rows) + ";")
ITEMS = len(rows)

# 10. invoices
rows = []
for i in range(1, N + 1):
    issue = rdate(150, 730); due = issue + dt.timedelta(days=30)
    st = random.choice(INV_STATUS)
    paid = q(issue + dt.timedelta(days=random.randint(5, 55))) if st == "Paid" else "NULL"
    rows.append(f"({i},{q(f'INV-{5000+i}')},{q(issue)},{q(due)},{paid},{round(random.uniform(1500,300000),2)},{q(st)})")
out.append("INSERT INTO invoices (order_id,invoice_number,issue_date,due_date,paid_date,amount,status) VALUES\n"
           + ",\n".join(rows) + ";")

# 11. activities
rows = []
for i in range(1, N + 1):
    rows.append(f"({random.randint(1,N)},{random.randint(1,N)},{random.randint(1,N)},"
                f"{q(random.choice(ACT_TYPES))},{q(random.choice(['Quarterly review','Discovery call','Pricing discussion','Technical demo','Onboarding check-in','Renewal conversation'])+f' {i}')},"
                f"{q(rts(60,800))},{random.choice([15,30,45,60,90])},{q(random.choice(OUTCOMES))})")
out.append("INSERT INTO activities (account_id,contact_id,rep_id,activity_type,subject,activity_date,duration_minutes,outcome) VALUES\n"
           + ",\n".join(rows) + ";")

# 12. support_tickets
rows = []
for i in range(1, N + 1):
    st = random.choice(TICKET_STATUS)
    opened = rts(120, 700)
    resolved = q(opened + dt.timedelta(hours=random.randint(2, 400))) if st in ("Resolved","Closed") else "NULL"
    sat = random.randint(1, 5) if st in ("Resolved","Closed") and random.random() > 0.3 else "NULL"
    rows.append(f"({random.randint(1,N)},{random.randint(1,N)},"
                f"{q(random.choice(['Cannot connect data source','Slow report export','SSO login failure','Incorrect totals','Missing permissions','Scheduled job failed'])+f' #{i}')},"
                f"{q(random.choice(PRIORITIES))},{q(st)},{q(random.choice(TICKET_CATS))},{q(opened)},{resolved},{sat})")
out.append("INSERT INTO support_tickets (account_id,contact_id,subject,priority,status,category,opened_at,resolved_at,satisfaction_score) VALUES\n"
           + ",\n".join(rows) + ";")

open("/var/tmp/crm-data.sql", "w").write("\n\n".join(out) + "\n")
print(f"generated; order_items rows = {ITEMS}")
