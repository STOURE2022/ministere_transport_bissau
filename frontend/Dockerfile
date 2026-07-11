# --- Étape build : Node 20 (npm 10, bug optional-deps #4828 corrigé) ---
FROM node:20-slim AS build
WORKDIR /app

# Installe les dépendances à partir du seul package.json (pas de lock Windows).
# npm 10 résout correctement le binaire natif @tailwindcss/oxide pour Linux.
COPY package.json ./
RUN npm install

# Copie le code source et compile la SPA (Vite → dossier dist/)
COPY . .
RUN npm run build

# --- Étape run : image légère qui sert les fichiers statiques ---
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
# Railway injecte $PORT ; repli sur 3000 en local
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
