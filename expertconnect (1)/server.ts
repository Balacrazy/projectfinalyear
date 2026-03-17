import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini AI Setup
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // API Route for Auto-Response
  app.post("/api/auto-respond", async (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Missing title or description" });
    }

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a helpful expert response to this request. 
        Title: ${title}
        Description: ${description}
        
        Format your response as JSON with the following structure:
        {
          "summary": "A concise summary of the solution",
          "links": ["List of 2-3 helpful article URLs"],
          "videos": ["List of 1-2 helpful YouTube video titles or search queries"]
        }`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text);
      res.json(result);
    } catch (error) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: "Failed to generate auto-response" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
