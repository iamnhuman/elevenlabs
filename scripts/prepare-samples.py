#!/usr/bin/env python3
"""Build the static sample index and artwork-free, bit-exact MP3 copies.

Requires Python 3, ffmpeg and ffprobe. Originals are never modified.
Run again after changing files in sound/samplepack sfx v3/.
"""
from array import array
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "sound" / "samplepack sfx v3"
OUTPUT = ROOT / "assets" / "audio"
POINTS = 112
ENVELOPE_RATE = 30


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)


def prepare(path):
    relative = path.relative_to(SOURCE).as_posix()
    identity = hashlib.sha256(relative.encode()).hexdigest()[:12]
    target = OUTPUT / f"{identity}.mp3"
    if not target.exists() or target.stat().st_mtime < path.stat().st_mtime:
        run("ffmpeg", "-v", "error", "-y", "-i", str(path), "-map", "0:a:0",
            "-c:a", "copy", "-map_metadata", "-1", "-id3v2_version", "0", str(target))
    metadata = json.loads(run("ffprobe", "-v", "error", "-show_format", "-show_streams",
                              "-of", "json", str(target)))
    duration = float(metadata["format"]["duration"])
    stream = metadata["streams"][0]
    pcm = array("h", run("ffmpeg", "-v", "error", "-i", str(target), "-vn",
                         "-ac", "1", "-ar", "8000", "-f", "s16le", "-"))
    if sys.byteorder != "little":
        pcm.byteswap()
    peaks = []
    for i in range(POINTS):
        chunk = pcm[i * len(pcm) // POINTS:(i + 1) * len(pcm) // POINTS]
        peaks.append(max((abs(v) for v in chunk), default=0))
    ceiling = max(peaks) or 1
    peaks = [round(v / ceiling, 3) for v in peaks]
    # Real RMS envelopes provide audio-synchronised fallback on file:// and when
    # a browser cannot run Web Audio. Stored as bytes to keep the catalogue small.
    window_size = 8000 // ENVELOPE_RATE
    levels, bass_levels = [], []
    low_pass = 0.0
    alpha = 1 - math.exp(-2 * math.pi * 180 / 8000)
    for start in range(0, len(pcm), window_size):
        chunk = pcm[start:start + window_size]
        full_energy, bass_energy = 0.0, 0.0
        for raw in chunk:
            value = raw / 32768
            low_pass += alpha * (value - low_pass)
            full_energy += value * value
            bass_energy += low_pass * low_pass
        levels.append(math.sqrt(full_energy / max(1, len(chunk))))
        bass_levels.append(math.sqrt(bass_energy / max(1, len(chunk))))
    def reference(values):
        return max(0.005, sorted(values)[int((len(values) - 1) * 0.95)])
    rms_reference, bass_reference = reference(levels), reference(bass_levels)
    def quantize(values, scale):
        return [round(min(1, (v / scale) ** 0.8) * 255) if v > 0.0001 else 0 for v in values]
    match = re.search(r"11labs v(\d+) sfx (\d+)", path.stem)
    if match:
        version, number = map(int, match.groups())
        title = f"Кожаный {number:03d}"
        group = f"v{version}"
        order = number
        subtitle = f"ElevenLabs SFX v{version}"
    else:
        title = re.sub(r"-\d+$", "", path.stem).replace("_", " ")
        title = re.sub(r"\s+", " ", title).strip()
        group = "experiments"
        order = 1000
        subtitle = "Эксперименты"
    return {
        "id": identity, "title": title, "subtitle": subtitle, "group": group,
        "order": order, "filename": path.name,
        "src": f"assets/audio/{identity}.mp3",
        "original": quote(path.relative_to(ROOT).as_posix(), safe="/"),
        "duration": round(duration, 3), "bytes": target.stat().st_size,
        "originalBytes": path.stat().st_size,
        "sampleRate": int(stream["sample_rate"]), "channels": stream["channels"],
        "peaks": peaks,
        "envelopeRate": 8000 / window_size,
        "envelope": quantize(levels, rms_reference),
        "bassEnvelope": quantize(bass_levels, bass_reference),
        "rmsReference": round(rms_reference, 6),
    }


def number_samples(samples, previous=()):
    """Number each section independently, retaining order and artwork identity."""
    positions = {item["id"]: index for index, item in enumerate(previous)}
    artwork = {item["id"]: item.get("artworkNumber", item["number"]) for item in previous}
    samples.sort(key=lambda item: positions.get(item["id"], float("inf")))
    next_artwork = max(artwork.values(), default=0) + 1
    counts = {"track": 0, "samples": 0}
    for sample in samples:
        section = "track" if sample["duration"] > 30 else "samples"
        counts[section] += 1
        sample["number"] = counts[section]
        sample["title"] = f"{counts[section]:03d}"
        if sample["id"] not in artwork:
            artwork[sample["id"]] = next_artwork
            next_artwork += 1
        sample["artworkNumber"] = artwork[sample["id"]]
        sample.pop("subtitle", None)


def update_page_counts(samples):
    counts = {"track": 0, "samples": 0}
    for sample in samples:
        counts["track" if sample["duration"] > 30 else "samples"] += 1
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf-8")
    for section, count in counts.items():
        html = re.sub(r'(<span data-count="' + section + r'">)\d+(</span>)',
                      lambda match: match[1] + str(count) + match[2], html)
    html = re.sub(r'(<span id="sample-count"[^>]*>)\d+(</span>)',
                  lambda match: match[1] + str(counts["samples"]) + match[2], html)
    count = counts["samples"]
    word = "семпл" if count % 10 == 1 and count % 100 != 11 else "семпла" if 2 <= count % 10 <= 4 and not 12 <= count % 100 <= 14 else "семплов"
    html = re.sub(r'(<span id="result-label"[^>]*>)[^<]*(</span>)',
                  lambda match: match[1] + f"{count} {word}" + match[2], html)
    source_url = quote(SOURCE.relative_to(ROOT).as_posix(), safe="/") + "/"
    html = re.sub(r'<a href="[^"]*">Открыть папку с оригиналами</a>',
                  f'<a href="{source_url}">Открыть папку с оригиналами</a>', html)
    index.write_text(html, encoding="utf-8")


def remove_deleted_assets(samples, previous):
    current_ids = {sample["id"] for sample in samples}
    removed = [sample for sample in previous if sample["id"] not in current_ids]
    for sample in removed:
        identity = sample["id"]
        if not re.fullmatch(r"[a-f0-9]{12}", identity):
            raise ValueError(f"Invalid generated sample ID: {identity}")
        (OUTPUT / f"{identity}.mp3").unlink(missing_ok=True)
        (ROOT / "assets" / "spectrum" / f"{identity}.js").unlink(missing_ok=True)
    if removed:
        print(f"Removed generated audio and spectra for {len(removed)} deleted samples.")


def main():
    for executable in ("ffmpeg", "ffprobe"):
        if not shutil.which(executable):
            raise SystemExit(f"Install {executable} before running this script.")
    files = sorted(SOURCE.rglob("*.mp3"))
    if not files:
        raise SystemExit(f"No MP3 files found in {SOURCE.relative_to(ROOT)}/.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        samples = list(pool.map(prepare, files))
    samples.sort(key=lambda item: (item["order"], item["title"]))
    index_path = ROOT / "samples.js"
    previous = []
    if index_path.exists():
        previous = json.loads(index_path.read_text(encoding="utf-8")
                              .split("window.SAMPLE_LIBRARY = ", 1)[1].rstrip(";\n"))["samples"]
    number_samples(samples, previous)
    catalogue = {"source": SOURCE.relative_to(ROOT).as_posix(),
                 "samples": samples, "totalBytes": sum(s["bytes"] for s in samples),
                 "originalBytes": sum(s["originalBytes"] for s in samples),
                 "totalDuration": round(sum(s["duration"] for s in samples), 3)}
    # A classic script works from both file:// and a GitHub Pages subdirectory.
    (ROOT / "samples.js").write_text(
        "// Generated by scripts/prepare-samples.py; do not edit by hand.\n"
        + "window.SAMPLE_LIBRARY = " + json.dumps(catalogue, ensure_ascii=False, separators=(",", ":"))
        + ";\n", encoding="utf-8")
    print(f"Prepared {len(samples)} samples; {catalogue['totalBytes'] / 1e6:.1f} MB "
          f"instead of {catalogue['originalBytes'] / 1e6:.1f} MB. Originals unchanged.")
    subprocess.run(["node", str(ROOT / "scripts/prepare-spectra.cjs")], check=True)
    remove_deleted_assets(samples, previous)
    update_page_counts(samples)
    subprocess.run([sys.executable, str(ROOT / "scripts/version-assets.py")], check=True)


if __name__ == "__main__":
    main()
