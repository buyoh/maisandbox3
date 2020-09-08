FROM ubuntu:20.04

RUN useradd -u 1000 -U -M -s /usr/sbin/nologin master
RUN useradd -u 1001 -U -M -s /usr/sbin/nologin user
RUN mkdir /opt/msb \
  && chown 1000:1000 /opt/msb -R \
  && chmod o-rwx /opt/msb -R

RUN apt update && apt upgrade -y
RUN apt install -y ruby g++ curl unzip
# RUN curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
# RUN apt-get install -y nodejs

RUN mkdir -p /tmp/work
WORKDIR /tmp/work

# for AtCoder Library and cLay
RUN curl -o ac-library.zip https://img.atcoder.jp/practice2/ac-library.zip
RUN curl -o clay.zip http://rsujskf.s602.xrea.com/files/clay_20200906-1.zip

# AtCoder
RUN mkdir -p ac-library && unzip -d ac-library ac-library.zip \
  && mv ac-library /opt/ \
  && chmod +r-w /opt/ac-library -R

# cLay
RUN mkdir -p clay && unzip -d clay clay.zip
RUN cd clay && g++ -O3 -std=c++14 -o clay clay.cpp && mv clay /usr/bin/
