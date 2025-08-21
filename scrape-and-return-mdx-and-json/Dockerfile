FROM node:24-slim

WORKDIR /usr/src/app

# Install Chromium and cleanup in a single layer
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY . .

CMD ["node", "index.js"]