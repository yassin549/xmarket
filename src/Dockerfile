FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build
RUN npm run build

# Create data directory for WAL
RUN mkdir -p /var/data/wal

# Expose port
EXPOSE 3001

# Start
CMD ["node", "dist/backend/server.js"]
