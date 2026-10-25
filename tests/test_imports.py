import concurrent.futures, hashlib, importlib.util, json, pathlib, tempfile, threading, unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
acquire=load('acquire_sources');normalize=load('normalize_local')
class AcquisitionTest(unittest.TestCase):
    def test_exact_raw_hash_and_refuse_overwrite(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self): self.send_response(200);self.end_headers();self.wfile.write(b'PINNED RAW SOURCE\r\n')
            def log_message(self,*args): pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        try:
            with tempfile.TemporaryDirectory(prefix='spitaltarife-acquire-') as temp:
                root=pathlib.Path(temp);url=f'http://127.0.0.1:{server.server_port}/source'
                with concurrent.futures.ThreadPoolExecutor(3) as ex: rows=list(ex.map(lambda i:acquire.acquire(url,f'source-{i}.txt',root),range(3)))
                self.assertEqual(len(json.loads((root/'manifest.json').read_text())),3)
                for row in rows:
                    data=(root/row['file']).read_bytes();self.assertEqual(data,b'PINNED RAW SOURCE\r\n');self.assertEqual(row['sha256'],hashlib.sha256(data).hexdigest());self.assertEqual(row['bytes'],len(data))
                with self.assertRaises(FileExistsError):acquire.acquire(url,'source-0.txt',root)
                with self.assertRaises(ValueError):acquire.acquire(url,'../escape',root)
        finally: server.shutdown();server.server_close();t.join()
class NormalizeTest(unittest.TestCase):
    def kwargs(self):return dict(system='swissdrg',edition='SYNTHETIC TEST',valid_from='2026-01-01',valid_to='2026-12-31',source_url='https://example.invalid/test',source_sha256='b'*64,coverage='subset',scope='synthetic fixture')
    def test_exact_literals_and_null_not_zero(self):
        with tempfile.TemporaryDirectory(prefix='spitaltarife-csv-') as temp:
            path=pathlib.Path(temp)/'fixture.csv';path.write_text('code;title;weight;notes\nTEST-A;Literal <text>;1.25;Full note\nTEST-B;No weight;;Unknown is not zero\n')
            out=normalize.convert(path,**self.kwargs());self.assertEqual(len(out['groups']),2);self.assertEqual(out['groups'][0]['title'],'Literal <text>');self.assertIsNone(out['groups'][1]['weight'])
    def test_invalid_headers_and_duplicate_rejected(self):
        with tempfile.TemporaryDirectory(prefix='spitaltarife-csv-') as temp:
            path=pathlib.Path(temp)/'fixture.csv'
            for raw in ['wrong;title;weight;notes\n','code;title;weight;notes\nTEST;One;1;\nTEST;Two;2;\n','code;title;weight;notes\nTEST;One;-1;\n']:
                path.write_text(raw)
                with self.assertRaises(ValueError):normalize.convert(path,**self.kwargs())
    def test_public_data_counts_without_private_sources(self):
        c=json.loads((ROOT/'public/data/catalog.json').read_text());p=json.loads((ROOT/'public/data/provenance.json').read_text());self.assertEqual(len(c['systems']),3);self.assertEqual(c['coverage']['official_groups'],0);self.assertEqual(c['coverage']['baserates'],0);self.assertEqual(len(p['files']),4)
if __name__=='__main__':unittest.main()
