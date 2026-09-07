// Better Manual SQL Editor Test Script
// This version will make the SQL visible in Monaco Editor

console.log('=== Manual SQL Editor Test v2 ===');

const complexQuery = `-- Complex query: Analyze film rentals by customer category
WITH customer_rentals AS (
  SELECT
    c.customer_id,
    c.first_name,
    c.last_name,
    COUNT(r.rental_id) as total_rentals,
    SUM(p.amount) as total_spent
  FROM customer c
  LEFT JOIN rental r ON c.customer_id = r.customer_id
  LEFT JOIN payment p ON r.rental_id = p.rental_id
  GROUP BY c.customer_id, c.first_name, c.last_name
),
spending_categories AS (
  SELECT
    customer_id,
    first_name,
    last_name,
    total_rentals,
    total_spent,
    CASE
      WHEN total_spent > 200 THEN 'High Value'
      WHEN total_spent > 100 THEN 'Medium Value'
      ELSE 'Low Value'
    END as customer_category
  FROM customer_rentals
)
SELECT
  customer_category,
  COUNT(*) as customer_count,
  AVG(total_rentals) as avg_rentals,
  AVG(total_spent) as avg_spent,
  MAX(total_spent) as max_spent,
  MIN(total_spent) as min_spent
FROM spending_categories
GROUP BY customer_category
ORDER BY avg_spent DESC;`;

// Method 1: Try to use Monaco's internal API
const monacoContainer = document.querySelector('.monaco-editor');
if (monacoContainer) {
  // Monaco Editor stores its instance in a specific location
  const monacoInstance = (monacoContainer as any).__monaco_editor__;
  console.log('Monaco instance found:', !!monacoInstance);

  if (monacoInstance) {
    // Use Monaco's API to set value
    monacoInstance.setValue(complexQuery);
    console.log('✓ SQL set via Monaco API');
    console.log('Query should now be visible in the editor!');
  } else {
    // Method 2: Use clipboard API to paste
    console.log('Monaco instance not found, trying clipboard method...');

    // Copy to clipboard
    navigator.clipboard.writeText(complexQuery).then(() => {
      console.log('✓ SQL copied to clipboard');
      console.log('Now do this:');
      console.log('1. Click inside the SQL Editor');
      console.log('2. Press Ctrl+A (or Cmd+A on Mac) to select all');
      console.log('3. Press Ctrl+V (or Cmd+V on Mac) to paste');
      console.log('4. Click "Validate" button');
      console.log('5. Click "Run Query" button');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      console.log('\nManual steps:');
      console.log('1. Copy the SQL query from the complexQuery variable');
      console.log('2. Click inside the SQL Editor');
      console.log('3. Paste the query');
      console.log('4. Click "Validate" button');
      console.log('5. Click "Run Query" button');
    });
  }
} else {
  console.error('✗ Monaco Editor not found!');
}

// Also log the query for manual copying
console.log('\n=== SQL Query (for manual copying) ===');
console.log(complexQuery);
console.log('\n=== End of Query ===\n');
