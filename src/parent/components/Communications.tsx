
import React from 'react';
import { MOCK_EVENTS, MOCK_ADS } from '../constants';
import { Calendar, Tag, ExternalLink, ChevronRight, Bell } from 'lucide-react';

const Communications: React.FC = () => {
  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* Featured Advertisements */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
            <Tag className="w-6 h-6 text-emerald-600" /> Announcements & Hub
          </h2>
          <div className="flex gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 transition-all shadow-sm hover:shadow-md">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 transition-all shadow-sm hover:shadow-md">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {MOCK_ADS.map(ad => (
            <div key={ad.id} className="group relative rounded-[2.5rem] overflow-hidden aspect-[16/9] shadow-xl border-4 border-white">
              <img src={ad.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={ad.title} />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-900/20 to-transparent flex flex-col justify-end p-8">
                <span className="text-emerald-400 font-black uppercase tracking-[0.2em] mb-3 text-[10px] bg-emerald-900/40 w-fit px-3 py-1 rounded-lg backdrop-blur-md">Growth Opportunity</span>
                <h3 className="text-white text-2xl font-black mb-6 leading-tight max-w-xs">{ad.title}</h3>
                <a href={ad.link} className="flex items-center gap-3 text-white font-black text-xs uppercase tracking-widest hover:text-emerald-400 transition-colors w-fit group/link">
                  Detailed Dossier <ExternalLink className="w-4 h-4 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Events Timeline */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 mb-8 uppercase tracking-tighter">
            <Calendar className="w-6 h-6 text-emerald-600" /> Operational Calendar
          </h2>
          <div className="space-y-4">
            {MOCK_EVENTS.map(event => (
              <div key={event.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex gap-6 hover:shadow-xl hover:border-emerald-100 transition-all group cursor-pointer">
                <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 h-fit shrink-0 group-hover:bg-emerald-600 group-hover:border-emerald-600 transition-colors">
                  <span className="text-emerald-800 text-[10px] font-black uppercase tracking-widest group-hover:text-emerald-100">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                  <span className="text-emerald-600 text-3xl font-black group-hover:text-white">{new Date(event.date).getDate()}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${
                      event.type === 'Holiday' ? 'bg-emerald-100 text-emerald-700' :
                      event.type === 'Exam' ? 'bg-rose-100 text-rose-700' :
                      event.type === 'Meeting' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {event.type}
                    </span>
                    <span className="text-slate-200">/</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">09:00 - 11:30</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-800 transition-colors tracking-tight">{event.title}</h3>
                  <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">{event.description}</p>
                </div>
                <button className="self-center p-3 text-slate-300 group-hover:text-emerald-600 transition-all group-hover:translate-x-2">
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Notice Board */}
        <div className="bg-emerald-950 rounded-[2.5rem] p-8 text-white h-fit shadow-2xl shadow-emerald-900/20 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20"></div>
           <div className="flex items-center gap-4 mb-10">
             <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
               <Bell className="w-6 h-6 text-white animate-ring" />
             </div>
             <div>
               <h2 className="text-lg font-black uppercase tracking-tight">Active Intel</h2>
               <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Updates</p>
             </div>
           </div>
           
           <div className="space-y-8">
              <div className="space-y-3 pb-8 border-b border-white/5 relative group/item">
                 <div className="flex items-center justify-between">
                   <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-900/50 px-2 py-0.5 rounded-md w-fit">T+ 0:45</p>
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500"></div>
                 </div>
                 <h4 className="font-black text-base tracking-tight group-hover/item:text-emerald-400 transition-colors">Bus Route #12 Delay</h4>
                 <p className="text-emerald-100/60 text-xs font-medium leading-relaxed">Due to infrastructure maintenance on Main St, bus #12 is adjusted by +20m.</p>
              </div>
              <div className="space-y-3 pb-8 border-b border-white/5 group/item">
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">T- 24:00</p>
                 <h4 className="font-black text-base tracking-tight group-hover/item:text-emerald-400 transition-colors">Uniform Store Restock</h4>
                 <p className="text-emerald-100/60 text-xs font-medium leading-relaxed">Summer inventory is now fully staged. Official uniforms available in all sizes.</p>
              </div>
              <div className="space-y-3 group/item">
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">T- 48:00</p>
                 <h4 className="font-black text-base tracking-tight group-hover/item:text-emerald-400 transition-colors">Security Protocol</h4>
                 <p className="text-emerald-100/60 text-xs font-medium leading-relaxed">New digital badge verification policy is now active for all visitors.</p>
              </div>
           </div>
           
           <button className="mt-10 w-full py-4 bg-emerald-900/50 text-emerald-100 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-white/5 hover:bg-emerald-900 transition-all hover:border-emerald-500/30 active:scale-95 shadow-lg">
             Historical Log
           </button>
        </div>
      </section>
    </div>
  );
};

export default Communications;
