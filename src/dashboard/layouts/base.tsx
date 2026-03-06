import type { Child, FC } from "hono/jsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Runs" },
  { href: "/dashboard/definitions", label: "Definitions" },
  { href: "/dashboard/schedules", label: "Schedules" },
] as const;

const LIGHT_THEME = "retro";
const DARK_THEME = "retro-dark";

const retroDarkTheme = `
[data-theme="retro-dark"] {
  color-scheme: dark;

  --p: 52% 0.07 46;              /* warm muted orange-red, retro primary softened */
  --pf: 45% 0.06 46;
  --pc: 90% 0.02 75;

  --s: 58% 0.09 75;              /* warm tan-gold, retro secondary */
  --sf: 50% 0.08 75;
  --sc: 18% 0.02 75;

  --a: 55% 0.08 145;             /* sage green accent */
  --af: 48% 0.07 145;
  --ac: 18% 0.02 75;

  --n: 55% 0.02 75;              /* warm gray for neutral */
  --nf: 45% 0.02 75;
  --nc: 90% 0.02 75;

  --b1: 20% 0.02 75;             /* dark warm brown background */
  --b2: 23% 0.02 75;             /* slightly lighter */
  --b3: 27% 0.025 75;            /* card/surface */

  --bc: 85% 0.03 80;             /* warm off-white text */

  --in: 55% 0.10 230;            /* muted blue for info */
  --inc: 90% 0.02 75;

  --su: 55% 0.10 145;            /* sage green for success */
  --suc: 18% 0.02 75;

  --wa: 60% 0.10 75;             /* warm amber for warning */
  --wac: 18% 0.02 75;

  --er: 50% 0.12 25;             /* warm red for error */
  --erc: 90% 0.02 75;

  --rounded-box: 0.4rem;
  --rounded-btn: 0.4rem;
  --rounded-badge: 0.4rem;
  --tab-radius: 0.4rem;
  --animation-btn: 0.2s;
  --animation-input: 0.2s;
  --btn-focus-scale: 0.97;
}
`;

export const BaseLayout: FC<{ title?: string; currentPath?: string; children: Child }> = ({
  title,
  currentPath,
  children,
}) => {
  const pageTitle = title ? `${title} — Cinnamon` : "Cinnamon Dashboard";

  return (
    <html lang="en" data-theme={LIGHT_THEME}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pageTitle}</title>
        <link
          href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css"
          rel="stylesheet"
          type="text/css"
        />
        <script src="https://cdn.tailwindcss.com" />
        <script src="https://unpkg.com/htmx.org@2.0.4" />
        <style dangerouslySetInnerHTML={{ __html: retroDarkTheme }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var t = localStorage.getItem('cinnamon-theme') || '${LIGHT_THEME}';
                document.documentElement.setAttribute('data-theme', t);
              })();
            `,
          }}
        />
      </head>
      <body class="min-h-screen bg-base-200" hx-boost="true">
        <div class="navbar bg-base-100 shadow-sm px-4">
          <div class="flex-1">
            <a href="/dashboard" class="text-xl font-bold tracking-tight">
              🫙 Cinnamon
            </a>
          </div>
          <div class="flex-none">
            <ul class="menu menu-horizontal px-1 gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    class={currentPath === item.href ? "active" : ""}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <button
              class="btn btn-ghost btn-circle ml-2"
              id="theme-toggle"
              aria-label="Toggle theme"
            >
              <span id="theme-icon">🌙</span>
            </button>
          </div>
        </div>

        <main class="container mx-auto px-4 py-6 max-w-7xl">{children}</main>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var LIGHT = '${LIGHT_THEME}';
                var DARK = '${DARK_THEME}';
                function setup() {
                  var btn = document.getElementById('theme-toggle');
                  var icon = document.getElementById('theme-icon');
                  if (!btn || !icon) return;
                  function updateIcon() {
                    var current = document.documentElement.getAttribute('data-theme');
                    icon.textContent = current === DARK ? '☀️' : '🌙';
                  }
                  updateIcon();
                  btn.onclick = function() {
                    var current = document.documentElement.getAttribute('data-theme');
                    var next = current === DARK ? LIGHT : DARK;
                    document.documentElement.setAttribute('data-theme', next);
                    localStorage.setItem('cinnamon-theme', next);
                    updateIcon();
                  };
                }
                setup();
                document.body.addEventListener('htmx:afterSwap', setup);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
};
