FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

FROM node:18-alpine

WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cryptexa -u 1001

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/package.json ./package.json
COPY --from=build /app/dist ./dist

# Create data directory and set permissions
RUN mkdir -p /app/data && chown -R cryptexa:nodejs /app

# Switch to non-root user
USER cryptexa

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/server.js"]
