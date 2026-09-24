# Production image (task 27). Built and run by compose.prod.yml.
# ponytail: one stage with dev deps — the Prisma CLI (migrations) and tsx (seed) run inside it; move to output:"standalone" multi-stage if image size ever matters.
FROM node:24-alpine
RUN mkdir -p /app /data/uploads && chown node:node /app /data/uploads
WORKDIR /app
USER node
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Apply pending migrations on every start, then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
