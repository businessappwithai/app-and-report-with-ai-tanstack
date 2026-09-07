import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { errorLogger } from "@/lib/errors/error-logger";
import { ErrorReportDialog } from "./error-report-dialog";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showErrorDialog: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showErrorDialog: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    const _errorLog = errorLogger.logError(error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
      showErrorDialog: true,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showErrorDialog: false,
    });
  };

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <>
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-destructive/10">
                  <AlertTriangle className="h-12 w-12 text-destructive" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="font-semibold text-2xl text-tremor-content-strong">
                  Something went wrong
                </h1>
                <p className="text-tremor-content">
                  An unexpected error has occurred. Our team has been notified and we&apos;re
                  working to fix it.
                </p>
              </div>

              {this.state.error && (
                <div className="p-4 rounded-lg bg-muted border">
                  <p className="text-sm font-mono text-left">{this.state.error.message}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={this.handleRetry} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Button onClick={() => this.setState({ showErrorDialog: true })} variant="outline">
                  Report Error
                </Button>
              </div>

              <p className="text-tremor-label text-tremor-content">
                If this problem persists, please contact your system administrator.
              </p>
            </div>
          </div>

          <ErrorReportDialog
            open={this.state.showErrorDialog}
            onOpenChange={(show) => this.setState({ showErrorDialog: show })}
            errorLog={errorLogger.getLatestLog()}
          />
        </>
      );
    }

    return this.props.children;
  }
}
