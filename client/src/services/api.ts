const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export async function getAiCallsRemaining(): Promise<number | null> {
  const response = await fetch(`${API_URL}/api/ai-usage`);
  if (!response.ok) return null;
  const result = (await response.json()) as { aiCallsRemaining?: number };
  return typeof result.aiCallsRemaining === "number" ? result.aiCallsRemaining : null;
}

export interface GeneratedQuestion {
  id: string;

  scope?: "shared" | "personal";
  creatorLabel?: string;

  question: string;
  answer: string;

  category: string;
  importance: number;

  reviewState?: "new" | "learning" | "due";

  bookmarked: boolean;
  options?: string[];
  correctOption?: string;
  explanation?: string;
}

export async function generateMultipleChoice(image: File): Promise<GenerateQuestionsResponse> {
  const formData = new FormData();
  formData.append("image", image);
  const response = await fetch(`${API_URL}/api/generate-mcq`, { method: "POST", body: formData });
  if (!response.ok) { const error = (await response.json().catch(() => null)) as { message?: string } | null; throw new Error(error?.message || "Không thể tạo câu trắc nghiệm."); }
  const result = (await response.json()) as GenerateQuestionsResponse;
  result.data = result.data.map((question, index) => ({ ...question, id: crypto.randomUUID?.() ?? index.toString(), bookmarked: false }));
  return result;
}

export async function generateClinicalCase(image: File): Promise<GenerateQuestionsResponse> {
  const formData = new FormData();
  formData.append("image", image);
  const response = await fetch(`${API_URL}/api/generate-clinical-case`, { method: "POST", body: formData });
  if (!response.ok) { const error = (await response.json().catch(() => null)) as { message?: string } | null; throw new Error(error?.message || "Không thể tạo case lâm sàng."); }
  const result = (await response.json()) as GenerateQuestionsResponse;
  result.data = result.data.map((question, index) => ({ ...question, id: crypto.randomUUID?.() ?? index.toString(), bookmarked: false }));
  return result;
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
  aiCallsRemaining?: number;
  importSummary?: {
    format: string;
    noteCount: number;
    cardCount: number;
    deckCount: number;
    noteTypeCount: number;
    mediaCount: number;
    mediaReferenced?: number;
    mediaUploaded?: number;
    mediaFailed?: number;
    skippedCount: number;
    mediaNotice?: string;
  };
}

export interface ImportedMcqOption {
  id: "A" | "B" | "C" | "D";
  text: string;
}

export interface ImportedMcqQuestion {
  source_number: number;
  question: string;
  options: ImportedMcqOption[];
  correct_answer: "A" | "B" | "C" | "D" | "";
  explanation: string;
  image_source_name: string;
  image_alt: string;
  review_note: string;
}

export interface McqImportResponse {
  success: boolean;
  data: { title: string; questions: ImportedMcqQuestion[] };
  aiCallsRemaining?: number;
}

export async function extractMcqFiles(files: File[]): Promise<McqImportResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Bạn cần đăng nhập bằng tài khoản quản trị MCQ.");
  const response = await fetch(`${API_URL}/api/mcq-import/extract`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let error: { message?: string; error?: string } | null = null;
    try { error = JSON.parse(body) as { message?: string; error?: string }; } catch { /* proxy may return plain text */ }
    throw new Error(error?.message || error?.error || body.trim() || `Không thể trích xuất bộ MCQ (HTTP ${response.status}).`);
  }
  return (await response.json()) as McqImportResponse;
}

export interface ExtractedGuidelineEntry {
  topic: string;
  drugName: string;
  clinicalContext: string;
  recommendationSummary: string;
  dose: string;
  renalAdjustment: string;
  hepaticAdjustment: string;
  contraindications: string;
  monitoring: string;
  recommendationClass: string;
  evidenceLevel: string;
  pageReference: string;
  tableKind: "recommendation" | "data";
  tableRowRole: "header" | "section" | "body";
  tableCells: Array<{ text: string; colSpan: number; rowSpan: number; backgroundColor: string; textColor: string; textAlign: "left" | "center" | "right"; fontWeight: "normal" | "bold" }>;
}

export interface GuidelineExtractionResponse {
  success: boolean;
  data: {
    documentTitle: string;
    society: string;
    condition: string;
    publicationYear: number;
    versionLabel: string;
    sourceUrl: string;
    entries: ExtractedGuidelineEntry[];
  };
  aiCallsRemaining?: number;
}

export async function extractGuidelinePdf(document: File, supplement?: File | null, focus = ""): Promise<GuidelineExtractionResponse> {
  const formData = new FormData();
  formData.append("document", document);
  if (supplement?.size) formData.append("supplement", supplement);
  formData.append("focus", focus);
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Bạn cần đăng nhập bằng tài khoản quản trị Guideline.");
  const response = await fetch(`${API_URL}/api/extract-guideline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message || "Không thể đọc guideline bằng AI.");
  }
  return (await response.json()) as GuidelineExtractionResponse;
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

  if (!response.ok) { const error = (await response.json().catch(() => null)) as { message?: string } | null; throw new Error(error?.message || "Không thể kết nối tới server."); }

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

  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Bạn cần đăng nhập để nhập file Anki và lưu hình ảnh.");

  const response = await fetch(`${API_URL}/api/import-anki`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message || "Không thể đọc file Anki.");
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
