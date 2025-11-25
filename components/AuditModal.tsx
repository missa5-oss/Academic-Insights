
import React from 'react';
import { X, FileText, Globe, DollarSign, Clock, BookOpen, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';
import { ExtractionResult } from '../types';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExtractionResult;
}

export const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-brand-600" size={20}/>
              Audit Extraction Source
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Verifying data for <span className="font-semibold text-slate-700">{data.school_name}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
          {/* Metadata Grid */}
          <div className="p-6 bg-white border-b border-slate-100">
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Detailed Metadata</h4>
             <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <DollarSign size={14} />
                      <span className="text-xs font-medium">Cost Per Credit</span>
                   </div>
                   <p className="font-semibold text-slate-900">{data.cost_per_credit || 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <BookOpen size={14} />
                      <span className="text-xs font-medium">Total Credits</span>
                   </div>
                   <p className="font-semibold text-slate-900">{data.total_credits || 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <Clock size={14} />
                      <span className="text-xs font-medium">Program Length</span>
                   </div>
                   <p className="font-semibold text-slate-900">{data.program_length || 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <MapPin size={14} />
                      <span className="text-xs font-medium">Location</span>
                   </div>
                   {data.location_data ? (
                       <a href={data.location_data.map_url} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline block truncate">
                           {data.location_data.address}
                       </a>
                   ) : (
                       <p className="font-semibold text-slate-400 italic">Location not extracted</p>
                   )}
                </div>
             </div>
             <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <AlertCircle size={14} />
                    <span className="text-xs font-medium">Remarks</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm leading-tight">{data.remarks || 'No remarks.'}</p>
             </div>
          </div>

          {/* Validated Sources Section */}
          <div className="p-6 bg-white border-b border-slate-100">
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Validated Official Sources</h4>
             <div className="space-y-3">
               {data.validated_sources && data.validated_sources.length > 0 ? (
                 data.validated_sources.map((source, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="bg-green-100 p-1.5 rounded-full mt-0.5">
                            <CheckCircle2 size={14} className="text-green-700"/>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-semibold text-slate-800 truncate">{source.title || 'Official Source'}</p>
                            <a href={source.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline truncate block">
                                {source.url}
                            </a>
                        </div>
                        {idx === 0 && <span className="px-2 py-0.5 bg-green-200 text-green-800 text-[10px] font-bold rounded uppercase">Primary</span>}
                    </div>
                 ))
               ) : (
                  <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex items-start gap-3">
                     <div className="bg-yellow-100 p-2 rounded-full">
                       <Globe size={16} className="text-yellow-700"/>
                     </div>
                     <div>
                       <p className="text-xs font-bold text-yellow-800 uppercase tracking-wide">Legacy Source</p>
                       <a href={data.source_url} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline break-all">
                         {data.source_url}
                       </a>
                     </div>
                  </div>
               )}
             </div>
          </div>

          <div className="flex-1 p-6 bg-slate-900 text-slate-300 font-mono text-sm leading-relaxed raw-content-scroll">
            <p className="mb-4 text-xs text-slate-500 uppercase">--- Raw HTML Content Snippet ---</p>
            {data.raw_content ? (
              <pre className="whitespace-pre-wrap">{data.raw_content}</pre>
            ) : (
              <p className="text-slate-500 italic">No raw content available for this extraction.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
           <button 
             onClick={onClose}
             className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
};
