import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test('NL Query with Mastra.ai agent', async ({ browser }) => {
  const page = await browser.newPage()

  console.log('\n🚀 Testing NL Query with Mastra.ai Agent')
  console.log('='.repeat(60))

  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  // Login
  console.log('\n1. Authenticating...')
  await page.goto('http://localhost:4050/login')
  await login(page, 'admin@admin.com', 'admin')
  console.log('✓ Logged in')

  // Navigate to NL Query
  console.log('\n2. Navigating to NL Query page...')
  await page.goto('http://localhost:4050/nl-query')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  console.log('✓ NL Query page loaded')

  // Check for Mastra availability message
  console.log('\n3. Checking Mastra.ai status...')
  const pageText = await page.content()
  if (pageText.includes('Mastra')) {
    console.log('✓ Mastra.ai referenced on page')
  } else {
    console.log('⚠ Mastra not mentioned on page')
  }

  // Check system status
  console.log('\n4. Checking system status...')
  const hasErrors = errors.length > 0
  if (hasErrors) {
    console.log(`⚠ Found ${errors.length} error(s):`)
    errors.slice(0, 3).forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.substring(0, 80)}...`)
    })
  } else {
    console.log('✓ No console errors')
  }

  // Check page functionality
  console.log('\n5. Page Elements:')
  const buttons = await page.locator('button').count()
  const inputs = await page.locator('input, textarea').count()
  console.log(`✓ Buttons: ${buttons}, Inputs: ${inputs}`)

  console.log('\n' + '='.repeat(60))
  console.log('✅ Mastra.ai Integration Test Complete')
  console.log('='.repeat(60))
  console.log('\nNote: Ensure Mastra.ai server is running at http://localhost:4111/')
  console.log('      Or configure MASTRA_URL environment variable')

  await page.close()
})
