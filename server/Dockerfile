FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN chmod +x start.sh

EXPOSE 3001

CMD ["./start.sh"]
