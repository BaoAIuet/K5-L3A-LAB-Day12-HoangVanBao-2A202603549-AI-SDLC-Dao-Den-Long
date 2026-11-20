FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY public ./public
COPY src ./src
COPY game.contract.json LICENSE CREDITS.md ./
ENV BIND_HOST=0.0.0.0
ENV LEADERBOARD_FILE=/app/data/leaderboard.json
EXPOSE 4173
CMD ["node", "src/server.js"]
