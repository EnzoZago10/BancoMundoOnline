import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  webServer: [
    {
      command: "npm run dev:server",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:2567/api/health",
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command: "npm run dev:client",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 30_000
    }
  ]
});
