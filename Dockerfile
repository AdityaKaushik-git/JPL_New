# ---------- 1. build the React client ----------
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- 2. production server ----------
FROM node:20-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
# bcrypt ships prebuilt binaries for alpine/musl; build tools are only a fallback
RUN apk add --no-cache --virtual .build python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev && apk del .build
COPY server ./server
COPY database ./database
COPY --from=client /app/client/dist ./client/dist
EXPOSE 3000
# Runs the idempotent migration, then starts the server.
CMD ["npm", "start"]
