const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface GeneratedQuestion {
  question: string;
  answer: string;
  category: string;
  importance: number;
}

export interface GenerateQuestionsResponse {
  success: boolean;
  text: string;
  data: GeneratedQuestion[];
}

export async function generateQuestions(
  image: File
): Promise<GenerateQuestionsResponse> {
  const formData = new FormData();
  formData.append("image", image);

  const response = await fetch(`${API_URL}/api/generate-cloze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Không thể kết nối tới server.");
  }

  return (await response.json()) as GenerateQuestionsResponse;
}