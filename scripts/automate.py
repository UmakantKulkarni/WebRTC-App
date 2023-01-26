#!/usr/bin/env python3
import os
import time
import json
import logging
from multiprocessing import Process
from selenium.webdriver import Firefox
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver import FirefoxProfile
from selenium.webdriver.common.by import By
#from selenium.webdriver.firefox.service import Service
#from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities


logging.basicConfig(
    level=logging.INFO,
    format=
    "[%(asctime)s] [%(filename)s:%(lineno)d] [%(name)s] [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("automate.log"),
        logging.StreamHandler()
    ])

ENABLE_VIDEO_DOWNLOAD = 1
ENABLE_SENDER_WEBRTC_STATS = 0
ENABLE_RECEIVER_WEBRTC_STATS = 1
SLEEP_TIME = 5
CALL_DURATION = 60
WEBRTC_URI = "https://128.110.219.84:3000/"
EXECUTABLE_PATH = '/usr/local/bin/geckodriver'
CHROME_DRIVER = '/usr/local/bin/chromedriver'
VIDEO_FILE = "/Users/umakantkulkarni/Library/CloudStorage/OneDrive-purdue.edu/Research/JuniperProject/Spring2023/person_talking.y4m"
AUDIO_FILE = "/Users/umakantkulkarni/Library/CloudStorage/OneDrive-purdue.edu/Research/JuniperProject/Spring2023/person_talking_audio.wav"
#VIDEO_FILE = "/Users/umakantkulkarni/Downloads/test.y4m"
#https://stackoverflow.com/questions/55697221/firefox-selenium-python-wont-open-a-webrtc-stream
#chrome audio does not work - https://stackoverflow.com/questions/50774560/chrome-speech-recognition-webkitspeechrecognition-not-accepting-input-of-fake

#Sample y4m files - https://media.xiph.org/video/derf/y4m/

def chrome_sender():
    webrtc_stats = {}
    downloadFilepath = "/Users/umakantkulkarni/Downloads"
    # enable browser logging
    chrome_options = Options()
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("start-maximized")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument('ignore-certificate-errors')
    #chrome_options.add_experimental_option("prefs", { \
    #"profile.default_content_settings.popups": 0,
    #"download.default_directory": downloadFilepath
    #"profile.default_content_setting_values.media_stream_mic": 1, 
    #"profile.default_content_setting_values.media_stream_camera": 1,
    #"profile.default_content_setting_values.geolocation": 1, 
    #"profile.default_content_setting_values.notifications": 1 
    #})
    chrome_options.add_argument("--allow-file-access-from-files")
    chrome_options.add_argument("--allow-file-access")
    chrome_options.add_argument("--use-fake-ui-for-media-stream")
    chrome_options.add_argument("--use-fake-device-for-media-stream")
    chrome_options.add_argument(r"--use-file-for-fake-video-capture={}".format(VIDEO_FILE))
    chrome_options.add_argument(r"--use-file-for-fake-audio-capture={}".format(AUDIO_FILE))

    chrome_service = Service(CHROME_DRIVER, log_path=os.path.devnull)
    driver = Chrome(options=chrome_options, service=chrome_service,service_log_path=None)

    #get method to launch the URL
    driver.get(WEBRTC_URI)
    time.sleep(SLEEP_TIME)

    driver.find_element(By.XPATH,'//*[@id="cam"]').click()
    driver.find_element(By.XPATH,'//*[@id="mic"]').click()
    time.sleep(CALL_DURATION)

    if ENABLE_SENDER_WEBRTC_STATS:
        webrtc_stats = {}
        op = driver.execute_script("return window.localStorage;")
        for key, value in op.items():
            webrtc_stats[key] = json.loads(str(value))
        with open('webrtc_stats.log', 'w') as f:
            print(json.dumps(webrtc_stats), file=f)

    #to refresh the browser
    #driver.refresh()
    #time.sleep(SLEEP_TIME)

    #to close the browser
    driver.close()


def chrome_receiver():
    webrtc_stats = {}
    downloadFilepath = "/Users/umakantkulkarni/Downloads"
    # enable browser logging
    chrome_options = Options()
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("start-maximized")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument('ignore-certificate-errors')
    chrome_options.add_experimental_option("prefs", { \
    "profile.default_content_settings.popups": 0,
    "download.default_directory": downloadFilepath
    #"profile.default_content_setting_values.media_stream_mic": 1, 
    #"profile.default_content_setting_values.media_stream_camera": 1,
    #"profile.default_content_setting_values.geolocation": 1, 
    #"profile.default_content_setting_values.notifications": 1 
    })
    chrome_options.add_argument("--allow-file-access-from-files")
    chrome_options.add_argument("--allow-file-access")
    chrome_options.add_argument("--use-fake-ui-for-media-stream")
    chrome_options.add_argument("--use-fake-device-for-media-stream")
    chrome_options.add_argument(r"--use-file-for-fake-video-capture={}".format(VIDEO_FILE))
    chrome_options.add_argument(r"--use-file-for-fake-audio-capture={}".format(AUDIO_FILE))

    chrome_service = Service(CHROME_DRIVER, log_path=os.path.devnull)
    driver = Chrome(options=chrome_options, service=chrome_service,service_log_path=None)

    #get method to launch the URL
    driver.get(WEBRTC_URI)
    time.sleep(SLEEP_TIME)

    driver.find_element(By.XPATH,'//*[@id="cam"]').click()
    driver.find_element(By.XPATH,'//*[@id="mic"]').click()
    driver.find_element(By.CLASS_NAME,'user-item').click()
    driver.find_element(By.XPATH,'//*[@id="call"]').click()
    time.sleep(CALL_DURATION)

    if ENABLE_VIDEO_DOWNLOAD:
        driver.find_element(By.XPATH,'//*[@id="download"]').click()
    if ENABLE_RECEIVER_WEBRTC_STATS:
        op = driver.execute_script("return window.localStorage;")
        for key, value in op.items():
            webrtc_stats[key] = json.loads(str(value))
        with open('webrtc_stats.log', 'w') as f:
            print(json.dumps(webrtc_stats), file=f)

    #to refresh the browser
    #driver.refresh()
    #time.sleep(SLEEP_TIME)

    #to close the browser
    driver.close()
    


def firefox_sender():
    #Proxy options - https://stackoverflow.com/a/29917687/12865444
    firefox_options = Options()
    firefox_options.set_preference("network.proxy.type", 5)
    firefox_options.set_preference("media.navigator.streams.fake", True)
    desired = DesiredCapabilities.FIREFOX
    #firefox_options.set_preference(
    #    "network.proxy.autoconfig_url",
    #    "http://netstats-ba.labs.hpecorp.net/forticache.pac")

    #browser exposes an executable file. Downloaded from https://github.com/mozilla/geckodriver/releases
    #Through Selenium, we will invoke the executable file which will then #invoke actual browser

    firefox_profile = FirefoxProfile()
    firefox_profile.set_preference("media.navigator.permission.disabled", True)
    #firefox_profile.set_preference("media.navigator.streams.fake", True)
    firefox_profile.set_preference("permissions.default.microphone", True)
    firefox_profile.set_preference("permissions.default.camera", True)
    firefox_profile.set_preference("media.block-autoplay-until-in-foreground", False)
    firefox_profile.set_preference("media.autoplay.default", False)
    firefox_profile.set_preference("media.autoplay.allow-muted", False)
    firefox_profile.set_preference("plugin.state.flash", True)
    firefox_profile.set_preference("webdriver_accept_untrusted_certs", True)
    firefox_profile.set_preference("media.webrtc.hw.h264.enabled", True)
    firefox_profile.set_preference("media.recorder.audio_node.enabled", True)
    
    firefox_service = Service(EXECUTABLE_PATH, log_path=os.path.devnull)

    driver = Firefox(service=firefox_service, desired_capabilities=desired, firefox_profile=firefox_profile)

    # to maximize the browser window
    driver.maximize_window()

    #get method to launch the URL
    driver.get(WEBRTC_URI)
    time.sleep(SLEEP_TIME)

    button = driver.find_element(By.XPATH,'//*[@id="cam"]')
    button.click()
    time.sleep(SLEEP_TIME)

    #to refresh the browser
    #driver.refresh()
    #time.sleep(SLEEP_TIME)

    #to close the browser
    #driver.close()


if __name__ == "__main__":
    p1 = Process(target=chrome_sender)
    p2 = Process(target=chrome_receiver)
    p1.start()
    time.sleep(SLEEP_TIME)
    p2.start()
    p1.join()
    p2.join()