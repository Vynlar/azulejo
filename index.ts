import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import sharp from 'sharp';

const app = express();
const PORT = 3000;

const NUM_TILES_WIDE = 3;
const NUM_TILES_HIGH = 3;

// Store tiles and results
type TileObject = {
    id: string
    buffer: Buffer;
    width: number
    height: number
};
let tiles: TileObject[] = [];

let finalImageBuffer: Buffer | null = null;
let tileWidth: number;
let tileHeight: number;

let tilesMap: { [key: string]: Buffer } = {};

// Serve static files
app.use(express.static('public'));

// Create an HTTP server instance for socket.io to bind to
const httpServer = http.createServer(app);

// Set up the socket.io server
const io = new Server(httpServer, {
    cors: {
        origin: '*',
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    let currentTile: TileObject | null = null;

    // Function to emit the current tiles count to all clients
    const updateTilesCount = () => {
        io.sockets.emit('tiles-update', { remaining: tiles.length });
    };

    const sendTileToSocket = (sock: Socket) => {
        const tileObject = tiles.pop();
        if (!tileObject) {
            return;
        }
        currentTile = tileObject;
        sock.emit('tile-response', {
            image: `data:image/png;base64,${tileObject.buffer.toString('base64')}`,
            id: tileObject.id,
            remaining: tiles.length,
            width: tileObject.width,
            height: tileObject.height
        });
        updateTilesCount()
    };

    async function stitchImages() {
        const finalImage = sharp({
            create: {
                width: tileWidth * NUM_TILES_WIDE, // width:
                height: tileHeight * NUM_TILES_HIGH, // height:
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        }).png();

        await finalImage.toFile('public/final.png');

        finalImage.composite(
            Object.entries(tilesMap).map(([tileId, tileBuffer]) => {
                const x = parseInt(tileId.split('-')[0])
                const y = parseInt(tileId.split('-')[1])
                return { input: tileBuffer, top: y, left: x, bottom: y + tileHeight, right: x + tileWidth }
            })
        );

        await finalImage.toFile('public/final2.png');

        finalImageBuffer = await finalImage.toBuffer();
        io.emit('stitched-update', { image: `data:image/png;base64,${finalImageBuffer.toString('base64')}` });
    }

    socket.on('upload', async (data) => {
        // reset things
        tiles = []
        tilesMap = {};

        const imgData = Buffer.from(data.image.split(',')[1], 'base64');

        const image = sharp(imgData).toFormat('png');
        const metadata = await image.metadata();
        if (metadata.width === undefined || metadata.height === undefined) {
            socket.emit('upload-response', { error: 'Invalid image' });
            return;
        }

        tileWidth = Math.floor(metadata.width / NUM_TILES_WIDE);
        tileHeight = Math.floor(metadata.height / NUM_TILES_HIGH);

        for (let y = 0; y < metadata.height; y += tileHeight) {
            for (let x = 0; x < metadata.width; x += tileWidth) {
                if (x + tileWidth > metadata.width || y + tileHeight > metadata.height) {
                    console.error('Skipping tile', x, y)
                    continue;
                }
                const tileBuffer = await sharp(imgData).extract({ left: x, top: y, width: tileWidth, height: tileHeight }).toBuffer();
                tiles.push({
                    buffer: tileBuffer,
                    id: `${x}-${y}`,
                    width: tileWidth,
                    height: tileHeight
                });
            }
        }

        console.log('split into', tiles.length, 'tiles')

        tiles = tiles.sort(() => Math.random() - 0.5);

        socket.emit('upload-response', { success: true });

        // Notify all waiting clients that tiles are available
        updateTilesCount();
        io.sockets.emit('check-for-tiles');
    });

    socket.on('get-tile', () => {
        sendTileToSocket(socket);
    });

    socket.on('submit', async (data) => {
        const imgData = Buffer.from(data.image.split(',')[1], 'base64');
        const tileId = data.tileId;

        if (tileId !== undefined) {
            tilesMap[tileId] = imgData;
            await stitchImages();
        }

        socket.emit('submit-response', { success: true });

        // Send the next tile after submission
        updateTilesCount();
        sendTileToSocket(socket);
    });

    socket.on('disconnect', () => {
        if (currentTile) {
            tiles.push(currentTile);
            currentTile = null;
            updateTilesCount();
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
