# Candidate isolated test image; build context is repository root, not live Bolt.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY experiments/account-test-service/package.json experiments/account-test-service/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY experiments/account-keys-prototype/*.mjs ./experiments/account-keys-prototype/
COPY experiments/oidc-library-lab/adapter.mjs experiments/oidc-library-lab/zip-intake.mjs ./experiments/oidc-library-lab/
COPY experiments/account-test-service/*.mjs ./experiments/account-test-service/
COPY experiments/account-test-service/public/ ./experiments/account-test-service/public/
USER node
EXPOSE 3000
CMD ["node","experiments/account-test-service/server.mjs"]
