import type { ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

export function SectionTabs({ value, onValueChange, label, items, children }: { value: string; onValueChange: (value: string) => void; label: string; items: readonly (readonly [string, string])[]; children: ReactNode }) {
  return <Tabs.Root value={value} onValueChange={onValueChange} activationMode="automatic"><Tabs.List className="tabs" aria-label={label}>{items.map(([key, title]) => <Tabs.Trigger key={key} value={key}>{title}</Tabs.Trigger>)}</Tabs.List>{children}</Tabs.Root>;
}
export function SectionTabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  // Keep the panel element free of display classes so inactive panels remain hidden.
  return <Tabs.Content value={value}>{className ? <div className={className}>{children}</div> : children}</Tabs.Content>;
}
