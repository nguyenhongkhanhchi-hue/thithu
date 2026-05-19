import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Download, UploadCloud, Save, Settings, Brain, Key, Eye, EyeOff, X, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { exportAllData, importAllData, backupToLocalStorage } from "@/lib/storage";
import { toast } from "sonner";

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
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
      <div className="bg-slate-600 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black font-heading tracking-tight uppercase">Cài Đặt Hệ Thống</h1>
        </div>
        <div className="bg-white/20 p-2 rounded-xl">
          <Settings className="w-6 h-6" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
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
