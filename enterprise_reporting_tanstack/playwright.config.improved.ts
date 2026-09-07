import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * IMPROVED Playwright Configuration
 * Optimized for:
 * - Better performance (faster test execution)
 * - Higher reliability (fewer flaky tests)
 * - Better debugging (more detailed failure information)
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI for flaky tests */
  retries: process.env.CI ? 2 : 1,

  /* Optimize worker count based on environment */
  workers: process.env.CI ? 2 : 7,

  /* Reporter to use - multiple reporters for better feedback */
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list', { printSteps: true }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4050',

    /* Collect trace on failure for debugging */
    trace: 'retain-on-failure',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording for failures */
    video: 'retain-on-failure',

    /* Reduce default timeouts for faster failure detection */
    actionTimeout: 10000, // 10s for actions (click, fill, etc.)
    navigationTimeout: 30000, // 30s for navigation

    /* Capture console logs */
    ignoreHTTPSErrors: true,

    /* Wait for network idle after actions */
    launchOptions: {
      args: [
        '--disable-web-security', // Only for local testing
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    },
  },

  /* Test timeout - give tests enough time but fail fast on hangs */
  timeout: 60 * 1000, // 60 seconds per test

  /* Expect timeout - how long to wait for assertions */
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome-specific settings
        viewport: { width: 1280, height: 720 },
        contextOptions: {
          // Reduce resource usage for faster tests
          permissions: [],
        },
      },
    },

    // Uncomment to test in other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile viewport tests
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4050',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
  },

  /* Global setup runs once before all tests */
  // globalSetup: path.join(__dirname, 'e2e/global-setup.ts'),

  /* Global teardown runs once after all tests */
  // globalTeardown: path.join(__dirname, 'e2e/global-teardown.ts'),
});
