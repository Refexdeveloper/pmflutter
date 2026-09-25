import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import AutoImport from "unplugin-auto-import/vite";
// import { readdyJsxRuntimeProxyPlugin } from "./vite.jsx-runtime-proxy";

const base = process.env.BASE_PATH || "/";
const isPreview = process.env.IS_PREVIEW ? true : false;
const manifestCategory = process.env.KF_MANIFEST_CATEGORY || "Component";
const zipBuild = process.env.ZIP_BUILD === "1";
//const proxyPlugins = isPreview ? [readdyJsxRuntimeProxyPlugin()] : [];
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const kfOrigin =
    env.VITE_KF_API_ORIGIN ||
    env.VITE_KF_BASE_URL ||
    env.VITE_KF_LIVE_API_ORIGIN ||
    "https://refexgroup.kissflow.com";
  const kfLiveOrigin =
    env.VITE_KF_LIVE_API_ORIGIN || "https://refexgroup.kissflow.com";

  return {
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview),
    __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ""),
    __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ""),
    __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ""),
  },
  plugins: [
    // ...proxyPlugins,
    {
      name: "pm-dev-get-to-live",
      configureServer(server) {
        const liveOrigin = String(kfLiveOrigin || "https://refexgroup.kissflow.com").replace(/\/$/, "");
        const liveAccount = env.VITE_KF_LIVE_ACCOUNT_ID || "AcCMptlq60zH";
        const liveKeyId = env.VITE_KF_LIVE_ACCESS_KEY_ID || "";
        const liveSecret = env.VITE_KF_LIVE_ACCESS_KEY_SECRET || "";
        const prefixes = ["/process/", "/process-report/", "/case/", "/case-report/", "/user/"];

        server.middlewares.use(async (req, res, next) => {
          const method = String(req.method || "GET").toUpperCase();
          const rawUrl = String(req.url || "");
          const pathOnly = rawUrl.split("?")[0];
          if (method !== "GET" && method !== "HEAD") return next();
          if (pathOnly.startsWith("/kf-live") || pathOnly.startsWith("/kf-dev") || pathOnly.startsWith("/__pm-last-webhook")) return next();
          if (pathOnly.includes("/pm_external_report_A00") || pathOnly.includes("/pm_subtask_A00")) return next();
          if (!prefixes.some((prefix) => pathOnly.startsWith(prefix))) return next();
          if (!liveKeyId || !liveSecret) return next();

          try {
            const incoming = new URL(rawUrl, "http://localhost");
            incoming.pathname = incoming.pathname.replaceAll("AcCMptp3yqcn", liveAccount);
            const target = `${liveOrigin}${incoming.pathname}${incoming.search}`;
            const upstream = await fetch(target, {
              method,
              headers: {
                Accept: "application/json",
                "X-Access-Key-Id": liveKeyId,
                "X-Access-Key-Secret": liveSecret,
              },
            });
            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
            res.end(body);
          } catch (error) {
            console.warn("pm-dev-get-to-live failed:", error?.message || error);
            next();
          }
        });
      },
    },
    {
      name: "pm-last-webhook-dump",
      configureServer(server) {
        const outFile = resolve(__dirname, "scripts/playwright-output/last-create-webhook.json");
        server.middlewares.use("/__pm-last-webhook", (req, res, next) => {
          if (req.method === "GET") {
            try {
              res.setHeader("Content-Type", "application/json");
              res.end(readFileSync(outFile, "utf8"));
            } catch {
              res.statusCode = 404;
              res.end("{}");
            }
            return;
          }
          if (req.method !== "POST") {
            next();
            return;
          }
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => {
            try {
              mkdirSync(resolve(__dirname, "scripts/playwright-output"), { recursive: true });
              writeFileSync(outFile, Buffer.concat(chunks).toString("utf8") || "{}");
            } catch {
              /* ignore */
            }
            res.statusCode = 204;
            res.end();
          });
        });
      },
    },
    react(),
    AutoImport({
      imports: [
        {
          react: [
            ["default", "React"],
            "useState",
            "useEffect",
            "useContext",
            "useReducer",
            "useCallback",
            "useMemo",
            "useRef",
            "useImperativeHandle",
            "useLayoutEffect",
            "useDebugValue",
            "useDeferredValue",
            "useId",
            "useInsertionEffect",
            "useSyncExternalStore",
            "useTransition",
            "startTransition",
            "lazy",
            "memo",
            "forwardRef",
            "createContext",
            "createElement",
            "cloneElement",
            "isValidElement",
          ],
        },
        {
          "react-router-dom": [
            "useNavigate",
            "useLocation",
            "useParams",
            "useSearchParams",
            "Link",
            "NavLink",
            "Navigate",
            "Outlet",
          ],
        },
        // React i18n
        {
          "react-i18next": ["useTranslation", "Trans"],
        },
      ],
      dts: true,
    }),
    {
      name: "emit-manifest-vite-plugin",
      writeBundle() {
        const manifestContent = {
          Category: manifestCategory,
          Framework: "React",
        };
        const outputPath = resolve(__dirname, "dist/manifest.json");
        writeFileSync(outputPath, JSON.stringify(manifestContent, null, 2));
      },
    },
  ],
  base: "",
  build: {
    sourcemap: zipBuild ? false : true,
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@eam": resolve(__dirname, "./src/eam"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/case": { target: kfOrigin, changeOrigin: true, secure: true },
      "/case-report": { target: kfOrigin, changeOrigin: true, secure: true },
      "/process": { target: kfOrigin, changeOrigin: true, secure: true },
      "/process-report": { target: kfOrigin, changeOrigin: true, secure: true },
      "/user": { target: kfOrigin, changeOrigin: true, secure: true },
      "/kf-live": {
        target: kfLiveOrigin,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kf-live/, ""),
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq) => {
            if (proxyReq.getHeader("X-Access-Key-Id")) return;
            const keyId = env.VITE_KF_LIVE_ACCESS_KEY_ID || "";
            const keySecret = env.VITE_KF_LIVE_ACCESS_KEY_SECRET || "";
            if (keyId && keySecret) {
              proxyReq.setHeader("X-Access-Key-Id", keyId);
              proxyReq.setHeader("X-Access-Key-Secret", keySecret);
            }
          });
        },
      },
      "/kf-dev": {
        target: "https://development-refexgroup.kissflow.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kf-dev/, ""),
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq) => {
            const keyId = env.VITE_KF_ACCESS_KEY_ID || "";
            const keySecret = env.VITE_KF_ACCESS_KEY_SECRET || "";
            if (keyId && keySecret) {
              proxyReq.setHeader("X-Access-Key-Id", keyId);
              proxyReq.setHeader("X-Access-Key-Secret", keySecret);
            }
          });
        },
      },
      "/form": { target: kfOrigin, changeOrigin: true, secure: true },
      "/flow": { target: kfOrigin, changeOrigin: true, secure: true },
      "/dataset": { target: kfOrigin, changeOrigin: true, secure: true },
      "/integration": { target: kfOrigin, changeOrigin: true, secure: true },
      "/api/v1": { target: "https://refexone.com", changeOrigin: true, secure: true },
    },
  },
};
});
