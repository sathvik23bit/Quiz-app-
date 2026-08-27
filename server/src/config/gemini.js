import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Flash for grounded generation, Flash-Lite for cheap semantic fallback checks.
export const geminiFlash = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
export const geminiFlashLite = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
