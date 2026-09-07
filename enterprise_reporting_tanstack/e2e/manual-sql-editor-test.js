// Manual SQL Editor Test Script
// Copy and paste this into your browser's Developer Console (F12) on the SQL Editor page

console.log('=== Manual SQL Editor Test ===');

// 1. Check if Monaco Editor exists
const monacoEditor = document.querySelector('.monaco-editor');
console.log('Monaco Editor found:', !!monacoEditor);

if (monacoEditor) {
  const style = window.getComputedStyle(monacoEditor);
  console.log('Monaco Editor styles:', {
    zIndex: style.zIndex,
    pointerEvents: style.pointerEvents,
    position: style.position,
    display: style.display,
    visibility: style.visibility
  });

  // Check if textarea exists
  const textarea = document.querySelector('.monaco-editor textarea');
  console.log('Monaco textarea found:', !!textarea);

  if (textarea) {
    // Get the complex SQL query
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

    // Focus the textarea
    textarea.focus();
    console.log('Textarea focused');

    // Set the value
    textarea.value = complexQuery;

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);

    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    textarea.dispatchEvent(changeEvent);

    console.log('Complex SQL query inserted into editor');
    console.log('Query length:', complexQuery.length);

    // Verify the value was set
    console.log('Current textarea value length:', textarea.value.length);
  } else {
    console.error('Monaco textarea not found!');
  }

  // Check for any overlays blocking clicks
  const allDivs = Array.from(document.querySelectorAll('div'));
  const highZIndex = allDivs.filter(div => {
    const style = window.getComputedStyle(div);
    const zIndex = parseInt(style.zIndex);
    const rect = div.getBoundingClientRect();
    return !isNaN(zIndex) && zIndex > 30 && rect.width > 0 && rect.height > 0;
  });

  console.log('High z-index divs that might block clicks:', highZIndex.length);
  highZIndex.forEach((div, i) => {
    const style = window.getComputedStyle(div);
    console.log(`  ${i + 1}. z-index: ${style.zIndex}, position: ${style.position}, class: ${div.className}`);
  });
} else {
  console.error('Monaco Editor NOT found! Check if page has loaded properly.');

  // Check what's on the page instead
  const borderDivs = document.querySelectorAll('[class*="border"]');
  console.log('Found divs with "border" class:', borderDivs.length);

  borderDivs.forEach((div, i) => {
    const rect = div.getBoundingClientRect();
    console.log(`Border div ${i + 1}:`, {
      className: div.className,
      visible: rect.width > 0 && rect.height > 0,
      position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    });
  });
}

console.log('\nNext steps:');
console.log('1. If query was inserted, click "Validate" button to check SQL');
console.log('2. If validation passes, click "Run Query" to execute');
console.log('3. Check results panel below');
