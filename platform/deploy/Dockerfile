# Image de production de Spacora (construite par docker-compose.prod.yml).
FROM node:22-bookworm-slim AS build
WORKDIR /app
# OpenSSL : requis par le moteur Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# Schéma Prisma avant l'installation : `npm ci` génère le client Prisma (postinstall)
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# Adresse factice : la construction ne se connecte pas à la base, mais le client Prisma exige la variable
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Dépendances complètes conservées : Prisma (migrations) et tsx (purge) servent en production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
