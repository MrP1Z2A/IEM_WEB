import React, { useEffect, useState } from 'react';
import { School, MapPin, Phone, Globe, MessageSquare, Share2, Send, Mail } from 'lucide-react';
import { supabase } from '../../sms/supabaseClient';

interface InstitutionHubProps {
  schoolId?: string;
}

const InstitutionHub: React.FC<InstitutionHubProps> = ({ schoolId }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!schoolId) {
        setIsLoading(false);
        return;
      }
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('*')
          .eq('id', schoolId)
          .single();
        if (school) setData(school);
      } catch (err) {
        console.error('Error fetching school info:', err);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchInfo();
  }, [schoolId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const school = data || {
    name: 'Institution Profile',
    about: 'Information about your institution will appear here.',
    phone: 'Not provided',
    email: 'Not provided',
    address: 'Not provided'
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Profile */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          {school.banner_url ? (
            <img src={school.banner_url} className="w-full h-48 object-cover opacity-90 transition-opacity hover:opacity-100" alt="School Campus" />
          ) : (
            <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-slate-300">
               <School className="w-12 h-12" />
            </div>
          )}
          <div className="p-8">
            <div className="flex items-center gap-5 mb-8">
              {school.logo_url ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-600 shadow-md flex-shrink-0">
                   <img src={school.logo_url} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="bg-emerald-600 p-4 rounded-3xl text-white shadow-lg shadow-emerald-200">
                  <School className="w-8 h-8" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{school.name}</h2>
                <p className="text-slate-500 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mt-1">
                  <MapPin className="w-4 h-4 text-emerald-600" /> {school.address || 'Campus Location'}
                </p>
              </div>
            </div>
            
            <p className="text-slate-600 leading-relaxed mb-8 font-medium">
              {school.about || "Your school has not yet provided a description. Please contact the administration for more information."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl group hover:bg-emerald-50 transition-colors">
                <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Contact Number</p>
                  <p className="text-sm font-black text-slate-900">{school.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl group hover:bg-emerald-50 transition-colors">
                <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Email Address</p>
                  <p className="text-sm font-black text-slate-900">{school.email || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                <Share2 className="w-5 h-5 text-emerald-600" /> Digital Community
              </h3>
              <div className="flex gap-4">
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Share2 className="w-5 h-5" /></button>
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Globe className="w-5 h-5" /></button>
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><MessageSquare className="w-5 h-5" /></button>
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Send className="w-5 h-5" /></button>
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
