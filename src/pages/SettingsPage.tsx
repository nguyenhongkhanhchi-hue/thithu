import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Download, UploadCloud, Save, Settings, Brain, Key, Eye, EyeOff, X, CheckCircle2, Plus, Trash2, BookOpen, Sparkles } from "lucide-react";
import { exportAllData, importAllData, backupToLocalStorage } from "@/lib/storage";
import { toast } from "sonner";
import { getLocalKnowledgeDocs, addKnowledgeDoc, deleteKnowledgeDoc, KnowledgeDoc } from "@/lib/rag";

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Local AI Training (RAG) States ──
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  useEffect(() => {
    setKnowledgeDocs(getLocalKnowledgeDocs());
  }, []);

  const handleAddDoc = () => {
    if (!newDocContent.trim()) {
      toast.error("⚠️ Nội dung tài liệu không được để trống!");
      return;
    }
    const added = addKnowledgeDoc(newDocTitle || "Tài liệu không tên", newDocContent);
    if (added) {
      toast.success("🚀 Đã nạp tài liệu huấn luyện AI thành công!");
      setKnowledgeDocs(getLocalKnowledgeDocs());
      setNewDocTitle("");
      setNewDocContent("");
      setIsAddingDoc(false);
    } else {
      toast.error("❌ Lỗi dung lượng lưu trữ cục bộ!");
    }
  };

  const handleDeleteDoc = (id: string) => {
    if (confirm("Anh có chắc muốn xoá tài liệu học tập này không? AI sẽ không thể tham chiếu tài liệu này nữa.")) {
      if (deleteKnowledgeDoc(id)) {
        toast.success("🗑️ Đã xoá tài liệu thành công!");
        setKnowledgeDocs(getLocalKnowledgeDocs());
      }
    }
  };

  const handleTxtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const title = file.name.replace(/\.[^/.]+$/, ""); // strip extension
      const added = addKnowledgeDoc(title, content);
      if (added) {
        toast.success(`🚀 Đã nạp tài liệu: ${file.name}`);
        setKnowledgeDocs(getLocalKnowledgeDocs());
      } else {
        toast.error("❌ Lỗi tải file!");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  const [defaultDuration, setDefaultDuration] = useState(() => {
    const saved = localStorage.getItem("defaultDuration");
    return saved ? Number(saved) : 40;
  });

  const [geminiKeys, setGeminiKeys] = useState<string[]>(() => {
    const stored = localStorage.getItem("VITE_GEMINI_API_KEYS");
    if (stored) return JSON.parse(stored);
    const single = localStorage.getItem("VITE_GEMINI_API_KEY");
    return single ? [single] : [""];
  });

  const [groqKeys, setGroqKeys] = useState<string[]>(() => {
    const stored = localStorage.getItem("VITE_GROQ_API_KEYS");
    if (stored) return JSON.parse(stored);
    const single = localStorage.getItem("VITE_GROQ_API_KEY");
    return single ? [single] : [""];
  });

  const [onspaceKeys, setOnspaceKeys] = useState<string[]>(() => {
    const stored = localStorage.getItem("VITE_ONSPACE_AI_API_KEYS");
    if (stored) return JSON.parse(stored);
    const single = localStorage.getItem("VITE_ONSPACE_AI_API_KEY");
    return single ? [single] : [""];
  });
  
  const [initialGeminiKeys] = useState(() => JSON.stringify(geminiKeys));
  const [initialGroqKeys] = useState(() => JSON.stringify(groqKeys));
  const [initialOnspaceKeys] = useState(() => JSON.stringify(onspaceKeys));

  const [showGemini, setShowGemini] = useState<Record<number, boolean>>({});
  const [showGroq, setShowGroq] = useState<Record<number, boolean>>({});
  const [showOnspace, setShowOnspace] = useState<Record<number, boolean>>({});

  const hasAIChanges = 
    JSON.stringify(geminiKeys) !== initialGeminiKeys || 
    JSON.stringify(groqKeys) !== initialGroqKeys ||
    JSON.stringify(onspaceKeys) !== initialOnspaceKeys;

  const hasKeysStored = (
    geminiKeys.some(k => k.trim()) || 
    groqKeys.some(k => k.trim()) ||
    onspaceKeys.some(k => k.trim())
  );

  const handleSaveDuration = () => {
    localStorage.setItem("defaultDuration", defaultDuration.toString());
    toast.success("✅ Đã lưu thời gian mặc định!");
  };

  const handleSaveAIKeys = () => {
    const cleanGemini = geminiKeys.map(k => k.trim()).filter(Boolean);
    const cleanGroq = groqKeys.map(k => k.trim()).filter(Boolean);
    const cleanOnspace = onspaceKeys.map(k => k.trim()).filter(Boolean);

    localStorage.setItem("VITE_GEMINI_API_KEYS", JSON.stringify(cleanGemini));
    localStorage.setItem("VITE_GROQ_API_KEYS", JSON.stringify(cleanGroq));
    localStorage.setItem("VITE_ONSPACE_AI_API_KEYS", JSON.stringify(cleanOnspace));
    
    // Giữ lại key đầu tiên làm VITE_GEMINI_API_KEY cho tương thích ngược nếu cần
    if (cleanGemini.length > 0) localStorage.setItem("VITE_GEMINI_API_KEY", cleanGemini[0]);
    if (cleanGroq.length > 0) localStorage.setItem("VITE_GROQ_API_KEY", cleanGroq[0]);
    if (cleanOnspace.length > 0) localStorage.setItem("VITE_ONSPACE_AI_API_KEY", cleanOnspace[0]);

    backupToLocalStorage();
    toast.success("✅ Đã cập nhật danh sách API Keys!");
    setTimeout(() => window.location.reload(), 500);
  };

  const addKeyField = (type: 'gemini' | 'groq' | 'onspace') => {
    if (type === 'gemini') setGeminiKeys([...geminiKeys, ""]);
    else if (type === 'groq') setGroqKeys([...groqKeys, ""]);
    else setOnspaceKeys([...onspaceKeys, ""]);
  };

  const removeKeyField = (type: 'gemini' | 'groq' | 'onspace', index: number) => {
    if (type === 'gemini') {
      const newKeys = [...geminiKeys];
      newKeys.splice(index, 1);
      setGeminiKeys(newKeys.length > 0 ? newKeys : [""]);
    } else if (type === 'groq') {
      const newKeys = [...groqKeys];
      newKeys.splice(index, 1);
      setGroqKeys(newKeys.length > 0 ? newKeys : [""]);
    } else {
      const newKeys = [...onspaceKeys];
      newKeys.splice(index, 1);
      setOnspaceKeys(newKeys.length > 0 ? newKeys : [""]);
    }
  };

  const updateKeyField = (type: 'gemini' | 'groq' | 'onspace', index: number, value: string) => {
    if (type === 'gemini') {
      const newKeys = [...geminiKeys];
      newKeys[index] = value;
      setGeminiKeys(newKeys);
    } else if (type === 'groq') {
      const newKeys = [...groqKeys];
      newKeys[index] = value;
      setGroqKeys(newKeys);
    } else {
      const newKeys = [...onspaceKeys];
      newKeys[index] = value;
      setOnspaceKeys(newKeys);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importAllData(content)) {
        toast.success("🚀 Đã khôi phục dữ liệu thành công!");
      } else {
        toast.error("❌ File không hợp lệ hoặc bị lỗi!");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-600 text-white py-4 sticky top-0 z-50 shadow-md">
        <div className="w-full px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-black font-heading tracking-tight uppercase" style={{ fontFamily: "'Baloo 2', cursive" }}>Cài Đặt Hệ Thống</h1>
          </div>
          <div className="bg-white/20 p-2.5 rounded-2xl">
            <Settings className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-6">
        {/* Thời gian thi */}
        <section className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 font-heading">Thời gian làm bài</h2>
              <p className="text-gray-500 text-sm">Thời gian mặc định khi bé bắt đầu các đề thi mới</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-5xl font-black text-slate-600 font-heading">{defaultDuration} <small className="text-lg text-gray-400 font-bold uppercase tracking-widest">phút</small></span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
              className="w-full h-3 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-slate-600"
            />
            <div className="flex justify-between text-xs font-black text-gray-400">
              <span>10 PHÚT</span>
              <span>120 PHÚT</span>
            </div>
            <button
              onClick={handleSaveDuration}
              className="w-full bg-slate-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <Save className="w-5 h-5" /> Lưu thời gian thi
            </button>
          </div>
        </section>

        {/* Cấu hình AI */}
        <section className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-2xl text-purple-600">
                <Brain className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 font-heading uppercase">Cấu hình AI</h2>
                <p className="text-gray-500 text-sm">Thiết lập danh sách API Keys để luân phiên sử dụng</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Gemini Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                <label className="text-xs font-black text-purple-600 uppercase tracking-widest flex items-center gap-2">
                  <Key className="w-4 h-4" /> Gemini Keys (OCR & Fallback)
                </label>
                <button 
                  onClick={() => addKeyField('gemini')}
                  className="text-xs font-bold text-purple-600 hover:bg-purple-50 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> THÊM KEY
                </button>
              </div>
              
              <div className="space-y-3">
                {geminiKeys.map((key, idx) => (
                  <div key={`gemini-${idx}`} className="relative group flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showGemini[idx] ? "text" : "password"}
                        value={key}
                        onChange={(e) => updateKeyField('gemini', idx, e.target.value)}
                        placeholder={`Gemini API Key #${idx + 1}...`}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-purple-500 focus:bg-white outline-none transition-all font-mono text-sm pr-12"
                      />
                      <button
                        onClick={() => setShowGemini(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                      >
                        {showGemini[idx] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {geminiKeys.length > 1 && (
                      <button 
                        onClick={() => removeKeyField('gemini', idx)}
                        className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 font-medium px-2">Lấy tại: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-purple-600 underline">AI Studio (FREE)</a></p>
            </div>

            {/* Groq Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                <label className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                  <Key className="w-4 h-4" /> Groq Keys (Tạo đề & Chấm bài)
                </label>
                <button 
                  onClick={() => addKeyField('groq')}
                  className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> THÊM KEY
                </button>
              </div>

              <div className="space-y-3">
                {groqKeys.map((key, idx) => (
                  <div key={`groq-${idx}`} className="relative group flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showGroq[idx] ? "text" : "password"}
                        value={key}
                        onChange={(e) => updateKeyField('groq', idx, e.target.value)}
                        placeholder={`Groq API Key #${idx + 1}...`}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-mono text-sm pr-12"
                      />
                      <button
                        onClick={() => setShowGroq(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {showGroq[idx] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {groqKeys.length > 1 && (
                      <button 
                        onClick={() => removeKeyField('groq', idx)}
                        className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 font-medium px-2">Lấy tại: <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Groq Console (FREE)</a></p>
            </div>

            {/* OnSpace Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                <label className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <Key className="w-4 h-4" /> OnSpace AI Keys (Gemini 3 Flash Preview)
                </label>
                <button 
                  onClick={() => addKeyField('onspace')}
                  className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> THÊM KEY
                </button>
              </div>

              <div className="space-y-3">
                {onspaceKeys.map((key, idx) => (
                  <div key={`onspace-${idx}`} className="relative group flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showOnspace[idx] ? "text" : "password"}
                        value={key}
                        onChange={(e) => updateKeyField('onspace', idx, e.target.value)}
                        placeholder={`OnSpace API Key #${idx + 1}...`}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-emerald-500 focus:bg-white outline-none transition-all font-mono text-sm pr-12"
                      />
                      <button
                        onClick={() => setShowOnspace(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-colors"
                      >
                        {showOnspace[idx] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {onspaceKeys.length > 1 && (
                      <button 
                        onClick={() => removeKeyField('onspace', idx)}
                        className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 font-medium px-2">Key được cấp từ OnSpace.ai hoặc Bolt.new để dùng Gemini 3 cực mạnh!</p>
            </div>

            {hasAIChanges ? (
              <button
                onClick={handleSaveAIKeys}
                className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-purple-200 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest animate-in fade-in zoom-in duration-300"
              >
                <Save className="w-5 h-5" /> Lưu danh sách Keys
              </button>
            ) : hasKeysStored ? (
              <div className="w-full bg-emerald-50 text-emerald-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 border-2 border-emerald-100 uppercase tracking-widest">
                <CheckCircle2 className="w-5 h-5" /> Đã cấu hình thành công
              </div>
            ) : null}
          </div>
        </section>

        {/* Đào Tạo Trí Tuệ Nhân Tạo Local (Local RAG) */}
        <section className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 animate-pulse">
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 font-heading uppercase">Đào tạo AI bằng Tài liệu (Local RAG)</h2>
                <p className="text-gray-500 text-sm">Nạp sách giáo khoa, tài liệu học tập để AI ra đề & giải nghĩa bám sát chương trình</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddingDoc(!isAddingDoc)}
              className="bg-purple-100 text-purple-600 font-black px-4 py-2.5 rounded-2xl hover:bg-purple-200 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-heading shadow-sm"
            >
              <Plus className="w-4 h-4" /> {isAddingDoc ? "ĐÓNG LẠI" : "NẠP TÀI LIỆU"}
            </button>
          </div>

          {/* Form Nạp tài liệu mới */}
          {isAddingDoc && (
            <div className="bg-purple-50/30 p-5 rounded-3xl border-2 border-purple-100/50 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <h3 className="font-black text-purple-700 font-heading text-sm flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-purple-500 animate-spin" /> Nạp Trí Thức Mới Cho AI
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  placeholder="Tiêu đề tài liệu (Ví dụ: SGK Toán Lớp 4 - Tập 1)..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:border-purple-500 outline-none transition-all text-sm font-bold text-gray-700"
                />
                
                <textarea
                  placeholder="Nhập nội dung/kiến thức bám sát SGK, công thức cần học, hoặc các bài toán mẫu ở đây để AI học hỏi..."
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:border-purple-500 outline-none transition-all text-sm text-gray-600 leading-relaxed font-sans"
                />

                <div className="flex gap-3 justify-end">
                  <label className="bg-white border-2 border-gray-100 hover:border-gray-300 text-gray-600 font-black px-4 py-3 rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1 shadow-sm font-heading">
                    <UploadCloud className="w-4 h-4" /> Tải File (.txt)
                    <input type="file" accept=".txt" onChange={handleTxtUpload} className="hidden" />
                  </label>
                  
                  <button
                    onClick={handleAddDoc}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-black px-5 py-3 rounded-xl transition-all text-xs flex items-center gap-1 shadow-md font-heading active:scale-95"
                  >
                    <Save className="w-4 h-4" /> Xác Nhận Nạp Trí Thức
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Danh sách tài liệu đã học */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Kho tri thức đã học ({knowledgeDocs.length} tài liệu)</h4>
            
            {knowledgeDocs.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-gray-100 space-y-2">
                <span className="text-3xl">📚</span>
                <p className="text-gray-400 text-xs font-black">AI chưa được nạp tài liệu riêng của phụ huynh.</p>
                <p className="text-gray-400 text-[10px] font-bold">Mặc định AI sẽ dùng kiến thức chương trình chuẩn Việt Nam.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {knowledgeDocs.map((doc) => (
                  <div key={doc.id} className="bg-slate-50 p-4 rounded-2xl border border-gray-150 flex items-center justify-between gap-3 group relative hover:border-purple-300 transition-colors shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-gray-700 truncate font-heading">{doc.title}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{doc.charCount.toLocaleString()} ký tự • {doc.uploadedAt}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Dữ liệu */}
        <section className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 font-heading">Quản lý dữ liệu</h2>
              <p className="text-gray-500 text-sm">Sao lưu hoặc khôi phục đề thi và lịch sử</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={exportAllData}
              className="flex flex-col items-center justify-center gap-3 bg-blue-50 text-blue-700 font-black p-6 rounded-[24px] border-2 border-blue-100 active:scale-95 transition-all group"
            >
              <Download className="w-8 h-8 group-hover:bounce" />
              <div className="text-center">
                <p className="text-sm">XUẤT DỮ LIỆU</p>
                <p className="text-[10px] font-bold opacity-60 uppercase mt-0.5 tracking-tighter">Lưu thành file .json</p>
              </div>
            </button>
            <label className="flex flex-col items-center justify-center gap-3 bg-emerald-50 text-emerald-700 font-black p-6 rounded-[24px] border-2 border-emerald-100 active:scale-95 transition-all cursor-pointer group">
              <UploadCloud className="w-8 h-8 group-hover:bounce" />
              <div className="text-center">
                <p className="text-sm">NHẬP DỮ LIỆU</p>
                <p className="text-[10px] font-bold opacity-60 uppercase mt-0.5 tracking-tighter">Khôi phục từ file backup</p>
              </div>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              <strong>Lưu ý quan trọng:</strong> Khi bé nhập dữ liệu từ file backup, toàn bộ đề thi và lịch sử hiện tại trên máy sẽ bị thay thế bởi dữ liệu từ file đó.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
