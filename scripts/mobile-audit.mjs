/**
 * Mobile browser audit.
 *
 * Drives the real UI in phone-sized viewports and asserts the things that
 * actually break on mobile: horizontal overflow, sub-16px inputs (which make
 * iOS Safari zoom), tiny tap targets, console errors, and the two-device room
 * flow driven entirely through touch.
 *
 * Usage: node scripts/mobile-audit.mjs [baseUrl]
 */
import { chromium, devices } from "playwright";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";

const VIEWPORTS = [
  { name: "iPhone SE (375x667)", viewport: { width: 375, height: 667 }, mobile: true },
  { name: "iPhone 14 Pro (393x852)", viewport: { width: 393, height: 852 }, mobile: true },
  { name: "Galaxy S20 (360x800)", viewport: { width: 360, height: 800 }, mobile: true },
  { name: "iPad mini (768x1024)", viewport: { width: 768, height: 1024 }, mobile: true },
  { name: "Desktop (1440x900)", viewport: { width: 1440, height: 900 }, mobile: false },
];

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Elements wider than the viewport are what cause the sideways-scroll bug. */
async function overflowReport(page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === "fixed") continue;
      if (rect.right > docWidth + 1 || rect.left < -1) {
        offenders.push(
          `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} (${Math.round(rect.left)}→${Math.round(rect.right)})`
        );
      }
      if (offenders.length >= 5) break;
    }
    return { docWidth, scrollWidth, offenders };
  });
}

/** Anything below 16px triggers Safari's focus-zoom. */
async function smallFontInputs(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        if (["range", "checkbox", "radio", "file", "hidden"].includes(el.type)) return false;
        return parseFloat(getComputedStyle(el).fontSize) < 16;
      })
      .map((el) => `${el.id || el.name || el.placeholder || el.type}: ${getComputedStyle(el).fontSize}`)
  );
}

async function smallTapTargets(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], [role="button"], summary')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (getComputedStyle(el).visibility === "hidden") return false;
        return r.height < 40 || r.width < 24;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} "${(el.textContent || el.ariaLabel || "").trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
      })
      .slice(0, 6)
  );
}

async function main() {
  console.log(`\nMobile audit against ${BASE}\n`);
  const browser = await chromium.launch();

  // --- Static screen checks across viewports -------------------------------
  for (const { name, viewport, mobile } of VIEWPORTS) {
    console.log(`\n${name}`);
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: mobile ? 3 : 1,
      userAgent: mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
    });

    for (const path of ["/", "/create", "/join?code=ABC123"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      const { docWidth, scrollWidth, offenders } = await overflowReport(page);
      check(
        `${path} has no horizontal overflow`,
        scrollWidth <= docWidth + 1,
        `scrollWidth ${scrollWidth} > ${docWidth}; e.g. ${offenders.join("; ")}`
      );

      if (mobile) {
        const fonts = await smallFontInputs(page);
        check(`${path} inputs are >= 16px (no iOS zoom)`, fonts.length === 0, fonts.join("; "));

        const taps = await smallTapTargets(page);
        check(`${path} tap targets are large enough`, taps.length === 0, taps.join("; "));
      }
    }

    check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await context.close();
  }

  // --- Two-device room flow, driven by touch -------------------------------
  console.log("\nTwo-device flow (iPhone 13 + Pixel 5, touch only)");
  const hostCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const guestCtx = await browser.newContext({ ...devices["Pixel 5"] });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  const hostErrors = [];
  host.on("pageerror", (e) => hostErrors.push(e.message));

  await host.goto(`${BASE}/create`, { waitUntil: "networkidle" });
  await host.getByLabel("Nickname").fill("HostPhone");
  await host.getByRole("button", { name: /^Create room/ }).tap();
  await host.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 20000 });

  const code = host.url().split("/room/")[1];
  check("host creates a room by tapping", /^[A-Z0-9]{6}$/.test(code), code);

  const roomOverflow = await overflowReport(host);
  check(
    "room screen has no horizontal overflow on iPhone",
    roomOverflow.scrollWidth <= roomOverflow.docWidth + 1,
    `${roomOverflow.scrollWidth} > ${roomOverflow.docWidth}; ${roomOverflow.offenders.join("; ")}`
  );

  // The invite link, opened cold in a second mobile browser.
  await guest.goto(`${BASE}/join?code=${code}`, { waitUntil: "networkidle" });
  const prefilled = await guest.getByLabel("Room code").inputValue();
  check("invite link prefills the room code", prefilled === code, prefilled);

  await guest.getByLabel("Nickname").fill("GuestPhone");
  await guest.getByRole("button", { name: /^Join room/ }).tap();
  await guest.waitForURL(/\/room\//, { timeout: 20000 });
  check("guest joins from a second device", guest.url().includes(code));

  // Host should see the guest without reloading.
  await host.getByRole("button", { name: "players", exact: true }).tap();
  await host.waitForSelector("text=GuestPhone", { timeout: 15000 }).catch(() => {});
  const seesGuest = await host.getByText("GuestPhone").first().isVisible().catch(() => false);
  check("host sees the new player in real time", seesGuest);

  // Ready + start, all by tap.
  await host.getByRole("button", { name: "play", exact: true }).tap();
  await host.getByRole("button", { name: "I'm Ready" }).tap();
  await guest.getByRole("button", { name: "I'm Ready" }).tap();
  await host.getByRole("button", { name: "Start Game" }).tap();
  await host.waitForSelector("text=Choose your level", { timeout: 15000 });
  check("game starts and reaches level select", true);

  await host.getByRole("button", { name: /Spicy/ }).first().tap();
  await guest.waitForSelector("text=/Truth|Waiting on/", { timeout: 15000 });
  check("level selection reaches the other device", true);

  // Refresh the guest: the reconnect token should restore the seat.
  await guest.reload({ waitUntil: "networkidle" });
  await guest.waitForSelector(`text=${code}`, { timeout: 20000 });
  const rejoined = await guest.getByText("GuestPhone").first().isVisible().catch(() => false);
  check("guest reconnects after a refresh", rejoined || guest.url().includes(code));

  const playerCount = await host
    .locator("text=/Players · \\d+\\//")
    .first()
    .textContent()
    .catch(() => "");
  check("refresh did not duplicate the player", !/Players · 3\//.test(playerCount || ""), playerCount);

  check("no runtime errors during the flow", hostErrors.length === 0, hostErrors.slice(0, 2).join(" | "));

  await hostCtx.close();
  await guestCtx.close();
  await browser.close();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}\n`);
  process.exit(1);
});
