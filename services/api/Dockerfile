FROM node:22-alpine AS source
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN corepack prepare pnpm@10.18.0 --activate && pnpm install --no-frozen-lockfile
RUN pnpm --filter @tto/api build
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=source /workspace /workspace
USER node
EXPOSE 3001
CMD ["node","services/api/dist/main.js"]
