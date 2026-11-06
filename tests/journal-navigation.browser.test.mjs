import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const { articles } = JSON.parse(readFileSync(new URL("../content/journal.json", import.meta.url), "utf8"));
const [first, second] = articles;
const locales = [
  { code: "ru", query: "", read: "Читать статью", logo: "OZ SPA — на главную", back: "К журналу", next: "Следующая статья" },
  { code: "en", query: "?lang=en", read: "Read article", logo: "OZ SPA — home", back: "Back to journal", next: "Next article" },
];

let browser;
let worker;
let baseUrl;
let temporaryDirectory;

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

before(async () => {
  assert.ok(first && second, "The bundled journal must contain at least two articles");
  temporaryDirectory = mkdtempSync(join(tmpdir(), "oz-navigation-test-"));
  const envFile = join(temporaryDirectory, "empty.env");
  writeFileSync(envFile, "");
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
    CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
    WRANGLER_SEND_METRICS: "false",
  };
  for (const name of ["DATABASE_URL", "DATABASE_SCHEMA", "PGUSER", "PGHOST", "PGPASSWORD", "PGPORT", "PGDATABASE", "POSTGRES_USER", "POSTGRES_HOST", "POSTGRES_PASSWORD", "POSTGRES_PORT", "POSTGRES_DB", "JOURNAL_CATALOG_PATH"]) {
    delete env[name];
  }

  worker = spawn(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "dev", "--local",
    "--config", "dist/server/wrangler.json", "--ip", "127.0.0.1", "--port", String(port),
    "--env-file", envFile, "--persist-to", join(temporaryDirectory, "state"), "--log-level", "error",
    "--var", "DATABASE_URL:", "--var", "PGUSER:", "--var", "PGHOST:",
    "--var", "POSTGRES_USER:", "--var", "POSTGRES_HOST:",
  ], { cwd: root, env, stdio: ["ignore", "ignore", "pipe"] });
  let errors = "";
  worker.stderr.on("data", (chunk) => { errors += chunk.toString(); });

  const deadline = Date.now() + 30_000;
  while (true) {
    if (worker.exitCode !== null) throw new Error(`Local Worker exited before starting: ${errors}`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) break;
    } catch {
      // The Worker is still starting.
    }
    if (Date.now() >= deadline) throw new Error(`Local Worker did not start: ${errors}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
}, { timeout: 40_000 });

after(async () => {
  await browser?.close();
  if (worker && worker.exitCode === null) {
    await new Promise((resolve) => {
      const timeout = setTimeout(() => { worker.kill("SIGKILL"); resolve(); }, 3_000);
      timeout.unref();
      worker.once("exit", () => { clearTimeout(timeout); resolve(); });
      worker.kill("SIGTERM");
    });
  }
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function openReadyPage(page, pathname) {
  const response = await page.goto(`${baseUrl}${pathname}`);
  assert.equal(response.status(), 200);
  await page.waitForLoadState("networkidle");

  // Confirm hydration before clicking links: a pre-hydration click can use the
  // browser's default navigation and hide a broken client-side router.
  const menu = page.locator("button.menu-toggle");
  await menu.click();
  await page.waitForFunction(() => document.querySelector("button.menu-toggle")?.getAttribute("aria-expanded") === "true");
  await menu.click();
  await page.waitForFunction(() => document.querySelector("button.menu-toggle")?.getAttribute("aria-expanded") === "false");
}

async function expectNavigation(page, pathname) {
  const expected = `${baseUrl}${pathname}`;
  try {
    await page.waitForURL(expected, { timeout: 3_000 });
  } catch (error) {
    assert.equal(page.url(), expected, "Clicking the link should navigate to its destination");
    throw error;
  }
}

for (const locale of locales) {
  const articlePath = `/journal/${first.slug}${locale.query}`;
  const nextPath = `/journal/${second.slug}${locale.query}`;

  test(`${locale.code}: open an article from the home page`, async (t) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());
    await openReadyPage(page, `/${locale.query}`);
    await page.getByRole("link", { name: `${locale.read}: ${first.title[locale.code]}`, exact: true }).click();
    await expectNavigation(page, articlePath);
    await page.getByRole("heading", { level: 1, name: first.title[locale.code], exact: true }).waitFor();
  });

  test(`${locale.code}: article logo returns home`, async (t) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());
    await openReadyPage(page, articlePath);
    await page.getByRole("link", { name: locale.logo, exact: true }).click();
    await expectNavigation(page, `/${locale.query}`);
    assert.equal(await page.locator("#journal").count(), 1);
  });

  test(`${locale.code}: article link returns to the journal`, async (t) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());
    await openReadyPage(page, articlePath);
    await page.getByRole("link", { name: locale.back, exact: true }).click();
    await expectNavigation(page, `/${locale.query}#journal`);
    assert.equal(await page.locator("#journal").count(), 1);
  });

  test(`${locale.code}: article link opens the next article`, async (t) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());
    await openReadyPage(page, articlePath);
    await page.getByRole("link", { name: locale.next }).click();
    await expectNavigation(page, nextPath);
    await page.getByRole("heading", { level: 1, name: second.title[locale.code], exact: true }).waitFor();
  });

  test(`${locale.code}: certificate heading stays on one line when it fits`, async (t) => {
    const page = await browser.newPage({ viewport: { width: 583, height: 844 } });
    t.after(() => page.close());
    const response = await page.goto(`${baseUrl}/${locale.query}`);
    assert.equal(response.status(), 200);
    await page.waitForLoadState("networkidle");

    const heading = page.locator("#certificates h2");
    assert.equal(await heading.textContent(), locale.code === "ru" ? "Дипломы и сертификаты" : "Diplomas and Certificates");
    const lineCount = await heading.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    });
    assert.equal(lineCount, 1);
  });

  test(`${locale.code}: browse certificates and open a full-size document`, async (t) => {
    const page = await browser.newPage({
      viewport: locale.code === "ru" ? { width: 320, height: 844 } : { width: 1280, height: 900 },
    });
    t.after(() => page.close());
    if (locale.code === "ru") {
      await openReadyPage(page, `/${locale.query}`);
    } else {
      const response = await page.goto(`${baseUrl}/${locale.query}`);
      assert.equal(response.status(), 200);
      await page.waitForLoadState("networkidle");
    }

    const labels = locale.code === "ru"
      ? { region: "Дипломы и сертификаты", next: "Следующий документ", previous: "Предыдущий документ", document: "Документ", view: "Открыть в полном размере" }
      : { region: "Diplomas and Certificates", next: "Next document", previous: "Previous document", document: "Document", view: "View full size" };
    const images = [
      "hair-master-diploma.jpg",
      "hair-master-certificate.jpg",
      "expert-1.webp",
      "expert-3.webp",
      "scalp-peelings.webp",
      "cold-reconstruction.webp",
      "collagen-restoration.webp",
    ];
    const slider = page.getByRole("region", { name: labels.region });
    const image = slider.locator(".certificate-image");
    const view = slider.getByRole("link", { name: labels.view });
    await slider.scrollIntoViewIfNeeded();
    assert.equal(await slider.locator(".about-slider-dots button").count(), images.length);
    const dotRows = await slider.locator(".about-slider-dots button").evaluateAll((dots) =>
      dots.map((dot) => Math.round(dot.getBoundingClientRect().top)),
    );
    assert.equal(new Set(dotRows).size, 1);

    const placement = await page.evaluate(() => {
      const section = document.querySelector("#certificates");
      const heading = section.querySelector("h2");
      const range = document.createRange();
      range.selectNodeContents(heading);
      const headingBox = range.getBoundingClientRect();
      const galleryBox = section.querySelector(".certificate-slider").getBoundingClientRect();
      const sectionBackground = getComputedStyle(section).backgroundColor;
      const galleryBackground = getComputedStyle(section.querySelector(".certificate-slider")).backgroundColor;
      const imageBackground = getComputedStyle(section.querySelector(".certificate-image")).backgroundColor;
      const typography = (element) => {
        const style = getComputedStyle(element);
        return [style.fontFamily, style.fontSize, style.fontWeight, style.letterSpacing, style.lineHeight];
      };
      return {
        followsBooking: section.previousElementSibling?.id === "booking",
        precedesFooter: section.nextElementSibling?.matches("footer.site-footer"),
        headingCenter: headingBox.x + headingBox.width / 2,
        galleryCenter: galleryBox.x + galleryBox.width / 2,
        pageCenter: window.innerWidth / 2,
        galleryMatchesSection: ["rgba(0, 0, 0, 0)", sectionBackground].includes(galleryBackground),
        imageMatchesSection: ["rgba(0, 0, 0, 0)", sectionBackground].includes(imageBackground),
        headingTypography: typography(heading),
        sectionHeadingTypography: typography(document.querySelector("#services .section-intro h2")),
      };
    });
    assert.equal(placement.followsBooking, true);
    assert.equal(placement.precedesFooter, true);
    assert.ok(Math.abs(placement.headingCenter - placement.pageCenter) < 1);
    assert.ok(Math.abs(placement.galleryCenter - placement.pageCenter) < 1);
    assert.equal(placement.galleryMatchesSection, true);
    assert.equal(placement.imageMatchesSection, true);
    assert.deepEqual(placement.headingTypography, placement.sectionHeadingTypography);

    for (const [index, name] of images.entries()) {
      const path = `/certificates/${name}`;
      await page.waitForFunction((src) => {
        const image = document.querySelector(".certificate-image");
        return image?.getAttribute("src") === src && image.complete && image.naturalWidth > 0;
      }, path);
      assert.equal(await view.getAttribute("href"), path);
      assert.ok(await image.getAttribute("alt"));
      assert.equal(await slider.getByRole("button", { name: `${labels.document} ${index + 1}`, exact: true }).getAttribute("aria-current"), "true");
      await slider.getByRole("button", { name: labels.next }).click();
    }

    await image.scrollIntoViewIfNeeded();
    const dragBox = await image.boundingBox();
    assert.ok(dragBox);
    await page.mouse.move(dragBox.x + dragBox.width * 0.8, dragBox.y + dragBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragBox.x + dragBox.width * 0.2, dragBox.y + dragBox.height / 2);
    await page.mouse.up();
    assert.equal(await image.getAttribute("src"), `/certificates/${images[1]}`);
    await slider.getByRole("button", { name: labels.previous }).click();
    await slider.getByRole("button", { name: labels.previous }).click();
    assert.equal(await image.getAttribute("src"), `/certificates/${images.at(-1)}`);
    await slider.getByRole("button", { name: `${labels.document} 4`, exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await image.getAttribute("src"), `/certificates/${images[3]}`);
    const imageBox = await image.boundingBox();
    const controlsBox = await slider.locator(".certificate-controls").boundingBox();
    assert.ok(imageBox && controlsBox && controlsBox.y >= imageBox.y + imageBox.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    const [popup] = await Promise.all([page.waitForEvent("popup"), view.click()]);
    await popup.waitForLoadState("load");
    assert.equal(new URL(popup.url()).pathname, `/certificates/${images[3]}`);
    await popup.close();
  });
}
