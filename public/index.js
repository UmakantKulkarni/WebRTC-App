
const server_url = document.URL
console.log("server_url ", server_url);

var mediaRecorder;
var recordedBlobs;
var sourceBuffer;
var recordButton = document.querySelector('button#record');
var playButton = document.querySelector('button#play');
var downloadButton = document.querySelector('button#download');
var gumVideo = document.querySelector('video#localVideo');
var recordedVideo = document.querySelector('video#remoteVideo');
recordButton.onclick = toggleRecording;
playButton.onclick = play;
downloadButton.onclick = download;


// Creating the peer
const peer = new RTCPeerConnection({
  iceServers: [
    {
      urls: "stun:stun.stunprotocol.org",
    },
  ],
});

// Connecting to socket
const socket = io(server_url);

const onSocketConnected = async () => {
  //var mediaSource = new MediaSource();
  //mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
  const constraints = {
    audio: true,
    video: true,
  };
  //navigator.mediaDevices.getUserMedia(constraints).then(successCallback,errorCallback);
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  var vidTrack = stream.getVideoTracks();
  vidTrack.forEach((track) => (track.enabled = false));
  var audioTrack = stream.getAudioTracks();
  audioTrack.forEach((track) => (track.enabled = false));
  document.querySelector("#localVideo").srcObject = stream;
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  successCallback(stream);
};

let callButton = document.querySelector("#call");
let shareButton = document.querySelector("#share");
let cameraButton = document.querySelector("#cam");
let micButton = document.querySelector("#mic");

shareButton.addEventListener("click", async () => {
  const constraints = {
    audio: true,
    video: true,
  };
  const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
  document.querySelector("#localVideo").srcObject = stream;

  peer.getSenders().forEach(async (s) => {
    if (s.track && s.track.kind === "video")
      await s.replaceTrack(stream.getTracks()[0]);
  });
});

cameraButton.addEventListener("click", async () => {
  const constraints = {
    audio: true,
    video: true,
  };

  if (cameraButton.textContent == "Camera On") {
    peer.getSenders().forEach((s) => {
      if (s.track && s.track.kind === "video") s.track.enabled = true;
    });
    cameraButton.textContent = "Camera Off";
  } else {
    peer.getSenders().forEach((s) => {
      if (s.track && s.track.kind === "video") s.track.enabled = false;
    });
    cameraButton.textContent = "Camera On";
  }
});

micButton.addEventListener("click", async () => {
  const constraints = {
    audio: true,
    video: true,
  };

  if (micButton.textContent == "Mic On") {
    peer.getSenders().forEach((s) => {
      if (s.track && s.track.kind === "audio") s.track.enabled = true;
    });
    micButton.textContent = "Mic Off";
  } else {
    peer.getSenders().forEach((s) => {
      if (s.track && s.track.kind === "audio") s.track.enabled = false;
    });
    micButton.textContent = "Mic On";
  }
});

// Handle call button
callButton.addEventListener("click", async () => {
  const localPeerOffer = await peer.createOffer();
  await peer.setLocalDescription(new RTCSessionDescription(localPeerOffer));

  sendMediaOffer(localPeerOffer);
});

// Create media offer
socket.on("mediaOffer", async (data) => {
  await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
  const peerAnswer = await peer.createAnswer();
  await peer.setLocalDescription(new RTCSessionDescription(peerAnswer));

  sendMediaAnswer(peerAnswer, data);
});

// Create media answer
socket.on("mediaAnswer", async (data) => {
  await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
});

// ICE layer
peer.onicecandidate = (event) => {
  sendIceCandidate(event);
};

socket.on("remotePeerIceCandidate", async (data) => {
  try {
    const candidate = new RTCIceCandidate(data.candidate);
    await peer.addIceCandidate(candidate);
  } catch (error) {
    // Handle error, this will be rejected very often
  }
});

peer.addEventListener("track", (event) => {
  const [stream] = event.streams;
  document.querySelector("#remoteVideo").srcObject = stream;
});

let selectedUser;

const sendMediaAnswer = (peerAnswer, data) => {
  socket.emit("mediaAnswer", {
    answer: peerAnswer,
    from: socket.id,
    to: data.from,
  });
};

const sendMediaOffer = (localPeerOffer) => {
  socket.emit("mediaOffer", {
    offer: localPeerOffer,
    from: socket.id,
    to: selectedUser,
  });
};

const sendIceCandidate = (event) => {
  socket.emit("iceCandidate", {
    to: selectedUser,
    candidate: event.candidate,
  });
};

const onUpdateUserList = ({ userIds }) => {
  const usersList = document.querySelector("#usersList");
  const usersToDisplay = userIds.filter((id) => id !== socket.id);

  usersList.innerHTML = "";

  usersToDisplay.forEach((user) => {
    const userItem = document.createElement("div");
    userItem.innerHTML = user;
    userItem.className = "user-item";
    userItem.addEventListener("click", () => {
      const userElements = document.querySelectorAll(".user-item");
      userElements.forEach((element) => {
        element.classList.remove("user-item--touched");
      });
      userItem.classList.add("user-item--touched");
      selectedUser = user;
    });
    usersList.appendChild(userItem);
  });
};
socket.on("update-user-list", onUpdateUserList);

const handleSocketConnected = async () => {
  onSocketConnected();
  socket.emit("requestUserList");
};

socket.on("connect", handleSocketConnected);

function successCallback(stream) {
  console.log('getUserMedia() got stream: ', stream);
  window.stream = stream;
  gumVideo.srcObject = stream;
}

function errorCallback(error) {
  console.log('navigator.getUserMedia error: ', error);
}

function handleSourceOpen(event) {
  console.log('MediaSource opened');
  //sourceBuffer = mediaSource.addSourceBuffer('video/webm;codecs=vp8');
  console.log('Source buffer: ', sourceBuffer);
}

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function handleStop(event) {
  console.log('Recorder stopped: ', event);
  console.log('Recorded Blobs: ', recordedBlobs);
}

function toggleRecording() {
  if (recordButton.textContent === 'Start Recording') {
    startRecording();
  } else {
    stopRecording();
    recordButton.textContent = 'Start Recording';
    playButton.disabled = false;
    downloadButton.disabled = false;
  }
}

// The nested try blocks will be simplified when Chrome 47 moves to Stable
function startRecording() {
  var options = {mimeType: 'video/webm;codecs=opus,vp9', bitsPerSecond: 100000};
  recordedBlobs = [];
  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e0) {
    console.log('Unable to create MediaRecorder with options Object: ', options, e0);
    try {
      options = {mimeType: 'video/webm;codecs=opus,vp8'};
      mediaRecorder = new MediaRecorder(window.stream, options);
    } catch (e1) {
      console.log('Unable to create MediaRecorder with options Object: ', options, e1);
      try {
        mediaRecorder = new MediaRecorder(window.stream);
      } catch (e2) {
        alert('MediaRecorder is not supported by this browser.');
        console.log('Unable to create MediaRecorder', e2);
        return;
      }
    }
  }
  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';
  playButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(5); // collect 1ms of data
  console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
  mediaRecorder.stop();
  recordedVideo.controls = false;
}

function play() {
  var type = (recordedBlobs[0] || {}).type;
  var superBuffer = new Blob(recordedBlobs, {type});
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
}

function download() {
  var blob = new Blob(recordedBlobs, {type: 'video/webm'});
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'test.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}


