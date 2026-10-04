import { readableDemoTitle } from './display-labels';

/** Keep the stored title available without putting test timestamps in headings. */
export function DemoTitleDetails({ title }: { title: string }) {
  const display = readableDemoTitle(title);
  if (!display.original) return null;
  return <details className="demo-title-details"><summary>Pełna nazwa próby</summary><p>{display.original}</p></details>;
}
