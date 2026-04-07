
import React from 'react';
import { Course } from '../types';

interface CourseCardProps {
  course: Course;
  onClick: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group bg-white rounded-[32px] overflow-hidden shadow- premium border border-slate-100 hover:border-[#4ea59d]/40 transition-all hover:-translate-y-2 cursor-pointer"
    >
      <div className="relative aspect-video overflow-hidden bg-slate-50">
        <img 
          src={course.thumbnail} 
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-transparent"></div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider rounded-lg border border-white/20">
            {course.category}
          </span>
        </div>
      </div>
      <div className="p-8 space-y-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1.5">Course</p>
          <h3 className="text-2xl font-black text-slate-900 group-hover:text-[#4ea59d] transition-colors line-clamp-1 uppercase tracking-tighter">
            {course.title}
          </h3>
        </div>
        <p className="text-slate-400 text-xs font-medium line-clamp-2 leading-relaxed">
          {course.description}
        </p>
        <div className="flex items-center justify-between border-t border-slate-50 pt-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ea59d] animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-slate-900 transition-colors">
              {course.notes.length} Academic Modules
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#4ea59d] group-hover:bg-[#4ea59d] group-hover:text-white transition-all shadow-sm">
            <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
