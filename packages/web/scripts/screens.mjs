// Visual baseline: node packages/web/scripts/screens.mjs <outDir>
// Starts the board on examples/recipe-box (free port, built web app), then saves
// <screen>-<width>-<theme>.png for each screen at 1280x800 and 375x812, light and dark.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outDir = path.resolve(process.argv[2] ?? 'screens');
fs.mkdirSync(outDir, { recursive: true });

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not answer at ${url}`);
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    else child.kill('SIGTERM');
  } catch {}
}

const SIZES = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
];
const THEMES = ['light', 'dark'];

// Open a header action: the button on a wide screen, a logo-menu item on a narrow one.
// Logs is always a header button (icon-only on a narrow screen, named by its tooltip label).
async function openHeaderAction(page, name, narrow) {
  if (narrow && name !== 'Logs') {
    await page.locator('[data-tour="brand"]').click();
    await page.getByRole('menuitem', { name }).click();
  } else {
    await page.getByRole('button', { name, exact: true }).click();
  }
}

const SCREENS = {
  async board(page) {
    await page.waitForTimeout(300);
  },
  async table(page) {
    await page.getByRole('radio', { name: 'Table view' }).click();
    await page.getByRole('table').first().waitFor();
  },
  async 'card-T-104'(page) {
    await page.locator('[role="button"][aria-label^="T-104 "]').first().click();
    await page.getByRole('heading').first().waitFor();
    await page.waitForTimeout(500);
  },
  async overview(page, narrow) {
    await openHeaderAction(page, 'Overview', narrow);
    await page.getByRole('dialog').first().waitFor();
    await page.waitForTimeout(500);
  },
  async logs(page, narrow) {
    await openHeaderAction(page, 'Logs', narrow);
    await page.getByRole('dialog').first().waitFor();
    await page.waitForTimeout(500);
  },
  async 'logo-menu'(page) {
    await page.locator('[data-tour="brand"]').click();
    await page.getByRole('menu').waitFor();
  },
};

async function main() {
  const port = await freePort();
  execSync('npm run build -w @specboard/web', { cwd: root, stdio: 'inherit' });
  const server = spawn(
    process.execPath,
    ['--import', 'tsx', 'packages/server/src/cli.ts', 'examples/recipe-box', '--port', String(port), '--no-open'],
    { cwd: root, stdio: 'inherit', windowsHide: true },
  );
  const cleanup = () => killTree(server);
  process.on('exit', cleanup);
  let browser;
  try {
    const url = `http://127.0.0.1:${port}/`;
    await waitFor(url);
    browser = await chromium.launch();
    let n = 0;
    for (const size of SIZES) {
      for (const theme of THEMES) {
        const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
        // Every load: chosen theme, tour already seen (its overlay blocks clicks), and the Board view.
        await ctx.addInitScript((t) => {
          localStorage.setItem('specboard.theme', t);
          localStorage.setItem('specboard.tour', 'seen');
          localStorage.setItem('specboard.view', 'board');
        }, theme);
        const page = await ctx.newPage();
        for (const [name, run] of Object.entries(SCREENS)) {
          await page.goto(url, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: /^Milestone:/ }).waitFor({ timeout: 15000 });
          // The board opens on the current milestone; show every spec so T-104 is on screen.
          if (!(await page.getByRole('button', { name: 'Milestone: All milestones' }).count())) {
            await page.getByRole('button', { name: /^Milestone:/ }).click();
            await page.getByRole('menuitemradio', { name: /^All milestones/ }).click();
          }
          await page.locator('[role="button"][aria-label^="T-104 "]').first().waitFor({ timeout: 15000 });
          await run(page, size.width < 768);
          const file = path.join(outDir, `${name}-${size.width}-${theme}.png`);
          await page.screenshot({ path: file });
          n++;
          console.log('saved', path.basename(file));
          await page.keyboard.press('Escape');
        }
        await ctx.close();
      }
    }
    console.log(`${n} screenshots in ${outDir}`);
  } finally {
    await browser?.close();
    cleanup();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
