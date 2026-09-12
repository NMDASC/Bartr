FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY src ./src
ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]
