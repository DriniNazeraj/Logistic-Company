FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN chmod +x start.sh

USER node

EXPOSE 3001

CMD ["./start.sh"]
