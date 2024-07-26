const { webkit } = require('playwright');
const fs = require('fs');
const http = require('http');
const { JSDOM } = require('jsdom');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const getStockData = async () => {
    try {
        const response = await fetch('https://www.cbr.ru/scripts/XML_daily.asp');
        const text = await response.text();
        const dom = new JSDOM(text);

        const getValue = (charCode) => {
            const element = Array.from(dom.window.document.getElementsByTagName("Valute"))
                .find(node => node.getElementsByTagName("CharCode")[0].textContent === charCode);
            return element ? element.getElementsByTagName("Value")[0].textContent : null;
        };

        const usdRate = getValue("USD");
        const cnyRate = getValue("CNY");

        return { usdRate, cnyRate };
    } catch (error) {
        console.error('Error fetching stock data:', error);
        return null;
    }
};

http.createServer(async (req, res) => {
    if (req.url === '/stock') {
        const stockData = await getStockData();
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Разрешить все источники
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', // Разрешить методы
            'Access-Control-Allow-Headers': 'Content-Type' // Разрешить заголовки
        });
        res.end(JSON.stringify(stockData));
    } else {
        res.writeHead(404, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*' // Разрешить все источники
        });
        res.end('Not Found');
    }
}).listen(8080, () => {
    console.log('Proxy server running on port 8080');
});

(async () => {
    const browser = await webkit.launch();
    const page = await browser.newPage();

    const htmlContent = fs.readFileSync('index.html', 'utf8');

    await page.setContent(htmlContent);
    await page.setViewportSize({ width: 96, height: 32 });

    let frameCount = 0;
    let firstScreenshotSaved = false;
    let tenthScreenshotSaved = false;
    let startTime = Date.now();

    async function captureScreenshot() {
        frameCount++;

        const elementHandle = await page.$('#container');
        const boundingBox = await elementHandle.boundingBox();

        const screenshotBuffer = await page.screenshot({
            encoding: 'binary',
            clip: boundingBox
        });

        if (frameCount === 1 && !firstScreenshotSaved) {
            fs.writeFileSync('screenshot1.png', screenshotBuffer);

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
