

#https://stackoverflow.com/questions/43480867/linux-pipe-audio-file-to-microphone-input
#https://gist.github.com/GusAntoniassi/c994dc5fc470f5910b61e4d238a6cccf
arecord -L
./stream_audio.sh test.webm 

#https://askubuntu.com/questions/881305/is-there-any-way-ffmpeg-send-video-to-dev-video0-on-ubuntu
v4l2-ctl --list-devices

#https://stackoverflow.com/questions/68433415/using-v4l2loopback-virtual-cam-with-google-chrome-or-chromium-on-linux-while-hav
sudo modprobe v4l2loopback exclusive_caps=1
sudo chmod 000 /dev/video0
sudo chmod 000 /dev/video1

#https://askubuntu.com/questions/881305/is-there-any-way-ffmpeg-send-video-to-dev-video0-on-ubuntu
ffmpeg -re -i test.webm -map 0:v -f v4l2 /dev/video2


#https://write.corbpie.com/overlay-frame-number-on-video-with-ffmpeg/
ffmpeg -i orig.webm -vf "drawtext=fontfile=Arial.ttf:text='%{frame_num}':start_number=1:x=(w-tw)/2:y=h-(2*lh):fontcolor=blue:fontsize=50:" -c:a copy test.webm
ffmpeg -i orig.webm -vf "drawtext=fontfile=Arial.ttf:text='%{frame_num}':start_number=1:x=10:y=10:fontcolor=black:fontsize=50:" -crf 0 -c:a copy test.webm

#https://superuser.com/a/135152/1396837
ffmpeg -i output.webm -vframes 1  output_image.jpg
ffmpeg -ss 20 -i output.webm -vframes 1  output_image.jpg


