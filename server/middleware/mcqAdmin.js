const MCQ_OWNER_EMAIL = "thukhoa2002@gmail.com";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Thiếu cấu hình Supabase trên server.");
  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function requireMcqAdmin(req, res, next) {
  try {
    const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập để dùng tính năng này." });

    const { url, anonKey } = supabaseConfig();
    const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers });
    const user = await userResponse.json().catch(() => null);
    if (!userResponse.ok) return res.status(401).json({ success: false, message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });

    const email = user?.email?.trim().toLowerCase();
    let allowed = email === MCQ_OWNER_EMAIL;
    if (!allowed) {
      const accessResponse = await fetch(`${url}/rest/v1/rpc/is_mcq_admin`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{}",
      });
      allowed = accessResponse.ok && (await accessResponse.json().catch(() => false)) === true;
    }
    if (!allowed) return res.status(403).json({ success: false, message: "Tài khoản này chưa được cấp quyền sử dụng Xưởng MCQ." });
    req.mcqAdmin = user;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Không thể xác minh quyền quản trị MCQ." });
  }
}

