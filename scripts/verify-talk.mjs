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
const args = process.argv.slice(2);
const mobileMode = args.includes("--mobile");
const videoLazyMode = args.includes("--video-lazy");
const url = args.find((value) => !value.startsWith("--"));

if (!url) {
  console.error("Usage: node scripts/verify-talk.mjs [--mobile] [--video-lazy] <url>");
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
const page = await browser.newPage(
  mobileMode
    ? {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      }
    : {
        viewport: { width: 1440, height: 900 },
      }
);

try {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1000);

  if (mobileMode) {
    const mobileState = await page.evaluate(() => {
      const note = document.querySelector(".mobile-guide");
      return {
        noteText: note?.textContent?.trim() || "",
        scrollSnapType: getComputedStyle(document.documentElement).scrollSnapType,
        slideOverflow: getComputedStyle(document.querySelector(".slide-content")).overflow,
      };
    });

    assert.ok(
      mobileState.noteText.includes("移动端"),
      `Expected a mobile usage note, got ${mobileState.noteText || "<empty>"}`
    );
    assert.equal(
      mobileState.scrollSnapType,
      "none",
      `Expected mobile mode to disable scroll snap, got ${mobileState.scrollSnapType}`
    );
    assert.equal(
      mobileState.slideOverflow,
      "visible",
      `Expected mobile slide content overflow to be visible, got ${mobileState.slideOverflow}`
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          checked: ["mobile usage note", "mobile continuous scroll mode", "mobile slide overflow"],
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  if (videoLazyMode) {
    const lazyState = await page.evaluate(() => {
      const inlineVideos = Array.from(document.querySelectorAll(".media-frame video")).filter(
        (video) => !video.classList.contains("media-modal-video")
      );
      return {
        inlineCount: inlineVideos.length,
        eagerSources: inlineVideos
          .map((video, index) => ({
            index,
            currentSrc: video.currentSrc,
            src: video.getAttribute("src"),
            sourceSrc: video.querySelector("source")?.getAttribute("src") || "",
          }))
          .filter((item) => item.currentSrc || item.src || item.sourceSrc),
      };
    });

    assert.ok(lazyState.inlineCount >= 5, `Expected multiple inline videos, got ${lazyState.inlineCount}`);
    assert.equal(
      lazyState.eagerSources.length,
      0,
      `Expected inline videos to avoid eager sources, got ${JSON.stringify(lazyState.eagerSources)}`
    );

    await page.evaluate(() => {
      document.querySelector(".media-frame")?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        })
      );
    });
    await page.waitForTimeout(1200);

    const modalState = await page.evaluate(() => {
      const modal = document.querySelector(".media-modal");
      const video = modal?.querySelector(".media-modal-video");
      return {
        modalHidden: modal?.hasAttribute("hidden"),
        modalSrc: video?.getAttribute("src") || "",
      };
    });

    assert.equal(modalState.modalHidden, false, "Expected media modal to open after clicking a video");
    assert.ok(modalState.modalSrc, "Expected modal video src to be populated on demand");

    console.log(
      JSON.stringify(
        {
          ok: true,
          checked: ["inline videos stay lazy on load", "video modal hydrates on click"],
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const initial = await getActiveState(page);
  assert.ok(initial.totalSlides >= 20, `Expected at least 20 slides, got ${initial.totalSlides}`);

  await page.keyboard.press("PageDown");
  await page.waitForTimeout(900);

  const afterKeyboard = await getActiveState(page);
  assert.equal(afterKeyboard.activeId, "slide-02", `Expected keyboard nav to reach slide-02, got ${afterKeyboard.activeId}`);
  assert.equal(afterKeyboard.hash, "#slide-02", `Expected keyboard nav to update hash, got ${afterKeyboard.hash || "<empty>"}`);

  await page.goto(`${url.replace(/#.*$/, "")}#slide-10`, { waitUntil: "load" });
  await page.waitForTimeout(1000);

  const fromHash = await getActiveState(page);
  assert.equal(fromHash.activeId, "slide-10", `Expected hash navigation to land on slide-10, got ${fromHash.activeId}`);

  await page.goto(url, { waitUntil: "load" });
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
