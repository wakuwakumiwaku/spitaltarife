#!/usr/bin/env python3
"""Independent raw-source oracle. Imports neither converter nor application arithmetic.
Only outputs local QA inputs/results; no group records are published.
"""
import csv, hashlib, io, json, pathlib, xml.etree.ElementTree as ET, zipfile
from decimal import Decimal, ROUND_HALF_UP
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read_source(suffix):
 meta=json.loads((ROOT/'scripts/source_metadata.json').read_text());e=next(e for e in meta['artifacts'] if e['file'].endswith(suffix));data=(ROOT/'sources'/e['file']).read_bytes()
 if len(data)!=e['bytes'] or hashlib.sha256(data).hexdigest()!=e['sha256']:raise ValueError('Oracle source hash mismatch')
 return data
def csv_records(suffix,header):
 rows=list(csv.reader(io.StringIO(read_source(suffix).decode('cp1252')),delimiter=';'));i=next(i for i,r in enumerate(rows) if r[0]==header)
 return {r[0]:dict(zip(rows[i],r)) for r in rows[i+1:]}
def oracle():
 ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'};weights={}
 with zipfile.ZipFile(io.BytesIO(read_source('2026_2026.xlsx'))) as z:
  # These independent coordinates are bound to the verified A01Z and O60C rows.
  strings=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
  for sheet,code in [(2,'A01Z'),(3,'O60C')]:
   cells={c.get('r'):c for c in ET.fromstring(z.read(f'xl/worksheets/sheet{sheet}.xml')).findall('.//s:c',ns)}
   assert strings[int(cells['A9'].find('s:v',ns).text)]==code
   weights[code]=str(Decimal(cells['D9'].find('s:v',ns).text).quantize(Decimal('.001'),rounding=ROUND_HALF_UP))
 tar=csv_records('PCG_Katalog.csv','pcg');reha=csv_records('PV2_d.csv','rcg')
 def draft(system,weight='',segments=None):
  return {'system':system,'label':'Source QA only','edition':'Source QA','group':'','base':'1000.00','weight':weight,'segments':segments or [{'days':'','weight':''}],'reference':'Pinned original; QA base is an assumption, not an official baserate'}
 a=draft('swissdrg',weights['A01Z']);a['base']='10000.00';a['group']='A01Z'
 b=draft('swissdrg',weights['O60C']);b['base']='10000.00';b['group']='O60C'
 t=draft('tarpsy',segments=[{'days':'43','weight':tar['TP21A']['pt43']}]);t['group']='TP21A'
 r=reha['TR18Z'];assert (r['ogv_ph1'],r['ogv_ph2'])==('10','13')
 d=draft('st-reha',segments=[{'days':'10','weight':r['tkg_ph1']},{'days':'3','weight':r['tkg_ph2']},{'days':'2','weight':r['tkg_ph3']}]);d['group']='TR18Z'
 cases=[]
 for key,v in [('swissdrg-akut',a),('swissdrg-geburtshaus',b),('tarpsy',t),('st-reha',d)]:
  w=Decimal(v['weight']) if v['system']=='swissdrg' else sum(Decimal(s['days'])*Decimal(s['weight']) for s in v['segments'])
  cents=int((w*Decimal(v['base'])*100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
  money='CHF '+f'{cents//100:,}'.replace(',','’')+'.'+f'{cents%100:02d}'
  cases.append({'key':key,'draft':v,'cents':str(cents),'money':money})
 return {'cases':cases,'source_notes':'Independent XML/CSV/Decimal oracle; no converter/domain arithmetic reused'}
if __name__=='__main__':print(json.dumps(oracle(),ensure_ascii=False))
