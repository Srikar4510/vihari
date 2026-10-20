# Optional: run the API in a container (Render can also run it directly with "npm start").
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "app.js"]
