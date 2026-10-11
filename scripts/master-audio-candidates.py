"""Remaster the retained ElevenLabs ambience beds without changing their originals.

Sound effects are synthesised in the browser (lib/games/sound); the effect
candidates this once mastered live in the art archive."""
import json, re, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/audio/elevenlabs/2026-09-28'
records = [r for r in json.loads((folder / 'generation.json').read_text())['completed'] if r.get('kind') == 'bed']
report = []
for record in records:
    source = folder / f"{record['id']}.mp3"
    if not source.exists():
        raise FileNotFoundError(f'Restore the retained source before remastering: {source}')
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(source)]))
    duration = float(probe['format']['duration'])
    analysis = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(source), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    mean = float(re.search(r'mean_volume: ([\d.-]+)', analysis)[1])
    peak = float(re.search(r'max_volume: ([\d.-]+)', analysis)[1])
    target = -20 if record.get('kind') == 'bed' else -24
    change = target - mean
    output = root / f"public/audio/elevenlabs/{record['id']}.mp3"
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-af', f'volume={change}dB,alimiter=limit=0.398:level=false', '-c:a', 'libmp3lame', '-b:a', '96k' if record.get('kind') == 'bed' else '128k', str(output)], check=True)
    mastered = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(output), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    master_mean = float(re.search(r'mean_volume: ([\d.-]+)', mastered)[1])
    master_peak = float(re.search(r'max_volume: ([\d.-]+)', mastered)[1])
    report.append({'id': record['id'], 'duration': round(duration, 3), 'source_mean_db': mean, 'source_peak_db': peak, 'gain_db': round(change, 2), 'master_mean_db': master_mean, 'master_peak_db': master_peak, 'limiter_ceiling_db': -8})
(folder / 'mastering.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'Mastered {len(report)} beds; RMS target -20 dBFS, peak ceiling -8 dBFS.')
