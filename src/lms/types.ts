
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
  phone?: string;
  dob?: string;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  address?: string;
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
  | 'live-intel-detail'
  | 'parent-portal';

// ...existing code...


export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at?: string;
  school_id: string;
}

export interface Contact {
  id: string; // The record ID in its table (students/teachers/student_services)
  auth_user_id: string; // The ID for messaging (auth.users.id)
  name: string;
  email: string;
  role: 'teacher' | 'student' | 'student_service';
  avatar?: string;
  lastMessage?: Message;
  unreadCount?: number;
}

// ...existing code...