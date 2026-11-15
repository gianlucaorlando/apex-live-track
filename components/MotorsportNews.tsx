"use client";

import { ExternalLink, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { formatShortDateTime } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import type {
  MotorsportNewsApiResponse,
  MotorsportNewsItem,
} from "@/types/motorsportNews";

interface MotorsportNewsProps {
  locale: Locale;
  /** Dentro un altro pannello (tab): niente cornice ne' intestazione propria. */
  embedded?: boolean;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}...`;
}

export function MotorsportNews({ locale, embedded = false }: MotorsportNewsProps) {
  const [items, setItems] = useState<MotorsportNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ lang: locale });

    async function loadNews() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/motorsport-news?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | MotorsportNewsApiResponse
          | null;

        if (controller.signal.aborted) {
          return;
        }

        setItems(response.ok ? payload?.data ?? [] : []);
        setError(response.ok ? null : payload?.meta.messages[0] ?? t(locale, "apiUnexpected"));
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setError(t(locale, "apiUnexpected"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadNews();

    return () => {
      controller.abort();
    };
  }, [locale]);

  return (
    <aside
      className={`flex h-full min-h-0 flex-col ${embedded ? "" : "panel rounded-xl overflow-hidden"}`}
      aria-label={t(locale, "motorsportNewsAria")}
      data-motorsport-news
    >
      <div className={`flex items-center justify-between border-b border-line px-4 py-3 ${embedded ? "hidden" : ""}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Newspaper className="h-4 w-4 flex-none text-ink" aria-hidden="true" />
          <h2 className="truncate text-sm font-black uppercase tracking-[0.16em] text-ink">
            {t(locale, "motorsportNews")}
          </h2>
        </div>
        <span className="rounded-md bg-soft px-2 py-1 text-xs font-semibold text-muted">
          {items.length || 0}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-muted">
            {t(locale, "motorsportNewsLoading")}
          </div>
        ) : error || items.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-muted">
            {error ?? t(locale, "motorsportNewsEmpty")}
          </div>
        ) : (
          <div className="grid gap-2 p-2 sm:grid-cols-2" role="list">
            {items.slice(0, 6).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                role="listitem"
                className="group grid min-h-[7.25rem] grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-soft p-2 text-left transition hover:border-cyan-200/30 hover:bg-soft focus:outline-none focus:ring-2 focus:ring-ink/30"
              >
                <div className="relative h-full min-h-[6.25rem] overflow-hidden rounded-md bg-white">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-white">
                      <Newspaper className="h-6 w-6 text-muted" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/48 to-transparent" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-muted">
                    <span>{item.category ?? t(locale, "motorsportNewsSource")}</span>
                    {item.publishedAt ? (
                      <span>{formatShortDateTime(item.publishedAt, locale)}</span>
                    ) : null}
                  </div>

                  <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-ink">
                    {item.title}
                  </h3>

                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-muted">
                      {truncate(item.description, 150)}
                    </p>
                  ) : null}

                  <div className="mt-2 inline-flex items-center gap-1 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-ink">
                    {item.source}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
