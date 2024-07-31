import { webkit } from 'playwright';
import fs from 'fs';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

// WebSocket server setup
const server = http.createServer();
const wss = new WebSocketServer({ server });
let clients = [];
let timeStamp;

wss.on('connection', (ws) => {
    clients.push(ws);
    console.log('Client connected');

    ws.on('close', () => {
        clients = clients.filter((client) => client !== ws);
    });

    ws.on('message', async (message) => {
        let msg = JSON.parse(message);
        timeStamp = msg.timeStamp;

        if (timeStamp) {
            await captureAndSendScreenshot();
            ws.send('screenshot_done');  // Send confirmation back to client
        }
    });
});

let page;
(async () => {
    const browser = await webkit.launch();
    page = await browser.newPage();
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    await page.setContent(htmlContent, { waitUntil: 'load' });
    await page.setViewportSize({ width: 96, height: 32 });

    process.on('exit', async () => {
        await browser.close();
    });
})();

async function captureAndSendScreenshot() {
    try {
        const elementHandle = await page.waitForSelector('#container');
        const boundingBox = await elementHandle.boundingBox();
        const screenshotBuffer = await page.screenshot({
            encoding: 'base64',
            clip: boundingBox,
            timeout: 30
        });

        const imageBuffer = Buffer.from(screenshotBuffer, 'base64');
        const frame = {
            timeStamp: timeStamp,
            imageBuffer: imageBuffer.toString('base64')
        };
        const frameString = JSON.stringify(frame);

        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(frameString);
            }
        });
    } catch (error) {
        console.error(`Error capturing screenshot: ${timeStamp}`, error);
    }
}

server.listen(8081, () => {
    console.log('WebSocket server running on port 8081');
});
