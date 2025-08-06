# Multi-stage build for Node.js server
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    curl \
    bash \
    openssh-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 8000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for production
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    curl \
    bash \
    openssh-client \
    dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cline -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=build --chown=cline:nodejs /app/dist ./dist
COPY --from=build --chown=cline:nodejs /app/node_modules ./node_modules

# Create data directory
RUN mkdir -p /app/data /app/repositories && \
    chown -R cline:nodejs /app/data /app/repositories

# Switch to non-root user
USER cline

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
