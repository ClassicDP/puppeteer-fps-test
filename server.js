import { webkit } from 'playwright';
import fs from 'fs';
import http from 'http';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import WebSocket, { WebSocketServer } from 'ws';
import * as os from 'node:os';

const getStockData = async () => {
    try {
        const response = await fetch('https://www.cbr.ru/scripts/XML_daily.asp');
        const text = await response.text();
        const $ = cheerio.load(text);

        const getValue = (charCode) => {
            const element = $('Valute').filter((i, el) => $(el).find('CharCode').text() === charCode);
            return element.find('Value').text();
        };

        const usdRate = getValue('USD');
        const cnyRate = getValue('CNY');

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
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end(JSON.stringify(stockData));
    } else {
        res.writeHead(404, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
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
    if (screenshotTimes.length > 0 && sendTimes.length > 0) {
        const averageScreenshotTime = screenshotTimes.reduce((a, b) => a + b, 0) / screenshotTimes.length;
        const averageSendTime = sendTimes.reduce((a, b) => a + b, 0) / sendTimes.length;
        console.log(`Average Screenshot Time: ${averageScreenshotTime.toFixed(2)}ms`);
        console.log(`Screenshot Count per sec: ${screenshotTimes.length}`);
        console.log(`Average Send Time: ${averageSendTime.toFixed(2)}ms`);
        console.log(`Send Count to free WebSocket per sec: ${sendCountPerSec}`);
        screenshotTimes = [];
        sendTimes = [];
        sendCountPerSec = 0;
        // Получение общей памяти системы в байтах
        const totalMemory = os.totalmem();

        // Получение свободной памяти системы в байтах
        const freeMemory = os.freemem();

        // Вывод информации в консоль
        console.log(`Общая память: ${totalMemory} байт`);
        console.log(`Свободная память: ${freeMemory} байт`);
    }
}

setInterval(logAverageTimes, 1000);

// Function to check if WebSocket buffer is empty
function isWebSocketBufferEmpty(ws) {
    return ws.bufferedAmount === 0;
}

// Function to capture screenshot and send to WebSocket clients
async function captureAndSendScreenshot() {
    try {
        const startScreenshot = Date.now();
        const elementHandle = await page.$('#container');
        const boundingBox = await elementHandle.boundingBox();
        const screenshotBuffer = await page.screenshot({
            encoding: 'base64',
            clip: boundingBox,
            timeout: 30000, // Increase timeout if needed
        });
        const endScreenshot = Date.now();
        screenshotTimes.push(endScreenshot - startScreenshot);

        const imageBuffer = Buffer.from(screenshotBuffer, 'base64');
        const startSend = Date.now();
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && isWebSocketBufferEmpty(client)) {
                client.send(imageBuffer);
                sendCountPerSec++;
            }
        });
        const endSend = Date.now();
        sendTimes.push(endSend - startSend);

        // Schedule the next screenshot
        setTimeout(captureAndSendScreenshot, 0); // Capture as fast as possible
    } catch (error) {
        console.error('Error capturing screenshot:', error);
    }
}


// Launch Playwright and start screenshot loop
let page;
(async () => {
    const browser = await webkit.launch();
    page = await browser.newPage();
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 1000 });
    await page.setViewportSize({ width: 96, height: 32 });

    captureAndSendScreenshot(); // Start the screenshot loop

    process.on('exit', async () => {
        await browser.close();
    });
})();

server.listen(8081, () => {
    console.log('WebSocket server running on port 8081');
});
