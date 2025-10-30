FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache curl \
 && npm install --omit=dev
COPY src ./src
ENV PORT=8000
EXPOSE 8000
CMD ["node","src/server.js"]