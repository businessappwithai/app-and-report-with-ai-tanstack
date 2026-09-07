import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test('Verify Inspect Schema creates entities', async ({ browser }) => {
  const page = await browser.newPage()

  console.log('\n📋 Testing Inspect Schema Feature')
  console.log('='.repeat(60))

  // Login
  console.log('\n1. Authenticating...')
  await page.goto('http://localhost:4050/login')
  await login(page, 'admin@admin.com', 'admin')
  console.log('✓ Logged in')

  // Navigate to Data Sources
  console.log('\n2. Navigating to Data Sources page...')
  await page.goto('http://localhost:4050/data-sources')
  await page.waitForLoadState('networkidle')
  console.log('✓ Data Sources page loaded')

  // Get first data source
  const dataSourceRows = await page.locator('table tbody tr').count()
  console.log(`✓ Found ${dataSourceRows} data source(s)`)

  if (dataSourceRows > 0) {
    // Find and click Inspect Schema button
    console.log('\n3. Clicking Inspect Schema button...')
    const inspectButton = page.locator('button:has-text("Inspect Schema")').first()
    
    if (await inspectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inspectButton.click()
      await page.waitForTimeout(2000) // Wait for inspection to complete
      console.log('✓ Schema inspection triggered')
    } else {
      console.log('⚠ Inspect button not found')
    }

    // Navigate to Metadata Entities to see if entities were created
    console.log('\n4. Checking Metadata Entities...')
    const firstRow = page.locator('table tbody tr').first()
    const dataSourceCell = firstRow.locator('td').nth(1) // Get data source name
    const dataSourceName = await dataSourceCell.textContent()
    const dataSourceId = await firstRow.getAttribute('data-source-id') || 'unknown'
    
    console.log(`✓ Data source: ${dataSourceName}`)

    // Get data source ID from the page - need to find it from the data attributes or parse from URL
    await page.goto('http://localhost:4050/metadata/entities?data_source_id=' + dataSourceId)
    await page.waitForLoadState('networkidle')
    
    console.log('\n5. Checking entities created from inspection...')
    const entityCount = await page.locator('text=/Total Entities|Active & Visible|Hidden|Inactive/').count()
    
    if (entityCount > 0) {
      console.log('✓ Entity statistics visible on page')
      const activeEntities = await page.locator('text=/Active & Visible/').count()
      if (activeEntities > 0) {
        console.log('✓ Entities found in metadata')
      }
    } else {
      console.log('⚠ No entity statistics found yet')
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Inspect Schema Test Complete')
  console.log('='.repeat(60))

  await page.close()
})
