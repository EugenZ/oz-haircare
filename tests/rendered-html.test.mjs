import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const designSystemRoot = new URL("../opendesign/root-ritual/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the bilingual ROOT / RITUAL site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ru">/i);
  assert.match(html, /<title>OZ SPA/);
  assert.match(html, /class="language-switch"/);
  assert.match(html, />RU<\/button>/);
  assert.match(html, />EN<\/button>/);
  assert.match(html, /id="services"/);
  assert.match(html, /id="gallery"/);
  assert.match(html, /id="journal"/);
  assert.match(html, /id="booking"/);
  assert.match(html, /class="booking-form"/);
  assert.match(html, /id="service-01"/);
});

test("keeps core client interactions wired", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(page, /type Language = "ru" \| "en"/);
  assert.match(page, /setLanguage\("ru"\)/);
  assert.match(page, /setLanguage\("en"\)/);
  assert.match(page, /setMenuOpen/);
  assert.match(page, /setOpenService/);
  assert.match(page, /aboutPhotos/);
  assert.match(page, /setAboutPhotoIndex/);
  assert.match(page, /Мои дипломы и сертификаты/);
  assert.match(page, /setCertificateIndex/);
  assert.match(page, /aria-expanded/);
  assert.match(page, /event\.preventDefault\(\)/);
  assert.match(page, /name="date"/);
  assert.match(page, /name="time"/);
  assert.match(page, /className="floating-note floating-note-bottom"/);
  assert.match(page, /href=\{"#service-"/);
  assert.match(page, /setOpenService\(services\[0\]\.number\)/);
  assert.match(page, /Выбрать время и дату/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.match(css, /@import "\.\.\/opendesign\/root-ritual\/tokens\.css"/);
});

test("ships a complete OpenDesign design-system package", async () => {
  const [manifestText, design, tokens] = await Promise.all([
    readFile(new URL("manifest.json", designSystemRoot), "utf8"),
    readFile(new URL("DESIGN.md", designSystemRoot), "utf8"),
    readFile(new URL("tokens.css", designSystemRoot), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.schemaVersion, "od-design-system-project/v1");
  assert.equal(manifest.id, "root-ritual");
  assert.equal(manifest.files.design, "DESIGN.md");
  assert.equal(manifest.files.tokens, "tokens.css");
  assert.ok((design.match(/^## /gm) ?? []).length >= 7);

  const requiredTokens = [
    "--bg", "--surface", "--surface-warm", "--fg", "--fg-2", "--muted",
    "--meta", "--border", "--border-soft", "--accent", "--accent-on",
    "--accent-hover", "--accent-active", "--success", "--warn", "--danger",
    "--font-display", "--font-body", "--font-mono", "--text-xs", "--text-sm",
    "--text-base", "--text-lg", "--text-xl", "--text-2xl", "--text-3xl",
    "--text-4xl", "--leading-body", "--leading-tight", "--tracking-display",
    "--space-1", "--space-2", "--space-3", "--space-4", "--space-5",
    "--space-6", "--space-8", "--space-12", "--section-y-desktop",
    "--section-y-tablet", "--section-y-phone", "--radius-sm", "--radius-md",
    "--radius-lg", "--radius-pill", "--elev-flat", "--elev-ring",
    "--elev-raised", "--focus-ring", "--motion-fast", "--motion-base",
    "--ease-standard", "--container-max", "--container-gutter-desktop",
    "--container-gutter-tablet", "--container-gutter-phone",
  ];
  for (const token of requiredTokens) {
    assert.match(tokens, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
  }
});
