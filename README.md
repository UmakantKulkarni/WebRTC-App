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

## Citation

If you use this tool, we request you to please cite our paper:

**BibTeX:**
```bibtex
@article{10.1145/3709371,
author = {Kulkarni, Umakant and Diab, Khaled and Cao, Lianjie and Ahmed, Faraz and Aggarwal, Shivang and Sharma, Puneet and Fahmy, Sonia},
title = {Maestro: QoE-Aware Dynamic Resource Allocation in Wi-Fi Networks},
year = {2025},
issue_date = {March 2025},
publisher = {Association for Computing Machinery},
address = {New York, NY, USA},
volume = {3},
number = {CoNEXT1},
url = {https://doi.org/10.1145/3709371},
doi = {10.1145/3709371},
journal = {Proc. ACM Netw.},
month = mar,
articleno = {4},
numpages = {24},
keywords = {access category, ddqn, lstm, po-mdp, priority queue, qoe, wi-fi}
}
```

---
