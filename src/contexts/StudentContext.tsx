import React, { createContext, useContext, useState } from 'react';

export interface StudentProfile {
  name: string;      // "Nam", "Lan", "Bé An"...
  nickname: string;  // "con", "em", "bạn"...
  grade: string;     // "Lớp 4", "Lớp 9"...
  avatar: string;    // emoji avatar
}

const DEFAULT_PROFILE: StudentProfile = {
  name: '',
  nickname: 'con',
  grade: '',
  avatar: '🧒',
};

const PROFILE_KEY = 'examtouch_student_profile';

interface StudentContextValue {
  profile: StudentProfile;
  setProfile: (p: StudentProfile) => void;
  hasProfile: boolean;
  teacherGreet: (context?: string) => string;
}

const StudentContext = createContext<StudentContextValue>({
  profile: DEFAULT_PROFILE,
  setProfile: () => {},
  hasProfile: false,
  teacherGreet: () => 'Hãy cùng học nào!',
});

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfileState] = useState<StudentProfile>(() => {
    try {
      const s = localStorage.getItem(PROFILE_KEY);
      return s ? { ...DEFAULT_PROFILE, ...JSON.parse(s) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const setProfile = (p: StudentProfile) => {
    setProfileState(p);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  };

  const hasProfile = !!profile.name.trim();

  const teacherGreet = (context?: string): string => {
    const name = profile.name ? ` ${profile.name}` : '';
    const nick = profile.nickname || 'con';
    const capNick = nick.charAt(0).toUpperCase() + nick.slice(1);
    const greetings = [
      `${capNick}${name} nhé, ${context || 'cô sẽ giải thích cho'} ${nick} hiểu nha!`,
      `Cô biết${name ? ` ${nick} ${name}` : ''} đang cần giúp đỡ phần này! Để cô hướng dẫn nha.`,
      `Đây là phần quan trọng lắm đó${name ? ` ${nick} ${name}` : ''}! Học kỹ nha.`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  };

  return (
    <StudentContext.Provider value={{ profile, setProfile, hasProfile, teacherGreet }}>
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => useContext(StudentContext);
