# 🚀 Hướng dẫn Deploy lên Vercel

## 📋 Chuẩn bị

### 1. Tạo tài khoản Vercel
- Truy cập: https://vercel.com
- Đăng ký bằng GitHub (Recommended)

### 2. Cài đặt Vercel CLI (Optional - để deploy từ local)
```bash
npm install -g vercel
```

## 🔑 Setup API Keys

### Option 1: Google Gemini (MIỄN PHÍ - Recommended ⭐)

1. Truy cập: https://makersuite.google.com/app/apikey
2. Đăng nhập bằng Google
3. Click **"Get API Key"** hoặc **"Create API Key"**
4. Copy API key

**Ưu điểm:**
- ✅ Miễn phí
- ✅ Không cần thẻ tín dụng
- ✅ 60 requests/phút
- ✅ Hỗ trợ vision (OCR)

### Option 2: OnSpace (Nếu bạn có)
- Sử dụng API key hiện tại từ OnSpace

### Option 3: OpenAI (Trả phí)
- Truy cập: https://platform.openai.com/api-keys
- Tạo API key (yêu cầu thẻ tín dụng)

## 🌐 Deploy lên Vercel

### Cách 1: Deploy qua GitHub (Recommended)

1. **Push code lên GitHub:**
```bash
git add .
git commit -m "Setup for Vercel deployment"
git push origin main
```

2. **Import vào Vercel:**
   - Truy cập: https://vercel.com/new
   - Click **"Import Git Repository"**
   - Chọn repo của bạn
   - Click **"Import"**

3. **Configure Environment Variables:**
   
   Trong phần **"Environment Variables"**, thêm:
   
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Click **"Deploy"** → Đợi vài phút → Xong! 🎉

### Cách 2: Deploy từ CLI

```bash
# Login vào Vercel
vercel login

# Deploy
vercel

# Thêm Environment Variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add GEMINI_API_KEY

# Deploy lần cuối với env
vercel --prod
```

## 🔧 Cấu hình Supabase

### Update CORS trong Supabase Dashboard

1. Vào Supabase Dashboard → Settings → API
2. Thêm domain Vercel của bạn vào **"Allowed Origins"**:
   ```
   https://your-app.vercel.app
   ```

### (Optional) Update API URLs trong code

Nếu frontend gọi API, update base URL từ Supabase functions sang Vercel:

**Trước:**
```typescript
const apiUrl = 'https://your-project.supabase.co/functions/v1/generate-exam'
```

**Sau:**
```typescript
const apiUrl = '/api/generate-exam' // Vercel sẽ tự động route
```

## ✅ Kiểm tra sau khi Deploy

### 1. Test Frontend
- Truy cập URL Vercel của bạn (vd: `https://exam-touch.vercel.app`)
- Kiểm tra login/logout
- Kiểm tra UI hiển thị đúng

### 2. Test API Endpoints

**Test Generate Exam:**
```bash
curl -X POST https://your-app.vercel.app/api/generate-exam \
  -H "Content-Type: application/json" \
  -d '{
    "sourceExam": {
      "title": "Test",
      "subject": "Toán",
      "grade": "Lớp 4",
      "sections": []
    },
    "difficulty": "normal"
  }'
```

**Test OCR Extract:**
```bash
curl -X POST https://your-app.vercel.app/api/ocr-extract \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/test.jpg"
  }'
```

## 🎯 Custom Domain (Optional)

1. Vào Vercel Dashboard → Settings → Domains
2. Add domain của bạn (vd: `examtouch.com`)
3. Configure DNS theo hướng dẫn
4. Đợi DNS propagate (5-10 phút)

## 🔄 Auto Deploy

Sau khi setup xong, mỗi khi bạn push code lên GitHub:
- Vercel tự động build
- Tự động deploy
- Preview URL cho mỗi Pull Request

## 📊 Monitor & Analytics

- Vercel Dashboard: https://vercel.com/dashboard
- Xem logs: Click vào deployment → "Logs"
- Analytics: Tab "Analytics" để xem traffic

## ⚠️ Troubleshooting

### Lỗi: "API key not configured"
→ Kiểm tra Environment Variables trong Vercel Dashboard

### Lỗi: "Build failed"
→ Check build logs, thường do missing dependencies

### Lỗi CORS
→ Thêm domain vào Supabase allowed origins

### API chậm
→ Vercel cold start có thể mất 1-2s cho request đầu tiên

## 💰 Chi phí

- **Vercel Hobby (Free):**
  - ✅ 100GB bandwidth/tháng
  - ✅ Unlimited deployments
  - ✅ Analytics cơ bản
  - ⚠️ Giới hạn 10s timeout cho serverless functions

- **Vercel Pro ($20/tháng):**
  - ✅ 1TB bandwidth
  - ✅ 60s timeout
  - ✅ Advanced analytics

- **Supabase Free:**
  - ✅ 500MB database
  - ✅ 50,000 monthly active users
  - ✅ 2GB file storage

- **Google Gemini Free:**
  - ✅ 60 requests/phút
  - ✅ Unlimited requests/tháng (có rate limit)

## 🎉 Hoàn thành!

Bây giờ project của bạn:
- ✅ Không phụ thuộc OnSpace
- ✅ Full control backend
- ✅ Auto deploy từ GitHub
- ✅ Miễn phí (với Free tier)
- ✅ Có thể scale dễ dàng

Domain của bạn sẽ có dạng: `https://exam-touch.vercel.app`

Chúc deploy thành công! 🚀
