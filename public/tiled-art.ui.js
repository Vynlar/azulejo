const socket = io('http://localhost:3000');

const tileCanvas = document.getElementById('tileCanvas');
const tileCtx = tileCanvas.getContext('2d');
let tileId = null

const drawingCanvas = document.getElementById('drawingCanvas');
const drawingCtx = drawingCanvas.getContext('2d');

socket.on('connect', () => {
  console.log('Connected to the server');
  getTile();
});

socket.on('tile-response', (data) => {
  if (data.error) {
    alert('Failed to get tile: ' + data.error);
    return;
  }
  const img = new Image();
  img.onload = function () {
    tileCtx.drawImage(img, 0, 0);
  }
  img.src = data.image;
  tileId = data.id;
  tileCanvas.width = data.width;
  tileCanvas.height = data.height;
  drawingCanvas.width = data.width;
  drawingCanvas.height = data.height;
  updateRemaining(data.remaining);
});

socket.on('submit-response', (data) => {
  if (data.success) {
  } else {
    alert('Failed to submit tile: ' + (data.error || 'Unknown error'));
  }
});

socket.on('check-for-tiles', () => {
  getTile();
});

socket.on('tiles-update', (data) => {
  updateRemaining(data.remaining);
});

function updateRemaining(newRemaining) {
  document.getElementById('remaining-images').innerText = newRemaining;
}

function getTile() {
  socket.emit('get-tile');
}

function submitTile() {
  const imgData = drawingCanvas.toDataURL();
  // Clear the canvased
  tileCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  socket.emit('submit', { image: imgData, tileId });
}


// Drawing tools

let drawing = false;

drawingCanvas.addEventListener('mousedown', () => {
  drawing = true;
});

document.addEventListener('mouseup', () => {
  drawing = false;
  drawingCtx.beginPath();
});

drawingCanvas.addEventListener('mousemove', draw);

function draw(event) {
  if (!drawing) return;

  drawingCtx.lineWidth = brushSize; // Set the brush size
  drawingCtx.lineCap = 'round';
  drawingCtx.strokeStyle = brushColor; // Set the brush color

  drawingCtx.lineTo(event.clientX - drawingCanvas.offsetLeft, event.clientY - drawingCanvas.offsetTop);
  drawingCtx.stroke();
  drawingCtx.beginPath();
  drawingCtx.moveTo(event.clientX - drawingCanvas.offsetLeft, event.clientY - drawingCanvas.offsetTop);
}

// Configuration
const brushSize = 5; // Adjust this to change brush size
const brushColor = "black"; // Adjust this to change brush color
