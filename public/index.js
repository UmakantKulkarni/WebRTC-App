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
var myVideo = document.querySelector("video#localVideo");
var recordedVideo = document.querySelector("video#remoteVideo");
recordButton.onclick = toggleRecording;
playButton.onclick = play;
downloadButton.onclick = download;
const constraints = {
  audio: {
    echoCancellation: {exact: true}
  },
  video: {
    width: { min: 640, ideal: 1920 },
    height: { min: 360, ideal: 1080 },
    frameRate: { min: 28 },
  },
};

/* 5-tuple per media-trac; bundle policy:
https://www.rfc-editor.org/rfc/rfc8834
https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection
https://stackoverflow.com/questions/57794305/how-to-change-webrtc-rtcpmuxpolicy
https://webrtcstandards.info/sdp-bundle/
https://www.rfc-editor.org/rfc/rfc8835.pdf
*/

// Creating the peer
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
var stats_counter = 1;
var statsInterval = setInterval(function () {
  getConnectionStats(stats_counter);
  stats_counter++;
}, 1000);

// Connecting to socket
const socket = io(server_host);

//https://github.com/webrtc/samples/blob/gh-pages/src/content/getusermedia/resolution/js/main.js
const onSocketConnected = async () => {
  //var mediaSource = new MediaSource();
  //mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
  //navigator.mediaDevices.getUserMedia(constraints).then(successCallback,errorCallback);
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
  const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
  document.querySelector("#localVideo").srcObject = stream;

  peer.getSenders().forEach(async (s) => {
    if (s.track && s.track.kind === "video")
      await s.replaceTrack(stream.getTracks()[0]);
  });
});

cameraButton.addEventListener("click", async () => {
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

//Change SDP to allow max bitrate - https://stackoverflow.com/a/57674478/12865444
// Create media offer
socket.on("mediaOffer", async (data) => {
  var arr = data.offer.sdp.split("\r\n");
  arr.forEach((str, i) => {
    if (/^a=fmtp:\d*/.test(str)) {
      arr[i] =
        str +
        ";x-google-max-bitrate=10000000;x-google-min-bitrate=1;x-google-start-bitrate=6000";
    } else if (/^a=mid:(1|video)/.test(str)) {
      arr[i] += "\r\nb=AS:10000";
    }
  });
  sdp = new RTCSessionDescription({
    type: "offer",
    sdp: arr.join("\r\n"),
  });
  await peer.setRemoteDescription(new RTCSessionDescription(sdp));
  const peerAnswer = await peer.createAnswer();
  var arr = peerAnswer.sdp.split("\r\n");
  arr.forEach((str, i) => {
    if (/^a=fmtp:\d*/.test(str)) {
      arr[i] =
        str +
        ";x-google-max-bitrate=10000000;x-google-min-bitrate=1;x-google-start-bitrate=6000";
    } else if (/^a=mid:(1|video)/.test(str)) {
      arr[i] += "\r\nb=AS:10000";
    }
  });
  sdp = new RTCSessionDescription({
    type: "answer",
    sdp: arr.join("\r\n"),
  });
  await peer.setLocalDescription(new RTCSessionDescription(sdp));

  sendMediaAnswer(sdp, data);
});

//https://www.webrtc-experiment.com/webrtcpedia/
//https://github.com/ant-media/Ant-Media-Server/wiki/How-to-improve-WebRTC-bit-rate%3F
//https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpEncodingParameters/maxBitrate
// https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/bandwidth/js/main.js
// Create media answer
socket.on("mediaAnswer", async (data) => {
  /*
  peer.getSenders().forEach((sender) => {
    var parameters = sender.getParameters();
    console.log('Before parameters: ', parameters);
    parameters.encodings.forEach((encoding) => {
        encoding.maxBitrate = 100 * 1000 * 100;
        encoding.adaptivePtime = true;
        encoding.networkPriority = "high";
        encoding.priority = "high";
    });
    sender.getParameters(parameters);
    console.log('After parameters: ', parameters);
  });
  */
  var arr = data.answer.sdp.split("\r\n");
  arr.forEach((str, i) => {
    if (/^a=fmtp:\d*/.test(str)) {
      arr[i] =
        str +
        ";x-google-max-bitrate=10000000;x-google-min-bitrate=1;x-google-start-bitrate=6000";
    } else if (/^a=mid:(1|video)/.test(str)) {
      arr[i] += "\r\nb=AS:10000";
    }
  });
  sdp = new RTCSessionDescription({
    type: "answer",
    sdp: arr.join("\r\n"),
  });
  await peer.setRemoteDescription(new RTCSessionDescription(sdp));
  startRecording();
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
  console.log("getUserMedia() got stream: ", stream);
  localStorage.setItem("stream", JSON.stringify(stream));
  window.stream = stream;
  myVideo.srcObject = stream;
}

function errorCallback(error) {
  console.log("navigator.getUserMedia error: ", error);
}

function handleSourceOpen(event) {
  console.log("MediaSource opened");
  //sourceBuffer = mediaSource.addSourceBuffer('video/webm;codecs=vp8');
  console.log("Source buffer: ", sourceBuffer);
  localStorage.setItem("sourceBuffer", JSON.stringify(sourceBuffer));
}

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function handleStop(event) {
  console.log("Recorder stopped: ", event);
  console.log("Recorded Blobs: ", recordedBlobs);
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

//https://github.com/webrtc/samples/tree/gh-pages/src/content/getusermedia/record
// The nested try blocks will be simplified when Chrome 47 moves to Stable
function startRecording() {
  var options = { mimeType: "video/webm;codecs=opus,h264" };
  recordedBlobs = [];
  if (server_path == "sender") {
    qs = "#localVideo";
  } else {
    qs = "#remoteVideo";
  }
  console.log("qs is", qs);
  try {
    mediaRecorder = new MediaRecorder(
      document.querySelector(qs).srcObject,
      options
    );
  } catch (e0) {
    console.log(
      "Unable to create MediaRecorder with options Object: ",
      options,
      e0
    );
    try {
      options = { mimeType: "video/webm;codecs=opus,vp9" };
      mediaRecorder = new MediaRecorder(
        document.querySelector(qs).srcObject,
        options
      );
    } catch (e1) {
      console.log(
        "Unable to create MediaRecorder with options Object: ",
        options,
        e1
      );
      try {
        mediaRecorder = new MediaRecorder(document.querySelector(qs).srcObject);
      } catch (e2) {
        alert("MediaRecorder is not supported by this browser.");
        console.log("Unable to create MediaRecorder", e2);
        return;
      }
    }
  }
  console.log("Created MediaRecorder", mediaRecorder, "with options", options);
  recordButton.textContent = "Stop Recording";
  playButton.disabled = true;
  downloadButton.disabled = false;
  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(5); // collect 5ms of data
  console.log("MediaRecorder started", mediaRecorder);
  localStorage.setItem("mediaRecorder", JSON.stringify(mediaRecorder));
}

function stopRecording() {
  mediaRecorder.stop();
  recordedVideo.controls = false;
}

function play() {
  var type = (recordedBlobs[0] || {}).type;
  var superBuffer = new Blob(recordedBlobs, { type });
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
}

function download() {
  stopRecording();
  recordButton.textContent = "Start Recording";
  playButton.disabled = false;
  downloadButton.disabled = false;
  var blob = new Blob(recordedBlobs, { type: "video/webm" });
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
    //let statsConsoleOutput = ""

    //https://developer.mozilla.org/en-US/docs/Web/API/RTCStats/type
    stats.forEach((report) => {
      if ((report.type === "inbound-rtp" || report.type === "outbound-rtp") && (report.kind === "video" || report.kind === "audio")) {
        localStorage.setItem(subcounter, JSON.stringify(report));
        console.log(report);
        subcounter = subcounter + 0.1;
      }
      /*if ((report.type === "inbound-rtp" || report.type === "outbound-rtp") && (report.kind === "video" || report.kind === "audio")) {
        Object.keys(report).forEach((statName) => {
          statsOutput += `<strong>"${statName}":</strong> "${report[statName]}"<br>\n`;
          //statsConsoleOutput += `"${statName}":"${report[statName]}"\n`;
        });
      }*/
    });
    //console.log(statsConsoleOutput)

    document.querySelector(".stats-box").innerHTML = statsOutput;
  });
}
