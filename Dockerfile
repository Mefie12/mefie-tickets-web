# Dev-mode Dockerfile — hot reload via bind mount (see docker-compose.yml
# at the workspace root). Not a production build (that's Milestone 9).
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
