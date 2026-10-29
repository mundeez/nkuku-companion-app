import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface DocsPageProps {
  params: Promise<{ path?: string[] }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { path: pathSegments } = await params;
  const docsRoot = path.resolve(process.cwd(), 'public', 'docs');

  if (!pathSegments || pathSegments.length === 0) {
    const files = fs.readdirSync(docsRoot, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(md|txt)$/i.test(e.name))
      .map((e) => e.name)
      .sort();
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Documentation</h1>
        <div className="bg-card text-card-foreground rounded-lg border p-6 shadow-sm">
          <ul className="list-disc pl-5 space-y-2">
            {files.map((f) => (
              <li key={f}>
                <Link href={`/docs/${f}`} className="text-primary hover:underline">
                  {f.replace(/\.(md|txt)$/i, '').replace(/[_-]+/g, ' ')}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  const filePath = path.join(docsRoot, ...pathSegments);
  const resolved = path.resolve(filePath);

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
