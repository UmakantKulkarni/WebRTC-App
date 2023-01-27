#!/usr/bin/env python3

import cv2
import pytesseract


vid_text = []

def image_2_text(frame, x, y, w, h):
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
    print(number)
    vid_text.append(number)
    # Display the frame
    #cv2.imshow("Frame", ROI)


def run():
    # Open the video file
    video = cv2.VideoCapture("output.webm")

    #https://stackoverflow.com/a/58984370/12865444
    # Set the frame width and height
    frame_width = int(video.get(3))
    #frame_height = int(video.get(4))
    x, y, w, h = frame_width - 450, 40, 440, 60

    while True:
        # Read a frame from the video
        ret, frame = video.read()

        # Check if the video has ended
        if not ret:
            break

        image_2_text(frame,x, y, w, h)
        # Exit the program when the 'q' key is pressed
        if cv2.waitKey(25) & 0xFF == ord('q'):
            break

    print("Length of array", len(vid_text))
    # Release the video capture object and close all windows
    video.release()
    cv2.destroyAllWindows()


if __name__ == '__main__':
    run()