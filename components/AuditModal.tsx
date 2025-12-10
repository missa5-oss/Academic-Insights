
import React, { useState, useEffect } from 'react';
import { X, FileText, Globe, DollarSign, Clock, BookOpen, AlertCircle, CheckCircle2, MapPin, GraduationCap, MessageSquare, Save, Loader2, ChevronDown, ChevronUp, Code, Beaker, HelpCircle } from 'lucide-react';
import { ExtractionResult } from '../types';
import { useApp } from '../context/AppContext';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExtractionResult;
}

export const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose, data }) => {
  const { updateResult } = useApp();
  const [comments, setComments] = useState(data.user_comments || '');
  const [costPerCredit, setCostPerCredit] = useState(data.cost_per_credit || '');
  const [totalCredits, setTotalCredits] = useState(data.total_credits || '');
  const [programLength, setProgramLength] = useState(data.program_length || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set([0])); // Primary source expanded by default

  // Reset all fields when data changes
  useEffect(() => {
    setComments(data.user_comments || '');
    setCostPerCredit(data.cost_per_credit || '');
    setTotalCredits(data.total_credits || '');
    setProgramLength(data.program_length || '');
    setHasChanges(false);
    setExpandedSources(new Set([0])); // Reset to primary expanded
  }, [data.id, data.user_comments, data.cost_per_credit, data.total_credits, data.program_length]);

  // Check for changes whenever any field changes
  useEffect(() => {
    const hasCommentChanges = comments !== (data.user_comments || '');
    const hasCostPerCreditChanges = costPerCredit !== (data.cost_per_credit || '');
    const hasTotalCreditsChanges = totalCredits !== (data.total_credits || '');
    const hasProgramLengthChanges = programLength !== (data.program_length || '');
    setHasChanges(hasCommentChanges || hasCostPerCreditChanges || hasTotalCreditsChanges || hasProgramLengthChanges);
  }, [comments, costPerCredit, totalCredits, programLength, data.user_comments, data.cost_per_credit, data.total_credits, data.program_length]);

  const toggleSourceExpanded = (index: number) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSources(newExpanded);
  };

  const handleCommentsChange = (value: string) => {
    setComments(value);
  };

  const handleCostPerCreditChange = (value: string) => {
    setCostPerCredit(value);
  };

  const handleTotalCreditsChange = (value: string) => {
    setTotalCredits(value);
  };

  const handleProgramLengthChange = (value: string) => {
    setProgramLength(value);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    await updateResult(data.id, { 
      user_comments: comments,
      cost_per_credit: costPerCredit || null,
      total_credits: totalCredits || null,
      program_length: programLength || null
    });
    setIsSaving(false);
    setHasChanges(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-xl font-semibold text-jhu-heritage flex items-center gap-2">
              <FileText size={20}/>
              Audit Extraction Source
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Verifying data for <span className="font-semibold text-slate-700">{data.school_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-jhu-gray text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
          {/* Stated Tuition & Confidence Section */}
          <div className="p-6 bg-white border-b border-slate-100">
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Tuition Data & Confidence</h4>
             
             {/* Stated vs Calculated Tuition */}
             <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                   <div className="flex items-center gap-2 text-green-700 mb-1">
                       <DollarSign size={14} />
                       <span className="text-xs font-medium">Website Stated Tuition</span>
                   </div>
                   <p className="font-bold text-green-800 text-lg">
                     {data.stated_tuition || data.tuition_amount || <span className="text-slate-400 italic text-sm">Not found</span>}
                   </p>
                   <p className="text-xs text-green-600 mt-1">{data.tuition_period}</p>
                </div>
                {data.calculated_total_cost && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                     <div className="flex items-center gap-2 text-blue-700 mb-1">
                         <DollarSign size={14} />
                         <span className="text-xs font-medium">Calculated Total Cost</span>
                     </div>
                     <p className="font-bold text-blue-800 text-lg">
                       {data.calculated_total_cost}
                     </p>
                     <p className="text-xs text-blue-600 mt-1">
                       {data.cost_per_credit} × {data.total_credits}
                     </p>
                  </div>
                )}
                {!data.calculated_total_cost && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                     <div className="flex items-center gap-2 text-slate-500 mb-1">
                         <DollarSign size={14} />
                         <span className="text-xs font-medium">Calculated Total</span>
                     </div>
                     <p className="text-slate-400 italic text-sm">
                       Not available (missing cost/credit or total credits)
                     </p>
                  </div>
                )}
             </div>

             {/* Confidence Score Details */}
             {data.confidence_details && (
               <div className={`p-3 rounded-lg border mb-4 ${
                 data.confidence_score === 'High' 
                   ? 'bg-emerald-50 border-emerald-200' 
                   : data.confidence_score === 'Medium' 
                     ? 'bg-amber-50 border-amber-200' 
                     : 'bg-red-50 border-red-200'
               }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`flex items-center gap-2 ${
                      data.confidence_score === 'High' 
                        ? 'text-emerald-700' 
                        : data.confidence_score === 'Medium' 
                          ? 'text-amber-700' 
                          : 'text-red-700'
                    }`}>
                        <CheckCircle2 size={14} />
                        <span className="text-xs font-medium">Confidence Score: {data.confidence_score}</span>
                    </div>
                    <span className={`text-xs font-bold ${
                      data.confidence_score === 'High' 
                        ? 'text-emerald-600' 
                        : data.confidence_score === 'Medium' 
                          ? 'text-amber-600' 
                          : 'text-red-600'
                    }`}>
                      {data.confidence_details.score}/{data.confidence_details.max_score}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.confidence_details.factors.map((factor, idx) => (
                      <span key={idx} className={`text-[10px] px-2 py-0.5 rounded-full ${
                        data.confidence_score === 'High' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : data.confidence_score === 'Medium' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {factor}
                      </span>
                    ))}
                  </div>
               </div>
             )}

             {/* Source Validation */}
             {data.source_validation && (
               <div className={`p-3 rounded-lg border mb-4 ${
                 data.source_validation.is_business_school_site && data.source_validation.primary_source_valid
                   ? 'bg-emerald-50 border-emerald-200'
                   : 'bg-amber-50 border-amber-200'
               }`}>
                  <div className={`flex items-center gap-2 mb-2 ${
                    data.source_validation.is_business_school_site ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                      <Globe size={14} />
                      <span className="text-xs font-medium">Source Validation</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Business School Site:</span>
                      <span className={`ml-2 font-semibold ${data.source_validation.is_business_school_site ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {data.source_validation.is_business_school_site ? '✓ Yes' : '⚠ No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Primary Source Valid:</span>
                      <span className={`ml-2 font-semibold ${data.source_validation.primary_source_valid ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {data.source_validation.primary_source_valid ? '✓ Yes' : '⚠ No'}
                      </span>
                    </div>
                    {data.source_validation.source_domain && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Domain:</span>
                        <span className="ml-2 font-mono text-slate-700">{data.source_validation.source_domain}</span>
                      </div>
                    )}
                  </div>
               </div>
             )}

             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 mt-6">Detailed Metadata</h4>

             {/* Extraction Timestamps */}
             <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="grid grid-cols-2 gap-3 text-xs">
                   <div>
                      <span className="text-slate-600 font-medium">Extracted At:</span>
                      <p className="text-slate-900 font-mono mt-1">
                        {data.extracted_at ? new Date(data.extracted_at).toLocaleString() : 'N/A'}
                      </p>
                   </div>
                   <div>
                      <span className="text-slate-600 font-medium">Last Updated:</span>
                      <p className="text-slate-900 font-mono mt-1">
                        {data.updated_at ? new Date(data.updated_at).toLocaleString() : 'Not updated'}
                      </p>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-slate-500">
                         <DollarSign size={14} />
                         <span className="text-xs font-medium">Cost Per Credit</span>
                      </div>
                   </div>
                   <input
                     type="text"
                     value={costPerCredit}
                     onChange={(e) => handleCostPerCreditChange(e.target.value)}
                     placeholder="e.g. $1,200/credit"
                     className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-jhu-heritage focus:border-transparent"
                   />
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-slate-500">
                         <BookOpen size={14} />
                         <span className="text-xs font-medium">Total Credits</span>
                      </div>
                   </div>
                   <input
                     type="text"
                     value={totalCredits}
                     onChange={(e) => handleTotalCreditsChange(e.target.value)}
                     placeholder="e.g. 30 credits"
                     className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-jhu-heritage focus:border-transparent"
                   />
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-slate-500">
                         <Clock size={14} />
                         <span className="text-xs font-medium">Program Length</span>
                      </div>
                   </div>
                   <input
                     type="text"
                     value={programLength}
                     onChange={(e) => handleProgramLengthChange(e.target.value)}
                     placeholder="e.g. 18 months, 2 years"
                     className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-jhu-heritage focus:border-transparent"
                   />
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <MapPin size={14} />
                      <span className="text-xs font-medium">Location</span>
                   </div>
                   {data.location_data ? (
                       <a href={data.location_data.map_url} target="_blank" rel="noreferrer" className="font-semibold text-jhu-heritage hover:underline block truncate">
                           {data.location_data.address}
                       </a>
                   ) : (
                       <p className="font-semibold text-slate-400 italic">Location not extracted</p>
                   )}
                </div>
             </div>

             {/* Additional Fees */}
             {data.additional_fees && (
               <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-2 text-orange-700 mb-1">
                      <DollarSign size={14} />
                      <span className="text-xs font-medium">Additional Fees</span>
                  </div>
                  <p className="text-sm text-orange-800">{data.additional_fees}</p>
               </div>
             )}

             {/* Official Program Name & STEM Status */}
             <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                   <div className="flex items-center gap-2 text-blue-600 mb-1">
                       <GraduationCap size={14} />
                       <span className="text-xs font-medium">Official Program Name</span>
                   </div>
                   <p className="font-semibold text-slate-900 text-sm leading-tight">
                     {data.actual_program_name || <span className="text-slate-400 italic">Not specified</span>}
                   </p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  data.is_stem === true 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : data.is_stem === false 
                      ? 'bg-slate-50 border-slate-200' 
                      : 'bg-amber-50 border-amber-200'
                }`}>
                   <div className={`flex items-center gap-2 mb-1 ${
                     data.is_stem === true 
                       ? 'text-emerald-600' 
                       : data.is_stem === false 
                         ? 'text-slate-500' 
                         : 'text-amber-600'
                   }`}>
                       {data.is_stem === true ? <Beaker size={14} /> : data.is_stem === false ? <Beaker size={14} /> : <HelpCircle size={14} />}
                       <span className="text-xs font-medium">STEM Status</span>
                   </div>
                   <p className={`font-semibold text-sm ${
                     data.is_stem === true 
                       ? 'text-emerald-700' 
                       : data.is_stem === false 
                         ? 'text-slate-600' 
                         : 'text-amber-700'
                   }`}>
                     {data.is_stem === true 
                       ? '✓ STEM Designated' 
                       : data.is_stem === false 
                         ? 'Not STEM' 
                         : 'Unknown'}
                   </p>
                </div>
             </div>

             {/* User Comments - Editable */}
             <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-amber-700">
                      <MessageSquare size={14} />
                      <span className="text-xs font-medium">User Comments</span>
                  </div>
                </div>
                <textarea
                  value={comments}
                  onChange={(e) => handleCommentsChange(e.target.value)}
                  placeholder="Add your comments or notes here..."
                  className="w-full p-2 text-sm border border-amber-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent resize-none"
                  rows={3}
                />
             </div>

             {/* Save Button for All Editable Fields */}
             {hasChanges && (
               <div className="mt-4 flex justify-end">
                 <button
                   onClick={handleSaveAll}
                   disabled={isSaving}
                   className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-jhu-heritage text-white hover:bg-jhu-heritage/90 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                 >
                   {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                   {isSaving ? 'Saving Changes...' : 'Save All Changes'}
                 </button>
               </div>
             )}

             <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <AlertCircle size={14} />
                    <span className="text-xs font-medium">Remarks</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm leading-tight">{data.remarks || 'No remarks.'}</p>
             </div>
          </div>

          {/* Validated Sources Section with Raw Content */}
          <div className="p-6 bg-white flex-1">
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Validated Official Sources</h4>
             <div className="space-y-2">
               {data.validated_sources && data.validated_sources.length > 0 ? (
                 data.validated_sources.map((source, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        {/* Source Header - Clickable */}
                        <button 
                          className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                            expandedSources.has(idx) 
                              ? 'bg-slate-100 border-b border-slate-200' 
                              : 'bg-white hover:bg-slate-50'
                          }`}
                          onClick={() => toggleSourceExpanded(idx)}
                        >
                            <div className={`p-1.5 rounded-full flex-shrink-0 ${idx === 0 ? 'bg-green-100' : 'bg-slate-100'}`}>
                                <CheckCircle2 size={14} className={idx === 0 ? 'text-green-600' : 'text-slate-500'}/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-800 truncate">{source.title || 'Official Source'}</p>
                                  {idx === 0 && (
                                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded flex-shrink-0">
                                      PRIMARY
                                    </span>
                                  )}
                                  {source.raw_content && 
                                   !source.raw_content.includes('Could not fetch content') &&
                                   !source.raw_content.includes('No extractable text content found') &&
                                   source.raw_content.trim().length > 0 ? (
                                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded flex-shrink-0" title="Page content fetched directly from URL">
                                      FETCHED
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded flex-shrink-0" title="Could not fetch content from URL">
                                      BLOCKED
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 truncate mt-0.5">{source.url}</p>
                            </div>
                            <div className={`p-1 rounded transition-transform ${expandedSources.has(idx) ? 'rotate-180' : ''}`}>
                              <ChevronDown size={18} className="text-slate-400" />
                            </div>
                        </button>
                        
                        {/* Expandable Raw Content Panel */}
                        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
                          expandedSources.has(idx) ? 'max-h-64' : 'max-h-0'
                        }`}>
                          <div className="p-3 bg-slate-50 border-b border-slate-200">
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs text-jhu-heritage hover:underline break-all inline-flex items-center gap-1"
                            >
                              <Globe size={12} />
                              {source.url}
                            </a>
                          </div>
                          <div className="bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed p-4 max-h-96 overflow-y-auto border-t border-slate-700">
                            <div className="flex items-center justify-between mb-3 text-slate-400 border-b border-slate-700 pb-2">
                              <div className="flex items-center gap-2">
                                <FileText size={12} />
                                <span className="uppercase text-[10px] font-semibold tracking-wide">Page Content (Fetched from URL)</span>
                              </div>
                              {source.raw_content && 
                               !source.raw_content.includes('Could not fetch content') &&
                               !source.raw_content.includes('No extractable text content found') &&
                               source.raw_content.trim().length > 0 && (
                                <span className="text-[10px] text-slate-500">
                                  {source.raw_content.length.toLocaleString()} characters
                                </span>
                              )}
                            </div>
                            {source.raw_content && 
                             !source.raw_content.includes('Could not fetch content') &&
                             !source.raw_content.includes('No extractable text content found') &&
                             source.raw_content.trim().length > 0 ? (
                              <pre className="whitespace-pre-wrap text-slate-200 leading-relaxed font-mono text-xs bg-slate-950 p-3 rounded border border-slate-800">{source.raw_content}</pre>
                            ) : source.raw_content && source.raw_content.includes('Could not fetch content') ? (
                              <div className="text-center py-6">
                                <AlertCircle size={24} className="text-amber-500 mx-auto mb-3" />
                                <p className="text-amber-400 italic text-xs font-medium">Could not fetch content from this URL.</p>
                                <p className="text-slate-500 text-[10px] mt-2">The website may be blocking automated requests or the page is not accessible.</p>
                                <a 
                                  href={source.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-block mt-3 px-3 py-1.5 bg-jhu-heritage text-white text-xs font-medium rounded hover:bg-jhu-heritage/90 transition-colors"
                                >
                                  Visit URL to Verify Manually
                                </a>
                              </div>
                            ) : idx === 0 && data.raw_content ? (
                              <div>
                                <p className="text-slate-500 text-[10px] mb-2 italic">Using AI extraction summary (direct URL fetch not available):</p>
                                <pre className="whitespace-pre-wrap text-slate-200 leading-relaxed font-mono text-xs bg-slate-950 p-3 rounded border border-slate-800">{data.raw_content}</pre>
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <AlertCircle size={24} className="text-slate-500 mx-auto mb-3" />
                                <p className="text-slate-400 italic text-xs font-medium">No content available for this URL.</p>
                                <a 
                                  href={source.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-block mt-3 px-3 py-1.5 bg-jhu-heritage text-white text-xs font-medium rounded hover:bg-jhu-heritage/90 transition-colors"
                                >
                                  Visit URL to Verify Manually
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                 ))
               ) : (
                  <div className="rounded-lg border border-amber-200 overflow-hidden">
                     <div className="p-4 bg-amber-50 flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-full">
                          <Globe size={16} className="text-amber-600"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Legacy Source</p>
                          <a href={data.source_url} target="_blank" rel="noreferrer" className="text-sm text-jhu-heritage hover:underline break-all">
                            {data.source_url}
                          </a>
                        </div>
                     </div>
                     {data.raw_content && (
                       <div className="bg-slate-800 text-slate-300 font-mono text-xs leading-relaxed p-4 max-h-48 overflow-y-auto">
                         <div className="flex items-center gap-2 mb-3 text-slate-500 border-b border-slate-700 pb-2">
                           <Code size={12} />
                           <span className="uppercase text-[10px] font-semibold tracking-wide">Raw Content Snippet</span>
                         </div>
                         <pre className="whitespace-pre-wrap">{data.raw_content}</pre>
                       </div>
                     )}
                  </div>
               )}
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
           <button
             onClick={onClose}
             className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-jhu-gray rounded-lg transition-colors"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
};
