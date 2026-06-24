import { LoaderCircle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export function LoadingState({ locale }: { locale: Locale }) {
  return (
    <div className="grid min-h-[60vh] place-items-center rounded-lg border border-white/10 bg-neutral-950/70">
      <div className="flex items-center gap-3 text-sm text-neutral-300">
        <LoaderCircle className="h-5 w-5 animate-spin text-red-400" aria-hidden="true" />
        {t(locale, "loadingOpenF1")}
      </div>
    </div>
  );
}
