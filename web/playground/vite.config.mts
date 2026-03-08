import { defineConfig } from "@vben/vite-config";

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        // 忽略翻译文件的变化，避免后端写入时触发前端热更新导致页面刷新
        // 但刷新页面时会加载最新的翻译文件
        watch: {
          ignored: ["**/src/locales/langs/**/*.json"],
        },
        proxy: {
          "/api": {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ""),
            target: "http://localhost:5320",
            ws: true,
          },
        },
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-dom/client', 'react-markdown', 'remark-gfm'],
      },
      resolve: {
        alias: {
          'react': 'react',
          'react-dom': 'react-dom',
        },
      },
    },
  };
});
