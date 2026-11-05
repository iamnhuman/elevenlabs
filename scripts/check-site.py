#!/usr/bin/env python3
"""Check the static catalogue and optionally all HTTP asset URLs (no browser)."""
import argparse
import base64
import hashlib
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
import re
import struct
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent


def local_file(url):
    return ROOT / unquote(urlsplit(url).path)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []
        self.ids = set()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate HTML id: {attrs['id']}"
            self.ids.add(attrs["id"])
        if tag == "script" and attrs.get("src"):
            self.assets.append(attrs["src"])
        if tag == "img" and attrs.get("src"):
            self.assets.append(attrs["src"])
        if tag == "link" and attrs.get("href"):
            self.assets.append(attrs["href"])
        if attrs.get("href", "").startswith("#"):
            self.links.append(attrs["href"][1:])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url")
    args = parser.parse_args()
    catalogue = json.loads((ROOT / "samples.js").read_text().split("window.SAMPLE_LIBRARY = ", 1)[1].rstrip(";\n"))
    samples = catalogue["samples"]
    assert samples and len({s["id"] for s in samples}) == len(samples), "Duplicate or missing sample IDs"
    source = ROOT / catalogue["source"]
    expected_originals = {unicodedata.normalize("NFC", str(path.resolve())) for path in source.rglob("*.mp3")}
    actual_originals = {unicodedata.normalize("NFC", str(local_file(sample["original"]).resolve())) for sample in samples}
    assert actual_originals == expected_originals, "Catalogue does not match the selected source folder"
    page = Page()
    page.feed((ROOT / "index.html").read_text())
    assert set(page.links) <= page.ids, "Missing fragment targets"
    for source, dependency in [("spectral-image.js", "spectral-image-worker.js"), ("spectral-image-worker.js", "spectral-image-dsp.js")]:
        version = hashlib.sha256((ROOT / dependency).read_bytes()).hexdigest()[:12]
        assert f"{dependency}?v={version}" in (ROOT / source).read_text(), f"Stale worker import; run python3 scripts/version-assets.py: {source}"
    paths = ["index.html", ".nojekyll", *page.assets]
    paths.extend(re.findall(r'url\([\'"]?([^\'")]+)', (ROOT / "styles.css").read_text()))
    paths.extend([
        "spectral-image-worker.js", "spectral-image-dsp.js",
        "assets/fonts/OFL-IBMPlex.txt", "assets/fonts/OFL-Exo2.txt", "assets/fonts/OFL-Oxanium.txt",
        "assets/vendor/audiomotion/LICENSE", "assets/vendor/audiomotion/NOTICE.md",
        "assets/vendor/audiomotion/source.js",
        "assets/vendor/three/three.module.js", "assets/vendor/three/three.core.js",
        "assets/vendor/three/LICENSE", "assets/vendor/three/NOTICE.md",
        "assets/vendor/three/three.js",
        "assets/vendor/sonoscope/LICENSE", "assets/vendor/sonoscope/NOTICE.md",
        "assets/vendor/sonoscope/provenance.json", "assets/vendor/sonoscope/terrain-source.ts",
    ])
    art = json.loads((ROOT / "assets/art/macro-200/manifest.json").read_text())
    assert art["count"] == 200 and art["columns"] == art["rows"] == 5
    assert len(art["sheets"]) == 8
    paths.append("assets/art/macro-200/manifest.json")
    for sheet in art["sheets"]:
        paths.append(sheet["file"])
        atlas = (ROOT / sheet["source"]).read_bytes()
        assert atlas[:8] == b"\x89PNG\r\n\x1a\n"
        width, height = struct.unpack(">II", atlas[16:24])
        assert width == height and width >= 1250, "Atlas must be square and sufficiently detailed"
    assert len(art["cards"]) == 200
    crops = set()
    for card in art["cards"]:
        sheet = art["sheets"][card["sheet"]]
        assert 0 <= card["x"] < card["x"] + card["size"] <= sheet["width"]
        assert 0 <= card["y"] < card["y"] + card["size"] <= sheet["height"]
        crops.add((card["sheet"], card["x"], card["y"], card["size"]))
    assert len(crops) == 200, "Repeated card artwork"
    assert all(sum(c["sheet"] == i for c in art["cards"]) == 25 for i in range(8))
    paths = list(dict.fromkeys(paths))
    spectra = json.loads((ROOT / "assets/spectrum/manifest.json").read_text())
    assert spectra["version"] == 2 and spectra["bins"] == 256 and spectra["rate"] == 96
    assert {item["id"] for item in spectra["samples"]} == {item["id"] for item in samples}
    paths.append("assets/spectrum/manifest.json")
    for item in spectra["samples"]:
        assert (ROOT / item["file"]).stat().st_size == item["bytes"]
        entry = json.loads((ROOT / item["file"]).read_text().split(f'window.SAMPLE_SPECTRA["{item["id"]}"] = ', 1)[1].rstrip(';\n'))
        assert entry["version"] == 2 and entry["bins"] == spectra["bins"] and entry["rate"] == spectra["rate"]
        assert entry["frames"] == item["frames"]
        assert len(base64.b64decode(entry["values"], validate=True)) == entry["frames"] * entry["bins"]
        assert entry["minDb"] == spectra["minDb"] and entry["maxDb"] == spectra["maxDb"]
        paths.append(item["file"])
    numbers = {"track": 0, "samples": 0}
    artwork_numbers = set()
    for sample in samples:
        section = "track" if sample["duration"] > 30 else "samples"
        numbers[section] += 1
        number = numbers[section]
        assert sample["title"] == f"{number:03d}" and sample["number"] == number
        assert sample["artworkNumber"] > 0 and sample["artworkNumber"] not in artwork_numbers
        artwork_numbers.add(sample["artworkNumber"])
        assert len(sample["envelope"]) == len(sample["bassEnvelope"])
        assert len(sample["envelope"]) > sample["duration"] * 25
        assert all(0 <= v <= 255 for v in sample["envelope"] + sample["bassEnvelope"])
        assert sample["duration"] > 0
        assert len(sample["peaks"]) == 112 and all(0 <= peak <= 1 for peak in sample["peaks"])
        assert (ROOT / unquote(sample["src"])).stat().st_size == sample["bytes"]
        assert (ROOT / unquote(sample["original"])).stat().st_size == sample["originalBytes"]
        assert urlsplit(sample["original"]).fragment == "", "Unescaped # in a filename"
        paths.extend([sample["src"], sample["original"]])
    for path in paths:
        assert not path.startswith("/"), f"Absolute path breaks project Pages: {path}"
        assert not urlsplit(path).scheme, f"Unexpected remote dependency: {path}"
        assert local_file(path).is_file(), f"Missing: {path}"
        if path in page.assets and urlsplit(path).path.endswith(('.js', '.css')):
            version = hashlib.sha256(local_file(path).read_bytes()).hexdigest()[:12]
            assert urlsplit(path).query == f'v={version}', f"Stale asset URL; run python3 scripts/version-assets.py: {path}"
        assert urljoin("https://example.github.io/sample-room/", path).startswith("https://example.github.io/sample-room/")
    print(f"PASS: {len(samples)} samples, waveforms, original filenames, unique IDs and {len(paths)} local URLs.")
    if args.url:
        base = args.url.rstrip("/") + "/"
        def check(path):
            with urlopen(Request(urljoin(base, path), method="HEAD"), timeout=10) as response:
                assert response.status == 200, path
                assert int(response.headers["Content-Length"]) == local_file(path).stat().st_size, path
                if path.endswith(".mp3"):
                    assert response.headers["Content-Type"].startswith("audio/"), path
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(check, paths))
        # Verify actual seek bytes, suffix ranges and a representative original with Unicode/#.
        for sample in [samples[0], next(s for s in samples if "#" in s["filename"])]:
            for path in [sample["src"], sample["original"]]:
                local = local_file(path).read_bytes()
                for header, expected in [("bytes=100-199", local[100:200]), ("bytes=-64", local[-64:])]:
                    with urlopen(Request(urljoin(base, path), headers={"Range": header}), timeout=10) as response:
                        assert response.status == 206, "HTTP Range not supported"
                        assert response.read() == expected, f"Incorrect range bytes: {path}"
        print(f"PASS: {len(paths)} HTTP responses, MP3 content types and 8 byte-range checks.")


if __name__ == "__main__":
    main()
