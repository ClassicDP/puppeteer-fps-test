import { webkit } from 'playwright';
import fs from 'fs';
import http from 'http';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import WebSocket, { WebSocketServer } from 'ws';
import * as os from 'node:os';

const getStockData = async () => {
    // (Your existing code to fetch stock data)
};

const proxyServer = http.createServer(async (req, res) => {
    // (Your existing code to handle stock data proxy)
}).listen(8080, () => {
    console.log('Proxy server running on port 8080');
});

const server = http.createServer();
const wss = new WebSocketServer({ server });
let clients = [];

let screenshotTimes = [];
let sendTimes = [];
let sendCountPerSec = 0;

wss.on('connection', (ws) => {
    clients.push(ws);
    ws.on('close', () => {
        clients = clients.filter((client) => client !== ws);
    });
});

function logAverageTimes() {
    // (Your existing code to log average times)
}

setInterval(logAverageTimes, 1000);

async function captureAndSendScreenshot() {
    try {
        const startScreenshot = Date.now();
        const elementHandle = await page.$('#container');
        const boundingBox = await elementHandle.boundingBox();
        const screenshotBuffer = await page.screenshot({
            encoding: 'base64',
            clip: boundingBox,
            timeout: 30000
        });
        const endScreenshot = Date.now();
        screenshotTimes.push(endScreenshot - startScreenshot);

        const imageBuffer = Buffer.from(screenshotBuffer, 'base64');
        const frame = {
            timestamp: Date.now(),
            imageBuffer: imageBuffer.toString('base64')
        };
        const frameString = JSON.stringify(frame);

        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(frameString);
                sendCountPerSec++;
            }
        });
    } catch (error) {
        console.error('Error capturing screenshot:', error);
    }
}

let page;
(async () => {
    const browser = await webkit.launch();
    page = await browser.newPage();
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 1000 });
    await page.setViewportSize({ width: 96, height: 32 });

    setInterval(captureAndSendScreenshot, 1000 / 30);

    process.on('exit', async () => {
        await browser.close();
    });
})();

server.listen(8081, () => {
    console.log('WebSocket server running on port 8081');
});
