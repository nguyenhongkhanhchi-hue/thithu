import { supabase, isSupabaseConfigured } from "./supabase";
import { Exam, ExamSession, WrongQuestion } from "@/types/exam";
import { getExams, saveExam, getSessions, saveSession, getGamificationData, saveGamificationData, getWrongQuestions, saveWrongQuestion, type GamificationData } from "./storage";
import { getTTSSettings, saveTTSSettings, type TTSSettings } from "./tts";
import { StudentProfile } from "@/contexts/StudentContext";

const PROFILE_KEY = "examtouch_student_profile";

interface CombinedSyncData {
  exams: Exam[];
  sessions: ExamSession[];
  wrongQuestions: WrongQuestion[];
  settings: Partial<TTSSettings>;
  profile: Partial<StudentProfile>;
  gamification: Partial<GamificationData>;
  lastUpdated: string;
}

/**
 * Lấy profile học sinh từ localStorage
 */
function getLocalProfile(): StudentProfile {
  try {
    const s = localStorage.getItem(PROFILE_KEY);
    return s ? JSON.parse(s) : { name: "", nickname: "con", grade: "", avatar: "🧒" };
  } catch {
    return { name: "", nickname: "con", grade: "", avatar: "🧒" };
  }
}

/**
 * Lưu profile học sinh vào localStorage
 */
function saveLocalProfile(profile: StudentProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

/**
 * Thực hiện đồng bộ hóa dữ liệu hai chiều giữa Local Storage và Supabase.
 * Hỗ trợ tự phục hồi: nếu bảng database chưa được tạo, tự động lưu trữ nén vào User Metadata của Supabase Auth.
 */
export async function syncAllData(user: any): Promise<{ success: boolean; hasNewMessage: boolean }> {
  if (!isSupabaseConfigured || !user) {
    return { success: false, hasNewMessage: false };
  }

  try {
    let hasNewMessage = false;
    const localExams = getExams().filter(e => e.id.includes("-") || e.isAIGenerated);
    const localSessions = getSessions();
    const localSettings = getTTSSettings();
    const localProfile = getLocalProfile();
    const localGamification = getGamificationData();
    const localWrongQuestions = getWrongQuestions();

    // 1. Cố gắng đồng bộ qua các bảng Supabase (nếu có sẵn)
    let syncSuccess = false;
    
    try {
      // Thử đồng bộ bảng exam_sessions
      const { data: remoteSessions, error: sessionsErr } = await supabase
        .from("exam_sessions")
        .select("*")
        .eq("user_id", user.id);

      if (!sessionsErr && remoteSessions) {
        // Đồng bộ xuôi ngược sessions
        const remoteSessionMap = new Map(remoteSessions.map((s: any) => [s.id || s.exam_session_id, s]));
        
        // Upload các session chưa có trên cloud
        for (const localS of localSessions) {
          const remoteS = remoteSessionMap.get(localS.id);
          if (!remoteS) {
            await supabase.from("exam_sessions").insert({
              id: localS.id,
              exam_id: localS.examId,
              user_id: user.id,
              started_at: localS.startedAt,
              submitted_at: localS.submittedAt,
              answers: localS.answers,
              score: localS.score,
              total_points: localS.totalPoints,
              time_used: localS.timeUsed,
            });
          } else if (localS.submittedAt && !remoteS.submitted_at) {
            // Cập nhật kết quả làm bài nếu local mới hơn
            await supabase.from("exam_sessions").update({
              submitted_at: localS.submittedAt,
              answers: localS.answers,
              score: localS.score,
              total_points: localS.totalPoints,
              time_used: localS.timeUsed,
            }).eq("id", localS.id);
          }
        }

        // Tải các session từ cloud về local
        for (const remoteS of remoteSessions) {
          const localS = localSessions.find(s => s.id === (remoteS.id || remoteS.exam_session_id));
          if (!localS || (!localS.submittedAt && remoteS.submitted_at)) {
            const newSession: ExamSession = {
              id: remoteS.id || remoteS.exam_session_id,
              examId: remoteS.exam_id,
              startedAt: remoteS.started_at,
              submittedAt: remoteS.submitted_at,
              answers: remoteS.answers || [],
              score: remoteS.score,
              totalPoints: remoteS.total_points,
              timeUsed: remoteS.time_used,
            };
            saveSession(newSession);
          }
        }
        syncSuccess = true;
      }
    } catch (e) {
      console.warn("Bảng database exam_sessions chưa sẵn sàng, chuyển sang chế độ dự phòng Metadata:", e);
    }

    // 2. Chế độ đồng bộ dự phòng siêu việt qua User Metadata (Không cần tạo bảng, luôn luôn thành công!)
    const currentMeta = user.user_metadata?.methi_sync as CombinedSyncData | undefined;
    
    // Tạo cấu trúc dữ liệu đẩy lên
    const syncDataToUpload: CombinedSyncData = {
      exams: localExams,
      sessions: localSessions.slice(-30),
      wrongQuestions: localWrongQuestions,
      settings: {
        childName: localSettings.childName,
        daddyName: localSettings.daddyName,
        remoteMessage: localSettings.remoteMessage,
        remoteMessageRead: localSettings.remoteMessageRead,
        rate: localSettings.rate,
        pitch: localSettings.pitch,
        enabled: localSettings.enabled,
      },
      profile: localProfile,
      gamification: localGamification,
      lastUpdated: new Date().toISOString(),
    };

    if (currentMeta) {
      // Phát hiện xem bố có gửi tin nhắn mới từ xa không
      if (currentMeta.settings?.remoteMessage && 
          currentMeta.settings.remoteMessage !== localSettings.remoteMessage) {
        hasNewMessage = true;
        saveTTSSettings({
          remoteMessage: currentMeta.settings.remoteMessage,
          remoteMessageRead: false // Đánh dấu là tin nhắn mới để reo chuông chào hỏi đọc lên
        });
      }

      // Nhận cấu hình từ xa (tên bé, xưng hô của bố, giọng đọc...)
      if (currentMeta.settings) {
        saveTTSSettings({
          childName: currentMeta.settings.childName || localSettings.childName,
          daddyName: currentMeta.settings.daddyName || localSettings.daddyName,
          rate: currentMeta.settings.rate || localSettings.rate,
          pitch: currentMeta.settings.pitch || localSettings.pitch,
          enabled: currentMeta.settings.enabled !== undefined ? currentMeta.settings.enabled : localSettings.enabled,
        });
      }

      // Nhận profile của con từ xa
      if (currentMeta.profile && currentMeta.profile.name) {
        const mergedProfile = { ...localProfile, ...currentMeta.profile };
        saveLocalProfile(mergedProfile);
      }

      // Nhận điểm số & RPG từ xa (đồng bộ hai chiều lấy số lớn hơn)
      if (currentMeta.gamification) {
        const mergedGamification = {
          level: Math.max(localGamification.level, currentMeta.gamification.level || 1),
          xp: Math.max(localGamification.xp, currentMeta.gamification.xp || 0),
          stars: Math.max(localGamification.stars, currentMeta.gamification.stars || 0),
          streak: Math.max(localGamification.streak, currentMeta.gamification.streak || 1),
          lastActiveDate: currentMeta.gamification.lastActiveDate || localGamification.lastActiveDate,
        };
        saveGamificationData(mergedGamification);
      }

      // Đồng bộ Exams được bố soạn từ xa
      if (currentMeta.exams && Array.isArray(currentMeta.exams)) {
        currentMeta.exams.forEach((remoteE: Exam) => {
          const localE = getExams().find(e => e.id === remoteE.id);
          if (!localE) {
            saveExam(remoteE);
          }
        });
      }

      // Đồng bộ Sessions từ xa về (nếu chưa đồng bộ qua bảng)
      if (!syncSuccess && currentMeta.sessions && Array.isArray(currentMeta.sessions)) {
        currentMeta.sessions.forEach((remoteS: ExamSession) => {
          const localS = localSessions.find(s => s.id === remoteS.id);
          if (!localS || (!localS.submittedAt && remoteS.submittedAt)) {
            saveSession(remoteS);
          }
        });
      }

      // Đồng bộ WrongQuestions từ xa về
      if (currentMeta.wrongQuestions && Array.isArray(currentMeta.wrongQuestions)) {
        currentMeta.wrongQuestions.forEach((remoteWQ: WrongQuestion) => {
          const localWQ = localWrongQuestions.find(w => w.id === remoteWQ.id);
          if (!localWQ) {
            saveWrongQuestion(remoteWQ);
          } else if ((remoteWQ as any).aiSolution && !(localWQ as any).aiSolution) {
            // Cập nhật lời giải AI nếu thiết bị khác đã tạo sẵn
            saveWrongQuestion({ ...localWQ, ...(remoteWQ as any) });
          }
        });
      }
    }

    // Đẩy dữ liệu mới nhất lên đám mây
    const { error: updateErr } = await supabase.auth.updateUser({
      data: {
        methi_sync: {
          ...syncDataToUpload,
          // Nếu local có tin nhắn mới mà chưa đọc, giữ nguyên trạng thái
          settings: {
            ...syncDataToUpload.settings,
            remoteMessage: currentMeta?.settings?.remoteMessage || localSettings.remoteMessage,
            remoteMessageRead: currentMeta?.settings?.remoteMessage === localSettings.remoteMessage 
              ? localSettings.remoteMessageRead 
              : false
          }
        }
      }
    });

    if (updateErr) throw updateErr;

    return { success: true, hasNewMessage };
  } catch (error) {
    console.error("Lỗi đồng bộ đám mây:", error);
    return { success: false, hasNewMessage: false };
  }
}

/**
 * Hàm đẩy tin nhắn từ xa của Bố lên Supabase
 */
export async function sendRemoteMessage(user: any, message: string): Promise<boolean> {
  if (!isSupabaseConfigured || !user) return false;
  try {
    const currentMeta = user.user_metadata?.methi_sync || {};
    const settings = currentMeta.settings || {};

    const updatedSync = {
      ...currentMeta,
      settings: {
        ...settings,
        remoteMessage: message,
        remoteMessageRead: false // Báo cho tablet biết đây là tin nhắn mới
      },
      lastUpdated: new Date().toISOString()
    };

    const { error } = await supabase.auth.updateUser({
      data: {
        methi_sync: updatedSync
      }
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Lỗi gửi tin nhắn từ xa:", err);
    return false;
  }
}

/**
 * Lưu cấu hình và profile từ xa của phụ huynh lên đám mây
 */
export async function saveRemoteConfig(
  user: any, 
  settings: Partial<TTSSettings>, 
  profile: Partial<StudentProfile>
): Promise<boolean> {
  if (!isSupabaseConfigured || !user) return false;
  try {
    const currentMeta = user.user_metadata?.methi_sync || {};
    
    const updatedSync = {
      ...currentMeta,
      settings: {
        ...(currentMeta.settings || {}),
        ...settings
      },
      profile: {
        ...(currentMeta.profile || {}),
        ...profile
      },
      lastUpdated: new Date().toISOString()
    };

    const { error } = await supabase.auth.updateUser({
      data: {
        methi_sync: updatedSync
      }
    });

    if (error) throw error;
    
    // Đồng bộ ngược lại Local Storage của thiết bị hiện tại luôn
    saveTTSSettings(settings);
    if (profile.name !== undefined) {
      const localP = getLocalProfile();
      saveLocalProfile({ ...localP, ...profile });
    }

    return true;
  } catch (err) {
    console.error("Lỗi lưu cấu hình phụ huynh lên đám mây:", err);
    return false;
  }
}

/**
 * Đẩy đề thi vừa soạn lên đám mây để máy tính bảng ở nhà tải về
 */
export async function uploadExamToCloud(user: any, exam: Exam): Promise<boolean> {
  if (!isSupabaseConfigured || !user) return false;
  try {
    const currentMeta = user.user_metadata?.methi_sync || {};
    const exams = currentMeta.exams || [];
    
    // Loại trùng lặp
    const filteredExams = exams.filter((e: Exam) => e.id !== exam.id);
    filteredExams.push(exam);

    const updatedSync = {
      ...currentMeta,
      exams: filteredExams,
      lastUpdated: new Date().toISOString()
    };

    const { error } = await supabase.auth.updateUser({
      data: {
        methi_sync: updatedSync
      }
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Lỗi tải đề thi lên đám mây:", err);
    return false;
  }
}
