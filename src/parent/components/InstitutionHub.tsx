
import React from 'react';
import { School, MapPin, Phone, Globe, MessageSquare, Share2, Send } from 'lucide-react';

const InstitutionHub: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Profile */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <img src="https://picsum.photos/seed/school/800/300" className="w-full h-48 object-cover opacity-90 transition-opacity hover:opacity-100" alt="School Campus" />
          <div className="p-8">
            <div className="flex items-center gap-5 mb-8">
              <div className="bg-emerald-600 p-4 rounded-3xl text-white shadow-lg shadow-emerald-200">
                <School className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Greenwood International</h2>
                <p className="text-slate-500 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mt-1"><MapPin className="w-4 h-4 text-emerald-600" /> Academic Valley, HQ</p>
              </div>
            </div>
            
            <p className="text-slate-600 leading-relaxed mb-8 font-medium">
              Greenwood International is a premier educational institution dedicated to fostering intellectual curiosity and personal growth. Founded in 1995, we offer a comprehensive K-12 curriculum that combines academic excellence with creative exploration.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl group hover:bg-emerald-50 transition-colors">
                <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Main Office</p>
                  <p className="text-sm font-black text-slate-900">+1 (555) 012-3456</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl group hover:bg-emerald-50 transition-colors">
                <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Website</p>
                  <p className="text-sm font-black text-slate-900">www.greenwoodintl.edu</p>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                <Share2 className="w-5 h-5 text-emerald-600" /> Digital Community
              </h3>
              <div className="flex gap-4">
                <a href="#" className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Share2 className="w-5 h-5" /></a>
                <a href="#" className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Globe className="w-5 h-5" /></a>
                <a href="#" className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><MessageSquare className="w-5 h-5" /></a>
                <a href="#" className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Send className="w-5 h-5" /></a>
              </div>
            </div>
          </div>
        </div>

        {/* Contact School */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
              <MessageSquare className="w-8 h-8 text-emerald-600" />
              Parent Inquiry
            </h2>
            <p className="text-slate-500 mt-2 font-medium">Have questions? Send a direct message to the administration.</p>
          </div>

          <form className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Department</label>
                <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all appearance-none cursor-pointer">
                  <option>Academic Affairs</option>
                  <option>Finance/Billing</option>
                  <option>Sports & Activities</option>
                  <option>Admissions</option>
                  <option>Technical Support</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Urgency</label>
                <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all appearance-none cursor-pointer">
                  <option>Normal Inquiry</option>
                  <option>Action Required</option>
                  <option>Urgent Attention</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Subject Header</label>
              <input type="text" placeholder="Brief summary of your request" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Your Message</label>
              <textarea rows={6} placeholder="Detailed notes or questions for the staff..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all resize-none"></textarea>
            </div>

            <button type="button" className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 group active:scale-[0.98]">
              <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Dispatch Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InstitutionHub;
