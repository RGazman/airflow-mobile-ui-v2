import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const airflowTarget = env.VITE_AIRFLOW_API_URL || 'http://localhost:8080'
  // Hosts allowed to reach the dev server (comma-separated). Needed when the
  // app runs behind an ingress: Vite by default accepts only
  // localhost/127.0.0.1/::1, otherwise requests are rejected with
  // "Blocked request. This host (...) is not allowed".
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  /**
   * Creates a Vite dev-server proxy entry for Airflow.
   * It forwards cookies (after stripping Secure/Domain) and rewrites absolute
   * redirects from the Airflow host back to the local dev server.
   *
   * ⚠️ Dev-only: cookie manipulation (Secure/Domain/SameSite removal) is needed
   * for HTTP local testing. In production behind a reverse proxy (nginx) this
   * config must NOT be replicated — the proxy handles HTTPS and cookies natively.
   */
  const createAirflowProxy = (): ProxyOptions => ({
    target: airflowTarget,
    changeOrigin: true,
    secure: false,
    ws: false,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq, req) => {
        // Behind an ingress the request carries X-Forwarded-* (host = frontend
        // domain). Forwarding them makes Airflow/FAB (ProxyFix) take the host
        // from X-Forwarded-Host, so the referer no longer matches the host:
        // 400 "The referrer does not match the host" on forms (login, clear,
        // mark). Strip them here.
        for (const h of [
          'forwarded',
          'x-forwarded-host',
          'x-forwarded-proto',
          'x-forwarded-port',
          'x-forwarded-for',
          'x-forwarded-prefix',
        ]) {
          proxyReq.removeHeader(h)
        }
        // Make Airflow think the request came from its own host.
        // This helps Flask/WTF CSRF checks on the login form.
        proxyReq.setHeader('origin', airflowTarget)
        proxyReq.setHeader('referer', `${airflowTarget}${req.url ?? ''}`)
      })

      proxy.on('proxyRes', (proxyRes, req) => {
        // Use the incoming request host so it works from any IP/port.
        const devHost = req.headers.host || 'localhost:5173'
        // Behind an HTTPS ingress the frontend is HTTPS: don't downgrade
        // redirects to http.
        const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'

        // Rewrite Set-Cookie so the browser accepts the session on http.
        const setCookie = proxyRes.headers['set-cookie']
        if (setCookie) {
          proxyRes.headers['set-cookie'] = setCookie.map((cookie) =>
            cookie
              .replace(/;?\s*Secure/gi, '')
              .replace(/;?\s*Domain=[^;]+/gi, '')
              .replace(/;?\s*SameSite=[^;]+/gi, '')
              .concat('; SameSite=Lax'),
          )
        }

        // Rewrite absolute redirects from Airflow host back to the dev server.
        const location = proxyRes.headers.location
        if (location && typeof location === 'string') {
          // Rewrite ONLY redirects pointing at Airflow itself. A redirect to an
          // external IdP (Keycloak etc.) must reach the browser untouched —
          // otherwise the browser would go to the dev host instead of the IdP
          // and SSO login breaks.
          const isAirflowRedirect =
            location.startsWith(airflowTarget) ||
            location.includes(encodeURIComponent(airflowTarget))
          if (isAirflowRedirect) {
            proxyRes.headers.location = location
              .replace(airflowTarget, `${proto}://${devHost}`)
              .replace(
                encodeURIComponent(airflowTarget),
                encodeURIComponent(`${proto}://${devHost}`),
              )
          }
        }
      })
    },
  })

  const airflowProxy = createAirflowProxy()

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      // Behind an ingress the Host header carries the frontend domain; without
      // this list Vite rejects such requests. Set VITE_ALLOWED_HOSTS
      // (comma-separated) in the deployment environment.
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
      proxy: {
        // Airflow REST API
        '/api': airflowProxy,
        // Legacy web form actions used by the original Airflow UI:
        // /clear (task clear), /success & /failed (mark state), /confirm (preview)
        '/clear': airflowProxy,
        '/success': airflowProxy,
        '/failed': airflowProxy,
        '/confirm': airflowProxy,
        // Run-level marks (Apply to run): /dagrun_success & /dagrun_failed
        '/dagrun_failed': airflowProxy,
        '/dagrun_success': airflowProxy,
        '/dagrun_clear': airflowProxy,
        '/dagrun_queued': airflowProxy,
        // Latest run per DAG for the DAGs list (legacy web endpoint, PC-mirror)
        '/last_dagruns': airflowProxy,
        // /object/{graph_data,grid_data,...} — web UI data endpoints
        '/object': airflowProxy,
        '/login': airflowProxy,
        '/logout': airflowProxy,
        // '/home' and '/dags' — not proxied: handled by React Router.
        // But the grid page (not a React route) is proxied so the app can
        // fetch a CSRF token from the rendered Airflow HTML.
        '^/dags/[^/]+/grid$': airflowProxy,
        '/static': airflowProxy,
      },
    },
  }
})
