# EXEMPLE NON TESTÉ — à valider avant tout usage réel.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
USER node
EXPOSE 3000
# Les migrations sont appliquées séparément : npx prisma migrate deploy
CMD ["npm", "run", "start"]
