FROM node:22-alpine AS build
RUN npm install -g pnpm@10.18.0
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tto/api build
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace ./
USER node
EXPOSE 3001
CMD ["node","services/api/dist/main.js"]
