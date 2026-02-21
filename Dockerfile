FROM node:18-alpine

WORKDIR /dg-bcda

COPY package*.json ./
RUN apk add --no-cache python3 make g++ gcc cmake

RUN npm install

COPY . .

CMD [ "npm", "start" ]
