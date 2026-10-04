"""Process Arena effect clips from raw/ into public/audio/arena/ and list them.

Usage: python3 assets/arena/audio/process-effects.py <clips.json> [--dry]

clips.json is a list of {id, gain, raw: [file names in raw/], prompt, dur}
and an optional maxLimit (dB of limiting allowed, default 6).
Each raw take becomes `<id>[-<n>]-<sha256 first 8>.mp3` (the pipeline in the
README: trim silence at -50 dB, gain toward -16 LUFS (integrated from 0.9 s,
shorter clips by max momentary loudness on a padded copy), boost capped at +20 dB and at 6 dB of limiting,
4x-oversampled limiter to -1.6 dBFS, a fade-out of 12 % of the clip within
30-120 ms, mono 44.1 kHz 96 kbps CBR) and the entry is written into
lib/games/arena/audio.json. Prints duration, loudness and true peak.
"""
import hashlib, json, re, subprocess, sys, tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[3]
here = Path(__file__).resolve().parent
raw = here / 'raw'
public = root / 'public/audio/arena'
manifest_path = root / 'lib/games/arena/audio.json'

TARGET = -16.0
CEILING = -1.6
MAX_BOOST = 20.0
MAX_LIMIT = 6.0
TRIM = ('silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
        'silenceremove=start_periods=1:start_threshold=-50dB,areverse')


def ff(*args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *args],
                          capture_output=True, text=True)


def duration(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                                   'format=duration', '-of', 'csv=p=0', str(path)])
    return float(out)


def measure(path, pad=True):
    """Max momentary loudness, integrated loudness, sample and true peak."""
    chain = ('apad=pad_dur=1,' if pad else '') + 'ebur128=peak=true+sample:metadata=1,' \
        'ametadata=print:key=lavfi.r128.M'
    r = ff('-i', str(path), '-af', chain, '-f', 'null', '-')
    moments = [float(v) for v in re.findall(r'lavfi\.r128\.M=(-?[\d.]+|-inf)', r.stdout + r.stderr)
               if v != '-inf']
    summary = r.stderr[r.stderr.rfind('Summary:'):]
    grab = lambda label: float(re.search(label + r':\s+(-?[\d.]+|-inf)', summary)[1].replace('-inf', '-99'))
    return {
        'M': max(moments) if moments else -99.0,
        'I': grab(r'I'),
        'sample': float(re.search(r'Sample peak:\s+Peak:\s+(-?[\d.]+|-inf)', summary)[1].replace('-inf', '-99')),
        'true': float(re.search(r'True peak:\s+Peak:\s+(-?[\d.]+|-inf)', summary)[1].replace('-inf', '-99')),
    }


def process(source, out_stem, max_limit=MAX_LIMIT):
    with tempfile.TemporaryDirectory() as tmp:
        trimmed = Path(tmp) / 'trim.wav'
        ff('-y', '-i', str(source), '-af', TRIM, '-ac', '1', '-ar', '44100', str(trimmed))
        m = measure(trimmed)
        length = duration(trimmed)
        # Clips of a second or so are gained by integrated loudness; shorter
        # ones by their loudest momentary window on a padded copy.
        loud = measure(trimmed, pad=False)['I'] if length >= 0.9 else m['M']
        gain = min(TARGET - loud, MAX_BOOST, CEILING + max_limit - m['sample'])
        fade = max(0.03, min(0.12, length * 0.12))
        limit = 10 ** (CEILING / 20)
        chain = (f'volume={gain:.2f}dB,aresample=176400,'
                 f'alimiter=limit={limit:.4f}:attack=1:release=40:level=false,'
                 f'aresample=44100,afade=t=out:st={max(0, length - fade):.3f}:d={fade:.3f}')
        mixed = Path(tmp) / 'out.mp3'
        r = ff('-y', '-i', str(trimmed), '-af', chain, '-ac', '1', '-ar', '44100',
               '-c:a', 'libmp3lame', '-b:a', '96k', str(mixed))
        if r.returncode:
            raise RuntimeError(r.stderr)
        data = mixed.read_bytes()
        name = f'{out_stem}-{hashlib.sha256(data).hexdigest()[:8]}.mp3'
        for old in public.glob(f'{out_stem}-????????.mp3'):
            old.unlink()
        (public / name).write_bytes(data)
        final = measure(public / name)
        return name, round(duration(public / name), 2), gain, final


def main():
    clips = json.loads(Path(sys.argv[1]).read_text())
    manifest = json.loads(manifest_path.read_text())
    for clip in clips:
        srcs, lengths = [], []
        for n, file in enumerate(clip['raw'], 1):
            stem = clip['id'] if len(clip['raw']) == 1 else f"{clip['id']}-{n}"
            name, length, gain, final = process(raw / file, stem, clip.get('maxLimit', MAX_LIMIT))
            srcs.append(f'/audio/arena/{name}')
            lengths.append(length)
            print(f"{stem:22} {length:5.2f}s gain {gain:+6.2f} dB  M {final['M']:6.1f}  "
                  f"I {final['I']:6.1f} LUFS  TP {final['true']:5.1f} dBTP")
        manifest[clip['id']] = {'srcs': srcs, 'duration': max(lengths),
                                'gain': clip['gain'], 'loop': False}
    if '--dry' not in sys.argv:
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
