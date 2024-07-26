const { webkit } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await webkit.launch();
    const page = await browser.newPage();

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HTML to PNG</title>
        <style>
            body {
                margin: 0;
                overflow: hidden;
                background-color: black;
                color: white;
                font-size: 24px;
                font-family: monospace;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                text-align: center;
            }
            .rainbow-text {
                background-image: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);
                -webkit-background-clip: text;
                color: transparent;
                animation: rainbow-animation 1s linear infinite;
            }
            @keyframes rainbow-animation {
                0% {
                    background-position: 0% 50%;
                }
                100% {
                    background-position: 100% 50%;
                }
            }
        </style>
    </head>
    <body>
        <div class="rainbow-text" id="time"></div>
        <script>
            function updateTime() {
                const now = new Date();
                const timeString = now.toLocaleTimeString() + '.' + now.getMilliseconds();
                document.getElementById('time').innerText = timeString;
                requestAnimationFrame(updateTime);
            }
            updateTime();
        </script>
    </body>
    </html>`;

    await page.setContent(htmlContent);
    await page.setViewportSize({ width: 800, height: 600 });

    let frameCount = 0;
    let firstScreenshotSaved = false;
    let tenthScreenshotSaved = false;
    let startTime = Date.now();

    async function captureScreenshot() {
        frameCount++;

        // Get the bounding box of the element to be captured
        const elementHandle = await page.$('#time');
        const boundingBox = await elementHandle.boundingBox();

        const screenshotBuffer = await page.screenshot({
            encoding: 'binary',
            clip: boundingBox // Only capture the bounding box area
        });

        if (frameCount === 1 && !firstScreenshotSaved) {
            fs.writeFileSync('screenshot1.png', screenshotBuffer);
            firstScreenshotSaved = true;
        } else if (frameCount === 10 && !tenthScreenshotSaved) {
            fs.writeFileSync('screenshot10.png', screenshotBuffer);
            tenthScreenshotSaved = true;
        }

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        if (elapsedSeconds >= 1) {
            const fps = frameCount / elapsedSeconds;
            console.log(`FPS: ${fps.toFixed(2)}`);
            frameCount = 0;
            startTime = Date.now();
        }

        setTimeout(captureScreenshot, 0); // Schedule next screenshot capture
    }

    captureScreenshot();

    process.on('exit', async () => {
        await browser.close();
    });
})();
