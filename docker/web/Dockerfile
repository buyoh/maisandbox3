FROM node:18-alpine

RUN adduser -u 1100 -H -D -s /usr/sbin/nologin master
RUN adduser -u 1101 -H -D -s /usr/sbin/nologin user
RUN mkdir /opt/msb \
  && chown 1100:1100 /opt/msb -R \
  && chmod o-rwx /opt/msb -R
RUN mkdir /var/opt/msb \
  && chown 1100:1100 /var/opt/msb -R
