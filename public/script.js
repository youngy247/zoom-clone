const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001',
});
const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};
let isRinging = false; // Flag to track if the user is ringing

// Hide the video grid initially
videoGrid.style.display = 'none';

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    addVideoStream(myVideo, stream);

    myPeer.on('call', (call) => {
      call.answer(stream);
      const video = document.createElement('video');
      call.on('stream', (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });

    socket.on('user-connected', (userId) => {
      if (isRinging) {
        // Ignore incoming calls if ringing
        return;
      }
      connectToNewUser(userId, stream);
    });

    socket.on('user-disconnected', (userId) => {
      if (peers[userId]) {
        const { call, videoElement } = peers[userId];
        if (videoElement) {
          videoElement.remove();
        }
        if (call) {
          call.close();
        }
        delete peers[userId];
      }
    })
    .catch((error) => {
      console.error('Error accessing media devices:', error);
      // Display an error message to the user
      alert('Error accessing camera and microphone. Please grant permission to join the call.');
    });

    socket.on('user-call-request', (userId) => {
        // Display a notification or alert to the admin about the incoming call request
        alert('Incoming call request from user:', userId);
      });
      

    socket.on('room-unavailable', () => {
      // Handle room unavailable scenario (display message or redirect)
      console.log('Room is unavailable at the moment.');
    });

    socket.on('call-accepted', () => {
      const ringButton = document.getElementById('ring-button');
      ringButton.style.display = 'none'; // Hide the ring button
      videoGrid.style.display = 'grid'; // Show the video grid
    });

    socket.on('availability-updated', (availability) => {
      const ringButton = document.getElementById('ring-button');
      ringButton.disabled = !availability; // Disable the ring button based on availability
    });
  });

myPeer.on('open', (id) => {
  socket.emit('join-room', ROOM_ID, id);
});

function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    const videoPreview = document.createElement('video');
    videoPreview.muted = true;
  
    call.on('stream', (userVideoStream) => {
      addVideoStream(video, userVideoStream);
      videoPreview.remove(); // Remove the video preview once the user's video stream is received
    });
  
    addVideoStream(videoPreview, stream);

  call.on('close', () => {
    video.remove();
    delete peers[userId];
  });

  peers[userId] = {
    call,
    videoElement: video,
  };

  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.append(video);
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.append(video);
}

function ring() {
  isRinging = true;
  const ringButton = document.getElementById('ring-button');
  ringButton.disabled = true; // Disable the ring button after clicking

  // Add animation or any visual indication of the ringing state
  ringButton.innerText = 'Ringing...';

  socket.emit('availability-change', true);
}

function acceptCall() {
  const ringButton = document.getElementById('ring-button');
  ringButton.style.display = 'none'; // Hide the ring button
  videoGrid.style.display = 'grid'; // Show the video grid

  socket.emit('accept-call');
}

function endCall() {
  myVideo.srcObject.getTracks().forEach((track) => track.stop());
  Object.values(peers).forEach((peer) => {
    peer.call.close();
    if (peer.videoElement) {
      peer.videoElement.remove();
    }
  });
  videoGrid.innerHTML = '';
  socket.emit('end-call');
}
