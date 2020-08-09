# maisandbox3

## concept

即席で手軽にできるWebアプリケーションベースの実行環境

## warning

./tmp is not deleted automatically.

## environment

- Ubuntu 20.04 (recommended. may be runnable on *NIX)
- node v12
- ruby 2.7
- (docker)

We recommend `yarn`.

```
npm i
npx yarn --help
```

or

```
npm i -g yarn
yarn -- help
```

## setup(production)

### build

```
yarn
yarn build
docker/build-launcher.sh  # for docker
```

### start (without docker)

```
yarn prod
```

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
ruby launcher/launcher.rb --verbose
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
