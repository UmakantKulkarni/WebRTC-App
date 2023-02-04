/*

openssl req -nodes -x509 -newkey rsa:4096 -keyout server.key -subj "/C=US/ST=Oregon/L=Portland/O=Company Name/OU=Org/CN=192.168.0.101" -out server.crt -days 365

https://128.110.218.254:3000/

https://askubuntu.com/a/261467/1246619

*/

const all_args = process.argv;
console.log("all_args ", all_args);

const server_ip = all_args[2]
const server_port = parseInt(all_args[3])

const express = require("express");
const path = require("path");

const app = express();

const options = {
  key: require("fs").readFileSync("server.key").toString(),
  cert: require("fs").readFileSync("server.crt").toString(),
};

const server = require("https").createServer(options, app);
const io = require("socket.io")(server);

app.use(express.static(path.join(__dirname, "../public")));
app.use('/sender',express.static(path.join(__dirname, "../public")));
app.use('/receiver',express.static(path.join(__dirname, "../public")));


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

server.listen(process.env.PORT || server_port, server_ip, () => {
  console.log("listening on", server_ip, server_port);
  
});


