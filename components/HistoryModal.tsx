import React, { useState, useEffect } from 'react';
import { X, History, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { ExtractionResult } from '../types';
import { useApp } from '../context/AppContext';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultId: string;
  onTrackUpdate: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, resultId, onTrackUpdate }) => {
  const { getResultHistory } = useApp();
  const [history, setHistory] = useState<ExtractionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && resultId) {
      loadHistory();
    }
  }, [isOpen, resultId]);

  const loadHistory = async () => {
    setIsLoading(true);
    const data = await getResultHistory(resultId);
    setHistory(data);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const calculateChange = (current: string | null, previous: string | null): { percent: number; amount: number } | null => {
    if (!current || !previous) return null;

    const currentNum = parseFloat(current.replace(/[^0-9.-]+/g, ''));
    const previousNum = parseFloat(previous.replace(/[^0-9.-]+/g, ''));

    if (isNaN(currentNum) || isNaN(previousNum) || previousNum === 0) return null;

    const percent = ((currentNum - previousNum) / previousNum) * 100;
    const amount = currentNum - previousNum;

    return { percent, amount };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <History className="w-5 h-5 text-jhu-heritage" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-jhu-heritage">Price History</h2>
              {history.length > 0 && (
                <p className="text-sm text-gray-600">
                  {history[0].school_name} - {history[0].program_name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-jhu-gray rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-jhu-heritage"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((version, index) => {
                const previousVersion = index < history.length - 1 ? history[index + 1] : null;
                const change = previousVersion ? calculateChange(version.tuition_amount, previousVersion.tuition_amount) : null;
                const isLatest = index === 0;

                return (
                  <div
                    key={version.id}
                    className={`p-4 rounded-lg border-2 ${
                      isLatest
                        ? 'border-jhu-heritage bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          isLatest
                            ? 'bg-jhu-heritage text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          v{version.extraction_version}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(version.extracted_at)}
                        </div>
                        {isLatest && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Current
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Tuition Amount</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {version.tuition_amount || 'N/A'}
                        </p>
                      </div>
                      {change && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Change from Previous</p>
                          <div className="flex items-center gap-2">
                            {change.percent > 0 ? (
                              <TrendingUp className="w-5 h-5 text-red-500" />
                            ) : change.percent < 0 ? (
                              <TrendingDown className="w-5 h-5 text-green-500" />
                            ) : (
                              <Minus className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                              <p className={`text-lg font-semibold ${
                                change.percent > 0 ? 'text-red-600' : change.percent < 0 ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {change.percent > 0 ? '+' : ''}{change.percent.toFixed(1)}%
                              </p>
                              <p className="text-xs text-gray-500">
                                ${Math.abs(change.amount).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Period</p>
                        <p className="font-medium text-gray-900">{version.tuition_period}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Academic Year</p>
                        <p className="font-medium text-gray-900">{version.academic_year}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Confidence</p>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          version.confidence_score === 'High' ? 'bg-green-100 text-green-700' :
                          version.confidence_score === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {version.confidence_score}
                        </span>
                      </div>
                    </div>

                    {version.remarks && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Remarks</p>
                        <p className="text-sm text-gray-700">{version.remarks}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {history.length} version{history.length !== 1 ? 's' : ''} tracked
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-jhu-gray rounded-lg transition-colors font-semibold"
            >
              Close
            </button>
            <button
              onClick={() => {
                onTrackUpdate();
                onClose();
              }}
              className="px-4 py-2 bg-jhu-heritage text-white hover:opacity-90 rounded-lg transition-all flex items-center gap-2 font-semibold shadow-sm"
            >
              <TrendingUp className="w-4 h-4" />
              Track Price Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
