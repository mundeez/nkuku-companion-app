import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';

interface DocsPageProps {
  params: Promise<{ path: string[] }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { path: pathSegments } = await params;
  const filePath = path.join(process.cwd(), 'public', 'docs', ...pathSegments);
  const resolved = path.resolve(filePath);
  const docsRoot = path.resolve(process.cwd(), 'public', 'docs');

  if (!resolved.startsWith(docsRoot) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    notFound();
  }

  const content = fs.readFileSync(resolved, 'utf-8');

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="bg-card text-card-foreground rounded-lg border p-6 shadow-sm">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{content}</pre>
      </div>
    </main>
  );
}
