import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test('Debug NL Query page', async ({ browser }) => {
  const page = await browser.newPage()

  console.log('\n🐛 Debugging NL Query Page')
  console.log('='.repeat(60))

  const errors: string[] = []
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`)
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  // Login
  await page.goto('http://localhost:4050/login')
  await login(page, 'admin@admin.com', 'admin')

  // Navigate to NL Query
  console.log('\nNavigating to NL Query...')
  await page.goto('http://localhost:4050/nl-query')
  await page.waitForLoadState('networkidle')
  
  // Get page content
  const pageContent = await page.content()
  
  // Look for specific elements
  console.log('\nPage Element Analysis:')
  console.log('- Select elements:', await page.locator('select').count())
  console.log('- Combobox elements:', await page.locator('[role="combobox"]').count())
  console.log('- Input/textarea elements:', await page.locator('input, textarea').count())
  console.log('- Button elements:', await page.locator('button').count())
  console.log('- Error/alert elements:', await page.locator('[class*="error"], [class*="alert"]').count())

  // Get error messages if any
  const errorMessages = await page.locator('[class*="error"]').allTextContents()
  if (errorMessages.length > 0) {
    console.log('\nError Messages Found:')
    errorMessages.forEach(msg => console.log(`  - ${msg.substring(0, 100)}`))
  }

  // Check console errors
  console.log(`\nConsole Errors Captured: ${errors.length}`)
  errors.slice(0, 5).forEach(err => {
    console.log(`  - ${err.substring(0, 150)}`)
  })

  // Wait a bit for everything to load
  await page.waitForTimeout(2000)

  // Take screenshot for manual inspection
  await page.screenshot({ path: 'nl-query-debug.png' })
  console.log('\n✓ Screenshot saved: nl-query-debug.png')

  console.log('\n' + '='.repeat(60))
  await page.close()
})
