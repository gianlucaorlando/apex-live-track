import { LoaderCircle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export function LoadingState({
  locale,
  message,
}: {
  locale: Locale;
  message?: string;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center rounded-lg border border-line bg-white">
      <div className="flex items-center gap-3 text-sm text-muted">
        <LoaderCircle className="h-5 w-5 animate-spin text-red-600" aria-hidden="true" />
        {message ?? t(locale, "loadingOpenF1")}
      </div>
    </div>
  );
}
