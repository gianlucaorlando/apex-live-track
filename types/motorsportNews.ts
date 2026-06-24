export interface MotorsportNewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  category: string | null;
  publishedAt: string | null;
  source: string;
}

export interface MotorsportNewsApiResponse {
  data: MotorsportNewsItem[];
  meta: {
    generatedAt: string;
    source: string;
    partial: boolean;
    messages: string[];
  };
}
