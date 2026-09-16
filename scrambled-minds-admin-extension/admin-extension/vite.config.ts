import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: resolve(here, "../admin"),
  build: {
    outDir: resolve(here, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(here, "../admin/admin.html"),
      output: { entryFileNames: "[name].js", format: "es" }
    }
  }
});
