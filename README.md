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
- node v16 or v18
- ruby 2.7
- docker (for production environment)
- docker compose (for production environment)

We recommend `yarn`.

```
npm i yarn
npx yarn --help
```

or

```
npm i -g yarn
yarn -- help
```

## install to systemd

launch as production with docker compose as independent process

```
yarn install
sudo scripts/install-service.sh
```

if you want to upgrade when already installed,

```
yarn install
sudo scripts/upgrade-service.sh
```


## setup(production)

### build

```
yarn
yarn build
```

```
# only for docker without docker compose
docker/build-docker.sh
```

### start (docker compose)

```
cd docker
docker compose up
```

### start (without docker)

```
PORT=11460 yarn prod
```

check http://localhost:11460

### start (with docker as independent process)

```
# launcher
docker/start-launcher.sh --silent
# webserver
LAUNCHER_PROCESS=SOCKET yarn prod
```

## setup(development)

#### install tools

```
yarn
bundle install  # for RSpec, rubocop only
```

#### start(without docker)

```
yarn dev
```

#### execute (without docker as independent process)

```
# launcher
ruby deps/applauncher/index.rb --verbose
# webserver
LAUNCHER_PROCESS=SOCKET yarn dev
```


#### execute (with docker as independent process)

(setup)
```
docker/build-launcher.sh
```

(run)

```
# launcher
docker/start-launcher.sh --verbose
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
