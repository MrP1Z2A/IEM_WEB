
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
      className="bg-[#0f2624] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border border-[#1f4e4a]"
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={course.thumbnail} 
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1a19]/90 to-transparent"></div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-[#4ea59d] backdrop-blur rounded-lg text-[10px] font-bold text-slate-900 shadow-lg uppercase tracking-wider">
            {course.category}
          </span>
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-[#4ea59d] transition-colors line-clamp-1">
          {course.title}
        </h3>
        <p className="text-[#4ea59d]/60 text-sm line-clamp-2 mb-6 leading-relaxed">
          {course.description}
        </p>
        <div className="flex items-center justify-between border-t border-[#1f4e4a] pt-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4ea59d] animate-pulse"></div>
            <span className="text-xs font-bold text-[#4ea59d]/60 uppercase tracking-widest">
              {course.notes.length} Modules
            </span>
          </div>
          <button className="text-[#4ea59d] hover:translate-x-1 transition-transform">
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
