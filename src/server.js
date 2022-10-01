//openssl req -nodes -x509 -newkey rsa:4096 -keyout key.pem -subj "/C=US/ST=Oregon/L=Portland/O=Company Name/OU=Org/CN=128.110.218.254" -out cert.pem -days 365

const express = require("express");
const path = require("path");

const app = express();

const options = {
  key: require("fs").readFileSync("server.key").toString(),
  cert: require("fs").readFileSync("server.crt").toString(),
};

const server = require("https").createServer(options, app);
const io = require("socket.io")(uks);

app.use(express.static(path.join(__dirname, "../public")));

let connectedUsers = [];

io.on("connection", (socket) => {
  connectedUsers.push(socket.id);

  socket.on("disconnect", () => {
    connectedUsers = connectedUsers.filter((user) => user !== socket.id);
    socket.broadcast.emit("update-user-list", { userIds: connectedUsers });
  });

  socket.on("mediaOffer", (data) => {
    socket.to(data.to).emit("mediaOffer", {
      from: data.from,
      offer: data.offer,
    });
  });

  socket.on("mediaAnswer", (data) => {
    socket.to(data.to).emit("mediaAnswer", {
      from: data.from,
      answer: data.answer,
    });
  });

  socket.on("iceCandidate", (data) => {
    socket.to(data.to).emit("remotePeerIceCandidate", {
      candidate: data.candidate,
    });
  });

  socket.on("requestUserList", () => {
    socket.emit("update-user-list", { userIds: connectedUsers });
    socket.broadcast.emit("update-user-list", { userIds: connectedUsers });
  });
});

server.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("listening on *:3000");
});
