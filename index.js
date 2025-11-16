// index.js
import http from "http";
import fs from "fs";
import path from "path";
import { Command } from "commander";
import express from "express";

const program = new Command();

program
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port")
  .requiredOption("-c, --cache <path>", "Cache directory path");

program.parse(process.argv);
const options = program.opts();

const HOST = options.host;
const PORT = parseInt(options.port, 10);
const CACHE_DIR = options.cache;

// 1) Переконуємось, що cache-директорія існує
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Створена директорія кешу: ${CACHE_DIR}`);
}

// 2) Створюємо Express-додаток
const app = express();

// Поки що можна простий хендлер
app.get("/", (req, res) => {
  res.status(200).send("Inventory service is running");
});

// 3) Створюємо HTTP-сервер через модуль http
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущено на http://${HOST}:${PORT}`);
});
