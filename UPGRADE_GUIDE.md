# 🚀 Upgrade Guide: OnSpace → Vercel

## 📊 So sánh Before/After

### ❌ TRƯỚC (OnSpace):
```
Frontend (React)
    ↓
Supabase Edge Functions (Deno)
    ↓ (OnSpace AI API)
Google Gemini
    ↓
Database (Supabase)

❌ Phụ thuộc OnSpace API
❌ Không tự quản lý được
❌ Nếu OnSpace đổi/ngừng → App die
```

### ✅ SAU (Vercel):
```
Frontend (React + Vite) → Vercel Static
    ↓
Vercel Serverless Functions (Node.js)
    ↓ (Your own API key)
Google Gemini / OpenAI
    ↓
Database (Supabase)

✅ Tự quản lý 100%
✅ Không phụ thuộc bên thứ 3
✅ Dễ scale và maintain
✅ MIỄN PHÍ với Free tier
```

## 🔑 Điểm khác biệt chính

| Feature | OnSpace | Vercel |
|---------|---------|--------|
| **Backend Control** | ❌ Limited | ✅ Full control |
| **API Dependency** | ❌ OnSpace API | ✅ Your API key |
| **Cost** | ❓ Unknown | ✅ Free tier |
| **Scalability** | ⚠️ OnSpace limit | ✅ Easy scale |
| **Custom Domain** | ❓ | ✅ Yes |
| **Auto Deploy** | ✅ Yes | ✅ Yes (GitHub) |
| **Analytics** | ❌ No | ✅ Yes |
| **Edge Network** | ❓ | ✅ Global CDN |

## 📁 Cấu trúc mới

```
ExamTouch/
├── api/                        # 🆕 Vercel Serverless Functions
│   ├── generate-exam.ts       # Migrate từ Supabase function
│   └── ocr-extract.ts         # Migrate từ Supabase function
│
├── src/                       # Frontend (không đổi)
│   ├── components/
│   ├── pages/
│   └── lib/
│       └── supabase.ts       # Giữ nguyên cho Auth + DB
│
├── supabase/                  # ⚠️ Không dùng functions nữa
│   └── (chỉ để reference)
│
├── vercel.json               # 🆕 Vercel config
├── .env.example              # 🆕 Template env vars
├── DEPLOY.md                 # 🆕 Hướng dẫn deploy
└── package.json              # Updated với @vercel/node
```

## 🔄 Migration Checklist

### 1. ✅ Backend API (Đã xong)
- [x] Migrate `generate-exam` từ Deno → Node.js
- [x] Migrate `ocr-extract` từ Deno → Node.js  
- [x] Setup CORS headers
- [x] Error handling
- [x] Environment variables

### 2. 📝 Frontend Updates (Cần làm)

**Nếu code đang gọi Supabase Functions:**

```typescript
// ❌ TRƯỚC
const { data } = await supabase.functions.invoke('generate-exam', {
  body: { sourceExam, difficulty }
})

// ✅ SAU
const response = await fetch('/api/generate-exam', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sourceExam, difficulty })
})
const data = await response.json()
```

### 3. 🔐 Environment Variables

**Local Development (.env.local):**
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_key
GEMINI_API_KEY=your_gemini_key
```

**Vercel Dashboard:**
- Vào Settings → Environment Variables
- Add cùng những biến trên

### 4. 🚀 Deploy Steps

1. **Install dependencies:**
```bash
npm install
```

2. **Test local:**
```bash
npm run dev
# App chạy ở http://localhost:5173
```

3. **Deploy to Vercel:**
   - Xem chi tiết trong `DEPLOY.md`
   - Cơ bản: Push lên GitHub → Import vào Vercel → Done

## 🎯 Lợi ích của việc upgrade

### 1. 💰 Tiết kiệm chi phí
- Vercel Free: 100GB bandwidth/tháng
- Gemini Free: Unlimited requests (có rate limit)
- Supabase Free: 500MB DB + 50k users

**→ Toàn bộ FREE nếu traffic nhỏ/vừa**

### 2. 🛡️ Reliability
- Không phụ thuộc OnSpace
- Full control backend logic
- Dễ debug và monitor

### 3. ⚡ Performance
- Vercel Edge Network (global CDN)
- Auto optimize images
- Fast cold start (~100ms)

### 4. 🔧 Developer Experience
- Git-based deployment
- Preview deployments cho PR
- Real-time logs & analytics
- Easy rollback

### 5. 📈 Scalability
- Auto scale với traffic
- Serverless = pay per use
- Easy upgrade plans

## ⚠️ Breaking Changes

### API Endpoints Changed
```typescript
// ❌ Old
const oldUrl = 'https://xxx.supabase.co/functions/v1/generate-exam'

// ✅ New  
const newUrl = '/api/generate-exam'
// hoặc trong production:
const newUrl = 'https://your-app.vercel.app/api/generate-exam'
```

### Response Format (Giữ nguyên)
- Response format không đổi
- Error handling tương tự
- JSON structure giống hệt

## 🧪 Testing After Migration

### 1. Test Local
```bash
# Start dev server
npm run dev

# Test trong browser:
# - Login/Logout
# - Generate exam
# - OCR extract
# - Upload files
```

### 2. Test Production
```bash
# Sau khi deploy xong
curl https://your-app.vercel.app/api/generate-exam \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"sourceExam": {...}}'
```

## 📚 Tài liệu tham khảo

- [Vercel Docs](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Google Gemini API](https://ai.google.dev/docs)
- [Supabase Docs](https://supabase.com/docs)

## 💬 Support

Nếu gặp vấn đề:
1. Check `DEPLOY.md` → Troubleshooting section
2. Xem Vercel logs trong Dashboard
3. Check browser console để xem lỗi frontend

## 🎉 Kết luận

Sau khi upgrade:
- ✅ Project mạnh mẽ hơn
- ✅ Không phụ thuộc OnSpace
- ✅ Miễn phí hoàn toàn (Free tier)
- ✅ Dễ maintain và scale
- ✅ Professional deployment workflow

**Let's ship it! 🚀**
