FROM node:16

# Install necessary utilities
RUN apt-get update && apt-get install -y net-tools netcat-openbsd curl iputils-ping

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run your app
CMD ["node", "server.js"]