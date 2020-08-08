# maisandbox3

## concept

即席で手軽にできるWebアプリケーションベースの実行環境

## warning

./tmp is not deleted automatically.

## setup (for develop)

- Ubuntu 20.04 (recommended. may be runnable on *NIX)
- node v12
- ruby 2.7

#### install yarn

```
npm i yarn
npx yarn
```

or

```
npm i -g yarn
yarn
```

#### install tools

```
yarn
bundle install  # for RSpec, rubocop only
```

#### execute

```
yarn dev
```

#### execute (independent process)

(setup)
```
docker/build-launcher.sh
```

(run)

```
# launcher
docker/start-launcher.sh
# webserver
LAUNCHER_PROCESS=SOCKET yarn dev
```

#### test

```
bundle exec rspec
yarn test
```

#### lint(too many problem)

```
yarn lint
bundle exec rubocop
```

(fix)

```
yarn lint-fix
bundle exec rubocop --auto-correct
```
