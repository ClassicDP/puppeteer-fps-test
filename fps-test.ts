import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';

const NUM_FRAMES = 50;  // Увеличим количество кадров
const FRAME_HEIGHT = 16;

async function setupPage(browser: Browser, width: number, height: number): Promise<Page> {
    const page = await browser.newPage();
    await page.setViewport({ width, height: height * NUM_FRAMES, deviceScaleFactor: 1 });

    await page.setRequestInterception(true);
    page.on('request', request => {
        if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
            request.abort();
        } else {
            request.continue();
        }
    });

    let frameDivs = '';
    for (let i = 0; i < NUM_FRAMES; i++) {
        frameDivs += `
            <div class="frame" style="width: ${width}px; height: ${FRAME_HEIGHT}px; display: flex; flex-direction: column; justify-content: center; align-items: center; border-bottom: 1px solid #ccc;">
                <p class="time" style="margin: 0; padding: 0;"></p>
                <p class="date" style="margin: 0; padding: 0;"></p>
            </div>
        `;
    }

    await page.setContent(`
        <div id="content" style="width: ${width}px; height: ${height * NUM_FRAMES}px; font-size: 8px; background-color: white; color: black; font-family: monospace;">
            ${frameDivs}
        </div>
        <script>
            const frames = document.querySelectorAll('.frame');
            let frameIndex = 0;

            function updateFrames() {
                const now = new Date();
                frames[frameIndex].querySelector('.time').innerText = now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds();
                frames[frameIndex].querySelector('.date').innerText = now.toDateString();
                frameIndex = (frameIndex + 1) % frames.length;
                requestAnimationFrame(updateFrames);
            }
            updateFrames();
        </script>
    `);

    await page.waitForSelector('.time');

    return page;
}

async function measureScreenshotFPS(page: Page, duration: number): Promise<number> {
    let totalScreenshots = 0;
    let firstScreenshotSaved = false;
    let secondScreenshotSaved = false;
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
        try {
            const screenshotBuffer = await page.screenshot({ encoding: 'binary' });  // Снимаем скриншот
            totalScreenshots++;

            // Сохраняем первые два скриншота
            if (!firstScreenshotSaved) {
                fs.writeFileSync('screenshot1.png', screenshotBuffer);
                firstScreenshotSaved = true;
            } else if (!secondScreenshotSaved) {
                fs.writeFileSync('screenshot2.png', screenshotBuffer);
                secondScreenshotSaved = true;
            }
        } catch (error) {
            console.error('Screenshot error:', error);
            break;
        }
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const fps = totalScreenshots / elapsedSeconds;

    return fps;
}

(async () => {
    const width = 96;
    const height = FRAME_HEIGHT;
    const duration = 1000; // Продолжительность теста в миллисекундах (1 секунда)

    const browser = await puppeteer.launch({ headless: true });
    const page = await setupPage(browser, width, height);

    const fps = await measureScreenshotFPS(page, duration);
    console.log(`Screenshot FPS for ${width}x${FRAME_HEIGHT * NUM_FRAMES} matrix: ${fps.toFixed(2)}`);

    await browser.close();
})();
