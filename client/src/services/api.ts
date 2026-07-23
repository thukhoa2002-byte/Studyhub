import type { DrugImportCandidate } from "../utils/drugImport";
import type { GuidelineTableBundle } from "../utils/guidelineImport";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export async function getAiCallsRemaining(): Promise<number | null> {
  const response = await fetch(`${API_URL}/api/ai-usage`);
  if (!response.ok) return null;
  const result = (await response.json()) as { aiCallsRemaining?: number };
  return typeof result.aiCallsRemaining === "number" ? result.aiCallsRemaining : null;
}

async function drugImportRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
    session = refreshed.data.session;
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Máy chủ trả về lỗi ${response.status}.`);
  }
  return response;
}

export async function parseDrugImportJson(raw: string): Promise<DrugImportCandidate[]> {
  const response = await drugImportRequest("/api/admin/thuoc/import/parse-json", { method: "POST", body: JSON.stringify({ raw }) });
  const result = await response.json() as { candidates: DrugImportCandidate[] };
  return result.candidates;
}

export async function extractDrugDocument(file: File): Promise<{ text: string; sourceType: "pdf" | "docx"; originalFileName: string; characterCount: number }> {
  const form = new FormData();
  form.append("file", file);
  const response = await drugImportRequest("/api/admin/thuoc/import/extract-file", { method: "POST", body: form });
  const result = await response.json() as { data: { text: string; sourceType: "pdf" | "docx"; originalFileName: string; characterCount: number } };
  return result.data;
}

export async function extractDrugWithAi(input: { text: string; drugName?: string; documentKind?: "drug" | "guideline_table"; sourceMetadata: Record<string, string | number | null>; rawFileName?: string }): Promise<{ candidate?: DrugImportCandidate; bundle?: GuidelineTableBundle; mode?: "guideline_table"; aiCallsRemaining?: number; chunksProcessed?: number; aiModel?: string; promptVersion?: string }> {
  const response = await drugImportRequest("/api/admin/thuoc/import/extract-ai", { method: "POST", body: JSON.stringify(input) });
  return await response.json() as { candidate: DrugImportCandidate; aiCallsRemaining?: number };
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
  shared_context?: string;
}

export interface McqImportResponse {
  success: boolean;
  data: { title: string; questions: ImportedMcqQuestion[] };
  aiCallsRemaining?: number;
}

async function startMcqImportJob(files: File[], accessToken: string): Promise<string> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await fetch(`${API_URL}/api/mcq-import/jobs`, {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: formData,
  });
  if (!response.ok) throw new Error(await apiErrorMessage(response, "Không thể bắt đầu trích xuất bộ MCQ."));
  const started = (await response.json()) as { jobId?: string };
  if (!started.jobId) throw new Error("Máy chủ không tạo được phiên trích xuất MCQ.");
  return started.jobId;
}

async function apiErrorMessage(response: Response, fallback: string) {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    if (parsed.message || parsed.error) return parsed.message || parsed.error || fallback;
  } catch {
    // Render may return an HTML error page instead of JSON.
  }
  if (body.trim().startsWith("<")) return fallback + " (HTTP " + response.status + "). Máy chủ đã đóng kết nối trước khi xử lý xong.";
  return body.trim() || fallback + " (HTTP " + response.status + ").";
}

export async function extractMcqFiles(files: File[]): Promise<McqImportResponse> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const supabaseClient = supabase;
  const { data: { session } } = await supabaseClient.auth.getSession();
  let accessToken = session?.access_token || "";
  let authRefreshCount = 0;
  async function refreshMcqSession() {
    if (authRefreshCount >= 2) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.");
    const refreshed = await supabaseClient.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.");
    accessToken = refreshed.data.session.access_token;
    authRefreshCount += 1;
  }
  if (!accessToken || (session?.expires_at && session.expires_at * 1000 <= Date.now() + 60_000)) await refreshMcqSession();
  let jobId: string;
  try {
    jobId = await startMcqImportJob(files, accessToken);
  } catch (startError) {
    if (!/phiên đăng nhập|đăng nhập không hợp lệ/i.test(startError instanceof Error ? startError.message : String(startError))) throw startError;
    await refreshMcqSession();
    jobId = await startMcqImportJob(files, accessToken);
  }
  let restartedAfterMissingJob = false;
  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    const progressResponse = await fetch(`${API_URL}/api/mcq-import/jobs/${jobId}`, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!progressResponse.ok) {
      if (progressResponse.status === 401 && authRefreshCount < 2) {
        await refreshMcqSession();
        continue;
      }
      if (progressResponse.status >= 500) continue;
      if (progressResponse.status === 404) {
        if (!restartedAfterMissingJob) {
          restartedAfterMissingJob = true;
          jobId = await startMcqImportJob(files, accessToken);
          continue;
        }
        throw new Error("Phiên trích xuất đã hết trên máy chủ. Hãy bấm lại nút đọc file để bắt đầu phiên mới.");
      }
      throw new Error(await apiErrorMessage(progressResponse, "Không thể lấy kết quả trích xuất MCQ."));
    }
    const progress = (await progressResponse.json()) as { status?: "running" | "complete"; success?: boolean; data?: McqImportResponse["data"]; aiCallsRemaining?: number; message?: string };
    if (progress.status === "complete" && progress.data) return { success: true, data: progress.data, aiCallsRemaining: progress.aiCallsRemaining };
    if (progress.success === false) throw new Error(progress.message || "Không thể trích xuất bộ MCQ.");
  }
}

export async function extractMcqFilesLocally(files: File[]): Promise<McqImportResponse> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await supabase.auth.getSession();
  let accessToken = session?.access_token || "";
  if (!accessToken) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.");
    accessToken = refreshed.data.session.access_token;
  }
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await fetch(`${API_URL}/api/mcq-import/local`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!response.ok) throw new Error(await apiErrorMessage(response, "Không thể nhận diện file trên máy."));
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
