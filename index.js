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

const INVENTORY_FILE = path.join(__dirname, "inventory.json");

let inventory = [];
let nextId = 1;

// -------------------------------
// JSON LOAD / SAVE
// -------------------------------
function saveInventory() {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventory, null, 2));
}

function loadInventory() {
    if (fs.existsSync(INVENTORY_FILE)) {
        const data = fs.readFileSync(INVENTORY_FILE, "utf-8");
        inventory = JSON.parse(data);

        // Відновлюємо nextId щоб ID не повторювались
        nextId = inventory.length > 0
            ? Math.max(...inventory.map(i => i.id)) + 1
            : 1;
    }
}

loadInventory(); // <<< ОБОВ'ЯЗКОВО

// -------------------------------
// EXPRESS INIT
// -------------------------------
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

// -------------------------------
// MULTER (UPLOADS)
// -------------------------------
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

// -------------------------------
// ROUTES
// -------------------------------

app.get("/", (req, res) => {
    res.status(200).send("Inventory service is running");
});

// GET SEARCH
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

// POST REGISTER
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
    saveInventory(); // *** ЗБЕРІГАЄМО У ФАЙЛ ***

    res.status(201).json(newItem);
});

// GET ALL
app.get("/inventory", (req, res) => {
    res.status(200).json(inventory);
});

// GET BY ID
app.get("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item) return res.status(404).json({ message: "Річ не знайдена" });

    res.status(200).json(item);
});

// UPDATE NAME/DESCRIPTION
app.put("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item) return res.status(404).json({ message: "Річ не знайдена" });

    const { inventory_name, description } = req.body;

    if (inventory_name !== undefined) item.inventory_name = inventory_name;
    if (description !== undefined) item.description = description;

    saveInventory();
    res.status(200).json(item);
});

// GET PHOTO
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

// UPDATE PHOTO
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(i => i.id === id);

    if (!item)
        return res.status(404).json({ message: "Річ не знайдена" });

    if (!req.file)
        return res.status(400).json({ message: "Фото не передано" });

    item.photoPath = `/inventory-photo/${req.file.filename}`;

    saveInventory(); // <<< ВАЖЛИВО

    res.status(200).json(item);
});

// DELETE ITEM
app.delete("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = inventory.findIndex(i => i.id === id);

    if (index === -1)
        return res.status(404).json({ message: "Річ не знайдена" });

    inventory.splice(index, 1);
    saveInventory();

    res.status(200).json({ message: "Річ видалено" });
});

// POST SEARCH
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

// FALLBACK
app.use((req, res) => {
    res.status(405).send("Method Not Allowed");
});

// SERVER
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
    console.log(`Сервер запущено: http://${HOST}:${PORT}`);
});
