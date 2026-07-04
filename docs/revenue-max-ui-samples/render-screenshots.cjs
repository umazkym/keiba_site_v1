const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..');
const outputDir = path.join(root, 'output', 'playwright');

const pages = [
  {
    name: 'home-desktop',
    html: path.join(__dirname, 'home-revenue-sample.html'),
    output: path.join(outputDir, 'uma-free-home-desktop-sample.png'),
    viewport: { width: 1440, height: 1600, deviceScaleFactor: 1, isMobile: false },
  },
  {
    name: 'home-mobile',
    html: path.join(__dirname, 'home-revenue-sample.html'),
    output: path.join(outputDir, 'uma-free-home-mobile-sample.png'),
    viewport: { width: 390, height: 1600, deviceScaleFactor: 1, isMobile: true },
  },
  {
    name: 'race-desktop',
    html: path.join(__dirname, 'race-revenue-sample.html'),
    output: path.join(outputDir, 'uma-free-race-desktop-sample.png'),
    viewport: { width: 1280, height: 1600, deviceScaleFactor: 1, isMobile: false },
  },
  {
    name: 'race-mobile',
    html: path.join(__dirname, 'race-revenue-sample.html'),
    output: path.join(outputDir, 'uma-free-race-mobile-sample.png'),
    viewport: { width: 390, height: 1700, deviceScaleFactor: 1, isMobile: true },
  },
];

function toFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, '/')}`;
}

(async () => {
  const executableCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--disable-gpu', '--no-sandbox'],
  });
  try {
    for (const pageSpec of pages) {
      const context = await browser.newContext({
        viewport: {
          width: pageSpec.viewport.width,
          height: pageSpec.viewport.height,
        },
        deviceScaleFactor: pageSpec.viewport.deviceScaleFactor,
        isMobile: pageSpec.viewport.isMobile,
      });
      const page = await context.newPage();
      await page.goto(toFileUrl(pageSpec.html), { waitUntil: 'load' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: pageSpec.output, fullPage: true });
      await context.close();
      console.log(`${pageSpec.name}: ${pageSpec.output}`);
    }
  } finally {
    await browser.close();
  }
})();
