import { AlertCircle, LoaderCircle, RotateCcw } from 'lucide-react';
import { errorMessage } from '../lib/api';
export function Loading({ label = 'Loading your readings…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={20} className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={19} aria-hidden="true" />
      <div>
        <p>{errorMessage(error)}</p>
        {retry && (
          <button className="text-button mt-2" onClick={retry}>
            <RotateCcw size={14} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
