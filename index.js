import http from "http";
import fs from "fs";
import path from "path";
import { Command } from "commander";
import express from "express";
import multer from "multer";


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

// Створюємо директорію кешу, якщо нема
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`Створено директорію кешу: ${CACHE_DIR}`);
}


const app = express();

// Щоб читати JSON
app.use(express.json());

// Щоб читати форму x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Щоб віддавати HTML-форми та інші файли
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

// Це дозволить отримувати фото по URL /inventory-photo/...
app.use("/inventory-photo", express.static(CACHE_DIR));




// Головна сторінка
app.get("/", (req, res) => {
    res.status(200).send("Inventory service is running");
});


// ➤ POST /register
app.post("/register", upload.single("photo"), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        return res.status(400).json({ message: "inventory_name є обовʼязковим" });
    }

    let photoPath = null;
    if (req.file) {
        photoPath = `/inventory-photo/${req.file.filename}`;
    }

    const newItem = {
        id: nextId++,
        inventory_name,
        description: description || "",
        photoPath,
    };

    inventory.push(newItem);

    return res.status(201).json(newItem);
});


// ➤ GET /inventory (всі елементи)
app.get("/inventory", (req, res) => {
    res.status(200).json(inventory);
});


// ➤ GET /inventory/:id (один елемент)
app.get("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find((i) => i.id === id);

    if (!item) {
        return res.status(404).json({ message: "Річ не знайдена" });
    }

    res.status(200).json(item);
});


// ➤ PUT /inventory/:id (оновити назву/опис)
app.put("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find((i) => i.id === id);

    if (!item) {
        return res.status(404).json({ message: "Річ не знайдена" });
    }

    const { inventory_name, description } = req.body;

    if (inventory_name !== undefined) item.inventory_name = inventory_name;
    if (description !== undefined) item.description = description;

    res.status(200).json(item);
});


// ➤ PUT /inventory/:id/photo (оновити фото)
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find((i) => i.id === id);

    if (!item) {
        return res.status(404).json({ message: "Річ не знайдена" });
    }

    if (!req.file) {
        return res.status(400).json({ message: "Фото не передано" });
    }

    item.photoPath = `/inventory-photo/${req.file.filename}`;

    res.status(200).json(item);
});


// ➤ GET /inventory/:id/photo (отримати фото)
app.get("/inventory/:id/photo", (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find((i) => i.id === id);

    if (!item || !item.photoPath) {
        return res.status(404).json({ message: "Фото не знайдено" });
    }

    const fileName = path.basename(item.photoPath);

    // ВАЖЛИВО: правильний абсолютний шлях
    const fullPath = path.resolve(CACHE_DIR, fileName);

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: "Файл фото відсутній" });
    }

    res.sendFile(fullPath);
});


// ➤ DELETE /inventory/:id (видалити елемент)
app.delete("/inventory/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = inventory.findIndex((i) => i.id === id);

    if (index === -1) {
        return res.status(404).json({ message: "Річ не знайдена" });
    }

    inventory.splice(index, 1);

    res.status(200).json({ message: "Річ видалено" });
});


// ➤ GET /RegisterForm.html
app.get("/RegisterForm.html", (req, res) => {
    res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

// ➤ GET /SearchForm.html
app.get("/SearchForm.html", (req, res) => {
    res.sendFile(path.join(__dirname, "SearchForm.html"));
});


// ➤ POST /search (форма пошуку)
app.post("/search", (req, res) => {
    const { id, has_photo } = req.body;
    const numericId = parseInt(id);

    const item = inventory.find((i) => i.id === numericId);

    if (!item) {
        return res.status(404).send("Річ не знайдена");
    }

    let description = item.description;

    if (has_photo && item.photoPath) {
        description += ` (Фото: ${item.photoPath})`;
    }

    res.status(200).json({
        id: item.id,
        inventory_name: item.inventory_name,
        description,
        photoPath: item.photoPath,
    });
});


// 405 Method Not Allowed
app.use((req, res) => {
    res.status(405).send("Method Not Allowed");
});



const server = http.createServer(app);

server.listen(PORT, HOST, () => {
    console.log(`Сервер запущено на http://${HOST}:${PORT}`);
});
