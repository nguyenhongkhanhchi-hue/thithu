# ✅ Deployment Checklist - ExamTouch lên Vercel

Sử dụng checklist này để đảm bảo deploy thành công!

---

## 📦 Pre-Deployment

### ✅ Code Setup
- [x] Đã tạo folder `/api` với serverless functions
- [x] Đã có `vercel.json` config
- [x] Đã thêm `@vercel/node` vào devDependencies
- [x] Đã có `.env.example` template
- [ ] Code đã được test local (`npm run dev`)

### ✅ Dependencies
- [ ] Chạy `npm install` để update dependencies
- [ ] Kiểm tra không có lỗi trong `package.json`
- [ ] Build thành công: `npm run build`

---

## 🔑 API Keys & Credentials

### ✅ Gemini API Key
- [ ] Đã tạo tài khoản Google
- [ ] Đã lấy API key từ: https://makersuite.google.com/app/apikey
- [ ] Đã test API key hoạt động

### ✅ Supabase Credentials
- [ ] Có `VITE_SUPABASE_URL`
- [ ] Có `VITE_SUPABASE_ANON_KEY`
- [ ] Database đã setup xong
- [ ] RLS policies đã cấu hình

---

## 🌐 GitHub Setup

- [ ] Code đã được push lên GitHub
- [ ] Branch `main` hoặc `master` đã update
- [ ] `.gitignore` đã ignore `.env` và `.env.local`
- [ ] README.md đã update

---

## 🚀 Vercel Deployment

### ✅ Import Project
- [ ] Đã tạo tài khoản Vercel
- [ ] Đã connect Vercel với GitHub
- [ ] Đã import project từ GitHub
- [ ] Framework được detect là **Vite** ✓

### ✅ Environment Variables (QUAN TRỌNG!)
Thêm các biến sau trong Vercel Dashboard → Settings → Environment Variables:

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `GEMINI_API_KEY` (hoặc `ONSPACE_AI_API_KEY`)
- [ ] Apply cho cả 3 environments: Production, Preview, Development

### ✅ Build Settings
- [ ] Build Command: `npm run build` ✓
- [ ] Output Directory: `dist` ✓
- [ ] Install Command: `npm install` ✓

### ✅ Deploy
- [ ] Click "Deploy"
- [ ] Đợi build hoàn thành (3-5 phút)
- [ ] Build thành công ✓
- [ ] Có được deployment URL

---

## 🧪 Post-Deployment Testing

### ✅ Frontend Testing
- [ ] Truy cập deployment URL
- [ ] Trang chủ load đúng
- [ ] UI hiển thị đúng (không broken CSS)
- [ ] Routing hoạt động (navigate giữa các trang)
- [ ] Login/Logout hoạt động
- [ ] Responsive trên mobile

### ✅ API Testing

**Test Generate Exam API:**
```bash
curl -X POST https://your-app.vercel.app/api/generate-exam \
  -H "Content-Type: application/json" \
  -d '{
    "sourceExam": {
      "title": "Test",
      "subject": "Toán",
      "grade": "Lớp 4",
      "sections": [{
        "id": "s1",
        "title": "Test",
        "questions": [{
          "id": "q1",
          "number": 1,
          "type": "multiple_choice",
          "text": "1 + 1 = ?",
          "choices": [
            {"id": "A", "text": "1"},
            {"id": "B", "text": "2"},
            {"id": "C", "text": "3"},
            {"id": "D", "text": "4"}
          ],
          "correctAnswer": "B",
          "points": 1
        }]
      }]
    },
    "difficulty": "normal"
  }'
```

- [ ] API trả về response thành công
- [ ] Response có data đúng format
- [ ] Không có error 500

**Test OCR Extract API:**
```bash
curl -X POST https://your-app.vercel.app/api/ocr-extract \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Sample_Math_Test.jpg/800px-Sample_Math_Test.jpg"
  }'
```

- [ ] API trả về response thành công
- [ ] OCR extract được nội dung
- [ ] Không có error

---

## 🔧 Supabase Configuration

### ✅ CORS Setup
- [ ] Vào Supabase Dashboard → Settings → API
- [ ] Thêm Vercel domain vào "Allowed Origins":
  ```
  https://your-app.vercel.app
  https://*.vercel.app
  ```
- [ ] Save changes

### ✅ Database
- [ ] Tables đã được tạo
- [ ] RLS policies enabled
- [ ] Test queries hoạt động

---

## 📊 Monitoring & Analytics

### ✅ Vercel Dashboard
- [ ] Check "Analytics" tab
- [ ] Xem được visitor stats
- [ ] Function invocations được track

### ✅ Logs
- [ ] Click vào deployment → "Logs"
- [ ] Xem được runtime logs
- [ ] Không có errors trong logs

---

## 🎯 Custom Domain (Optional)

- [ ] Đã mua domain
- [ ] Add domain trong Vercel Dashboard
- [ ] Configure DNS records
- [ ] SSL certificate được tạo tự động
- [ ] Domain hoạt động

---

## ⚠️ Troubleshooting Checklist

### Nếu build failed:
- [ ] Check build logs trong Vercel
- [ ] Verify dependencies trong `package.json`
- [ ] Test `npm run build` locally
- [ ] Check TypeScript errors

### Nếu API không hoạt động:
- [ ] Verify Environment Variables trong Vercel
- [ ] Check API endpoint URL đúng `/api/...`
- [ ] Xem Function logs trong Vercel
- [ ] Test API key còn hoạt động

### Nếu lỗi CORS:
- [ ] Add domain vào Supabase allowed origins
- [ ] Check CORS headers trong API response
- [ ] Verify frontend đang gọi đúng domain

### Nếu 404 errors:
- [ ] Check `vercel.json` routing config
- [ ] Verify file paths đúng
- [ ] Check output directory = `dist`

---

## 🎉 Success Criteria

Deployment thành công khi:

- ✅ Frontend accessible và UI đẹp
- ✅ Login/Logout hoạt động
- ✅ Generate Exam API hoạt động
- ✅ OCR Extract API hoạt động
- ✅ Database queries thành công
- ✅ Không có errors trong logs
- ✅ Performance tốt (<3s load time)
- ✅ Mobile responsive

---

## 📝 Post-Deployment Tasks

- [ ] Update README với deployment URL
- [ ] Share link với team/users
- [ ] Setup monitoring alerts (optional)
- [ ] Create backup của database (recommended)
- [ ] Document any issues encountered
- [ ] Plan for next features

---

## 💡 Tips

- Deploy ngày thường (tránh cuối tuần)
- Test thoroughly trên staging trước
- Keep track của Environment Variables
- Monitor usage để tránh vượt Free tier
- Backup database định kỳ

---

**Chúc deploy thành công! 🚀**

Last updated: 2024
