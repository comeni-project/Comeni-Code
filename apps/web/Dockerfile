# The web app, built and served by nginx (M0 part 8 spec, P8.2).
# Build from the repository root: docker build -f apps/web/Dockerfile .
# Base images are pinned by digest; Dependabot bumps them (.github/dependabot.yml).

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /web
# The lockfile first, so editing a component doesn't reinstall everything. .npmrc refuses install
# scripts, as it does locally.
COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM nginx:1.31-alpine@sha256:62ff2089abf5a9ed33bd232895bef5e22f7bb4b200675cec49a5ebc48e3d4ac8
COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
