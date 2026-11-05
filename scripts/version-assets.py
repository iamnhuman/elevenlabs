#!/usr/bin/env python3
"""Pin local JS/CSS URLs to their content, including the spectral worker imports."""
import hashlib
from pathlib import Path
import re
from urllib.parse import urlsplit


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def version_assets(root):
    changed = []

    def update(path, transform):
        original = path.read_text()
        updated = transform(original)
        if updated != original:
            path.write_text(updated)
            changed.append(str(path.relative_to(root)))

    def pin_script(source, dependency):
        pattern = r"(?P<quote>['\"])" + re.escape(dependency) + r"(?:\?[^'\"]*)?(?P=quote)"
        versioned = dependency + '?v=' + fingerprint(root / dependency)
        update(root / source, lambda text: re.sub(pattern, lambda match: match['quote'] + versioned + match['quote'], text))

    # Hash leaves first, then their importers, then the page that loads them.
    pin_script('spectral-image-worker.js', 'spectral-image-dsp.js')
    pin_script('spectral-image.js', 'spectral-image-worker.js')

    def pin_tag(match):
        url = urlsplit(match['url'])
        if url.scheme or url.netloc or not url.path.endswith(('.js', '.css')):
            return match[0]
        versioned = url.path + '?v=' + fingerprint(root / url.path)
        return match['prefix'] + match['quote'] + versioned + match['quote']

    tags = r'''(?P<prefix><(?:script|link)\b[^>]*\b(?:src|href)=)(?P<quote>["'])(?P<url>[^"']+)(?P=quote)'''
    update(root / 'index.html', lambda text: re.sub(tags, pin_tag, text))
    return changed


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    changed = version_assets(root)
    print('Versioned assets: ' + (', '.join(changed) if changed else 'already current'))
