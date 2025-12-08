import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { APP_VERSION } from '@/src/config';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional name to identify which boundary caught the error */
  boundaryName?: string;
}

interface ErrorInfo {
  componentStack: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

// Check if we're in development mode
const IS_DEVELOPMENT = import.meta.env.DEV;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Store error info for display
    this.setState({ errorInfo });

    // Log error with context
    const boundaryName = this.props.boundaryName || 'Unknown';
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      boundary: boundaryName,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // In development, log full details
    if (IS_DEVELOPMENT) {
      console.group(`🚨 ErrorBoundary [${boundaryName}] caught an error`);
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Full Report:', errorReport);
      console.groupEnd();
    } else {
      // In production, log minimal info
      console.error(`[ErrorBoundary:${boundaryName}] ${error.message}`);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorText = [
      `Error: ${error?.message}`,
      `Version: ${APP_VERSION}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      '',
      'Stack Trace:',
      error?.stack || 'No stack trace available',
      '',
      'Component Stack:',
      errorInfo?.componentStack || 'No component stack available'
    ].join('\n');

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
                <p className="text-sm text-gray-600">The application encountered an unexpected error</p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-mono text-red-800 break-words">
                  {error.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-jhu-heritage text-white rounded-lg hover:opacity-90 transition-all font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '#/'}
                className="flex-1 px-4 py-2 border-2 border-jhu-heritage text-jhu-heritage rounded-lg hover:bg-blue-50 transition-all font-semibold flex items-center justify-center gap-2"
              >
                <Home size={16} />
                Go Home
              </button>
            </div>

            {/* Expandable Details (Development or when toggled) */}
            {(IS_DEVELOPMENT || error?.stack) && (
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-2"
                >
                  {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showDetails ? 'Hide' : 'Show'} Technical Details
                </button>

                {showDetails && (
                  <div className="space-y-3">
                    {/* Stack Trace */}
                    {error?.stack && (
                      <div className="bg-gray-900 rounded-lg p-3 overflow-auto max-h-48">
                        <p className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                          {error.stack}
                        </p>
                      </div>
                    )}

                    {/* Component Stack (Development only) */}
                    {IS_DEVELOPMENT && errorInfo?.componentStack && (
                      <div className="bg-gray-100 rounded-lg p-3 overflow-auto max-h-32">
                        <p className="text-xs font-medium text-gray-600 mb-1">Component Stack:</p>
                        <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </p>
                      </div>
                    )}

                    {/* Copy Button */}
                    <button
                      onClick={this.handleCopyError}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 bg-gray-100 rounded-lg"
                    >
                      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy Error Details'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                If this problem persists, please contact support
              </p>
              <p className="text-xs text-gray-400">v{APP_VERSION}</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
