const server_url = document.URL;
var server_host = window.location.protocol + "//" + window.location.host;
var server_path = window.location.pathname.split("/")[1];
console.log("server_url ", server_url);
console.log("server_host ", server_host);
console.log("server_path ", server_path);

var qs;
var mediaRecorder;
var recordedBlobs;
var sourceBuffer;
var recordButton = document.querySelector("button#record");
var playButton = document.querySelector("button#play");
var downloadButton = document.querySelector("button#download");
// Remove video references
// var myVideo = document.querySelector("video#localVideo");
// var recordedVideo = document.querySelector("video#remoteVideo");
recordButton.onclick = toggleRecording;
playButton.onclick = play;
downloadButton.onclick = download;

// Use audio-only constraints
const constraints = {
  audio: true,
  video: false // Explicitly set video to false
};

// Peer connection configuration
var ICE_config = {
  bundlePolicy: "max-compat",
  rtcpMuxPolicy: "require",
  iceServers: [
    {
      urls: "turn:10.0.0.3",
      username: "mininet",
      credential: "mininet",
    },
    {
      urls: "turn:192.168.6.23",
      username: "computer",
      credential: "computer",
    },
    {
      urls: "stun:stun.stunprotocol.org",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};
const peer = new RTCPeerConnection(ICE_config);

// Event handler for ICE connection state changes
peer.oniceconnectionstatechange = function() {
  console.log(`ICE Connection State has changed to: ${peer.iceConnectionState}`);
  switch (peer.iceConnectionState) {
    case 'disconnected':
    case 'failed':
      // Attempt to recover the connection
      console.log('Attempting to restart ICE');
      peer.restartIce();
      break;
  }
};

// Detecting significant packet loss or a failed connection
peer.onicecandidateerror = function(event) {
  console.error('ICE Candidate Error:', event);
  if (event.errorCode >= 300 && event.errorCode <= 699) {
    // Attempt to recover from certain errors
    console.log('Network error detected, restarting ICE');
    peer.restartIce();
  }
};

// Handle new ICE candidates
peer.onicecandidate = function(event) {
  if (event.candidate) {
    console.log('New ICE Candidate:', event.candidate);
  } else {
    // No more candidates will be found.
    console.log('All ICE candidates have been received.');
  }
};

// WebRTC stats collection
var stats_counter = 1;
var statsInterval = setInterval(function () {
  getConnectionStats(stats_counter);
  stats_counter++;
}, 1000);

// Connecting to socket
const socket = io(server_host);

const onSocketConnected = async () => {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  var audioTrack = stream.getAudioTracks();
  audioTrack.forEach((track) => (track.enabled = false));

  // Add only the audio track to the peer connection
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  successCallback(stream);
};

let callButton = document.querySelector("#call");
let micButton = document.querySelector("#mic");

micButton.addEventListener("click", async () => {
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
  
  // Filter out video codecs from the SDP
  let modifiedOffer = filterVideoCodecs(localPeerOffer.sdp);
  await peer.setLocalDescription(new RTCSessionDescription({
    type: 'offer',
    sdp: modifiedOffer
  }));

  sendMediaOffer(peer.localDescription);
});

// Create media offer
socket.on("mediaOffer", async (data) => {
  let offer_sdp = handle_sdp(data.offer);
  offer_sdp = filterVideoCodecs(offer_sdp); // Filter video codecs from the remote offer
  sdp = new RTCSessionDescription({
    type: "offer",
    sdp: offer_sdp,
  });
  await peer.setRemoteDescription(new RTCSessionDescription(sdp));
  const peerAnswer = await peer.createAnswer();

  let answer_sdp = handle_sdp(peerAnswer);
  answer_sdp = filterVideoCodecs(answer_sdp); // Filter video codecs from the answer
  sdp = new RTCSessionDescription({
    type: "answer",
    sdp: answer_sdp,
  });
  await peer.setLocalDescription(new RTCSessionDescription(sdp));

  sendMediaAnswer(sdp, data);
});

// Create media answer
socket.on("mediaAnswer", async (data) => {
  let answer_sdp = handle_sdp(data.answer);
  answer_sdp = filterVideoCodecs(answer_sdp); // Filter video codecs from the remote answer
  sdp = new RTCSessionDescription({
    type: "answer",
    sdp: answer_sdp,
  });
  await peer.setRemoteDescription(new RTCSessionDescription(sdp));
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

// Filter out video codecs from SDP to ensure only audio codecs are used
function filterVideoCodecs(sdp) {
  let sdpLines = sdp.split("\r\n");
  sdpLines = sdpLines.filter((line) => !line.includes("m=video") && !line.includes("VP8") && !line.includes("VP9") && !line.includes("H264"));
  return sdpLines.join("\r\n");
}

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
  console.log("getUserMedia() got stream: ", stream);
  localStorage.setItem("stream", JSON.stringify(stream));
  window.stream = stream;
}

function errorCallback(error) {
  console.log("navigator.getUserMedia error: ", error);
}

// Adjust SDP to handle only audio
function handle_sdp(oadata) {
  let sdp = oadata.sdp.split("\r\n");
  let new_sdp = "";
  let position = null;
  sdp = sdp.slice(0, -1);
  for (let i = 0; i < sdp.length; i++) {
    if (sdp[i].match(/b=AS:/)) {
      position = i;
    }
  }
  if (position) {
    sdp.splice(position, 1);
  }
  for (let i = 0; i < sdp.length; i++) {
    if (sdp[i].match(/m=audio/)) {
      new_sdp += sdp[i] + "\r\n" + "b=AS:" + "100000" + "\r\n";
    } else {
      new_sdp += sdp[i] + "\r\n";
    }
  }
  return new_sdp;
}

function toggleRecording() {
  if (recordButton.textContent === "Start Recording") {
    startRecording();
  } else {
    stopRecording();
    recordButton.textContent = "Start Recording";
    playButton.disabled = false;
    downloadButton.disabled = false;
  }
}

// Adjusted mediaRecorder options to be audio only
function startRecording() {
  var options = { mimeType: "audio/webm;codecs=opus" };
  recordedBlobs = [];
  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e0) {
    console.log("Unable to create MediaRecorder with options Object: ", options, e0);
    try {
      mediaRecorder = new MediaRecorder(window.stream);
    } catch (e1) {
      alert("MediaRecorder is not supported by this browser.");
      console.log("Unable to create MediaRecorder", e1);
      return;
    }
  }
  console.log("Created MediaRecorder", mediaRecorder, "with options", options);
  recordButton.textContent = "Stop Recording";
  playButton.disabled = true;
  downloadButton.disabled = false;
  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(5);
  console.log("MediaRecorder started", mediaRecorder);
  localStorage.setItem("mediaRecorder", JSON.stringify(mediaRecorder));
}

function stopRecording() {
  mediaRecorder.stop();
}

function play() {
  var type = (recordedBlobs[0] || {}).type;
  var superBuffer = new Blob(recordedBlobs, { type });
}

function download() {
  stopRecording();
  recordButton.textContent = "Start Recording";
  playButton.disabled = false;
  downloadButton.disabled = false;
  var blob = new Blob(recordedBlobs, { type: "audio/webm" });
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = server_path + ".webm";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

function getConnectionStats(counter) {
  peer.getStats(null).then((stats) => {
    let statsOutput = "";
    var subcounter = counter + 0.1;
    stats.forEach((report) => {
      if (
        (report.type === "inbound-rtp" || report.type === "outbound-rtp") &&
        report.kind === "audio" // Handle audio stats only
      ) {
        localStorage.setItem(subcounter, JSON.stringify(report));
        console.log(report);
        subcounter = subcounter + 0.1;
      }
    });

    document.querySelector(".stats-box").innerHTML = statsOutput;
  });
}