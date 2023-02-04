#!/usr/bin/env python3

import cv2
import pytesseract
import argparse


def image_2_text(frame, frame_ts, x, y, w, h):
    #print(getText(frame))
    # Convert the frame to grayscale
    #gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    ROI = frame[y:y + h, x:x + w]
    # Use pytesseract to extract text from the frame
    text = pytesseract.image_to_string(
        ROI,
        lang='eng',
        config='--psm 6 --oem 3 digits -c tessedit_char_whitelist=0123456789')
    number = "".join([t for t in text if t != '|']).strip().replace(",", "")
    print("Timestamp for frame number {} is {}".format(number, frame_ts))

    # Display the frame
    cv2.imshow("Frame", ROI)

    return number


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        __doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--video_file', '-v', default="received.webm")
    parser.add_argument('--frame_num_file', '-f', default="frame_numbers.csv")
    args = parser.parse_args()

    frame_timestamps = []
    vid_text = []

    with open(args.frame_num_file, "w") as myfile:
        myfile.write("frame_number,frame_ts" + "\n")

    # Open the video file
    video = cv2.VideoCapture(args.video_file)

    #https://stackoverflow.com/a/58984370/12865444
    # Set the frame width and height
    frame_width = int(video.get(3))
    frame_height = int(video.get(4))

    x = int(frame_width * 0.80)
    y = int(frame_height / 20)
    w = frame_width - x
    h = int(2*frame_height / 15)


    print("frame_width, frame_height", frame_width, frame_height)
    #x, y, w, h = frame_width - 450, 40, 440, 60
    print("w, h, x, y", w, h, x, y)
    print_cnt = 10

    i = 0
    while i < print_cnt:
        i = i + 1
        # Read a frame from the video
        ret, frame = video.read()

        # Check if the video has ended
        if not ret:
            break

        frame_ts = str(video.get(cv2.CAP_PROP_POS_MSEC))
        frame_number = image_2_text(frame, frame_ts, x, y, w, h)
        # Exit the program when the 'q' key is pressed
        if cv2.waitKey(25) & 0xFF == ord('q'):
            break

        frame_timestamps.append(frame_ts)
        vid_text.append(frame_number)
        with open(args.frame_num_file, "a") as myfile:
            myfile.write("{},{}".format(frame_number,frame_ts) + "\n")

    print(vid_text, frame_timestamps)
    print("Length of array", len(vid_text))
    # Release the video capture object and close all windows
    video.release()
    cv2.destroyAllWindows()
