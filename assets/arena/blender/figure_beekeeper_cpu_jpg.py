"""Label CPU evidence and discard only this diagnostic's PPM intermediates.

Runs with system Python/Pillow, unlike the NumPy adapter that uses Blender's
standalone Python. Its labels keep proxy evidence separate from Blender QA.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw


def convert(folder):
    paths=[]
    for path in sorted(Path(folder).glob("cpu-*.ppm")):
        image=Image.open(path).convert("RGB")
        result=Image.new("RGB",(image.width,image.height+44),"#171c22")
        result.paste(image,(0,44));draw=ImageDraw.Draw(result)
        words=path.stem.replace("cpu-","").replace("-"," ").upper()
        draw.text((12,8),"BEEKEEPER | CPU DIAGNOSTIC | "+words,fill=(224,229,236))
        draw.text((12,25),"Authored analytic sample; Blender sewing, modifiers and AO pending",fill=(177,187,198))
        out=path.with_suffix(".jpg");result.save(out,quality=92);path.unlink();paths.append(str(out))
    print("\n".join(paths))


def sheet(folder,paths,out):
    images=[Image.open(Path(folder)/path).convert("RGB") for path in paths]
    w=max(i.width for i in images);h=max(i.height for i in images);result=Image.new("RGB",(w*2,h*((len(images)+1)//2)),"#171c22")
    for index,image in enumerate(images):result.paste(image,(index%2*w,index//2*h))
    result.save(Path(folder)/out,quality=92)


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("folder");parser.add_argument("--sheet");parser.add_argument("--out",default="cpu-review-sheet.jpg");args=parser.parse_args()
    convert(args.folder)
    if args.sheet:sheet(args.folder,args.sheet.split(","),args.out)
