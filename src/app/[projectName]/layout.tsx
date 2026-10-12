import type { Metadata } from 'next';

export function generateMetadata({ params }: { params: { projectName: string } }): Metadata {
  return { title: decodeURIComponent(params.projectName) };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
