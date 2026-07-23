const DRUG_ADMIN_EMAIL = "thukhoa2002@gmail.com";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Thiếu cấu hình Supabase trên server.");
  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function requireDrugImportAdmin(req, res, next) {
  try {
    const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập để nhập dữ liệu thuốc." });
    const { url, anonKey } = supabaseConfig();
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) return res.status(401).json({ success: false, message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
    if (user.email?.trim().toLowerCase() !== DRUG_ADMIN_EMAIL) return res.status(403).json({ success: false, message: "Tài khoản chưa có quyền nhập dữ liệu thuốc." });
    req.drugAdmin = user;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Không thể xác minh quyền nhập dữ liệu thuốc." });
  }
}
