FROM node:22-slim

# Build tools for compiling better-sqlite3 if no prebuilt binary matches
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Use the Node headers already bundled in this image instead of
# letting node-gyp fetch them from the network (that fetch kept timing out)
ENV npm_config_nodedir=/usr/local

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# db.js creates this itself, but we create it up front so the
# volume mount below has somewhere to attach to
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]