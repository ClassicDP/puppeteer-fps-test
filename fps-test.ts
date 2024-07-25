import puppeteer, { Browser, Page } from 'puppeteer';
import WebSocket from 'ws';
import fs from 'fs';

const width = 96;
const height = 32;
const duration = 1000; // Продолжительность теста в миллисекундах

async function setupPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    await page.setContent(`
        <canvas id="canvas" width="${width}" height="${height}" style="background-color: white;"></canvas>
        <script>
            const canvas = document.getElementById('canvas') as HTMLCanvasElement;
            const context = canvas.getContext('2d');
            let frameCount = 0;

            function updateCanvas() {
                if (!context) return;
                const now = new Date();
                const timeString = now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds();

                context.clearRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = 'white';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = 'black';
                context.font = '10px monospace';
                context.fillText(timeString, 10, 20);

                console.log('Rendered:', timeString); // Логирование времени

                frameCount++;
                requestAnimationFrame(updateCanvas);
            }

            updateCanvas();

            setInterval(() => {
                (window as any).frameCount = frameCount;
                frameCount = 0;
            }, 1000);
        </script>
    `);

    await page.waitForSelector('#canvas');

    return page;
}

async function measureRenderFPS(page: Page, duration: number): Promise<number> {
    let totalRenders = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
        try {
            const bitmap = await page.evaluate(() => {
                const canvas = document.getElementById('canvas') as HTMLCanvasElement;
                if (!canvas) return null;
                return canvas.toDataURL('image/png');
            });

            if (bitmap) {
                const buffer = Buffer.from(bitmap.split(',')[1], 'base64');
                totalRenders++;

                if (totalRenders === 1) {
                    fs.writeFileSync('bitmap1.png', buffer);
                    console.log('Saved bitmap1.png');
                } else if (totalRenders === 10) {
                    fs.writeFileSync('bitmap10.png', buffer);
                    console.log('Saved bitmap10.png');
                    break;
                }
            }
        } catch (error) {
            console.error('Render error:', error);
            break;
        }
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const fps = totalRenders / elapsedSeconds;

    return fps;
}

async function main() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await setupPage(browser);

    const wsServer = new WebSocket.Server({ port: 8080 });
    wsServer.on('connection', (ws) => {
        console.log('WebSocket client connected');

        const sendFrame = async () => {
            const bitmap = await page.evaluate(() => {
                const canvas = document.getElementById('canvas') as HTMLCanvasElement;
                if (!canvas) return null;
                return canvas.toDataURL('image/png');
            });

            if (bitmap) {
                const buffer = Buffer.from(bitmap.split(',')[1], 'base64');
                ws.send(buffer);
            }
        };

        const sendFrames = setInterval(sendFrame, 1000 / 30); // 30 FPS

        ws.on('close', () => {
            clearInterval(sendFrames);
            console.log('WebSocket client disconnected');
        });
    });

    console.log('WebSocket server started on ws://localhost:8080');

    // Измерение FPS и сохранение первого и десятого скриншотов
    const fps = await measureRenderFPS(page, duration);
    console.log(`Render FPS for ${width}x${height} matrix: ${fps.toFixed(2)}`);

    await browser.close();
}

main();
