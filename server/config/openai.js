import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Thiếu OPENAI_API_KEY. Hãy thêm biến môi trường này để dùng tính năng AI.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}
