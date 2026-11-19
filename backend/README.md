## tomo-gym — backend

NestJS 11 REST API (and, from roadmap Step 4, the Claude agent loop) for tomo-gym, the conversational workout logger. See [../CLAUDE.md](../CLAUDE.md) and [../constitution.md](../constitution.md) for the product and stack rules.

Based on [monstar-lab-oss/nestjs-starter-rest-api](https://github.com/monstar-lab-oss/nestjs-starter-rest-api), by way of denwa-alert's backend (same conventions; denwa-specific modules removed).

## Features

| Feature                  | Info               |
| ------------------------ | ------------------ |
| Authentication           | JWT (RS256)        |
| Authorization            | ACL-based (see [backend/CLAUDE.md](CLAUDE.md)) |
| ORM Integration          | TypeORM            |
| DB Migrations            | TypeORM            |
| Logging                  | winston            |
| Request Validation       | class-validator    |
| Pagination               | SQL offset & limit |
| Docker Ready             | Dockerfile         |
| Devcontainer             | -                  |
| Auto-generated OpenAPI   | -                  |

## Installation

Note: when using docker, all the `npm` commands can also be performed using `./scripts/npm` (for example `./scripts/npm install`).
This script allows you to run the same commands inside the same environment and versions than the service, without relying on what is installed on the host.

```bash
$ npm install
```

Create a `.env` file from the template `.env.template` file.

Generate public and private key pair for jwt authentication:

### With docker

Run this command:

```bash
./scripts/generate-jwt-keys
```

It will output something like this. You only need to add it to your `.env` file.

```
To setup the JWT keys, please add the following values to your .env file:
JWT_PUBLIC_KEY_BASE64="(long base64 content)"
JWT_PRIVATE_KEY_BASE64="(long base64 content)"
```

### Without docker

```bash
$ ssh-keygen -t rsa -b 2048 -m PEM -f jwtRS256.key
# Don't add passphrase
$ openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
```

You may save these key files in `./local` directory as it is ignored in git.

Encode keys to base64:

```bash
$ base64 -i local/jwtRS256.key

$ base64 -i local/jwtRS256.key.pub
```

Must enter the base64 of the key files in `.env`:

```bash
JWT_PUBLIC_KEY_BASE64=BASE64_OF_JWT_PUBLIC_KEY
JWT_PRIVATE_KEY_BASE64=BASE64_OF_JWT_PRIVATE_KEY
```

## Running the app

We can run the project with or without docker.

### Local

The usual flow runs Nest on the host and Postgres in docker (macOS bind mounts don't trigger the file watcher inside the container):

```bash
$ docker compose up -d pgsqldb   # Postgres on localhost:5433
$ npm run migration:run
```

Ports: API `3001`, Postgres `5433`, adminer `8081`. They're offset from denwa-alert's (3000 / 5432 / 8080) so both can run at once.

Commands:

```bash
# development
$ npm run start

# watch mode
$ npm run dev

# production mode
$ npm run start:prod
```

### Docker

```bash
# build image
$ docker build -t tomo-gym-backend .

# run container from image
$ docker run -p 3001:3001 --volume 'pwd':/usr/src/app --network --env-file .env tomo-gym-backend

# run using docker compose
$ docker compose up
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Migrations

```bash
# using docker
$ docker compose exec app npm run migration:run

# generate migration (replace CreateUsers with name of the migration)
$ npm run migration:generate --name=CreateUsers

# run migration
$ npm run migration:run

# revert migration
$ npm run migration:revert
```

## Architecture

- [Project Structure](./docs/project-structure.md)

## External Links

<a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo.svg" width="150" alt="Nest Logo" /></a>
