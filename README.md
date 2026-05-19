# 🎓 ExamTouch - Ứng dụng Tạo đề thi Thông minh

> **🚀 Đã được nâng cấp để deploy lên Vercel!**  
> Không còn phụ thuộc OnSpace, full control backend, 100% FREE với Free tier!

## ✨ Tính năng chính

- 📝 **Tạo đề thi tự động** bằng AI (Google Gemini)
- 🖼️ **OCR trích xuất đề** từ hình ảnh  
- 📊 **Quản lý ngân hàng đề thi**
- 🎯 **Tùy chỉnh độ khó** (Dễ, Bình thường, Khó, Rất khó)
- 📱 **Responsive UI** với Tailwind CSS + shadcn/ui
- 🔐 **Authentication** với Supabase

---

## 🚀 Quick Start (5 phút)

### 1. Install dependencies
```bash
npm install
```

### 2. Setup môi trường
```bash
cp .env.example .env.local
# Sửa .env.local với API keys của bạn
```

### 3. Chạy local
```bash
npm run dev
# App sẽ chạy tại http://localhost:5173
```

### 4. Deploy lên Vercel
- Push code lên GitHub
- Import vào Vercel tại: https://vercel.com/new
- Thêm Environment Variables
- Deploy! 🎉

**📖 Xem chi tiết:** [QUICKSTART.md](./QUICKSTART.md)

---

## 📁 Cấu trúc Project

```
ExamTouch/
├── api/                    # 🆕 Vercel Serverless Functions
│   ├── generate-exam.ts   # API tạo đề thi
│   └── ocr-extract.ts     # API OCR
│
├── src/
│   ├── components/        # React components
│   ├── pages/            # Pages/Routes  
│   ├── lib/              # Utilities
│   └── contexts/         # React contexts
│
├── vercel.json           # Vercel config
├── DEPLOY.md             # Hướng dẫn deploy chi tiết
├── UPGRADE_GUIDE.md      # So sánh OnSpace vs Vercel
└── QUICKSTART.md         # Quick start guide
```

---

## 🛠️ Tech Stack

### Frontend
- ⚛️ **React 18** + TypeScript
- ⚡ **Vite** - Fast build tool
- 🎨 **Tailwind CSS** + **shadcn/ui**
- 🔄 **React Router** - Routing
- 📊 **React Query** - Data fetching
- 🎭 **Framer Motion** - Animations

### Backend
- 🔥 **Vercel Serverless Functions** (Node.js)
- 🤖 **Google Gemini API** - AI generation
- 🗄️ **Supabase** - Database + Auth
- 🔐 **Row Level Security** (RLS)

### DevOps
- 🚀 **Vercel** - Hosting + CI/CD
- 📦 **npm** - Package manager
- 🔒 **Environment Variables** - Secure config

---

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Bắt đầu nhanh trong 5 phút
- **[DEPLOY.md](./DEPLOY.md)** - Hướng dẫn deploy chi tiết
- **[UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md)** - So sánh OnSpace vs Vercel

---

## 🎯 Tại sao upgrade từ OnSpace?

| Tính năng | OnSpace | Vercel |
|-----------|---------|--------|
| Backend Control | ❌ Limited | ✅ Full |
| API Dependency | ❌ OnSpace | ✅ Your key |
| Chi phí | ❓ Unknown | ✅ FREE |
| Custom Domain | ❓ | ✅ Yes |
| Analytics | ❌ | ✅ Yes |
| Scalability | ⚠️ | ✅ Easy |

**Xem chi tiết:** [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md)

---

## 💰 Chi phí (100% FREE)

- ✅ **Vercel Free:** 100GB bandwidth/tháng
- ✅ **Gemini Free:** 60 requests/phút
- ✅ **Supabase Free:** 500MB database

→ Hoàn toàn miễn phí cho traffic vừa/nhỏ!

---

## 🔐 Environment Variables

```bash
# Supabase - lấy tại: https://supabase.com/dashboard → Settings → API
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_key

# Google Gemini - lấy tại: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_key  # MIỄN PHÍ!
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

MIT License - feel free to use this project!

---

## 🆘 Support

Gặp vấn đề?
- 📖 Check [DEPLOY.md](./DEPLOY.md) → Troubleshooting
- 🔍 Xem Vercel logs
- 💬 Open an issue

---

## How can I edit this code?

There are several ways of editing your application.

**Use OnSpace**

Simply visit the [OnSpace Project]() and start prompting.

Changes made via OnSpace will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in OnSpace.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [OnSpace]() and click on Share -> Publish.
