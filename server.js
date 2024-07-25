const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    let imageIndex = 1;

    ws.on('message', (message) => {
        if (Buffer.isBuffer(message)) {
            const messageString = message.toString();
            if (messageString.startsWith('FPS:')) {
                console.log(messageString); // Выводим FPS в лог
            } else {
                try {
                    const buffer = Buffer.from(message);
                    if (imageIndex === 1 || imageIndex === 100) {
                        const filename = `screenshot${imageIndex}.png`;
                        fs.writeFileSync(path.join(__dirname, filename), buffer);
                        console.log(`Saved ${filename}`);
                    }
                    imageIndex++;
                } catch (error) {
                    console.error('Failed to process message:', error);
                }
            }
        } else {
            console.log('Received unknown data type');
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

console.log('WebSocket server started on ws://localhost:8080');
