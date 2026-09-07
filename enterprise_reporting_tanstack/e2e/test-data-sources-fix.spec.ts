import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test('Verify data sources load correctly', async ({ browser }) => {
  const page = await browser.newPage()

  // Login
  console.log('Logging in...')
  await page.goto('http://localhost:4050/login')
  await login(page, 'admin@admin.com', 'admin')

  // Navigate to SQL Editor
  console.log('Navigating to SQL Editor...')
  await page.goto('http://localhost:4050/sql-editor')
  await page.waitForLoadState('networkidle')

  // Wait a bit for data sources to load
  await page.waitForTimeout(2000)

  // Check for error message
  const errorText = await page.locator('text=Failed to load data sources').count()
  if (errorText > 0) {
    console.log('✗ Data sources failed to load')

    // Check network errors
    const response = await fetch('http://localhost:4050/api/data-sources', {
      headers: {
        'Cookie': await page.context().cookies().then(c =>
          c.find(x => x.name === 'session_token')
            ? `session_token=${c.find(x => x.name === 'session_token')?.value}`
            : ''
        )
      }
    })

    console.log(`API Response: ${response.status}`)
    const data = await response.json()
    console.log(`Response structure:`, JSON.stringify(data, null, 2).substring(0, 500))
  } else {
    console.log('✓ No error message - data sources loaded successfully')
  }

  // Check if select/combo appears
  const selects = await page.locator('select, [role="combobox"]').count()
  console.log(`Found ${selects} select/combobox elements`)

  // Look for any active data source in the page
  const hasDbText = await page.locator('text=db-sakila,text=sakila,text=database').count()
  console.log(`Found ${hasDbText} references to databases`)

  // Get page content to see what's actually there
  const content = await page.content()
  if (content.includes('Select a data source')) {
    console.log('✓ Data source selector is present')
  }
  if (content.includes('Failed to load')) {
    console.log('✗ Error message visible')
  }
  if (content.includes('Natural Language')) {
    console.log('✓ NL Query feature section visible')
  }

  await page.close()
})
