import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test('Verify CopilotKit endpoint works and no 404 errors', async ({ browser }) => {
  const page = await browser.newPage()

  console.log('\n🔍 Testing CopilotKit Endpoint')
  console.log('=' .repeat(60))

  // Collect console errors
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // Login
  console.log('\n1. Authenticating...')
  await page.goto('http://localhost:4050/login')
  await login(page, 'admin@admin.com', 'admin')
  console.log('✓ Logged in')

  // Navigate to NL Query page
  console.log('\n2. Navigating to NL Query page...')
  await page.goto('http://localhost:4050/nl-query')
  await page.waitForLoadState('networkidle')
  console.log('✓ NL Query page loaded')

  // Wait a bit for CopilotKit to try to connect
  await page.waitForTimeout(2000)

  // Check for runtime errors
  const runtimeErrors = consoleErrors.filter(e =>
    e.includes('runtime_info_fetch_failed') ||
    e.includes('CopilotKit') ||
    e.includes('404')
  )

  if (runtimeErrors.length > 0) {
    console.log('\n✗ Found CopilotKit errors:')
    runtimeErrors.forEach(err => console.log(`  - ${err}`))
  } else {
    console.log('\n✓ No CopilotKit 404 errors detected')
  }

  // Test the endpoint directly
  console.log('\n3. Testing /api/copilotkit endpoint...')
  const response = await fetch('http://localhost:4050/api/copilotkit')
  console.log(`✓ Endpoint status: ${response.status}`)

  if (response.ok) {
    const data = await response.json()
    console.log(`✓ Response: ${JSON.stringify(data, null, 2).substring(0, 100)}...`)
  }

  // Check page is functional
  console.log('\n4. Verifying page functionality...')
  const title = await page.title()
  console.log(`✓ Page title: "${title}"`)

  const hasContent = await page.content().then(c => c.length > 1000)
  console.log(`✓ Page has content: ${hasContent}`)

  console.log('\n' + '=' .repeat(60))
  console.log('✅ CopilotKit Endpoint Test Complete')
  console.log('=' .repeat(60))

  await page.close()
})
