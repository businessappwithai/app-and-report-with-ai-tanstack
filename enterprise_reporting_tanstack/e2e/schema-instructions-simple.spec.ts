import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test.describe('Schema Instructions - Simple Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4050/login')
    await login(page, 'admin@admin.com', 'admin')
    await page.goto('http://localhost:4050/admin')
  })

  test('1. Navigate to schema instructions page', async ({ page }) => {
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')
    await expect(page.locator('h1')).toContainText('Schema Instructions Management')
  })

  test('2. Page should load with layout components', async ({ page }) => {
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Check for main sections
    await expect(page.locator('text=Database Schema')).toBeVisible()
    await expect(page.locator('text=Instructions Editor')).toBeVisible()
  })

  test('3. Tabs should be available', async ({ page }) => {
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Check for tabs
    await expect(page.locator('button:has-text("Table Instructions")')).toBeVisible()
    await expect(page.locator('button:has-text("Field Instructions")')).toBeVisible()
  })
})
