-- ============================================================================
-- SAKILA DATABASE - PROFESSIONAL BUSINESS ANALYTICS QUERIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVENUE ANALYTICS
-- ----------------------------------------------------------------------------

-- Query 1: Monthly Revenue Trend
SELECT
  strftime('%Y-%m', rental_date) as month,
  ROUND(SUM(p.amount), 2) as total_revenue,
  COUNT(DISTINCT r.rental_id) as rental_count,
  COUNT(DISTINCT p.customer_id) as unique_customers,
  ROUND(AVG(p.amount), 2) as avg_payment_amount
FROM rental r
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY strftime('%Y-%m', rental_date)
ORDER BY month DESC;

-- Query 2: Revenue by Store
SELECT
  s.store_id,
  s.manager_staff_id,
  ROUND(SUM(p.amount), 2) as total_revenue,
  COUNT(DISTINCT r.rental_id) as rental_count,
  COUNT(DISTINCT p.customer_id) as unique_customers,
  ROUND(AVG(p.amount), 2) as avg_payment_amount
FROM store s
JOIN staff st ON s.manager_staff_id = st.staff_id
JOIN rental r ON st.staff_id = r.staff_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY s.store_id, s.manager_staff_id
ORDER BY total_revenue DESC;

-- Query 3: Revenue by Film Category
SELECT
  c.name as category,
  ROUND(SUM(p.amount), 2) as total_revenue,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(AVG(p.amount), 2) as avg_revenue_per_rental
FROM category c
JOIN film_category fc ON c.category_id = fc.category_id
JOIN film f ON fc.film_id = f.film_id
JOIN inventory i ON f.film_id = i.film_id
JOIN rental r ON i.inventory_id = r.inventory_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY c.category_id, c.name
ORDER BY total_revenue DESC;

-- Query 4: Top 10 Performing Films by Revenue
SELECT
  f.title,
  f.rental_rate,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(SUM(p.amount), 2) as total_revenue,
  ROUND(SUM(p.amount) / COUNT(DISTINCT r.rental_id), 2) as avg_revenue_per_rental,
  c.name as category
FROM film f
JOIN film_category fc ON f.film_id = fc.film_id
JOIN category c ON fc.category_id = c.category_id
JOIN inventory i ON f.film_id = i.film_id
JOIN rental r ON i.inventory_id = r.inventory_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY f.film_id, f.title, f.rental_rate, c.name
ORDER BY total_revenue DESC
LIMIT 10;

-- Query 5: Daily Revenue Trend (Last 30 Days)
SELECT
  DATE(r.rental_date) as rental_date,
  ROUND(SUM(p.amount), 2) as daily_revenue,
  COUNT(DISTINCT r.rental_id) as daily_rentals,
  COUNT(DISTINCT p.customer_id) as daily_customers
FROM rental r
JOIN payment p ON r.rental_id = p.rental_id
WHERE r.rental_date >= DATE('now', '-30 days')
GROUP BY DATE(r.rental_date)
ORDER BY rental_date DESC;

-- ----------------------------------------------------------------------------
-- 2. CUSTOMER ANALYTICS
-- ----------------------------------------------------------------------------

-- Query 6: Top Customers by Spending
SELECT
  c.customer_id,
  c.first_name || ' ' || c.last_name as customer_name,
  c.email,
  ROUND(SUM(p.amount), 2) as total_spent,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(SUM(p.amount) / COUNT(DISTINCT r.rental_id), 2) as avg_spent_per_rental,
  MIN(r.rental_date) as first_rental,
  MAX(r.rental_date) as last_rental
FROM customer c
JOIN rental r ON c.customer_id = r.customer_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
ORDER BY total_spent DESC
LIMIT 20;

-- Query 7: Customer Rental Frequency Distribution
SELECT
  rental_count,
  COUNT(*) as customer_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM customer), 2) as percentage
FROM (
  SELECT
    customer_id,
    COUNT(rental_id) as rental_count
  FROM rental
  GROUP BY customer_id
) rental_counts
GROUP BY rental_count
ORDER BY rental_count DESC;

-- Query 8: New Customer Acquisition
SELECT
  strftime('%Y-%m', c.create_date) as month,
  COUNT(*) as new_customers,
  COUNT(DISTINCT c.store_id) as stores_with_new_customers
FROM customer c
GROUP BY strftime('%Y-%m', c.create_date)
ORDER BY month DESC;

-- Query 9: Customer Retention Rate
WITH customer_periods AS (
  SELECT
    customer_id,
    MIN(DATE(rental_date)) as first_rental,
    MAX(DATE(rental_date)) as last_rental,
    COUNT(DISTINCT strftime('%Y-%m', rental_date)) as active_months
  FROM rental
  GROUP BY customer_id
)
SELECT
  CASE
    WHEN active_months >= 12 THEN '12+ months'
    WHEN active_months >= 6 THEN '6-11 months'
    WHEN active_months >= 3 THEN '3-5 months'
    ELSE '1-2 months'
  END as retention_category,
  COUNT(*) as customer_count
FROM customer_periods
GROUP BY retention_category
ORDER BY
  CASE
    WHEN active_months >= 12 THEN 1
    WHEN active_months >= 6 THEN 2
    WHEN active_months >= 3 THEN 3
    ELSE 4
  END;

-- ----------------------------------------------------------------------------
-- 3. INVENTORY & FILM ANALYTICS
-- ----------------------------------------------------------------------------

-- Query 10: Film Category Distribution
SELECT
  c.name as category,
  COUNT(DISTINCT f.film_id) as film_count,
  ROUND(COUNT(DISTINCT f.film_id) * 100.0 / (SELECT COUNT(*) FROM film), 2) as percentage
FROM category c
JOIN film_category fc ON c.category_id = fc.category_id
JOIN film f ON fc.film_id = f.film_id
GROUP BY c.category_id, c.name
ORDER BY film_count DESC;

-- Query 11: Most Rented Films
SELECT
  f.title,
  f.rental_rate,
  f.replacement_cost,
  COUNT(DISTINCT r.rental_id) as rental_count,
  COUNT(DISTINCT i.inventory_id) as inventory_count,
  c.name as category,
  f.rating
FROM film f
JOIN film_category fc ON f.film_id = fc.film_id
JOIN category c ON fc.category_id = c.category_id
JOIN inventory i ON f.film_id = i.film_id
LEFT JOIN rental r ON i.inventory_id = r.inventory_id
GROUP BY f.film_id, f.title, f.rental_rate, f.replacement_cost, c.name, f.rating
ORDER BY rental_count DESC
LIMIT 20;

-- Query 12: Inventory Availability by Category
SELECT
  c.name as category,
  COUNT(DISTINCT i.inventory_id) as total_inventory,
  COUNT(DISTINCT CASE WHEN r.rental_id IS NOT NULL THEN i.inventory_id END) as ever_rented,
  COUNT(DISTINCT CASE WHEN r.rental_id IS NULL THEN i.inventory_id END) as never_rented,
  ROUND(COUNT(DISTINCT CASE WHEN r.rental_id IS NOT NULL THEN i.inventory_id END) * 100.0 / COUNT(DISTINCT i.inventory_id), 2) as utilization_rate
FROM category c
JOIN film_category fc ON c.category_id = fc.category_id
JOIN film f ON fc.film_id = f.film_id
JOIN inventory i ON f.film_id = i.film_id
LEFT JOIN rental r ON i.inventory_id = r.inventory_id
GROUP BY c.category_id, c.name
ORDER BY utilization_rate DESC;

-- Query 13: Films by Rating
SELECT
  rating,
  COUNT(*) as film_count,
  ROUND(rental_rate, 2) as avg_rental_rate,
  ROUND(replacement_cost, 2) as avg_replacement_cost
FROM film
GROUP BY rating
ORDER BY film_count DESC;

-- ----------------------------------------------------------------------------
-- 4. RENTAL ANALYTICS
-- ----------------------------------------------------------------------------

-- Query 14: Rental Duration Statistics
SELECT
  ROUND(JULIANDATE(return_date) - JULIANDATE(rental_date), 1) as rental_days,
  COUNT(*) as rental_count
FROM rental
WHERE return_date IS NOT NULL
GROUP BY ROUND(JULIANDATE(return_date) - JULIANDATE(rental_date), 1)
ORDER BY rental_days;

-- Query 15: Late Rentals Analysis
SELECT
  ROUND(JULIANDATE(return_date) - JULIANDATE(DATE(rental_date, '+' || f.rental_duration || ' days')), 1) as days_late,
  COUNT(*) as rental_count
FROM rental r
JOIN inventory i ON r.inventory_id = i.inventory_id
JOIN film f ON i.film_id = f.film_id
WHERE return_date > DATE(rental_date, '+' || f.rental_duration || ' days')
GROUP BY ROUND(JULIANDATE(return_date) - JULIANDATE(DATE(rental_date, '+' || f.rental_duration || ' days')), 1)
ORDER BY days_late;

-- Query 16: Rental Returns by Day of Week
SELECT
  strftime('%w', return_date) as day_of_week,
  CASE strftime('%w', return_date)
    WHEN '0' THEN 'Sunday'
    WHEN '1' THEN 'Monday'
    WHEN '2' THEN 'Tuesday'
    WHEN '3' THEN 'Wednesday'
    WHEN '4' THEN 'Thursday'
    WHEN '5' THEN 'Friday'
    WHEN '6' THEN 'Saturday'
  END as day_name,
  COUNT(*) as return_count
FROM rental
WHERE return_date IS NOT NULL
GROUP BY strftime('%w', return_date)
ORDER BY day_of_week;

-- ----------------------------------------------------------------------------
-- 5. PAYMENT ANALYTICS
-- ----------------------------------------------------------------------------

-- Query 17: Payment Method Distribution
SELECT
  'All Payments' as payment_method,
  COUNT(*) as payment_count,
  ROUND(SUM(amount), 2) as total_amount,
  ROUND(AVG(amount), 2) as avg_amount
FROM payment
UNION ALL
SELECT
  'Payments Under $5',
  COUNT(*),
  ROUND(SUM(amount), 2),
  ROUND(AVG(amount), 2)
FROM payment
WHERE amount < 5
UNION ALL
SELECT
  'Payments $5-$10',
  COUNT(*),
  ROUND(SUM(amount), 2),
  ROUND(AVG(amount), 2)
FROM payment
WHERE amount >= 5 AND amount < 10
UNION ALL
SELECT
  'Payments $10+',
  COUNT(*),
  ROUND(SUM(amount), 2),
  ROUND(AVG(amount), 2)
FROM payment
WHERE amount >= 10;

-- Query 18: Payment Trends by Month
SELECT
  strftime('%Y-%m', payment_date) as month,
  COUNT(*) as payment_count,
  ROUND(SUM(amount), 2) as total_amount,
  ROUND(AVG(amount), 2) as avg_amount,
  MIN(amount) as min_payment,
  MAX(amount) as max_payment
FROM payment
GROUP BY strftime('%Y-%m', payment_date)
ORDER BY month DESC;

-- ----------------------------------------------------------------------------
-- 6. STAFF PERFORMANCE
-- ----------------------------------------------------------------------------

-- Query 19: Staff Performance Metrics
SELECT
  s.staff_id,
  s.first_name || ' ' || s.last_name as staff_name,
  s.email,
  COUNT(DISTINCT r.rental_id) as rentals_processed,
  ROUND(SUM(p.amount), 2) as total_revenue,
  ROUND(AVG(p.amount), 2) as avg_transaction,
  COUNT(DISTINCT p.customer_id) as unique_customers_served,
  MIN(r.rental_date) as first_rental,
  MAX(r.rental_date) as last_rental
FROM staff s
LEFT JOIN rental r ON s.staff_id = r.staff_id
LEFT JOIN payment p ON r.rental_id = p.rental_id
GROUP BY s.staff_id, s.first_name, s.last_name, s.email
ORDER BY total_revenue DESC;

-- ----------------------------------------------------------------------------
-- 7. COMPARATIVE ANALYSIS
-- ----------------------------------------------------------------------------

-- Query 20: Store Comparison
SELECT
  'Store ' || s.store_id as store_name,
  (SELECT COUNT(*) FROM customer WHERE store_id = s.store_id) as customer_count,
  (SELECT COUNT(*) FROM inventory i JOIN store st ON i.store_id = st.store_id WHERE st.store_id = s.store_id) as inventory_count,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(SUM(p.amount), 2) as total_revenue,
  ROUND(AVG(p.amount), 2) as avg_transaction
FROM store s
LEFT JOIN staff st ON s.manager_staff_id = st.staff_id
LEFT JOIN rental r ON st.staff_id = r.staff_id
LEFT JOIN payment p ON r.rental_id = p.rental_id
GROUP BY s.store_id
ORDER BY total_revenue DESC;
