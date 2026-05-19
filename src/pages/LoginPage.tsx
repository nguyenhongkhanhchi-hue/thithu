import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mapSupabaseUser } from "@/lib/auth";
import { useAuth, saveLocalUser } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Step = "email" | "otp" | "password";

// ── Local Mode Login (không cần Supabase) ────────────────────────────────────
const LocalModeLogin: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateLocalUsername } = useAuth();
  const [name, setName] = useState(user?.username || "");

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập tên");
      return;
    }
    updateLocalUsername(trimmed);
    toast.success("Đã lưu tên!");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">✏️</div>
          <h1 className="text-3xl font-bold text-white">ExamTouch</h1>
          <p className="text-blue-200 text-sm mt-1">
            Chế độ cục bộ (Local Mode)
          </p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5">
          {/* Info badge */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800">
            <p className="font-bold mb-1">✅ Không cần đăng nhập!</p>
            <p className="text-xs text-emerald-600">
              Dữ liệu lưu trên thiết bị này. Có thể đặt tên hiển thị bên dưới.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">
              Tên hiển thị
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Nhập tên của bạn..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all shadow-blue-200 shadow-md"
          >
            ✅ Xác nhận & Vào app
          </button>

          <button
            onClick={() => navigate("/")}
            className="w-full text-gray-400 text-sm py-1 hover:text-gray-600"
          >
            Bỏ qua → Vào luôn
          </button>

          {/* Hướng dẫn nâng cấp */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 text-center">
              Muốn đồng bộ đám mây?
            </p>
            <p className="text-xs text-gray-400 text-center mt-1">
              Thêm{" "}
              <code className="bg-gray-100 px-1 rounded">
                VITE_SUPABASE_URL
              </code>{" "}
              vào <code className="bg-gray-100 px-1 rounded">.env.local</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main LoginPage ─────────────────────────────────────────────────────────────
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Nếu không có Supabase → hiện Local Mode
  if (!isSupabaseConfigured) return <LocalModeLogin />;

  // Step 1: Send OTP or login with password
  const handleEmailSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    if (isLogin) {
      // Login mode: just move to password step
      setStep("password");
      setLoading(false);
    } else {
      // Register mode: send OTP
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Mã OTP đã gửi đến email của bạn!");
      setStep("otp");
      setLoading(false);
    }
  };

  // Step 2 (register): Verify OTP then set password
  const handleOtpSubmit = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    if (error) {
      toast.error("Mã OTP không đúng hoặc đã hết hạn");
      setLoading(false);
      return;
    }
    setStep("password");
    setLoading(false);
  };

  // Step 3: Set password (register) or login with password
  const handlePasswordSubmit = async () => {
    if (!password || password.length < 6) {
      toast.error("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    setLoading(true);
    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error("Email hoặc mật khẩu không đúng");
        setLoading(false);
        return;
      }
      navigate("/");
    } else {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: { username: email.split("@")[0] },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      navigate("/");
    }
  };

  const stepTitles: Record<Step, string> = {
    email: isLogin ? "Đăng nhập" : "Tạo tài khoản",
    otp: "Nhập mã OTP",
    password: isLogin ? "Nhập mật khẩu" : "Tạo mật khẩu",
  };

  const stepSubtitles: Record<Step, string> = {
    email: isLogin
      ? "Nhập email để tiếp tục"
      : "Nhập email để nhận mã xác nhận",
    otp: `Mã 4 chữ số đã gửi đến ${email}`,
    password: isLogin
      ? "Nhập mật khẩu tài khoản"
      : "Tạo mật khẩu mới (tối thiểu 6 ký tự)",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">✏️</div>
          <h1 className="text-3xl font-bold text-white">ExamTouch</h1>
          <p className="text-blue-200 text-sm mt-1">
            Ứng dụng thi cảm ứng thông minh
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {/* Step indicator */}
          {!isLogin && (
            <div className="flex items-center gap-2 mb-5">
              {(["email", "otp", "password"] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      s === step
                        ? "bg-blue-600 text-white"
                        : ["email", "otp", "password"].indexOf(s) <
                            ["email", "otp", "password"].indexOf(step)
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {["email", "otp", "password"].indexOf(s) <
                    ["email", "otp", "password"].indexOf(step)
                      ? "✓"
                      : i + 1}
                  </div>
                  {i < 2 && <div className="flex-1 h-0.5 bg-gray-100" />}
                </React.Fragment>
              ))}
            </div>
          )}

          <h2 className="text-xl font-bold text-gray-800 mb-1">
            {stepTitles[step]}
          </h2>
          <p className="text-sm text-gray-400 mb-5">{stepSubtitles[step]}</p>

          {/* Email step */}
          {step === "email" && (
            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                placeholder="email@example.com"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
              <button
                onClick={handleEmailSubmit}
                disabled={loading || !email.trim()}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-base active:scale-[0.98] transition-all disabled:opacity-50 shadow-blue-200 shadow-md"
              >
                {loading ? "⏳ Đang xử lý..." : "Tiếp tục →"}
              </button>
              <p className="text-center text-sm text-gray-400">
                {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setStep("email");
                    setOtp("");
                    setPassword("");
                  }}
                  className="text-blue-600 font-semibold"
                >
                  {isLogin ? "Đăng ký" : "Đăng nhập"}
                </button>
              </p>
            </div>
          )}

          {/* OTP step */}
          {step === "otp" && (
            <div className="space-y-4">
              <input
                type="text"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                onKeyDown={(e) => e.key === "Enter" && handleOtpSubmit()}
                placeholder="• • • •"
                maxLength={4}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-3xl text-center font-bold tracking-[0.5em] focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
              <button
                onClick={handleOtpSubmit}
                disabled={loading || otp.length < 4}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-base active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? "⏳ Đang xác nhận..." : "Xác nhận OTP"}
              </button>
              <button
                onClick={() => setStep("email")}
                className="w-full text-gray-400 text-sm py-2"
              >
                ← Nhập lại email
              </button>
            </div>
          )}

          {/* Password step */}
          {step === "password" && (
            <div className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
              <button
                onClick={handlePasswordSubmit}
                disabled={loading || password.length < 6}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-base active:scale-[0.98] transition-all disabled:opacity-50 shadow-blue-200 shadow-md"
              >
                {loading
                  ? "⏳ Đang xử lý..."
                  : isLogin
                    ? "🔓 Đăng nhập"
                    : "✅ Tạo tài khoản"}
              </button>
              <button
                onClick={() => setStep("email")}
                className="w-full text-gray-400 text-sm py-2"
              >
                ← Quay lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
