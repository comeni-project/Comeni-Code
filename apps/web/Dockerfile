# The web app, built and served by nginx (M0 part 8 spec, P8.2).
# Build from the repository root: docker build -f apps/web/Dockerfile .
# Base images are pinned by digest; Dependabot bumps them (.github/dependabot.yml).

FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS build
WORKDIR /web
# The lockfile first, so editing a component doesn't reinstall everything. .npmrc refuses install
# scripts, as it does locally.
COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de
COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
