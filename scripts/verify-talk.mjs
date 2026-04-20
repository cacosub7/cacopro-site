import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const fallback = path.join(
      os.homedir(),
      ".agents",
      "skills",
      "dev-browser",
      "node_modules",
      "playwright"
    );
    return require(fallback);
  }
}

const { chromium } = loadPlaywright();
const url = process.argv[2];

if (!url) {
  console.error("Usage: node scripts/verify-talk.mjs <url>");
  process.exit(1);
}

async function getActiveState(page) {
  return page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll(".nav-dots button"));
    const activeIndex = dots.findIndex((dot) => dot.classList.contains("active"));
    const activeSlide =
      activeIndex >= 0 ? document.querySelectorAll(".slide")[activeIndex] : null;

    return {
      hash: window.location.hash,
      activeIndex,
      activeId: activeSlide?.id || null,
      totalSlides: document.querySelectorAll(".slide").length,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const initial = await getActiveState(page);
  assert.ok(initial.totalSlides >= 20, `Expected at least 20 slides, got ${initial.totalSlides}`);

  await page.keyboard.press("PageDown");
  await page.waitForTimeout(900);

  const afterKeyboard = await getActiveState(page);
  assert.equal(afterKeyboard.activeId, "slide-02", `Expected keyboard nav to reach slide-02, got ${afterKeyboard.activeId}`);
  assert.equal(afterKeyboard.hash, "#slide-02", `Expected keyboard nav to update hash, got ${afterKeyboard.hash || "<empty>"}`);

  await page.goto(`${url.replace(/#.*$/, "")}#slide-10`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const fromHash = await getActiveState(page);
  assert.equal(fromHash.activeId, "slide-10", `Expected hash navigation to land on slide-10, got ${fromHash.activeId}`);

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    for (let i = 0; i < 5; i += 1) {
      window.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 260,
          bubbles: true,
          cancelable: true,
        })
      );
    }
  });
  await page.waitForTimeout(900);

  const afterWheelBurst = await getActiveState(page);
  assert.equal(afterWheelBurst.activeId, "slide-02", `Expected rapid wheel burst to advance to slide-02, got ${afterWheelBurst.activeId}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: ["slide count", "keyboard navigation", "hash navigation", "wheel burst navigation"],
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
