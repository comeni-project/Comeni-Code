# The web app, built and served by nginx (M0 part 8 spec, P8.2).
# Build from the repository root: docker build -f apps/web/Dockerfile .
# Base images are pinned by digest; Dependabot bumps them (.github/dependabot.yml).

FROM node:26-alpine@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868 AS build
WORKDIR /web
# The lockfile first, so editing a component doesn't reinstall everything. .npmrc refuses install
# scripts, as it does locally.
COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM nginx:1.31-alpine@sha256:c8497b180665e631ec92a5091125bec5b214f0e2b99409e30653a125b37557da
COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
