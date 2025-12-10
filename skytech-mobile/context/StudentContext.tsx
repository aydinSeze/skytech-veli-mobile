import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Student = {
  id: string;
  student_number: string;
  full_name: string;
  wallet_balance: number;
  school_id: string;
};

type StudentContextType = {
  student: Student | null;
  setStudent: (student: Student | null) => void;
  isLoading: boolean;
  logout: () => Promise<void>;
};

const StudentContext = createContext<StudentContextType | undefined>(undefined);
const STUDENT_STORAGE_KEY = '@skytech:student_data';

export function StudentProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Uygulama açıldığında öğrenci bilgisini YÜKLEME (Çıkış yapıldığında temizlensin)
  // Sadece login yapıldığında kaydedilecek
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Öğrenci değiştiğinde AsyncStorage'a kaydet
  const handleSetStudent = async (newStudent: Student | null) => {
    setStudent(newStudent);
    try {
      if (newStudent) {
        await AsyncStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(newStudent));
      } else {
        await AsyncStorage.removeItem(STUDENT_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Öğrenci bilgisi kaydedilemedi:', error);
    }
  };

  const logout = async () => {
    setStudent(null);
    try {
      await AsyncStorage.removeItem(STUDENT_STORAGE_KEY);
      await AsyncStorage.removeItem('@skytech:saved_access_code');
      await AsyncStorage.removeItem('@skytech:remember_access_code');
    } catch (error) {
      console.error('Çıkış yapılırken hata:', error);
    }
  };

  return (
    <StudentContext.Provider value={{ student, setStudent: handleSetStudent, isLoading, logout }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
}
