#!/usr/bin/env python3
"""Convert pinned official main settings to private schema-1 JSON. No network or licence grant.
Python stdlib; pdftotext is required for the independent PDF cross-check/rule extraction.
"""
import argparse, csv, hashlib, io, json, pathlib, re, subprocess, zipfile
from decimal import Decimal, ROUND_HALF_UP
import xml.etree.ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parents[1]
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
DRG = re.compile(r'(?:[A-Z][0-9]{2}[A-Z]|9[0-9]{2}[A-Z])')
NAMES = {'swissdrg-akut': 'Akutspitäler', 'swissdrg-geburtshaus': 'Geburtshäuser', 'tarpsy': 'Psychiatrie', 'st-reha': 'Rehabilitation'}
def encode(v): return json.dumps(v, ensure_ascii=False, indent=2) + '\n'
def metadata(root=ROOT): return json.loads((root/'scripts/source_metadata.json').read_text())
def verify_sources(root=ROOT):
    meta=metadata(root)
    for e in meta['artifacts']+meta['evidence']:
        p=root/'sources'/e['file']
        if p.is_symlink() or p.parent.resolve() != (root/'sources').resolve(): raise ValueError('Unsafe source path')
        data=p.read_bytes()
        if len(data)!=e['bytes'] or hashlib.sha256(data).hexdigest()!=e['sha256']: raise ValueError('Pinned source differs: '+p.name)
    return meta

def number(raw, fmt=0):
    """General styles retain meaningful decimals <=6, rejecting rather than truncating real precision.
    Only Excel binary serialization tails <=1e-12 are removed. Fixed numFmt164 has 2 places.
    All main numeric display values are additionally compared against the independently supplied PDF.
    """
    d=Decimal(raw)
    if not d.is_finite(): raise ValueError('Nonfinite number')
    digits=2 if fmt==164 else 6
    if fmt not in (0,164): raise ValueError('Unknown Excel number format')
    n=d.quantize(Decimal(10)**-digits,rounding=ROUND_HALF_UP)
    if fmt==0 and abs(d-n)>Decimal('0.000000000001'): raise ValueError('Meaningful precision exceeds 6')
    return format(n,'f').rstrip('0').rstrip('.') if '.' in format(n,'f') else format(n,'f')

def xlsx(path):
    with zipfile.ZipFile(path) as z:
        if z.testzip(): raise ValueError('Bad XLSX CRC')
        strings=[''.join(t.text or '' for t in n.findall('.//m:t',NS)) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS)]
        styles=ET.fromstring(z.read('xl/styles.xml')).findall('m:cellXfs/m:xf',NS)
        rels={r.get('Id'):r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        out={}
        for sh in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',NS):
            target=rels[sh.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            rows=[]
            for row in ET.fromstring(z.read('xl/'+target)).findall('m:sheetData/m:row',NS):
                vals={}; audit={}
                for c in row.findall('m:c',NS):
                    col=re.sub(r'\d','',c.get('r')); v=c.find('m:v',NS); raw=v.text if v is not None else ''
                    if c.get('t')=='s': val=strings[int(raw)] if raw else ''
                    elif c.get('t')=='inlineStr': val=''.join(t.text or '' for t in c.findall('.//m:t',NS))
                    elif raw:
                        fmt=int(styles[int(c.get('s','0'))].get('numFmtId'))
                        val=number(raw,fmt);audit[col]={'raw':raw,'style':c.get('s','0'),'numFmtId':fmt}
                    else: val=''
                    vals[col]=val
                rows.append((row.get('r'),vals,audit))
            out[sh.get('name')]=rows
    return out

def pdf(root, e):
    p=subprocess.run(['pdftotext','-layout',str(root/'sources'/e['file']),'-'],capture_output=True,check=True)
    return p.stdout.decode('utf-8')

def csv_rows(path, headers):
    rows=list(csv.reader(io.StringIO(path.read_bytes().decode('cp1252')),delimiter=';'))
    start=next(i for i,r in enumerate(rows) if r==headers)
    result=[]
    for i,r in enumerate(rows[start+1:],start+2):
        if len(r)!=len(headers): raise ValueError('Column count differs')
        result.append((i,dict(zip(headers,r))))
    return result

def make_catalog(key,e,groups):
    system='swissdrg' if key.startswith('swissdrg-') else key
    editions={'swissdrg-akut':'SwissDRG 15.0 AV 2026/2026 · Akutspitäler','swissdrg-geburtshaus':'SwissDRG 15.0 AV 2026/2026 · Geburtshäuser','tarpsy':'TARPSY 6.0 · 2026/2027','st-reha':'ST Reha 3.0 · PV2 Titel 2025 · unverändert für 2026'}
    return {'app':'spitaltarife.catalog','version':1,'system':system,'edition':editions[key],'validFrom':'2026-01-01','validTo':'2027-12-31' if key=='tarpsy' else '2026-12-31','source':{'url':e['original_url'],'sha256':e['sha256'],'rights':'local-only'},'coverage':{'kind':'full','scope':NAMES[key]+' – vollständiges Hauptsetting der gepinnten Datei; keine Vollständigkeit aller Anlagen/Änderungen bis Oktober 2026; keine Baserates. ST Reha: PV2, Fortgeltung 2026 durch archivierte offizielle Seite belegt.' if key=='st-reha' else NAMES[key]+' – vollständiges Hauptsetting der gepinnten Datei; Zusatzentgelte/Anlagen nicht modelliert, keine Vollständigkeit aller Änderungen bis Oktober 2026; keine Baserates.'},'groups':groups}

def notes(key,e,fields,rule, extra=''):
    return ('Setting: '+NAMES[key]+'\nOriginal: '+e['original_url']+'\nArchiv: '+e['url']+'\nSnapshot: '+e['snapshot_timestamp']+' · SHA-256 '+e['sha256']+'\nGültigkeit/Dateistand: '+json.dumps(e['validity'],ensure_ascii=False)+'\n'+extra+'\nAlle Quellfelder (leere Zeichenfolge = nicht ausgewiesen, niemals Nullwert):\n'+json.dumps(fields,ensure_ascii=False,indent=2)+'\nVollständige Erläuterungen des Hauptkatalogs (PDF/Deckblatt; keine automatisierte Fallprüfung):\n'+rule)

def generate(root=ROOT):
    meta=verify_sources(root); arts=meta['artifacts']
    pick=lambda ending: next(e for e in arts if e['file'].endswith(ending))
    drg=pick('2026_2026.xlsx'); dp=pick('BILLING.pdf'); tp=pick('archived-tarpsy-6.0.pdf'); rp=pick('PV2_d.pdf')
    sheets=xlsx(root/'sources'/drg['file']); drgpdf=pdf(root,dp)
    if len([p for p in drgpdf.split('\f') if p.strip()])!=162: raise ValueError('Not the billing PDF')
    deck='\n'.join(v for _,row,_ in sheets['Deckblatt'] for v in row.values() if v)
    # Independent PDF layout oracle: numeric columns of each code line, in exact source order.
    plines=[line for line in drgpdf.splitlines() if re.match(r'^\s*(?:[A-Z][0-9]{2}[A-Z]|9[0-9]{2}[A-Z])\s+[OAM](?:\s|$)',line)]
    result={}; offset=0
    for key in ['swissdrg-akut','swissdrg-geburtshaus']:
        sh=sheets[NAMES[key]]; headers=next(row for _,row,_ in sh if row.get('A')=='DRG ⁹⁾'); groups=[]; area=''
        for rowno,row,audit in sh:
            code=row.get('A','')
            if not DRG.fullmatch(code):
                if code.startswith(('MDC','Prä-MDC')): area=code
                continue
            parents={'F':'Untere Grenzverweildauer / ','G':'Untere Grenzverweildauer / ','H':'Obere Grenzverweildauer / ','I':'Obere Grenzverweildauer / '}
            fields={col+' · '+parents.get(col,'')+headers.get(col,col):row.get(col,'') for col in 'ABCDEFGHIJKL'}
            # All nonempty numeric columns D:J must equal printed PDF values, not float tails.
            line=plines[offset]; offset+=1
            if not re.match(r'^\s*'+re.escape(code)+r'\s',line): raise ValueError('PDF code order differs')
            # Column positions come from the fixed-layout number header: D starts near 90 chars.
            tail=line[88:]
            values=re.findall(r'(?<!\w)\d+(?:\.\d+)?(?!\w)',tail)
            expected=[row.get(c,'') for c in 'DEFGHIJ' if row.get(c,'')]
            if [Decimal(x) for x in values]!=[Decimal(x) for x in expected]: raise ValueError('PDF numeric mismatch '+code+': '+str((values,expected)))
            extra='PDF-Abgleich: '+dp['url']+' · SHA-256 '+dp['sha256']+'\nXLSX-Blatt '+NAMES[key]+' · Zeile '+rowno+' · '+area+'\nNumerik: Originalstil General (numFmtId 0), Dezimaldarstellung nach <=6-Stellen-Binärartefaktprüfung und unabhängiger PDF-Prüfung. Originale numerische XML-Lexeme (Audit, keine zusätzliche Tarifpräzision): '+json.dumps(audit,ensure_ascii=False)
            groups.append({'code':code,'title':row['C'],'weight':row.get('D') or None,'notes':notes(key,drg,fields,deck,extra)})
        result[key+'.json']=make_catalog(key,drg,groups)
    if offset!=len(plines): raise ValueError('PDF has additional main rows')
    for key,ending,pdfentry,headers,codekey,titlekey in [
        ('tarpsy','PCG_Katalog.csv',tp,['pcg','apcg','Bez_apcg','Bez_pcg','regp1','regp2','regp3']+['pt'+str(i) for i in range(1,81)],'pcg','Bez_pcg'),
        ('st-reha','PV2_d.csv',rp,['rcg','Bez_rcg','arcg','Bez_arcg','tkg_ph1','ogv_ph1','tkg_ph2','ogv_ph2','tkg_ph3'],'rcg','Bez_rcg')]:
        e=pick(ending); pdftext=pdf(root,pdfentry)
        rule=(pdftext.split('\f')[0].split('Erläuterungen:')[1].strip() if key=='tarpsy' else pdftext.split('\f')[1].strip())
        explanation=('TARPSY: regp1/regp2/regp3 sind Phasenparameter; ptN ist das Tagesgewicht bei Gesamtverweildauer N (nicht das marginale Gewicht von Tag N). Gesamtverweildauer × das dafür geltende Tagesgewicht, keine Phasensumme. Keine automatische Tabellenwahl; Abrechnungsregeln und letzte ab-Dauer im PDF prüfen.' if key=='tarpsy' else 'ST Reha: tkg_phN = Tageskostengewicht der Phase N; ogv_phN = obere Grenzverweildauer der Phase N (kumulative Grenze). Tage je Phase × deren Gewicht, dann summieren. Titeljahr 2025 / PV2 bleibt erhalten; Fortgeltung 2026: '+e['validity']['official_2026_unchanged_evidence'])
        groups=[]
        for lineno,fields in csv_rows(root/'sources'/e['file'],headers):
            if not re.fullmatch(r'(?:TP|TR)[0-9]{2}[A-Z]',fields[codekey]): raise ValueError('Invalid official code')
            groups.append({'code':fields[codekey],'title':fields[titlekey],'weight':None,'notes':notes(key,e,fields,rule,'PDF-Abgleich/Erläuterungen: '+pdfentry['url']+' · SHA-256 '+pdfentry['sha256']+'\nCSV cp1252; Semikolon; Zeile '+str(lineno)+'\n'+explanation)})
        result[key+'.json']=make_catalog(key,e,groups)
    for file,c in result.items():
        if len(c['groups'])!=meta['settings'][file[:-5]]: raise ValueError('Main count differs')
        if len({g['code'] for g in c['groups']})!=len(c['groups']): raise ValueError('Duplicate within setting')
        if any(len(g['notes'])>20000 for g in c['groups']): raise ValueError('Notes would exceed schema')
    # Same strict browser validator; does not upload or persist anything.
    script="import {validateCatalog} from './src/domain.js';let s='';for await(const b of process.stdin)s+=b;for(const c of Object.values(JSON.parse(s)))validateCatalog(c);"
    subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(result),text=True,cwd=root,check=True,capture_output=True)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');p.add_argument('--output',default=str(ROOT/'.local/catalogs'));a=p.parse_args()
    out=pathlib.Path(a.output).resolve()
    if not out.is_relative_to((ROOT/'.local').resolve()): p.error('Output must stay under ignored .local/')
    result=generate();out.mkdir(parents=True,exist_ok=True)
    for name,data in result.items():
        target=out/name; content=encode(data)
        if a.check:
            if target.read_bytes()!=content.encode('utf-8'): raise ValueError('Byte reimport mismatch: '+name)
        else:
            if target.exists(): raise FileExistsError('Refusing overwrite: '+str(target))
            target.write_text(content,encoding='utf-8')
    print('Private main settings: '+', '.join(f'{k}: {len(v["groups"])}' for k,v in result.items())+'; 1135 rows; no public data written')
if __name__=='__main__': main()
