# Single-stage image for the educational app: builds shared + schema + frontend,
# then runs the Express backend (via tsx) which also serves the built UI and the
# schema OOBI. Image size is not optimised — clarity over size for a teaching repo.
FROM node:22-bookworm-slim
WORKDIR /app

# Install workspace deps (dev deps included — tsx runs the backend).
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

# Copy sources and build shared types, the SAIDified schema, and the frontend.
COPY . .
RUN npm run build:shared \
 && npm run schema:saidify \
 && npm run build:frontend

ENV NODE_ENV=production
EXPOSE 3001
# npm runs the script with cwd = backend/, so the issuer salt persists to
# backend/data/issuer.salt (the mounted volume).
CMD ["npm", "run", "start", "-w", "backend"]
