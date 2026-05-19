# 📋 ExamTouch - Vercel Deployment Cheatsheet

## ⚡ Quick Commands

### Local Development
```bash
# Install
npm install

# Run dev server
npm run dev                    # → http://localhost:5173

# Build
npm run build

# Preview build
npm run preview
```

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel                         # Preview deployment
vercel --prod                  # Production deployment

# Environment variables
vercel env add VARIABLE_NAME   # Add env var
vercel env ls                  # List env vars
vercel env pull                # Pull env to local
```

---

## 🔑 Required Environment Variables

```bash
# Frontend (Supabase)
# Lấy tại: https://supabase.com/dashboard → Settings → API
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Backend - Google Gemini (MIỄN PHÍ)
# Lấy tại: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...
```

---

## 🌐 API Endpoints

### Local (Development)
```
Frontend: http://localhost:5173
API: http://localhost:5173/api/*
```

### Production (Vercel)
```
Frontend: https://your-app.vercel.app
API: https://your-app.vercel.app/api/*
```

### Available APIs:
- `POST /api/generate-exam` - Tạo đề thi
- `POST /api/ocr-extract` - OCR trích xuất

---

## 📝 Example API Calls

### Generate Exam
```bash
curl -X POST https://your-app.vercel.app/api/generate-exam \
  -H "Content-Type: application/json" \
  -d '{
    "sourceExam": { ... },
    "difficulty": "normal"
  }'
```

### OCR Extract
```bash
curl -X POST https://your-app.vercel.app/api/ocr-extract \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg"
  }'
```

---

## 🚀 Deployment Workflow

### Via GitHub (Recommended)
```bash
git add .
git commit -m "Your message"
git push origin main
# → Vercel auto-deploys
```

### Via CLI
```bash
vercel --prod
```

---

## 🔧 Troubleshooting

### Build Errors
```bash
# Test build locally
npm run build

# Check logs
# Vercel Dashboard → Deployments → Click deployment → Logs
```

### API Not Working
```bash
# Check env vars
vercel env ls

# View function logs
# Vercel Dashboard → Deployments → Functions tab
```

### CORS Issues
```bash
# Add domain to Supabase:
# Dashboard → Settings → API → Allowed Origins
# Add: https://your-app.vercel.app
```

---

## 📂 Project Structure

```
ExamTouch/
├── api/                    # Vercel Functions
│   ├── generate-exam.ts
│   └── ocr-extract.ts
├── src/                    # Frontend
│   ├── components/
│   ├── pages/
│   └── lib/
├── vercel.json            # Vercel config
└── .env.local             # Local env vars
```

---

## 🔗 Important Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Gemini API Keys:** https://makersuite.google.com/app/apikey
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Vercel Docs:** https://vercel.com/docs

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `QUICKSTART.md` | Quick start (5 min) |
| `DEPLOY.md` | Full deployment guide |
| `UPGRADE_GUIDE.md` | OnSpace → Vercel comparison |
| `DEPLOYMENT_CHECKLIST.md` | Step-by-step checklist |
| `MIGRATION_SUMMARY.md` | What was changed |
| `CHEATSHEET.md` | This file! |

---

## ⚠️ Common Mistakes

1. ❌ Forget to add env vars in Vercel
   ✅ Add them in Settings → Environment Variables

2. ❌ Use wrong env var names
   ✅ Use `VITE_` prefix for frontend vars

3. ❌ Not update Supabase CORS
   ✅ Add Vercel domain to allowed origins

4. ❌ Push `.env` to GitHub
   ✅ Only push `.env.example`

---

## 💰 Free Tier Limits

| Service | Free Limit |
|---------|-----------|
| Vercel | 100GB bandwidth/month |
| Gemini | 60 requests/minute |
| Supabase | 500MB DB, 50k MAU |

---

## 🎯 Quick Checks

✅ **Before deploying:**
- [ ] Code builds locally (`npm run build`)
- [ ] `.env.example` is up to date
- [ ] API keys are ready

✅ **After deploying:**
- [ ] Frontend loads correctly
- [ ] APIs return 200 status
- [ ] No errors in Vercel logs
- [ ] Environment variables are set

---

**Keep this handy! 📌**
