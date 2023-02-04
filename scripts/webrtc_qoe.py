#!/usr/bin/env python3

import json
import pandas as pd

def extract_time(json):
    try:
        # Also convert to int since update_time will be string.  When comparing
        # strings, "10" is smaller than "2".
        return int(json['page']['update_time'])
    except KeyError:
        return 0

with open('webrtc_logs.json', 'r') as file:
    # Load the JSON data from the file
    data = json.load(file)

video_countr = 0
audio_countr = 0
data_video = {}
data_audio = {}
for key, val in data.items():
    if isinstance(val, dict):
        a = val.get('kind')
        if a != None:
            if val["kind"] == "video":
                b = val.get('type')
                if b != None:
                    if val["type"] == "inbound-rtp":
                        video_countr = video_countr + 1
                        #ts = pd.to_datetime(val["timestamp"],unit='ms')
                        #print(val["timestamp"])
                        data_video[key] = val
            elif val["kind"] == "audio":
                b = val.get('type')
                if b != None:
                    if val["type"] == "inbound-rtp":
                        audio_countr = audio_countr + 1
                        #print(key)
                        data_audio[key] = val
df = pd.DataFrame(data_video).transpose()
df = df.astype({"timestamp": float})
df_video = df.sort_values('timestamp', ascending=True)
df = pd.DataFrame(data_audio).transpose()
df = df.astype({"timestamp": float})
df_audio = df.sort_values('timestamp', ascending=True)
df_video.to_csv("video_data.csv", encoding='utf-8', index=False)
df_audio.to_csv("audio_data.csv", encoding='utf-8', index=False)
print("audio_countr =",audio_countr)
print("video_countr =",video_countr)
