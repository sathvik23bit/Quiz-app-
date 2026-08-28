import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Flash for grounded generation, Flash-Lite for cheap semantic fallback checks.
// (gemini-2.5-flash/flash-lite are being sunset — updated to the current
// 3.x generation as of Aug 2026.)
export const geminiFlash = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
export const geminiFlashLite = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
