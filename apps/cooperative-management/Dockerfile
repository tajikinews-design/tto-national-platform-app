# Portable OCI container, uses only workspace packages; no Vercel-specific runtime.
FROM node:22-alpine AS build
RUN npm install -g pnpm@10.18.0
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @tto/cooperative-management build
FROM node:22-alpine
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /workspace
COPY --from=build /workspace/apps/cooperative-management/.next/standalone/ ./
COPY --from=build /workspace/apps/cooperative-management/.next/static ./apps/cooperative-management/.next/static
USER node
EXPOSE 3000
CMD ["node","apps/cooperative-management/server.js"]
