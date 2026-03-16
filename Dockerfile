ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS build
ARG NEXT_PUBLIC_API_SERVER="http://45.169.83.78:8001"
ARG NEXT_PUBLIC_READER_AUTH_TOKEN=""
ENV NEXT_PUBLIC_API_SERVER=$NEXT_PUBLIC_API_SERVER
ENV NEXT_PUBLIC_READER_AUTH_TOKEN=$NEXT_PUBLIC_READER_AUTH_TOKEN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules

RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "start"]
