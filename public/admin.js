const socket = io('http://localhost:3000');

socket.on('stitched-update', (data) => {
  const stitchedImage = document.getElementById('stitched-image');
  console.log(data.image)
  stitchedImage.src = data.image;
});

socket.on('upload-response', (data) => {
  if (data.success) {
    alert('Image uploaded and tiles generated!');
  } else {
    alert('Failed to upload image: ' + (data.error || 'Unknown error'));
  }
});

function uploadImage() {
  console.log('uploading')
  const fileInput = document.getElementById('imageUpload');
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onloadend = function () {
    const imgData = reader.result;
    socket.emit('upload', { image: imgData });
  }

  reader.readAsDataURL(file);
}
