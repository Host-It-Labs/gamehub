"""Rebuild fixed-year Outfox cards from the public World Bank API.
Cards explicitly rank reporting economies (not missing-data estimates).
"""
import json, urllib.request, concurrent.futures, pathlib, datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
YEAR=2023
METRICS=[
 ('SP.POP.TOTL','population','people'),
 ('AG.SRF.TOTL.K2','surface area','km²'),
 ('AG.LND.TOTL.K2','land area','km²'),
 ('EN.POP.DNST','population density','people per km² of land'),
 ('SP.URB.TOTL.IN.ZS','urban population share','%'),
 ('SP.POP.65UP.TO.ZS','population aged 65 and above','% of population'),
 ('SP.POP.0014.TO.ZS','population aged 0–14','% of population'),
 ('SP.DYN.LE00.IN','life expectancy at birth','years'),
 ('SP.DYN.TFRT.IN','fertility rate','births per woman'),
 ('NY.GDP.MKTP.CD','GDP','current US$'),
 ('NY.GDP.PCAP.CD','GDP per person','current US$'),
 ('NY.GDP.MKTP.KD.ZG','annual GDP growth','%'),
 ('NE.EXP.GNFS.ZS','exports of goods and services','% of GDP'),
 ('NE.IMP.GNFS.ZS','imports of goods and services','% of GDP'),
 ('NV.AGR.TOTL.ZS','agriculture, forestry and fishing value added','% of GDP'),
 ('NV.IND.TOTL.ZS','industry value added','% of GDP'),
 ('NV.SRV.TOTL.ZS','services value added','% of GDP'),
 ('IT.NET.USER.ZS','individuals using the internet','% of population'),
 ('IT.CEL.SETS.P2','mobile cellular subscriptions','per 100 people'),
 ('EG.ELC.ACCS.ZS','access to electricity','% of population'),
 ('AG.LND.FRST.ZS','forest area share','% of land area'),
 ('AG.LND.AGRI.ZS','agricultural land share','% of land area'),
 ('AG.LND.ARBL.ZS','arable land share','% of land area'),
 ('SL.UEM.TOTL.ZS','unemployment (modelled ILO estimate)','% of labour force'),
 ('SP.DYN.CBRT.IN','crude birth rate','births per 1,000 people'),
 ('SP.DYN.CDRT.IN','crude death rate','deaths per 1,000 people'),
 ('SP.POP.GROW','annual population growth','%'),
 ('SP.RUR.TOTL','rural population','people'),
 ('SP.URB.TOTL','urban population','people'),
 ('NE.CON.PRVT.ZS','household consumption expenditure','% of GDP'),
]
def fetch(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url, timeout=60) as r: return json.load(r)
  except Exception:
   if attempt==2: raise
countries=fetch('https://api.worldbank.org/v2/country?format=json&per_page=400')[1]
byid={c['id']:c for c in countries if c['region']['id']!='NA'}
regions=[('all','worldwide'),('EAS','East Asia & Pacific'),('ECS','Europe & Central Asia'),('LCN','Latin America & Caribbean'),('MEA','Middle East & North Africa region*'),('SSF','Sub-Saharan Africa')]
def metric(spec):
 code,label,unit=spec
 url=f'https://api.worldbank.org/v2/country/all/indicator/{code}?date={YEAR}&format=json&per_page=400'
 payload=fetch(url)
 rows=[{'iso':r['countryiso3code'],'name':byid[r['countryiso3code']]['name'],'value':r['value']} for r in payload[1] if r['countryiso3code'] in byid and r['value'] is not None]
 cards=[]
 for region,regionname in regions:
  eligible=[r for r in rows if region=='all' or byid[r['iso']]['region']['id']==region]
  if len(eligible)<10: continue
  for descending in [True,False]:
   ordered=sorted(eligible,key=lambda r:r['value'],reverse=descending)
   # Never arbitrarily rank tied values, including a tie at fifth place.
   if len({r['value'] for r in ordered[:6]})<6: continue
   cards.append({'key':f'{code}-{region}-{descending}', 'category':'World facts',
    'title':f"Five {'highest' if descending else 'lowest'}: {label} · {regionname} ({YEAR})",
    'answers':[r['name'] for r in ordered[:5]], 'values':[r['value'] for r in ordered[:5]],
    'unit':unit,'year':YEAR,'indicator':code,'direction':'descending' if descending else 'ascending',
    'scope':f'{len(eligible)} reporting economies; World Bank region definitions. '+('This region includes Afghanistan and Pakistan.' if region=='MEA' else 'Countries and territories; missing observations excluded.'),
    'source':f'https://data.worldbank.org/indicator/{code}', 'dataUrl':url,
    'retrieved':datetime.date.today().isoformat(),
    'botDecoy':ordered[6]['name']})
 return cards,{'indicator':code,'apiMetadata':payload[0],'observations':rows}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 results=list(pool.map(metric,METRICS))
cards=[c for group,_ in results for c in group]
assert len(cards)>=200,len(cards)
for i,c in enumerate(cards):c['id']=i
out=ROOT/'lib/games/party/facts.json';out.write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
(ROOT/'scripts/data/outfox-worldbank-evidence.json').write_text(json.dumps({'year':YEAR,'countries':countries,'indicators':[raw for _,raw in results]},ensure_ascii=False)+'\n')
print(f'{len(cards)} sourced cards written to {out}')
