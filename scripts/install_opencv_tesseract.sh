#!/usr/bin/env bash

sudo apt-get install -y build-essential cmake git pkg-config
sudo apt-get install -y libjpeg8-dev libtiff4-dev libjasper-dev libpng12-dev
sudo apt-get install -y libavcodec-dev libavformat-dev libswscale-dev libv4l-dev
sudo apt-get install -y libgtk2.0-dev
sudo apt-get install -y libatlas-base-dev gfortran
sudo apt-get install -y tesseract-ocr libtesseract-dev libleptonica-dev

cd /tmp/
git clone https://github.com/Itseez/opencv.git
cd opencv

cd /tmp/
git clone https://github.com/Itseez/opencv_contrib.git
cd opencv_contrib

cd /tmp/opencv
mkdir build
cd build
cmake -D CMAKE_BUILD_TYPE=RELEASE \
      -D CMAKE_INSTALL_PREFIX=/usr/local \
      -D OPENCV_EXTRA_MODULES_PATH=/tmp/opencv_contrib/modules \
      -D BUILD_opencv_python3=ON \
      -D BUILD_EXAMPLES=ON ..
make -j4
make install
ldconfig
