# Development image: runs the Vite dev server exactly like `npm run dev -- --host`
# Airflow target is injected at runtime via env vars (VITE_AIRFLOW_API_URL, VITE_AIRFLOW_API_PREFIX)

FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the sources
COPY . .

EXPOSE 5173

# --host 0.0.0.0 makes the dev server reachable outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
