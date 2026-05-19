# ⚡ Quick Start - Deploy ExamTouch lên Vercel

## 🎯 Làm gì sau đây? (5 phút)

### Bước 1: Cài dependencies
```bash
npm install
```

### Bước 2: Lấy Gemini API Key (MIỄN PHÍ)
1. Vào: https://makersuite.google.com/app/apikey
2. Đăng nhập Google
3. Click "Create API Key" → Copy key

### Bước 3: Tạo file .env.local
```bash
# Copy từ template
cp .env.example .env.local

# Sửa file .env.local với thông tin của bạn:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
GEMINI_API_KEY=paste_key_vừa_lấy_ở_bước_2
```

### Bước 4: Test local
```bash
npm run dev
# Mở http://localhost:5173
```

### Bước 5: Deploy lên Vercel
```bash
# Cách 1: Qua GitHub (Recommend)
git add .
git commit -m "Ready for Vercel"
git push

# Sau đó:
# - Vào https://vercel.com/new
# - Import repo của bạn
# - Thêm Environment Variables (giống .env.local)
# - Click Deploy

# Cách 2: Qua CLI
npm i -g vercel
vercel login
vercel
```

## ✅ Xong!

URL của bạn: `https://your-app.vercel.app`

---

## 📖 Chi tiết hơn?

- Deploy guide đầy đủ: `DEPLOY.md`
- So sánh OnSpace vs Vercel: `UPGRADE_GUIDE.md`
- Troubleshooting: Xem phần cuối trong `DEPLOY.md`

## 🆘 Cần giúp?

1. API không hoạt động? → Check Environment Variables trong Vercel
2. Build failed? → Check logs trong Vercel Dashboard  
3. CORS error? → Thêm domain vào Supabase allowed origins

---

**Chúc may mắn! 🚀**
