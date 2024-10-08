# video-calling-app-example

To run the example:

`yarn && yarn dev`
 
 or if you use npm:
 
 `npm i && npm run dev 192.168.0.102 3000`
 
 `nohup /usr/bin/node /home/kulkarnu/WebRTC-App/src/server.js 192.168.6.23 3000 &`

 `/usr/bin/node /tmp/WebRTC-App/src/server.js 192.168.6.23 11001 /tmp/ws.json /tmp/ws.csv`
 
 Once the server is running, open 
 `
    https://localhost:3000/sender/
    https://localhost:3000/receiver/
 `  
 in 2 separate tabs in your favourite browser.
 
 Select ID of the user and click call.

Forked from https://github.com/TechSivaram/WebRTC-Simple and modified based on https://github.com/webrtc/samples/tree/gh-pages/src/content/getusermedia/record
