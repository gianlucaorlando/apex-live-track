import { Dashboard } from "@/components/Dashboard";

interface PageProps {
  searchParams: Promise<{
    demo?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialDemo = params.demo === "true" || params.demo === "1";

  return <Dashboard initialDemo={initialDemo} />;
}
