"""Build pitch-preserving, circular-crossfaded Arena loops; requires ffmpeg."""
import subprocess, json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[4]
source=Path(__file__).with_name('take-1.mp3')
manifest_path=root/'lib/games/arena/audio.json'
manifest=json.loads(manifest_path.read_text())
for name,start,tempo in [('music-battle',0,1),('music-final',60,1.5)]:
    length=60/tempo
    bar=2.5/tempo
    # Blend the last bar over the first, then play bars 2..end. The wrap
    # returns from the blended first bar to bar 2 without a silent tail.
    filters=(f'[0:a]atrim=start={start}:end={start+60},asetpts=PTS-STARTPTS,'
             f'atempo={tempo},highpass=f=65,asplit=3[h][m][t];'
             f'[h]atrim=end={bar},asetpts=PTS-STARTPTS[head];'
             f'[m]atrim=start={bar}:end={length-bar},asetpts=PTS-STARTPTS[mid];'
             f'[t]atrim=start={length-bar},asetpts=PTS-STARTPTS[tail];'
             f'[tail][head]acrossfade=d={bar}:c1=tri:c2=tri[seam];'
             '[mid][seam]concat=n=2:v=0:a=1,loudnorm=I=-20:TP=-2:LRA=9[out]')
    target=Path('/tmp')/f'arena-{name}.mp3'
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-filter_complex',filters,
                    '-map','[out]','-ar','48000','-ac','2','-b:a','192k',str(target)],check=True)
    content=target.read_bytes();digest=hashlib.sha256(content).hexdigest()[:8]
    path=f'/audio/arena/{name}-{digest}.mp3'
    (root/'public'/path.lstrip('/')).write_bytes(content)
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
    manifest[name]={'srcs':[path],'duration':duration,'gain':0.8,'loop':True}
    print(name,path,duration)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
