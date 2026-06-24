import { AlertTriangle, RefreshCcw } from "lucide-react";
import { apiMessage, t, type Locale } from "@/lib/i18n";

interface ErrorStateProps {
  message: string;
  locale: Locale;
  onRetry: () => void;
}

export function ErrorState({ message, locale, onRetry }: ErrorStateProps) {
  return (
    <div className="grid min-h-[60vh] place-items-center rounded-lg border border-red-500/30 bg-red-950/20 p-6 text-center">
      <div className="max-w-md">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-300" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-white">{t(locale, "apiError")}</h2>
        <p className="mt-2 text-sm text-red-100/80">{apiMessage(locale, message)}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {t(locale, "retry")}
        </button>
      </div>
    </div>
  );
}
