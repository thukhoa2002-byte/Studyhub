import type { Question } from "../types/question";

const API_URL = "http://localhost:3000";

type GeneratedQuestion = Omit<
  Question,
  "id" | "remembered" | "bookmarked"
>;

interface GenerateQuestionsResponse {
  success: boolean;
  text: string;
  data: GeneratedQuestion[];
}

export async function generateQuestions(
  image: File
): Promise<GenerateQuestionsResponse> {
  const formData = new FormData();
  formData.append("image", image);

  const response = await fetch(
    `${API_URL}/api/generate-cloze`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Không thể tạo câu hỏi");
  }

  return response.json();
}