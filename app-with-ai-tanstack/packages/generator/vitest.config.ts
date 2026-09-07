import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.{test,spec}.{js,ts}"],
    exclude: ["node_modules", "dist", "templates"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.config.*",
        "**/*.d.ts",
        "**/types/**",
        "templates/**",
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@appwithai/core": path.resolve(__dirname, "../core/dist"),
      "@appwithai/core/types": path.resolve(__dirname, "../core/dist/types"),
      "@appwithai/core/utils": path.resolve(__dirname, "../core/dist/utils"),
    },
  },
});
