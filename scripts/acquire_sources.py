#!/usr/bin/env python3
"""Archive exact public-source bytes before any parsing; never overwrite a pinned file."""
import argparse, datetime, hashlib, json, pathlib, urllib.request, urllib.error, threading
_LOCK = threading.Lock()
ROOT = pathlib.Path(__file__).resolve().parents[1]
def acquire(url, name, root=ROOT/'sources'):
    if pathlib.PurePath(name).name != name:
        raise ValueError('Simple filename required')
    root.mkdir(parents=True, exist_ok=True)
    path = root/name
    if path.exists():
        raise FileExistsError(path)
    request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (public tariff reference research)'})
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        with urllib.request.urlopen(request, timeout=75) as response:
            data = response.read()
            entry = {'file':name,'url':url,'final_url':response.url,'retrieved_at':stamp,'status':response.status,'content_type':response.headers.get('Content-Type'),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    except urllib.error.HTTPError as error:
        data = error.read()
        entry = {'file':name,'url':url,'retrieved_at':stamp,'status':error.code,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    with path.open('xb') as output:
        output.write(data)
    log = root/'manifest.json'
    with _LOCK:
        entries = json.loads(log.read_text()) if log.exists() else []
        entries.append(entry)
        temp = root/'manifest.next.json'
        temp.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
        temp.replace(log)
    return entry
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url'); parser.add_argument('name')
    args = parser.parse_args()
    print(json.dumps(acquire(args.url,args.name),ensure_ascii=False,indent=2))
