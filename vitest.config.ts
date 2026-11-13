import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
    env: {
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "test-password-123",
      ADMIN_SESSION_SECRET: "test-session-secret-1234567890",
      LICENSE_SIGNING_SECRET: "test-license-secret-1234567890",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      CRON_SECRET: "test-cron-secret",
      LICENSE_CACHE_TTL: "0",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
