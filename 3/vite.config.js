import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "/Three-JS-study/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
