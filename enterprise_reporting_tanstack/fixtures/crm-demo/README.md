# CRM demo fixture

A PostgreSQL CRM dataset used to exercise SQL execution, report definitions and chart
definitions end to end. Twelve related entities, **200 records each** (`order_items`
holds 497 child rows), with real referential integrity and internally consistent
values — stage drives probability, `is_won` drives closed state, resolved tickets
carry resolution timestamps.

## Load it

```bash
createdb crm_demo
psql -d crm_demo -f fixtures/crm-demo/schema.sql
python3 fixtures/crm-demo/generate-data.py     # writes /var/tmp/crm-data.sql
psql -d crm_demo -f /var/tmp/crm-data.sql
```

The generator is seeded (`random.seed(42)`), so the dataset is reproducible.

## Connect it

Register it in the application under **Data Sources → New Data Source**, type
**PostgreSQL**. Using the UI rather than a direct insert exercises the encrypted
connection-config path.

## Queries

`saved-queries.json` holds the ten analytical queries used for testing — pipeline by
stage, monthly bookings, revenue by industry, top accounts, a rep leaderboard (CTE),
lead funnel, product margin, support SLA, campaign ROI and invoice aging. Between them
they cover joins, CTEs, `FILTER` aggregates, `DATE_TRUNC`, interval arithmetic,
`HAVING` and `CASE` bucketing.
