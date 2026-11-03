# Stage 1: Build applauncher-go
FROM golang:1.25-alpine AS go-builder
WORKDIR /src
COPY deps/applauncher-go/go.mod deps/applauncher-go/go.sum ./
RUN go mod download
COPY deps/applauncher-go/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /build/launcher ./cmd/launcher

# Stage 2: Runtime
FROM ubuntu:20.04
# TODO: Use alphine, re-consider how to install g++ and unzip in alpine

RUN apt update && apt upgrade -y
RUN apt install -y ruby g++ curl unzip
# RUN curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
# RUN apt-get install -y nodejs

RUN mkdir -p /tmp/work
WORKDIR /tmp/work

# for AtCoder Library and cLay
# RUN curl -o ac-library.zip https://img.atcoder.jp/practice2/ac-library.zip
COPY docker/base/third_party/ac-library/ac-library.zip /tmp/work/
COPY docker/base/third_party/clay/clay.zip /tmp/work/
# RUN curl -o clay.zip http://rsujskf.s602.xrea.com/files/clay_20200906-1.zip

# AtCoder
RUN mkdir -p ac-library && unzip -d ac-library /tmp/work/ac-library.zip \
  && mv ac-library /opt/ \
  && chmod +r-w /opt/ac-library -R

# cLay
RUN mkdir -p clay && unzip -d clay /tmp/work/clay.zip
RUN cd clay && g++ -O3 -std=c++14 -o clay clay.cpp && mv clay /usr/bin/

# Copy builded applauncher-go binary
RUN mkdir -p /opt/msb-launcher/
COPY --from=go-builder /build/launcher /opt/msb-launcher/

# Copy configs
COPY docker/base/launcher-configs /opt/msb-launcher/configs