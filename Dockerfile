# Використовуємо офіційний Node.js
FROM node:18

# Створюємо робочу директорію
WORKDIR /app

# Копіюємо package.json
COPY package*.json ./

# Встановлюємо залежності
RUN npm install

# Копіюємо весь проект у контейнер
COPY . .

# Створюємо директорію кешу
RUN mkdir -p cache

# Команда запуску
CMD ["node", "index.js", "--host", "0.0.0.0", "--port", "3000", "--cache", "./cache"]

# Відкриваємо порт контейнера
EXPOSE 3000
