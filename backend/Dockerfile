FROM node:22-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++ wget

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
