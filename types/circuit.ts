export interface CircuitPhoto {
  imageUrl: string;
  sourceUrl: string;
  title: string;
  author: string | null;
  license: string | null;
  attribution: string;
}

export interface CircuitPhotoApiResponse {
  data: CircuitPhoto | null;
  meta: {
    generatedAt: string;
    partial: boolean;
    messages: string[];
  };
}
