# maisandbox3

![test](https://github.com/buyoh/maisandbox3/workflows/test/badge.svg)
![lint](https://github.com/buyoh/maisandbox3/workflows/lint/badge.svg)

## concept

即席で手軽にできるWebアプリケーションベースの実行環境

## warning

./tmp is not deleted automatically.

## clone

you may need to sync git submodules

```
git submodule init
git submodule update
```

## environment

- Ubuntu 20.04 (recommended. may be runnable on *NIX)
- node v18
- ruby 2.7
- docker (for production environment)
- docker compose (for production environment)

```
npm install
```

## simple start (docker compose)

```
cd docker
docker compose up
```

Then, access http://localhost:11460

## install to systemd

launch as production with docker compose as independent process

```
npm install
sudo scripts/install-service.sh
```

## optional startup

### start with production build

#### build

```
npm install
npm run build
```

```
# only for docker without docker compose
docker/build-docker.sh
```

#### start

```
PORT=11460 npm run prod
```

check http://localhost:11460

### start with development environment

#### install tools

```
npm install
(cd deps/applauncher && bundle install)  # for RSpec, rubocop only
```

#### start (without docker)

```
npm run dev
```

#### start (without docker as independent process)

```
# launcher
ruby deps/applauncher/index.rb --verbose
# webserver
LAUNCHER_PROCESS=SOCKET yarn dev
```

#### test

```
yarn test
bundle exec rspec
```

#### lint

```
yarn lint
bundle exec rubocop
```

(fix)

```
yarn lint-fix
bundle exec rubocop --auto-correct
```
