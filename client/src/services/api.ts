const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export interface GeneratedQuestion {
  id: string;

  question: string;
  answer: string;

  category: string;
  importance: number;

  bookmarked: boolean;
}

export interface Deck {
  id: string;

  title: string;

  createdAt: number;

  questions: GeneratedQuestion[];
}

export interface GenerateQuestionsResponse {
  success: boolean;

  text: string;

  title: string;

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

  const result =
    (await response.json()) as GenerateQuestionsResponse;

  result.data = result.data.map((question, index) => ({
    ...question,

    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : index.toString(),

    bookmarked: false,
  }));

  return result;
}

export async function importAnkiPackage(
  deck: File
): Promise<GenerateQuestionsResponse> {
  const formData = new FormData();

  formData.append("deck", deck);

  const response = await fetch(`${API_URL}/api/import-anki`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Không thể đọc file Anki.");
  }

  const result =
    (await response.json()) as GenerateQuestionsResponse;

  result.data = result.data.map((question, index) => ({
    ...question,

    id: question.id || (
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : index.toString()
    ),

    bookmarked: false,
  }));

  return result;
}
