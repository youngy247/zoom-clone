const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const myPeer = new Peer(undefined, {
    host: '/',
    port: '3001'
})
const myVideo = document.createElement('video')
myVideo.muted = true
const peers = {}
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    addVideoStream(myVideo, stream)

    myPeer.on('call', call => {
        call.answer(stream)
        const video = document.createElement('video')
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream)
        })
    })

    socket.on('user-connected', userId => {
        connectToNewUser(userId, stream)
    })
})

socket.on('user-disconnected', userId => {
    if (peers[userId]) {
      peers[userId].close();
      if (peers[userId].videoElement) {
        peers[userId].videoElement.remove();
      }
      delete peers[userId];
    }
  });
  

myPeer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
  
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream);
    });
  
    call.on('close', () => {
      video.remove();
    });

    video.srcObject = stream;
  
    peers[userId] = {
      call,
      videoElement: video
    };
  }
  

function addVideoStream(video, stream) {
    video.srcObject = stream
    video.addEventListener('loadedmetadata', () => {
        video.play()
    })
    videoGrid.append(video)
}

function ring() {
    socket.emit('availability-change', true); // Notify that user wants to initiate a call
    // Add Additional logic here
}

socket.on('availability-updated', (isAvailable) => {
    const ringButton = document.getElementById('ring-button');
    ringButton.disabled = !isAvailable; // Enable/disable the button based on availability
});

function endCall() {
    myVideo.srcObject.getTracks().forEach(track => track.stop()); // Stop the local video stream
    Object.values(peers).forEach(peer => peer.call.close()); // Close all active calls with other users
    videoGrid.innerHTML = ''; // Clear the video grid
    // Additional cleanup or logic can be added here if needed
}
