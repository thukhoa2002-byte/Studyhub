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
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Bạn cần đăng nhập để tạo trắc nghiệm.");
  const response = await fetch(`${API_URL}/api/generate-mcq`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData });
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
  source_page?: number;
  image_page?: number;
  image_url?: string;
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

export interface GuidelineExtractionProgress {
  completedChunks: number;
  totalChunks: number;
  sourceLabel: string;
  startPage: number;
  endPage: number;
  entries: ExtractedGuidelineEntry[];
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

export async function extractGuidelinePdfStream(
  document: File,
  supplement: File | null | undefined,
  focus: string,
  onProgress: (progress: GuidelineExtractionProgress) => void,
): Promise<GuidelineExtractionResponse> {
  const formData = new FormData();
  formData.append("document", document);
  if (supplement?.size) formData.append("supplement", supplement);
  formData.append("focus", focus);
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Bạn cần đăng nhập bằng tài khoản quản trị Guideline.");
  const response = await fetch(`${API_URL}/api/extract-guideline/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message || "Không thể bắt đầu đọc guideline bằng AI.");
  }
  const started = (await response.json()) as { jobId?: string };
  if (!started.jobId) throw new Error("Máy chủ không tạo được phiên dịch guideline.");
  let lastSequence = -1;
  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    const progressResponse = await fetch(`${API_URL}/api/extract-guideline/jobs/${started.jobId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const progress = (await progressResponse.json().catch(() => null)) as {
      success?: boolean;
      status?: "running" | "complete" | "error";
      sequence?: number;
      progress?: GuidelineExtractionProgress | null;
      data?: GuidelineExtractionResponse;
      message?: string;
    } | null;
    if (!progressResponse.ok || !progress) throw new Error(progress?.message || "Không thể lấy tiến độ dịch guideline.");
    if (progress.status === "error") throw new Error(progress.message || "Không thể đọc guideline bằng AI.");
    if (progress.status === "complete" && progress.data) return progress.data;
    if (progress.status === "running" && progress.progress && progress.sequence !== lastSequence) {
      lastSequence = progress.sequence ?? lastSequence;
      onProgress(progress.progress);
    }
  }
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
