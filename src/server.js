/*
openssl req -nodes -x509 -newkey rsa:4096 -keyout server.key -subj "/C=US/ST=Oregon/L=Portland/O=Company Name/OU=Org/CN=192.168.0.101" -out server.crt -days 365

https://128.110.218.254:3000/

https://askubuntu.com/a/261467/1246619
*/

const all_args = process.argv;
console.log("all_args ", all_args);

const server_ip = all_args[2];
const server_port = parseInt(all_args[3]);

// Add additional arguments for file paths
const statsFilePath = all_args[4]; // JSON stats file path
const csvFilePath = all_args[5]; // CSV file path

const express = require("express");
const path = require("path");
const fs = require("fs");
const csvWriter = require('csv-writer');

const app = express();

const options = {
  key: fs.readFileSync("server.key").toString(),
  cert: fs.readFileSync("server.crt").toString(),
};

const server = require("https").createServer(options, app);
const io = require("socket.io")(server);

// Middleware to parse JSON body data
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));
app.use("/sender", express.static(path.join(__dirname, "../public")));
app.use("/receiver", express.static(path.join(__dirname, "../public")));

// Check if file paths are provided
if (!statsFilePath || !csvFilePath) {
  console.error("Error: Please provide the stats JSON file path and the CSV file path as command-line arguments.");
  process.exit(1); // Exit if file paths are not provided
}

// Ensure the JSON file exists, create if it does not
let statsArray = []; // Initialize statsArray
if (!fs.existsSync(statsFilePath)) {
  console.log(`Stats file does not exist, creating: ${statsFilePath}`);
  fs.writeFileSync(statsFilePath, JSON.stringify(statsArray)); // Initialize with an empty array
} else {
  // If the file exists, read it and parse the data
  const data = fs.readFileSync(statsFilePath, 'utf8');
  if (data) {
    statsArray = JSON.parse(data); // Initialize from file if not empty
  }
}

// Array to keep track of connected users
let connectedUsers = [];

// Socket.io connections
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


// Ensure the CSV file exists, create if it does not
if (!fs.existsSync(csvFilePath)) {
  console.log(`CSV file does not exist, creating: ${csvFilePath}`);
  const csvHeader = [
    { id: 'ipAddress', title: 'IP Address' },
    { id: 'timestamp', title: 'Timestamp' },
    { id: 'inbound_audio_jitter_avg', title: 'Inbound Audio Jitter Avg' },
    { id: 'inbound_audio_packetsLost_avg', title: 'Inbound Audio Packets Lost Avg' },
    { id: 'qoe', title: 'QoE' }
  ];
  // Write the header to the CSV file
  const createCsvWriter = csvWriter.createObjectCsvWriter({
    path: csvFilePath,
    header: csvHeader
  });

  // Create an empty CSV file with just the header
  createCsvWriter.writeRecords([]).then(() => {
    console.log(`Created CSV file with headers at ${csvFilePath}`);
  });
}

// Use the file paths
// Example: Writing stats to JSON
fs.writeFileSync(statsFilePath, JSON.stringify(statsArray, null, 2));

// CSV Writer
const createCsvWriter = csvWriter.createObjectCsvWriter({
  path: csvFilePath,
  header: [
    { id: 'ipAddress', title: 'IP Address' },
    { id: 'timestamp', title: 'Timestamp' },
    { id: 'inbound_audio_jitter_avg', title: 'Inbound Audio Jitter Avg' },
    { id: 'inbound_audio_packetsLost_avg', title: 'Inbound Audio Packets Lost Avg' },
    { id: 'qoe', title: 'QoE' }
  ]
});

// Object to track the previous cumulative stats by IP and kind (audio/video)
const previousStats = {};

// Function to compute QoE for a specific timestamp block
function computeQoE(data) {
  const inbound_audio_jitter_avg = data.inboundAudio?.jitter || 0;
  const inbound_audio_packetsLost_avg = data.inboundAudio?.packetsLost || 0;

  // QoE calculation using incremental values
  const qoe =
    3.420 -
    72.898 * inbound_audio_jitter_avg -
    0.001 * inbound_audio_packetsLost_avg;

  return {
    ipAddress: data.ipAddress,
    timestamp: data.timestamp,
    inbound_audio_jitter_avg: inbound_audio_jitter_avg.toFixed(3),
    inbound_audio_packetsLost_avg: inbound_audio_packetsLost_avg.toFixed(3),
    qoe: qoe.toFixed(3),
  };
}

// Function to compute the incremental stats (diff from the previous timestamp)
function computeIncrementalStats(ip, report) {
  const currentStats = {
    packetsLost: report.packetsLost || 0
  };

  // Check if we have previous stats for this IP and kind
  const previous = previousStats[ip]?.[report.type]?.[report.kind] || {
    packetsLost: 0
  };

  const incrementalStats = {
    packetsLost: currentStats.packetsLost - previous.packetsLost
  };

  // Save the current stats for the next round
  if (!previousStats[ip]) previousStats[ip] = {};
  if (!previousStats[ip][report.type]) previousStats[ip][report.type] = {};
  previousStats[ip][report.type][report.kind] = currentStats;

  return incrementalStats;
}

// Function to aggregate blocks by timestamp and compute QoE
function aggregateAndComputeQoE(statsArray) {
  const groupedByTimestamp = {};

  // Group data by timestamp
  statsArray.forEach(report => {
    const { ipAddress, timestamp, type, kind } = report;

    if (!groupedByTimestamp[timestamp]) {
      groupedByTimestamp[timestamp] = {
        ipAddress,
        timestamp,
        inboundAudio: null
      };
    }

    const group = groupedByTimestamp[timestamp];

    // Calculate incremental values for cumulative stats
    const incrementalStats = computeIncrementalStats(ipAddress, report);

    if (type === "inbound-rtp" && kind === "audio") {
      group.inboundAudio = {
        jitter: report.jitter || 0,
        packetsLost: incrementalStats.packetsLost || 0,
      };
    }
  });

  const computedQoEData = [];

  // Compute QoE for timestamps where all blocks (audio/video, inbound/outbound) exist
  Object.values(groupedByTimestamp).forEach(group => {
    if (group.inboundAudio) {
      const qoeData = computeQoE(group);
      computedQoEData.push(qoeData);
    }
  });

  return computedQoEData;
}

// Function to write data to CSV
function writeToCsv(data) {
  createCsvWriter.writeRecords(data).then(() => {
    //console.log("CSV file updated with metrics and QoE.");
  });
}

// Helper to track the last processed timestamp to avoid writing duplicate data
let lastProcessedTimestamp = null;

// POST endpoint to receive WebRTC stats and save to JSON, process QoE
app.post("/saveStats", (req, res) => {
  const stats = req.body;
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    let statsArray = [];

    // Check if the file exists and read the current data
    if (fs.existsSync(statsFilePath)) {
      const data = fs.readFileSync(statsFilePath, 'utf8');
      if (data) {
        statsArray = JSON.parse(data);
      }
    }

    // Add the user's stats with the IP address and timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000); // Current timestamp (in seconds)
    let newEntries = 0;

    stats.forEach(report => {
      // Only add data if it has a new timestamp
      if (currentTimestamp !== lastProcessedTimestamp) {
        statsArray.push({
          ...report,
          ipAddress: userIp,
          timestamp: currentTimestamp
        });
        newEntries++;
      }
    });

    // If no new data has been added, skip further processing
    if (newEntries === 0) {
      //console.log("No new data to process.");
      return res.status(200).send("No new data to process.");
    }

    // Write updated stats to the JSON file
    fs.writeFileSync(statsFilePath, JSON.stringify(statsArray, null, 2));

    // Aggregate data by timestamp and calculate QoE using incremental values
    const qoeData = aggregateAndComputeQoE(statsArray);

    // Filter the QoE data by ensuring we only write new entries with non-empty data
    const newQoEData = qoeData.filter(qoeEntry => {
      return qoeEntry.timestamp === currentTimestamp && Object.keys(qoeEntry).length > 0;
    });

    // Write QoE data to CSV if new data exists
    if (newQoEData.length > 0) {
      writeToCsv(newQoEData);
      //console.log("CSV updated with new QoE data.");
    } else {
      //console.log("No new QoE data to write to CSV.");
    }

    // Update the last processed timestamp
    lastProcessedTimestamp = currentTimestamp;

    res.status(200).send("Stats saved and QoE calculated successfully.");
  } catch (error) {
    console.error("Error saving stats to file:", error);
    res.status(500).send("Error saving stats.");
  }
});

// Start the server to handle incoming stats and write QoE
server.listen(process.env.PORT || server_port, server_ip, () => {
  console.log("listening on", server_ip, server_port);
});
