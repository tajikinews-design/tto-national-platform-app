# Portable OCI container, uses only workspace packages; no Vercel-specific runtime.
FROM node:22-alpine AS build
RUN npm install -g pnpm@10.18.0
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @tto/shareholder build
FROM node:22-alpine
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /workspace
COPY --from=build /workspace/apps/shareholder/.next/standalone/ ./
COPY --from=build /workspace/apps/shareholder/.next/static ./apps/shareholder/.next/static
USER node
EXPOSE 3000
CMD ["node","apps/shareholder/server.js"]
