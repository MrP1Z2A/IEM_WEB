
export enum UserRole {
  STUDENT = 'STUDENT',
  PARENT = 'PARENT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  studentId?: string;
  schoolId?: string;
  childId?: string; // Linked student for Parent role
  eduLevel?: string;
  bio?: string;
  specialization?: string[];
  rating?: number;
}

export interface ReportCard {
  term: string;
  gpa: string;
  rank: string;
  attendance: string;
  subjects: {
    name: string;
    grade: string;
    score: number;
    comment: string;
  }[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  ebookUrl?: string;
  createdAt: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  courseId: string;
}

export enum EventType {
  CLASS = 'CLASS',
  EXAM = 'EXAM',
  HOLIDAY = 'HOLIDAY',
  REMINDER = 'REMINDER'
}

export interface AppEvent {
  id: string;
  title: string;
  time: string;
  location: string;
  type: EventType;
  description?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  moduleIntro: string;
  topics: string[];
  teacherId: string;
  subTeacherName?: string;
  onlineClassUrl?: string;
  scheduleDescription?: string;
  thumbnail: string;
  category: string;
  notes: Note[];
  quizzes: Quiz[];
}

export type View = 
  | 'dashboard' 
  | 'notice-board'
  | 'notice-detail'
  | 'courses' 
  | 'marketplace' 
  | 'course-detail' 
  | 'quiz-player' 
  | 'profile'
  | 'instruction'
  | 'activity'
  | 'homework'
  | 'timetable'
  | 'studies'
  | 'contact'
  | 'parent-portal';

// ...existing code...

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  studentId?: string;
  schoolId?: string;
  eduLevel?: string;
  childId?: string; // parent -> child link
}

// ...existing code...