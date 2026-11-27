"""Actual pinned sources optional: explicit skip in a clean public checkout, never substitute fake catalogs."""
import csv, hashlib, importlib.util, io, json, pathlib, subprocess, sys, tempfile, unittest
from contextlib import redirect_stdout
from decimal import Decimal
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import convert_main_catalogs as convert
class DecimalTest(unittest.TestCase):
 def test_excel_general_binary_tails_and_real_zero(self):
  self.assertEqual(convert.number('7.7789999999999999'), '7.779')
  self.assertEqual(convert.number('9.8000000000000004E-2'), '0.098')
  self.assertEqual(convert.number('0'), '0')
  self.assertEqual(convert.number('1.235',164), '1.24')
  with self.assertRaises(ValueError):convert.number('1.2345678')
  with self.assertRaises(ValueError):convert.number('NaN')


class CatalogOutputTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = pathlib.Path(tmp.name)
        self.out = self.root / '.local' / 'catalogs'
        self.payloads = {'first.json': {'groups': []}, 'last.json': {'groups': ['ü']}}

    def run_converter(self, *args):
        with (patch.object(convert, 'ROOT', self.root),
              patch.object(convert, 'generate', return_value=self.payloads),
              patch.object(sys, 'argv', ['convert_main_catalogs.py', *args]),
              redirect_stdout(io.StringIO())):
            convert.main()

    def test_write_and_check_exact_bytes(self):
        with self.assertRaises(FileNotFoundError):
            self.run_converter('--check')
        self.assertFalse(self.out.exists())
        self.run_converter()
        expected = {name: convert.encode(data).encode('utf-8') for name, data in self.payloads.items()}
        self.assertEqual({p.name: p.read_bytes() for p in self.out.iterdir()}, expected)
        self.run_converter('--check')

        last = self.out / 'last.json'
        last.write_bytes(expected['last.json'].rstrip(b'\n'))
        with self.assertRaisesRegex(ValueError, 'Byte reimport mismatch: last'):
            self.run_converter('--check')
        self.assertEqual(last.read_bytes(), expected['last.json'].rstrip(b'\n'))

    def test_later_existing_output_leaves_no_partial_set(self):
        self.out.mkdir(parents=True)
        last = self.out / 'last.json'
        last.write_bytes(b'\xffexisting\n')
        with self.assertRaises(FileExistsError):
            self.run_converter()
        self.assertEqual(list(self.out.iterdir()), [last])
        self.assertEqual(last.read_bytes(), b'\xffexisting\n')

    def test_name_claimed_just_before_open_is_not_overwritten(self):
        self.out.mkdir(parents=True)
        first = self.out / 'first.json'
        real_open = pathlib.Path.open

        def claim_on_open(target, mode='r', *args, **kwargs):
            if target == first and ('w' in mode or 'x' in mode):
                with open(first, 'xb') as other_writer:
                    other_writer.write(b'claimed')
            return real_open(target, mode, *args, **kwargs)

        with patch.object(pathlib.Path, 'open', claim_on_open):
            with self.assertRaises(FileExistsError):
                self.run_converter()
        self.assertEqual(first.read_bytes(), b'claimed')


@unittest.skipUnless((ROOT/'sources/catalog-SwissDRG_Version_15.0_Fallpauschalenkatalog_Abrechnungsversion_2026_2026.xlsx').exists(), 'SKIP: actual pinned private sources absent (public checkout)')
class PinnedCatalogTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.generated=convert.generate(ROOT)
 def test_four_settings_exact_counts_and_no_cross_setting_dedup(self):
  self.assertEqual({k:len(v['groups']) for k,v in self.generated.items()}, {'swissdrg-akut.json':1081,'swissdrg-geburtshaus.json':8,'tarpsy.json':24,'st-reha.json':22})
  akut={g['code'] for g in self.generated['swissdrg-akut.json']['groups']};birth={g['code'] for g in self.generated['swissdrg-geburtshaus.json']['groups']}
  self.assertEqual(len(akut&birth),8)
 def test_actual_byte_exact_reimport(self):
  for name,data in self.generated.items():
   self.assertEqual((ROOT/'.local/catalogs'/name).read_bytes(),convert.encode(data).encode())
 def test_all_original_columns_preserved(self):
  for key,ending,cols in [('tarpsy','PCG_Katalog.csv',87),('st-reha','PV2_d.csv',9)]:
   p=next((ROOT/'sources').glob('*'+ending));rows=list(csv.reader(io.StringIO(p.read_bytes().decode('cp1252')),delimiter=';'))
   h=next(i for i,r in enumerate(rows) if r[0] in ('pcg','rcg')); headers=rows[h]
   for raw,g in zip(rows[h+1:],self.generated[key+'.json']['groups'],strict=True):
    notes=g['notes'];start=notes.index('Alle Quellfelder (');start=notes.index('\n',start)+1
    fields=json.JSONDecoder().raw_decode(notes[start:])[0]
    self.assertEqual(len(fields),cols);self.assertEqual(fields,dict(zip(headers,raw)));self.assertIsNone(g['weight'])
  import xml.etree.ElementTree as ET, zipfile
  ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
  source=next((ROOT/'sources').glob('*2026_2026.xlsx'))
  with zipfile.ZipFile(source) as z:
   strings=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
   original={}
   for key,sheet in [('swissdrg-akut',2),('swissdrg-geburtshaus',3)]:
    original[key]={}
    for row in ET.fromstring(z.read(f'xl/worksheets/sheet{sheet}.xml')).findall('s:sheetData/s:row',ns):
     fields={}
     for cell in row.findall('s:c',ns):
      v=cell.find('s:v',ns);value=v.text if v is not None else ''
      if cell.get('t')=='s' and value:value=strings[int(value)]
      fields[''.join(c for c in cell.get('r') if not c.isdigit())]=value
     if fields.get('A') in {g['code'] for g in self.generated[key+'.json']['groups']}:original[key][fields['A']]=fields
  for key in ['swissdrg-akut','swissdrg-geburtshaus']:
   for g in self.generated[key+'.json']['groups']:
    notes=g['notes'];start=notes.index('Alle Quellfelder (');start=notes.index('\n',start)+1
    fields=json.JSONDecoder().raw_decode(notes[start:])[0];self.assertEqual(len(fields),12)
    for field,value in fields.items():
     col=field.split(' · ')[0];raw=original[key][g['code']].get(col,'')
     if raw and col in 'DEFGHIJ':self.assertLessEqual(abs(Decimal(raw)-Decimal(value)),Decimal('0.000000000001'))
     else:self.assertEqual(value,raw)
    self.assertEqual(g['title'],original[key][g['code']]['C'])
    self.assertIn('[9] Die DRGs P60A, 960Z und 961Z sind nicht abrechenbar.',notes)
 def test_unweighted_not_zero_and_pv2_identity(self):
  gs=self.generated['swissdrg-akut.json']['groups'];self.assertEqual([g['code'] for g in gs if g['weight'] is None],['P60A','960Z','961Z','962Z'])
  for key,code in [('tarpsy','TP96Z'),('st-reha','TR96Z')]:self.assertIsNone(next(g for g in self.generated[key+'.json']['groups'] if g['code']==code)['weight'])
  reha=self.generated['st-reha.json'];self.assertIn('PV2',reha['edition']);self.assertIn('2025',reha['edition']);self.assertIn('20260417021256',reha['groups'][0]['notes']);self.assertIn('PV2_d.csv',reha['source']['url'])
 def test_private_sources_are_hash_pinned_including_unmodeled_annexes(self):
  meta=convert.verify_sources(ROOT);self.assertEqual(len(meta['artifacts']),9);self.assertFalse(meta['annexes_modeled'])
  from tempfile import TemporaryDirectory
  with TemporaryDirectory(prefix='spitaltarife-corrupt-') as d:
   fake=pathlib.Path(d);(fake/'scripts').mkdir();(fake/'sources').mkdir();(fake/'scripts/source_metadata.json').write_text(json.dumps(meta))
   (fake/'sources'/meta['artifacts'][0]['file']).write_bytes(b'CORRUPT')
   with self.assertRaises(ValueError): convert.verify_sources(fake)
 def test_source_derived_money_independent_of_domain(self):
  oracle=json.loads(subprocess.check_output([sys.executable,str(ROOT/'tests/native_oracle.py')],text=True))
  for case in oracle['cases']:
   script="import {calculate} from './src/domain.js';let s='';for await(const b of process.stdin)s+=b;console.log(calculate(JSON.parse(s)).cents.toString());"
   actual=subprocess.check_output(['node','--input-type=module','-e',script],input=json.dumps(case['draft']),text=True,cwd=ROOT).strip()
   self.assertEqual(actual,case['cents'])
if __name__=='__main__':unittest.main()
