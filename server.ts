import express from "express";
import type { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import fs from "fs";

import { createClient } from "@supabase/supabase-js";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

dotenv.config();

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  console.error(
    [
      "[Backend] Variáveis do Supabase ausentes.",
      "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (recomendado) ou SUPABASE_ANON_KEY.",
      "Dica: no frontend use VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    ].join(" ")
  );
}

const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder");

// Test Supabase connection on startup
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) {
      console.warn("Backend Supabase connection warning:", error.message);
    } else {
      console.log("Backend Supabase connection successful.");
    }
  } catch (err) {
    console.error("Backend Supabase connection failed:", err);
  }
}
testSupabaseConnection();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.set('trust proxy', 1);
app.use(cookieParser());

// API Routes
app.post("/api/upload", upload.single("file"), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const bucket = "tickets";

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: req.file.mimetype,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    // Clean up local file
    fs.unlinkSync(req.file.path);

    res.json({
      id: fileName,
      name: req.file.originalname,
      url: publicUrl,
      type: req.file.mimetype.startsWith("image/") ? "image" : "file",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Erro ao fazer upload para o Supabase Storage." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
