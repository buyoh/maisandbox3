.PHONY: build test lint proto clean

BINARY := launcher
BUILD_DIR := ./build
PROTO_SRC := ../../src/proto

build:
	go build -o $(BUILD_DIR)/$(BINARY) ./cmd/launcher

test:
	go test ./...

test-verbose:
	go test -v ./...

lint:
	go vet ./...

proto:
	@mkdir -p ./proto/launcher
	protoc \
		--proto_path=$(PROTO_SRC) \
		--go_out=./proto/launcher --go_opt=paths=source_relative \
		--go-grpc_out=./proto/launcher --go-grpc_opt=paths=source_relative \
		launcher.proto

clean:
	rm -rf $(BUILD_DIR)
