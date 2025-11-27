FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY src/orderbook/package*.json ./
COPY src/orderbook/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source
COPY src/orderbook/src ./src

# Build
RUN npm run build

# Create data directory for WAL at Render's persistent disk mount
RUN mkdir -p /data/wal

# Expose port
EXPOSE 3001

# Start
CMD ["npm", "start"]
