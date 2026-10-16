import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { readFile, readdir, stat, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import ts from "typescript";

const root = path.resolve("out");
const screenshots = path.resolve(".codex-temp/ui-theme-regression");
await mkdir(screenshots, { recursive: true });
const mime = { ".html": "text/html", ".js": "text/javascript", ".txt": "text/plain", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".wasm": "application/wasm" };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let file = path.resolve(root, `.${pathname}${pathname.endsWith("/") ? "index.html" : ""}`);
    if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const lessonText = await readFile("lib/lesson.ts", "utf8");
const lessonSource = ts.transpileModule(lessonText, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { lessons } = await import(`data:text/javascript;base64,${Buffer.from(lessonSource).toString("base64")}`);
const exerciseSet = "a-o-d-letters-and-sounds";
const exerciseLesson = lessons.find(lesson => lesson.progressionGroups?.some(group => group.lessons.some(step => step.exerciseSet === exerciseSet)));
const exercise = exerciseLesson.progressionGroups.flatMap(group => group.lessons).find(step => step.exerciseSet === exerciseSet);
const exerciseRoute = `/learn/${exerciseLesson.id}/play/${exercise.id}/`;
const routes = [
  ["home", "/"], ["learning", "/learn/"], ["exercise", exerciseRoute],
  ["dictionary", "/dictionary/"], ["translator", "/translator/"], ["reading", "/read/"],
  ["vocabulary", "/vocabulary/"], ["settings", "/settings/"],
];
const exerciseExportDirectory = path.resolve(root, `.${exerciseRoute}`);
const exerciseSegment = (await readdir(exerciseExportDirectory)).find(name => /^__next\..*__PAGE__\.txt$/.test(name));
assert.ok(exerciseSegment, "Exercise page has a flattened static page-segment file");
const exerciseSegmentResponse = await fetch(`${base}${exerciseRoute}${exerciseSegment}`);
assert.equal(exerciseSegmentResponse.status, 200, "Flattened exercise page-segment file is served successfully");
assert.ok((await exerciseSegmentResponse.text()).length > 0, "Static page-segment file contains rendered data");
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
  await context.addInitScript(() => {
    if (sessionStorage.getItem("__theme-test-initialized") !== "true") {
      localStorage.removeItem("theme-mode");
      sessionStorage.setItem("__theme-test-initialized", "true");
    }
  });
  const page = await context.newPage();
  const pageErrors = [];
  const hydrationErrors = [];
  const segmentResponses = [];
  const segmentFailures = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    const responseUrl = new URL(response.url());
    if (responseUrl.origin === base && responseUrl.pathname.endsWith(".txt")) {
      segmentResponses.push(response.status());
      if (response.status() >= 400) segmentFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", message => {
    if (message.type() === "error" && /hydration|react error #(?:418|423|425)/i.test(message.text())) hydrationErrors.push(message.text());
  });

  await page.goto(`${base}/settings/`);
  const theme = page.getByRole("combobox", { name: "App theme", exact: true });
  await assert.doesNotReject(() => theme.waitFor());
  assert.equal(await theme.inputValue(), "system");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await page.selectOption("#theme-choice", "system");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.selectOption("#theme-choice", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.selectOption("#theme-choice", "dark");
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  assert.equal(await theme.inputValue(), "dark");

  for (const [mode, colorScheme] of [["light", "light"], ["dark", "dark"]]) {
    await page.selectOption("#theme-choice", mode);
    await page.emulateMedia({ colorScheme });
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
    for (const [name, route] of routes) {
      await page.goto(`${base}${route}`);
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        pageTitle: document.querySelector("h1")?.textContent?.trim() ?? "missing heading",
      }));
      assert.ok(layout.pageTitle.length > 0, `${name} renders a page heading`);
      assert.ok(layout.documentWidth <= layout.width + 1, `${name} has no horizontal overflow at desktop width: ${JSON.stringify(layout)}`);
      if (name === "exercise") await startExercise(page);
      await page.screenshot({ path: path.join(screenshots, `${mode}-${name}-desktop.png`) });
      if (name === "settings") {
        assert.equal(await page.getByRole("combobox", { name: "App theme", exact: true }).inputValue(), mode);
      }
      await page.reload();
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
    }
  }

  // Exercise responsive layout and navigation through the actual home links.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/settings/`);
  await page.getByRole("combobox", { name: "App theme", exact: true }).selectOption("light");
  await page.goto(`${base}/`);
  await page.getByRole("link", { name: /Read Coptic/ }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Dictionary" }).click();
  await page.getByRole("textbox", { name: "Dictionary search" }).waitFor();
  const dictionaryInput = page.getByRole("textbox", { name: "Dictionary search" });
  await exerciseCopticEditing(page, dictionaryInput, "Dictionary");
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Translator" }).click();
  const translatorInput = page.getByRole("textbox", { name: "Coptic text" });
  await translatorInput.waitFor();
  await exerciseCopticEditing(page, translatorInput, "Translator");

  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Settings" }).click();
  await page.evaluate(() => {
    localStorage.removeItem("coptic-dictionary-recent");
    sessionStorage.removeItem("coptic-dictionary-search");
  });
  for (const [mode, colorScheme] of [["light", "light"], ["dark", "dark"]]) {
    await page.getByRole("combobox", { name: "App theme", exact: true }).selectOption(mode);
    await page.emulateMedia({ colorScheme });
    for (const [name, route] of routes) {
      await page.goto(`${base}${route}`);
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
      if (name === "exercise") await startExercise(page);
      if (name === "dictionary") await page.locator('.dictionary-results[data-state="ready"]').waitFor();
      const dimensions = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
      assert.ok(dimensions.documentWidth <= dimensions.width + 1, `${name} has no horizontal overflow at mobile width: ${JSON.stringify(dimensions)}`);
      await page.screenshot({ path: path.join(screenshots, `${mode}-${name}-mobile.png`) });
    }
  }

  assert.deepEqual(pageErrors, [], `No uncaught page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(hydrationErrors, [], `No React hydration errors: ${hydrationErrors.join(" | ")}`);
  assert.deepEqual(segmentFailures, [], `No static navigation segment failures: ${segmentFailures.join(" | ")}`);
  console.log(`PASS: Settings theme selection, system changes, persistence, reload/navigation hydration, responsive width, Coptic input editing, and served flat route-segment output (${segmentResponses.length} route-segment fetches during UI navigation). Screenshots: ${screenshots}`);
  await context.close();
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

async function exerciseCopticEditing(page, input, screen) {
  const original = "ⲁ̅ⲃⲅ";
  await input.fill(original);
  await input.evaluate(element => element.setSelectionRange(2, 2));
  await input.pressSequentially("ϩ");
  assert.equal(await input.inputValue(), "ⲁ̅ϩⲃⲅ", `${screen} inserts Coptic text at the cursor inside a word`);
  assert.equal(await input.evaluate(element => element.selectionStart), 3, `${screen} keeps the cursor after inserted Coptic text`);
  await input.evaluate(element => element.setSelectionRange(2, 4));
  await input.pressSequentially("ϣ");
  assert.equal(await input.inputValue(), "ⲁ̅ϣⲅ", `${screen} replaces a selection containing a Coptic letter`);
  assert.equal(await input.evaluate(element => element.selectionStart), 3, `${screen} positions the cursor after selection replacement`);
  await input.evaluate(element => element.setSelectionRange(3, 3));
  await input.press("Backspace");
  assert.equal(await input.inputValue(), "ⲁ̅ⲅ", `${screen} deletes the preceding letter without dropping the prior combining mark`);
  assert.equal(await caretAfterFrame(input), 2, `${screen} positions the cursor after the marked grapheme`);
  await input.fill("ⲁ̅ⲃⲅ");
  await input.evaluate(element => element.setSelectionRange(2, 2));
  await input.press("Backspace");
  assert.equal(await input.inputValue(), "ⲃⲅ", `${screen} backspaces a whole Coptic grapheme cluster`);
  const restoredCursor = await caretAfterFrame(input);
  assert.equal(restoredCursor, 0, `${screen} positions the cursor at the start of the deleted grapheme`);
}

async function startExercise(page) {
  await page.getByRole("heading", { name: /^Lesson \d+$/ }).waitFor();
  await page.getByRole("button", { name: "I’m ready", exact: true }).click();
  await page.getByRole("button", { name: "Check", exact: true }).waitFor();
}

function caretAfterFrame(input) {
  return input.evaluate(element => new Promise(resolve => requestAnimationFrame(() => resolve(element.selectionStart))));
}
