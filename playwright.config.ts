import { defineConfig, devices } from "@playwright/test";

const port = 3100;

// Runs against the production build (`npm run build` first).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${String(port)}`,
    ...devices["Pixel 7"],
    viewport: { width: 360, height: 780 },
  },
  webServer: {
    command: `npm run start -- -p ${String(port)}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
