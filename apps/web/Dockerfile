# The web app, built and served by nginx (M0 part 8 spec, P8.2).
# Build from the repository root: docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /web
# The lockfile first, so editing a component doesn't reinstall everything. .npmrc refuses install
# scripts, as it does locally.
COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM nginx:1.29-alpine
COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
