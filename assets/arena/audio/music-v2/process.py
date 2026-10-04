"""Two unused original takes for Sound Lab and gentle final-minute remasters.
Final versions use the SAME first-minute recording; no melody replacement.
"""
import subprocess, json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[4]
manifest_path=root/'lib/games/arena/audio.json'
manifest=json.loads(manifest_path.read_text())
choices=[('music-final','take-1.mp3',True),
         ('music-option-a-battle','take-2.mp3',False),
         ('music-option-a-final','take-2.mp3',True),
         ('music-option-b-battle','take-3.mp3',False),
         ('music-option-b-final','take-3.mp3',True)]
for name,take,urgent in choices:
    source=root/'assets/arena/audio/music-v1'/take
    tempo=1.08 if urgent else 1
    length=60/tempo
    bar=2.5/tempo
    tone=('highpass=f=40,bass=g=4:f=105:w=0.6,'
          'equalizer=f=240:t=q:w=0.7:g=2,acompressor=threshold=0.16:ratio=2:attack=20:release=180'
          if urgent else 'highpass=f=65')
    filters=(f'[0:a]atrim=start=0:end=60,asetpts=PTS-STARTPTS,atempo={tempo},{tone},asplit=3[h][m][t];'
             f'[h]atrim=end={bar},asetpts=PTS-STARTPTS[head];'
             f'[m]atrim=start={bar}:end={length-bar},asetpts=PTS-STARTPTS[mid];'
             f'[t]atrim=start={length-bar},asetpts=PTS-STARTPTS[tail];'
             f'[tail][head]acrossfade=d={bar}:c1=tri:c2=tri[seam];'
             '[mid][seam]concat=n=2:v=0:a=1,loudnorm=I=-20:TP=-2:LRA=9,aresample=48000,asetpts=N/SR/TB[out]')
    target=Path('/tmp')/f'arena-{name}-v2.mp3'
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-filter_complex',filters,
                    '-map','[out]','-ar','48000','-ac','2','-b:a','192k',str(target)],check=True)
    content=target.read_bytes();digest=hashlib.sha256(content).hexdigest()[:8]
    path=f'/audio/arena/{name}-{digest}.mp3'
    (root/'public'/path.lstrip('/')).write_bytes(content)
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
    manifest[name]={'srcs':[path],'duration':duration,'gain':0.8,'loop':True}
    print(name,path,round(duration,2))
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
