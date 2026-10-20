# Use an official Node.js runtime as the base image
FROM node:18.14.0-alpine

# Set the working directory in the container
WORKDIR /

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]


# docker run -p 3000:3000 f_healthnexus-client:latest