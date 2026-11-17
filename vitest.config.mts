import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve "@/…" imports the way tsconfig.json (and Next.js) do.
  resolve: { tsconfigPaths: true },
  test: {
    // Worktrees under .claude/ would otherwise double every suite.
    exclude: ["**/node_modules/**", ".claude/**"],
  },
});
