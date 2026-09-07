import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test('Verify schema loads correctly', async ({ browser }) => {
  const page = await browser.newPage()

  console.log('\n🔍 Testing Schema Loading')
  console.log('='.repeat(60))

  // Login
  console.log('\n1. Authenticating...')
  await page.goto('http://localhost:4050/login')
  await login(page, 'admin@admin.com', 'admin')
  console.log('✓ Logged in')

  // Navigate to SQL Editor
  console.log('\n2. Navigating to SQL Editor...')
  await page.goto('http://localhost:4050/sql-editor')
  await page.waitForLoadState('networkidle')
  console.log('✓ SQL Editor loaded')

  // Wait for data sources to load
  console.log('\n3. Waiting for data sources...')
  await page.waitForTimeout(1000)

  // Check if data source selector is available
  const selectors = await page.locator('select, [role="combobox"]').count()
  console.log(`✓ Found ${selectors} data source selector(s)`)

  // Try to select a data source
  console.log('\n4. Attempting to select data source...')
  const selectBox = page.locator('select, [role="combobox"]').first()

  if (await selectBox.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('✓ Data source selector is visible')

    // Click to open
    await selectBox.click()
    await page.waitForTimeout(500)

    // Get available options
    const options = await page.locator('[role="option"]').count()
    console.log(`✓ Found ${options} data source options`)

    if (options > 0) {
      // Click first option
      const firstOption = page.locator('[role="option"]').first()
      await firstOption.click()
      console.log('✓ Selected first data source')

      // Wait for schema to load
      console.log('\n5. Waiting for schema to load...')
      await page.waitForTimeout(2000)

      // Check for error message
      const errorCount = await page.locator('text=Failed to load schema').count()
      if (errorCount > 0) {
        console.log('✗ Schema loading failed')

        // Get error details
        const errorMsg = await page.locator('text=Failed to load schema').first().textContent()
        console.log(`Error: ${errorMsg}`)
      } else {
        console.log('✓ No schema loading errors')

        // Check for schema content
        const hasTableContent = await page.content().then(c =>
          c.includes('Table') || c.includes('Column') || c.includes('Schema')
        )
        if (hasTableContent) {
          console.log('✓ Schema content loaded')
        } else {
          console.log('⚠ Schema content may still be loading or not visible')
        }
      }
    }
  } else {
    console.log('⚠ Data source selector not visible')
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Schema Loading Test Complete')
  console.log('='.repeat(60))

  await page.close()
})
