import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Badge, Loading, Notice, Select } from './ui';

export function RegionalMap() {
  const result = useQuery((api as any).knowledge.indicators, {});
  const [selection, setSelection] = useState('');
  if (!result) return <Loading />;
  const key = (row: any) => `${row.name}|${row.year}|${row.unit}`;
  const groups: any[] = [...new Map(result.rows.map((row: any) => [key(row), row])).values()];
  const selected = groups.some(row => key(row) === selection) ? selection : groups[0] ? key(groups[0]) : '';
  const rows = result.rows.filter((row: any) => key(row) === selected);
  const points = rows.filter((row: any) => row.latitude >= 49.1 && row.latitude <= 50.7 && row.longitude >= 18.9 && row.longitude <= 21.8);
  return <section className="panel stack" aria-label="Mapa regionalnych wskaźników"><div className="section-heading"><div><span className="eyebrow">MAPA WYZWAŃ SPOŁECZNYCH</span><h2>Wiedza w lokalnym kontekście</h2></div><Badge>Mapa orientacyjna</Badge></div>
    <p>Wskaźniki pochodzą z opublikowanych materiałów. Każda wartość ma terytorium, rok, jednostkę i źródło. Lista pod mapą udostępnia tę samą treść.</p>
    {!rows.length ? <Notice>Nie ma jeszcze opublikowanych wskaźników dla tego obszaru.</Notice> : <>
      <Select label="Wskaźnik, rok i jednostka" value={selected} onChange={setSelection} options={groups.map(row => ({ value: key(row), label: `${row.name} · ${row.year} · ${row.unit}` }))} />
      {rows.some((row: any) => row.demo) && <Notice><strong>Dane demonstracyjne.</strong> Wartości fikcyjne pokazują sposób prezentacji wskaźników.</Notice>}
      <div className="map-visual" role="img" aria-label={`Orientacyjna mapa punktowa Małopolski: ${points.map((row: any) => `${row.territory}: ${row.value} ${row.unit}, ${row.year}`).join('; ')}. Pełne dane i źródła w tabeli poniżej.`}>
        <svg viewBox="0 0 640 310" style={{ width: '100%', maxHeight: 340 }} aria-hidden="true"><rect x="35" y="20" width="570" height="250" rx="18" fill="#edf3ef" stroke="#92ada0" /><text x="45" y="43" fill="#173c31">Małopolska · położenie przybliżone</text>{points.map((row: any) => { const x = 50 + (row.longitude - 18.9) / 2.9 * 500; const y = 255 - (row.latitude - 49.1) / 1.6 * 200; return <g key={row.id}><circle cx={x} cy={y} r="9" fill={row.demo ? '#7b5a2b' : '#1b6b57'} stroke="white" strokeWidth="2" /><text x={x + 14} y={y - 4} fontSize="14" fill="#173c31">{row.territory}</text><text x={x + 14} y={y + 16} fontSize="13" fill="#173c31">{row.value} {row.unit}</text></g>; })}<text x="45" y="294" fontSize="12" fill="#173c31">Punkty lokalizują dane; wielkość punktu nie oznacza natężenia problemu.</text></svg>
      </div>{points.length < rows.length && <p className="muted">Część danych nie ma współrzędnych w obszarze Małopolski. Pozostają dostępne w tabeli.</p>}
      <div className="table-wrap"><table><caption>{rows[0].name}. Rok {rows[0].year}, jednostka: {rows[0].unit}.</caption><thead><tr><th scope="col">Terytorium</th><th scope="col">Wartość</th><th scope="col">Rok</th><th scope="col">Jednostka</th><th scope="col">Źródło i ograniczenia</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.id}><th scope="row">{row.territory}</th><td>{row.value}{row.demo && <small>Fikcyjna</small>}</td><td>{row.year}</td><td>{row.unit}</td><td>{row.sources.map((source: any) => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.publisher} · źródło v{source.version} · materiał v{row.version}</small></p>)}{row.note && <small>{row.note}</small>}</td></tr>)}</tbody></table></div>
    </>}{result.truncated && <Notice>Wyświetlono pierwsze {result.recordLimit} opublikowanych materiałów mapowych. Zestawienie jest niepełne.</Notice>}
  </section>;
}
