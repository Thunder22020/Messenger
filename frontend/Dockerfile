# Stage 1: build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_WS_URL
RUN VITE_API_URL=${VITE_API_URL} VITE_WS_URL=${VITE_WS_URL} npm run build

# Stage 2: serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
