#!/usr/bin/env python3
"""Normalize an explicitly prepared four-column CSV; NOT an official SwissDRG XLSX parser."""
import argparse, csv, json, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
def convert(path, *, system, edition, valid_from, valid_to, source_url, source_sha256, coverage, scope, delimiter=';'):
    # Read full raw bytes first; original source hash is supplied separately, not invented from this CSV.
    raw=pathlib.Path(path).read_bytes()
    import io
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')),delimiter=delimiter)
    if reader.fieldnames!=['code','title','weight','notes']: raise ValueError('Exact headers required: code;title;weight;notes')
    groups=[]
    for row in reader:
        if set(row)!=set(reader.fieldnames) or any(v is None for v in row.values()): raise ValueError('Malformed CSV row')
        groups.append({'code':row['code'],'title':row['title'],'weight':row['weight'] if row['weight'] else None,'notes':row['notes']})
    result={'app':'spitaltarife.catalog','version':1,'system':system,'edition':edition,'validFrom':valid_from,'validTo':valid_to,'source':{'url':source_url,'sha256':source_sha256,'rights':'local-only'},'coverage':{'kind':coverage,'scope':scope},'groups':groups}
    code="import {validateCatalog} from './src/domain.js';let s='';for await(const b of process.stdin)s+=b;validateCatalog(JSON.parse(s));"
    check=subprocess.run(['node','--input-type=module','-e',code],input=json.dumps(result),text=True,cwd=ROOT,capture_output=True)
    if check.returncode: raise ValueError('Runtime schema rejected CSV: '+check.stderr)
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('csv');p.add_argument('--system',required=True,choices=['swissdrg','tarpsy','st-reha']);p.add_argument('--edition',required=True);p.add_argument('--valid-from',required=True);p.add_argument('--valid-to',required=True);p.add_argument('--source-url',required=True);p.add_argument('--source-sha256',required=True);p.add_argument('--coverage',required=True,choices=['full','subset']);p.add_argument('--scope',required=True);p.add_argument('--delimiter',default=';');p.add_argument('--output',default=str(ROOT/'.local/local-catalog.json'));a=p.parse_args()
    out=pathlib.Path(a.output).resolve()
    if not out.is_relative_to((ROOT/'.local').resolve()):p.error('Local catalogs must stay under ignored .local/')
    result=convert(a.csv,system=a.system,edition=a.edition,valid_from=a.valid_from,valid_to=a.valid_to,source_url=a.source_url,source_sha256=a.source_sha256,coverage=a.coverage,scope=a.scope,delimiter=a.delimiter)
    if out.exists():p.error('Refusing to overwrite existing output')
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(result["groups"])} local groups validated; nothing uploaded')
