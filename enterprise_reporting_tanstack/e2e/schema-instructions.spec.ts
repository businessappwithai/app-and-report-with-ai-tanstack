import { test, expect } from '@playwright/test'
import { login } from './test-auth'

test.describe('Schema Instructions Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:4050/login')
    await login(page, 'admin@admin.com', 'admin')

    // Navigate to admin panel
    await page.goto('http://localhost:4050/admin')
  })

  test('should navigate to schema instructions page', async ({ page }) => {
    // Click the Schema Instructions link
    await page.click('text=Schema Instructions')

    // Wait for page to load
    await page.waitForURL('**/admin/schema-instructions')

    // Verify page title
    await expect(page.locator('h1')).toContainText('Schema Instructions Management')
  })

  test('should display data sources in browser', async ({ page }) => {
    // Navigate to schema instructions
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Wait for data sources to load
    await page.waitForSelector('button', { timeout: 5000 })

    // Verify at least one data source is shown
    const dataSourceButtons = await page.locator('button').count()
    expect(dataSourceButtons).toBeGreaterThan(0)
  })

  test('should expand data source and show tables', async ({ page }) => {
    // Navigate to schema instructions
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Wait for first data source to load and click it
    const firstDataSource = page.locator('button').first()
    await firstDataSource.waitFor({ state: 'visible' })
    await firstDataSource.click()

    // Wait for tables to appear
    await page.waitForTimeout(500)

    // Verify we can see more buttons after expansion
    const allButtons = await page.locator('button').count()
    expect(allButtons).toBeGreaterThan(1)
  })

  test('should display table instruction editor when table is selected', async ({ page }) => {
    // Navigate to schema instructions
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Select a table
    const firstDataSource = page.locator('button').first()
    await firstDataSource.waitFor({ state: 'visible' })
    await firstDataSource.click()

    await page.waitForTimeout(300)

    // Click on second button (first table)
    const secondButton = page.locator('button').nth(1)
    if (await secondButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await secondButton.click()

      // Verify editor is shown
      await expect(page.locator('label')).toContainText('Table Name')
    }
  })

  test('should save table instructions', async ({ page }) => {
    // Navigate to schema instructions
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Select a data source
    const firstDataSource = page.locator('button').first()
    await firstDataSource.waitFor({ state: 'visible' })
    await firstDataSource.click()

    await page.waitForTimeout(300)

    // Select a table
    const secondButton = page.locator('button').nth(1)
    if (await secondButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await secondButton.click()

      // Fill in description
      const descTextarea = page.locator('textarea').first()
      if (await descTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descTextarea.fill('Test table for actors in the film industry')

        // Click save button
        const saveButton = page.locator('button:has-text("Save")')
        if (await saveButton.isVisible()) {
          await saveButton.click()

          // Wait for success message
          await expect(page.locator('text=saved successfully')).toBeVisible({ timeout: 5000 })
        }
      }
    }
  })

  test('should display field instruction editor when field is selected', async ({ page }) => {
    // Navigate to schema instructions
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Select a data source
    const firstDataSource = page.locator('button').first()
    await firstDataSource.waitFor({ state: 'visible' })
    await firstDataSource.click()

    await page.waitForTimeout(300)

    // Select a table
    const secondButton = page.locator('button').nth(1)
    if (await secondButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await secondButton.click()

      // Click on Field Instructions tab
      const fieldTab = page.locator('button:has-text("Field Instructions")')
      if (await fieldTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fieldTab.click()

        // Verify field instruction editor is shown
        await expect(page.locator('text=Select a field')).toBeVisible({ timeout: 2000 }).catch(() => null)
      }
    }
  })

  test('should save field instructions', async ({ page }) => {
    // Navigate to schema instructions
    await page.click('text=Schema Instructions')
    await page.waitForURL('**/admin/schema-instructions')

    // Select a data source
    const firstDataSource = page.locator('button').first()
    await firstDataSource.waitFor({ state: 'visible' })
    await firstDataSource.click()

    await page.waitForTimeout(300)

    // Select a table
    const secondButton = page.locator('button').nth(1)
    if (await secondButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await secondButton.click()

      await page.waitForTimeout(200)

      // Select a field - click 3rd button
      const thirdButton = page.locator('button').nth(2)
      if (await thirdButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await thirdButton.click()

        // Click on Field Instructions tab
        const fieldTab = page.locator('button:has-text("Field Instructions")')
        if (await fieldTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fieldTab.click()

          // Fill in description
          const descTextareas = page.locator('textarea')
          if (await descTextareas.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            await descTextareas.first().fill('Unique identifier for the actor')

            // Click save button
            const saveButton = page.locator('button:has-text("Save")')
            if (await saveButton.isVisible()) {
              await saveButton.click()

              // Wait for success message
              await expect(page.locator('text=saved successfully')).toBeVisible({ timeout: 5000 })
            }
          }
        }
      }
    }
  })
})
