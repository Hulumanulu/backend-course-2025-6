import http from "http";
import fs from "fs";
import path from "path";
import { Command } from "commander";
import express from "express";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

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

const __dirname = path.resolve();

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`Створено директорію кешу: ${CACHE_DIR}`);
}

const app = express();

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Inventory Service API",
            version: "1.0.0",
            description: "Лабораторна робота №6. Сервіс інвентаризації.",
        },
        servers: [{ url: `http://${HOST}:${PORT}` }],
    },
    apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

let inventory = [];
let nextId = 1;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, CACHE_DIR);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `photo_${Date.now()}${ext}`);
    },
});

const upload = multer({ storage });

app.use("/inventory-photo", express.static(CACHE_DIR));

/**
 * @openapi
 * /:
 *   get:
 *     summary: Перевірка роботи сервера
 *     responses:
 *       200:
 *         description: Сервер працює
 */
app.get("/", (req, res) => {
    res.status(200).send("Inventory service is running");
});

/**
 * @openapi
 * /search:
 *   get:
 *     summary: Пошук речі через форму (GET)
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includePhoto
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Знайдено
 *       404:
 *         description: Не знайдено
 */
app.get("/search", (req, res) => {
    const id = parseInt(req.query.id);
    const includePhoto = req.query.includePhoto === "on";

    const item = inventory.find(i => i.id === id);
    if (!item) return res.status(404).send("Річ не знайдена");

    if (includePhoto && item.photoPath) {
        const fileName = path.basename(item.photoPath);
        const fullPath = path.resolve(CACHE_DIR, fileName);

        if (!fs.existsSync(fullPath))
            return res.status(404).send("Фото не знайдено");

        return res.sendFile(fullPath);
    }

    res.status(200).json(item);
});

/**
 * @openapi
 * /register:
 *   post:
 *     summary: Реєстрація нової речі
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Успішно створено
 *       400:
 *         description: Некоректні дані
 */
app.post("/register", upload.single("photo"), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        return res.status(400).json({ message: "inventory_name є обовʼязковим" });
    }

    let photoPath = null;
    if (req.file) photoPath = `/inventory-photo/${req.file.filename}`;

    const newItem = {
        id: nextId++,
        inventory_name,
        description: description || "",
        photoPath,
    };

    inventory.push(newItem);
    res.status(201).json(newItem);
});

/**
 * @openapi
 * /inventory:
 *   get:
 *     summary: Отримати список речей
 *     responses:
 *       200:
 *         description: Список отримано
 */
app.get("/inventory", (req, res) => {
    res.status(200).json(inventory);
});

/**
 * @openapi
 * /inventory/{id}:
 *   get:
 *     summary: Отримати річ за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Річ знайдено
 *       404:
 *         description: Не знайдено
 */
app.get("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);
    if (!item) return res.status(404).json({ message: "Річ не знайдена" });
    res.status(200).json(item);
});

/**
 * @openapi
 * /inventory/{id}:
 *   put:
 *     summary: Оновити назву або опис
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Оновлено
 *       404:
 *         description: Не знайдено
 */
app.put("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);
    if (!item) return res.status(404).json({ message: "Річ не знайдена" });

    const { inventory_name, description } = req.body;
    if (inventory_name !== undefined) item.inventory_name = inventory_name;
    if (description !== undefined) item.description = description;

    res.status(200).json(item);
});

/**
 * @openapi
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Фото повернуто
 *       404:
 *         description: Не знайдено
 */
app.get("/inventory/:id/photo", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item || !item.photoPath)
        return res.status(404).json({ message: "Фото не знайдено" });

    const fileName = path.basename(item.photoPath);
    const fullPath = path.resolve(CACHE_DIR, fileName);

    if (!fs.existsSync(fullPath))
        return res.status(404).json({ message: "Файл відсутній" });

    res.sendFile(fullPath);
});

/**
 * @openapi
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фото
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       400:
 *         description: Фото не передано
 *       404:
 *         description: Річ не знайдена
 */
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item) return res.status(404).json({ message: "Річ не знайдена" });
    if (!req.file) return res.status(400).json({ message: "Фото не передано" });

    item.photoPath = `/inventory-photo/${req.file.filename}`;
    res.status(200).json(item);
});

/**
 * @openapi
 * /inventory/{id}:
 *   delete:
 *     summary: Видалити річ
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Видалено
 *       404:
 *         description: Не знайдено
 */
app.delete("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = inventory.findIndex(i => i.id === id);

    if (index === -1)
        return res.status(404).json({ message: "Річ не знайдена" });

    inventory.splice(index, 1);
    res.status(200).json({ message: "Річ видалено" });
});

/**
 * @openapi
 * /search:
 *   post:
 *     summary: Пошук речі через форму (POST)
 *     consumes:
 *       - application/x-www-form-urlencoded
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               has_photo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Знайдено
 *       404:
 *         description: Не знайдено
 */
app.post("/search", (req, res) => {
    const { id, has_photo } = req.body;
    const numericId = parseInt(id);
    const item = inventory.find(i => i.id === numericId);

    if (!item) return res.status(404).send("Річ не знайдена");

    let desc = item.description;
    if (has_photo && item.photoPath)
        desc += ` (Фото: ${item.photoPath})`;

    res.status(200).json({
        id: item.id,
        inventory_name: item.inventory_name,
        description: desc,
        photoPath: item.photoPath,
    });
});

// 405 fallback
app.use((req, res) => {
    res.status(405).send("Method Not Allowed");
});

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
    console.log(`Сервер запущено: http://${HOST}:${PORT}`);
});
