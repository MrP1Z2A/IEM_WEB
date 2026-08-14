export interface Student {
  id: string;
  name: string;
  grade: string;
  section: string;
  attendance: number;
  avatar: string;
}

export interface Achievement {
  id: string;
  title: string;
  date: string;
  category: 'Academic' | 'Sports' | 'Art' | 'Conduct';
}

export interface GradeResult {
  subject: string;
  score: number;
  average: number;
}

export interface SubjectGrade {
  name: string;
  grade: string;
  score: number;
  comment: string;
}

export interface ReportCard {
  term: string;
  gpa: string;
  rank: string;
  attendance: string;
  subjects: SubjectGrade[];
}

export interface Event {
  id: string;
  title: string;
  date: string;
  description: string;
  type: 'Holiday' | 'Exam' | 'Meeting' | 'Celebration';
}

export interface Advertisement {
  id: string;
  title: string;
  image: string;
  link: string;
}

export interface PaymentRecord {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  status: 'Pending' | 'Submitted' | 'Graded';
}
