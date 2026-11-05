import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parent.parent / 'scripts/version-assets.py'
spec = importlib.util.spec_from_file_location('asset_versions', SCRIPT)
versions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(versions)


class AssetVersionsTest(unittest.TestCase):
    def test_worker_changes_invalidate_the_entire_import_chain(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'spectral-image-dsp.js').write_text('const sampleRate = 32000;')
            (root / 'spectral-image-worker.js').write_text("importScripts('spectral-image-dsp.js');")
            (root / 'spectral-image.js').write_text("new Worker('spectral-image-worker.js');")
            (root / 'styles.css').write_text('.visual-toggle { color: white; }')
            (root / 'index.html').write_text('<link rel="stylesheet" href="styles.css"><script src="spectral-image.js" defer></script>')
            versions.version_assets(root)
            before = {name: (root / name).read_text() for name in ['spectral-image-worker.js', 'spectral-image.js', 'index.html']}
            self.assertEqual(versions.version_assets(root), [], 'Versioning must be stable across repeated builds')
            (root / 'spectral-image-dsp.js').write_text('const sampleRate = 48000;')
            versions.version_assets(root)
            for name, contents in before.items():
                self.assertNotEqual((root / name).read_text(), contents, name)
            self.assertIn('styles.css?v=' + versions.fingerprint(root / 'styles.css'), (root / 'index.html').read_text())
            self.assertIn('spectral-image.js?v=' + versions.fingerprint(root / 'spectral-image.js'), (root / 'index.html').read_text())
            self.assertIn('spectral-image-worker.js?v=' + versions.fingerprint(root / 'spectral-image-worker.js'), (root / 'spectral-image.js').read_text())
            self.assertIn('spectral-image-dsp.js?v=' + versions.fingerprint(root / 'spectral-image-dsp.js'), (root / 'spectral-image-worker.js').read_text())


if __name__ == '__main__':
    unittest.main()
