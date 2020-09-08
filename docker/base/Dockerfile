FROM ubuntu:20.04

RUN apt update && apt upgrade -y
RUN useradd -u 1000 -U -M -s /usr/sbin/nologin master
RUN useradd -u 1001 -U -M -s /usr/sbin/nologin user
RUN mkdir /opt/msb \
  && chown 1000:1000 /opt/msb -R \
  && chmod o-rwx /opt/msb -R

RUN apt install -y ruby g++ curl
# RUN curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
# RUN apt-get install -y nodejs