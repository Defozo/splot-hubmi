/** Deterministic edit of actual browser recordings. No generated UI images.
 * node scripts/render-demo.mjs artifacts/demo-raw/<timestamp>/scenes.json
 * Requires ffmpeg, ffprobe and Python Pillow (no cloud services).
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

const manifestFile = resolve(process.argv[2] || 'output/_video_work/manifests/capture.json');
const capture = JSON.parse(await readFile(manifestFile, 'utf8'));
const output = resolve('output'); const work = join(output, '_video_work');
for (const folder of ['render', 'manifests', 'frames', 'captions', 'reports', 'versions']) await mkdir(join(work, folder), { recursive: true });
const finalFile = process.argv[3] ? resolve(process.argv[3]) : join(output, 'splot-demo.mp4');
let previous; try { previous = JSON.parse(await readFile(join(work, 'manifests', 'edit-decisions.json'), 'utf8')); } catch {}
if (existsSync(finalFile)) {
  const revision = new Date().toISOString().replace(/[:.]/g, '-');
  await copyFile(finalFile, join(work, 'versions', `splot-demo-${revision}.mp4`));
  if (previous) await writeFile(join(work, 'versions', `edit-decisions-${revision}.json`), JSON.stringify(previous, null, 2));
}
const run = (program, args, options = {}) => {
  const result = spawnSync(program, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true, ...options });
  if (result.status !== 0) throw new Error(`${program} ${args.join(' ')}\n${result.stderr || result.stdout || result.error}`);
  return result.stdout;
};
const probe = file => JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
run('python', ['scripts/demo-captions.py', manifestFile, join(work, 'captions')]);
const fps = 25; const width = 1920; const height = 1080;
const decisions = []; let elapsed = 0;
for (const scene of capture.scenes) {
  const info = probe(scene.source); const sourceDuration = Number(info.format.duration);
  const start = Math.max(0, Math.min(scene.sourceIn, sourceDuration - 0.1));
  const end = Math.min(scene.sourceOut, sourceDuration);
  const duration = end - start; const target = scene.targetDuration;
  if (duration <= 0) throw new Error(`Empty recorded segment: ${scene.id}`);
  const clip = join(work, 'render', `${scene.id}.mp4`);
  // All captured actions are preserved. Retiming distributes reading time
  // across the actual sequence instead of freezing only its final state.
  const rate = duration / target;
  const checksum = createHash('sha256').update(await readFile(scene.source)).digest('hex');
  const prior = previous?.scenes.find(item => item.id === scene.id);
  const reuse = prior && existsSync(clip) && prior.sourceSha256 === checksum && prior.selectedStart === start && prior.selectedEnd === end && prior.speed === rate && prior.caption === scene.caption && prior.targetDuration === target && previous.width === width && previous.height === height && previous.fps === fps;
  const graph = `[0:v]trim=start=${start}:end=${end},setpts=(PTS-STARTPTS)/${rate},scale=1920:972:flags=lanczos,setsar=1,pad=1920:1080:0:0:color=0x133f38,tpad=stop_mode=clone:stop_duration=${target},fps=${fps}[recording];[recording][1:v]overlay=0:972,format=yuv420p[v]`;
  if (!reuse) run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-i', scene.source, '-loop', '1', '-i', join(work, 'captions', `${scene.id}.png`), '-filter_complex_threads', '2', '-filter_complex', graph, '-map', '[v]', '-an', '-t', String(target), '-r', String(fps), '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', clip]);
  decisions.push({ ...scene, sourceSha256: checksum, sourceDuration, selectedStart: start, selectedEnd: end, speed: rate, finalStart: elapsed, finalEnd: elapsed + target, clip });
  elapsed += target;
  console.log(`${reuse ? 'Reused verified clip' : 'Rendered'} ${scene.id}: ${target} s (${rate.toFixed(2)}x source).`);
}
if (elapsed > 180) throw new Error(`Duration ${elapsed} exceeds three minutes.`);
const clock = (seconds, separator = ',') => {
  const ms = Math.round(seconds * 1000); const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
};
const srt = decisions.map((scene, i) => `${i + 1}\n${clock(scene.finalStart)} --> ${clock(scene.finalEnd)}\n${scene.caption}\n`).join('\n');
const vtt = 'WEBVTT\n\n' + decisions.map((scene, i) => `${i + 1}\n${clock(scene.finalStart, '.')} --> ${clock(scene.finalEnd, '.')}\n${scene.caption}\n`).join('\n');
await writeFile(join(output, 'splot-demo.srt'), srt); await writeFile(join(output, 'splot-demo.vtt'), vtt);
const list = join(work, 'render', 'concat.txt');
await writeFile(list, decisions.map(scene => `file '${scene.clip.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n'));
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-map', '0:v:0', '-c:v', 'copy', '-metadata', 'title=Splot dla HubMI', '-metadata', 'artist=DEFOZO SOFTWARE HOUSE; Michał Kiełtyka', '-movflags', '+faststart', finalFile]);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-i', finalFile, '-map', '0:v:0', '-f', 'null', '-']);
const finalProbe = probe(finalFile); const video = finalProbe.streams.find(stream => stream.codec_type === 'video');
if (Number(finalProbe.format.duration) > 180 || video.width !== width || video.height !== height || video.pix_fmt !== 'yuv420p') throw new Error('Final output failed the duration, resolution or pixel format checks.');
for (const scene of decisions) run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-ss', String(scene.finalStart + Math.max(0.1, scene.targetDuration - 1)), '-i', finalFile, '-frames:v', '1', '-threads', '2', '-update', '1', join(work, 'frames', `${scene.id}.jpg`)]);
const transcript = `# Splot dla HubMI\n\nFilm przedstawia rzeczywiste działania w działającej aplikacji. Dane, osoby, instytucje i wyniki są demonstracyjne. Nagranie ekranowe bez ścieżki dźwiękowej; pełny opis znajduje się w zsynchronizowanych napisach i poniżej. Tempo zapisu ekranu dopasowano do czytelności napisów. Nie zmieniano treści, kolejności działań ani statusów widocznych w aplikacji.\n\nNagranie wykonano przed końcowymi poprawkami nawigacji, etykiet i dostępności. Bieżący interfejs można sprawdzić w demo pod adresem poniżej. Przepływy biznesowe pozostały bez zmian.\n\nAdres aplikacji: ${capture.publishedUrl}\n\nAutor: Michał Kiełtyka, DEFOZO SOFTWARE HOUSE.\n\n` + decisions.map(scene => `## ${clock(scene.finalStart, '.').slice(3, 8)}–${clock(scene.finalEnd, '.').slice(3, 8)}\n\n${scene.caption}\n\nDziałanie widoczne na ekranie: ${scene.id.replace(/^\d+-/, '').replaceAll('-', ' ')}. Rola: ${({ institution: 'instytucja / CUS', expert: 'ekspertka i partner zasobowy', admin: 'opiekun ROPS', resident: 'uczestniczka', anonymous: 'osoba niezalogowana' })[scene.role]}.\n`).join('\n');
await writeFile(join(output, 'splot-demo-transcript.md'), transcript);
await writeFile(join(work, 'manifests', 'edit-decisions.json'), JSON.stringify({ createdAt: new Date().toISOString(), sourceManifest: manifestFile, authorization: 'User requested the complete official PLAN including its specified demonstration film. The recording follows that sequence with honest synthetic data.', syntheticMedia: false, audio: 'No speech or music; complete Polish captions are burned into a separate rail and available as external VTT and SRT. The MP4 contains video only to avoid duplicate captions.', fps, width, height, duration: elapsed, scenes: decisions }, null, 2));
await writeFile(join(work, 'reports', 'technical-qc.json'), JSON.stringify({ decodedWithoutErrors: true, durationWithin180s: true, sourceUiErrors: decisions.flatMap(scene => scene.errors), finalSha256: createHash('sha256').update(await readFile(finalFile)).digest('hex'), probe: finalProbe }, null, 2));
console.log(`Final video: ${finalFile}, ${elapsed} s; full decode passed. Visual review frames: ${join(work, 'frames')}`);
