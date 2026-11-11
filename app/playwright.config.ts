import { defineConfig, devices } from '@playwright/test'

const MOCK_PORT = 4317
// Default API CORS allows this origin. Bind IPv4 so a mock dev server on localhost:5173 can stay up.
const API_PORT = 5173

const desktop = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1440, height: 900 },
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mock',
      testMatch: /map\.spec\.ts/,
      use: { ...desktop, baseURL: `http://localhost:${MOCK_PORT}` },
    },
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      use: { ...desktop, baseURL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
  webServer: [
    {
      // Empty VITE_MAP_STYLE_URL matches an unset URL: OpenFreeMap Positron, not the schematic map.
      command: `npx vite --port ${MOCK_PORT} --strictPort`,
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
      env: { VITE_DATA_MODE: 'mock', VITE_MAP_STYLE_URL: '' },
    },
    {
      // API-mode UI only. The KingSight API on :8000 is started separately.
      // 127.0.0.1:5173 is in the API's default CORS list.
      command: `npx vite --port ${API_PORT} --host 127.0.0.1 --strictPort`,
      url: `http://127.0.0.1:${API_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_DATA_MODE: 'api',
        VITE_API_BASE_URL: 'http://127.0.0.1:8000',
        VITE_MAP_STYLE_URL: '',
      },
    },
  ],
})
