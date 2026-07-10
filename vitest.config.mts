import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const SHARED_EXCLUDE = ["node_modules", ".next", "dist", "e2e/**"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves `@/*` from tsconfig.json's paths natively.
    tsconfigPaths: true,
  },
  test: {
    // Force a stable timezone so date-formatting assertions don't depend on
    // the developer's locale (e.g. Europe/Kyiv vs UTC).
    env: { TZ: "UTC" },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["**/*.test.{ts,tsx}"],
          exclude: [...SHARED_EXCLUDE, "**/*.integration.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "jsdom",
          include: ["**/*.integration.test.{ts,tsx}"],
          exclude: SHARED_EXCLUDE,
        },
      },
    ],
  },
});
