import { webkit } from 'playwright';
import fs from 'fs';
import http from 'http';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import WebSocket, { WebSocketServer } from 'ws';

const getStockData = async () => {
    try {
        const response = await fetch('https://www.cbr.ru/scripts/XML_daily.asp');
        const text = await response.text();
        const $ = cheerio.load(text);

        const getValue = (charCode) => {
            const element = $('Valute').filter((i, el) => $(el).find('CharCode').text() === charCode);
            return element.find('Value').text();
        };

        const usdRate = getValue("USD");
        const cnyRate = getValue("CNY");

        return { usdRate, cnyRate };
    } catch (error) {
        console.error('Error fetching stock data:', error);
        return null;
    }
};

// Create HTTP server for stock data proxy
const proxyServer = http.createServer(async (req, res) => {
    if (req.url === '/stock') {
        const stockData = await getStockData();
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(stockData));
    } else {
        res.writeHead(404, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
        });
        res.end('Not Found');
    }
}).listen(8080, () => {
    console.log('Proxy server running on port 8080');
});

// Create WebSocket server
const server = http.createServer();
const wss = new WebSocketServer({ server });
let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);
    ws.on('close', () => {
        clients = clients.filter((client) => client !== ws);
    });
});

// Launch Playwright and capture screenshots
(async () => {
    const browser = await webkit.launch();
    const page = await browser.newPage();
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    await page.setContent(htmlContent);
    await page.setViewportSize({ width: 96, height: 32 });

    async function captureScreenshot() {
        const elementHandle = await page.$('#container');
        const boundingBox = await elementHandle.boundingBox();
        const screenshotBuffer = await page.screenshot({
            encoding: 'base64',
            clip: boundingBox
        });

        const imageBuffer = Buffer.from(screenshotBuffer, 'base64');

        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(imageBuffer);
            }
        });

        setTimeout(captureScreenshot, 33); // Capture at ~30fps
    }

    captureScreenshot();

    process.on('exit', async () => {
        await browser.close();
    });
})();

server.listen(8081, () => {
    console.log('WebSocket server running on port 8081');
});
