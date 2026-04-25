FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./

ENV PORT=11435
EXPOSE 11435

CMD ["node", "index.js"]

