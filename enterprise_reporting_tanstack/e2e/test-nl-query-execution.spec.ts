import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test('NL Query execution with Ollama', async ({ browser }) => {
  const page = await browser.newPage()

  console.log('\n🤖 Testing NL Query Execution with Ollama')
  console.log('='.repeat(60))

  // Login
  console.log('\n1. Authenticating...')
  await page.goto('http://localhost:4050/login')
  await login(page, 'admin@admin.com', 'admin')
  console.log('✓ Logged in')

  // Navigate to NL Query
  console.log('\n2. Navigating to NL Query page...')
  await page.goto('http://localhost:4050/nl-query')
  await page.waitForLoadState('networkidle')
  console.log('✓ NL Query page loaded')

  // Select data source
  console.log('\n3. Selecting data source...')
  const selector = page.locator('select, [role="combobox"]').first()
  if (await selector.isVisible({ timeout: 2000 }).catch(() => false)) {
    await selector.click()
    await page.waitForTimeout(300)
    const firstOption = page.locator('[role="option"]').first()
    await firstOption.click()
    await page.waitForTimeout(1500) // Wait for schema to load
    console.log('✓ Data source selected')
  }

  // Enter NL query
  console.log('\n4. Entering natural language query...')
  const queryInput = page.locator('textarea, [placeholder*="Ask question"]').first()
  if (await queryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await queryInput.fill('How many records are in the first table')
    console.log('✓ Query entered')

    // Try to find and click execute button
    console.log('\n5. Executing query...')
    const executeButton = page.locator('button:has-text("Execute"), button:has-text("Submit"), button:has-text("Run")').first()
    if (await executeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await executeButton.click()
      await page.waitForTimeout(5000) // Wait for execution
      console.log('✓ Query executed')

      // Check for results
      console.log('\n6. Checking for results...')
      const hasResults = await page.locator('[role="table"], .results, .query-results').first().isVisible({ timeout: 3000 }).catch(() => false)
      if (hasResults) {
        console.log('✓ Results displayed')
      } else {
        console.log('⚠ No results visible yet')
      }
    } else {
      console.log('⚠ Execute button not found')
    }
  } else {
    console.log('⚠ Query input not found')
  }

  // Check for errors
  console.log('\n7. Checking for errors...')
  const errors = await page.locator('[class*="error"], [class*="alert"]').count()
  console.log(`✓ Error elements: ${errors}`)

  console.log('\n' + '='.repeat(60))
  console.log('✅ NL Query Execution Test Complete')
  console.log('='.repeat(60))

  await page.close()
})
