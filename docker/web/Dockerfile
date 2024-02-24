FROM node:18-alpine

# Create users
RUN adduser -u 1100 -H -D -s /usr/sbin/nologin master
# RUN adduser -u 1101 -H -D -s /usr/sbin/nologin user
RUN mkdir /opt/msb \
  && chown 1100:1100 /opt/msb -R \
  && chmod o-rwx /opt/msb -R
RUN mkdir /var/opt/msb \
  && chown 1100:1100 /var/opt/msb -R

# Copy sources
RUN mkdir -p /opt/msb/src
RUN mkdir -p /opt/msb/public
COPY *.json *.ts* *.js* *.html yarn.lock  /opt/msb/
COPY src  /opt/msb/src
COPY public  /opt/msb/public

# Install packages and build
WORKDIR /opt/msb
RUN yarn --frozen-lockfile
RUN yarn install
RUN yarn build
# erase development dependencies
RUN yarn --production --frozen-lockfile

# Restrict access
RUN chmod o-w /opt/msb -R

# Set user
# USER master

# Expose port
# EXPOSE 11460
