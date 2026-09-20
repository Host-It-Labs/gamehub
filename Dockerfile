FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 DATABASE_PATH=/data/gamehub.sqlite
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --from=build --chown=node:node /app/dist/client ./dist/client
COPY --chown=node:node server ./server
COPY --chown=node:node lib/games ./lib/games
COPY --chown=node:node lib/online ./lib/online
COPY --chown=node:node scripts/reset-password.ts scripts/backup.ts ./scripts/
COPY --chown=node:node package.json LICENSE ./
USER node
EXPOSE 8080
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "server/index.ts"]
