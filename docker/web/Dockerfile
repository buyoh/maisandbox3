FROM node:14-alpine

RUN useradd -u 1000 -U -M -s /usr/sbin/nologin master
RUN useradd -u 1001 -U -M -s /usr/sbin/nologin user
RUN mkdir /opt/msb \
  && chown 1000:1000 /opt/msb -R \
  && chmod o-rwx /opt/msb -R
RUN mkdir /var/opt/msb \
  && chown 1000:1000 /var/opt/msb -R

