const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--single-process'
        ]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 96, height: 32 });
    await page.goto(`file://${__dirname}/index.html`, { waitUntil: 'networkidle2' });

    let frameCount = 0;
    let firstScreenshotSaved = false;
    let secondScreenshotSaved = false;
    let startTime = Date.now();

    async function captureScreenshot() {
        const screenshotBuffer = await page.screenshot({ encoding: 'binary' });

        frameCount++;

        if (frameCount === 1 && !firstScreenshotSaved) {
            fs.writeFileSync('screenshot1.png', screenshotBuffer);
            firstScreenshotSaved = true;
        } else if (frameCount === 2 && !secondScreenshotSaved) {
            fs.writeFileSync('screenshot2.png', screenshotBuffer);
            secondScreenshotSaved = true;
        }

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        if (elapsedSeconds >= 1) {
            const fps = frameCount / elapsedSeconds;
            console.log(`FPS: ${fps.toFixed(2)}`);
            frameCount = 0;
            startTime = Date.now();
        }

        setTimeout(captureScreenshot, 0); // Schedule next screenshot as soon as possible
    }

    captureScreenshot();

    process.on('exit', async () => {
        await browser.close();
    });
})();
