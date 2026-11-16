# Astraeus — production image (build once, serve dist/ + API with Express)
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server.ts tsconfig.json ./
COPY src ./src
COPY public ./public
EXPOSE 3000
CMD ["npm", "start"]
