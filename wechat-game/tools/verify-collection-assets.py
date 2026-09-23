from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2] / 'prototype/public/assets/game/chibi'
EXPECTED = {
    'ui/icon-alchemy-book.png': (256, 256),
    'collection/star-dew-potion.png': (1024, 1024),
    'collection/forest-potion.png': (512, 512),
    'collection/moon-glow-potion.png': (512, 512),
    'collection/flame-potion.png': (512, 512),
    'collection/ice-crystal-potion.png': (512, 512),
    'collection/wind-spirit-potion.png': (512, 512),
    'titles/title-badge-novice.png': (768, 384),
    'titles/title-badge-junior.png': (768, 384),
    'effects/particle-scarlet-flame.png': (64, 64),
    'effects/particle-chartreuse-rune.png': (64, 64),
    'effects/particle-indigo-comet.png': (64, 64),
    'effects/particle-pearl-diamond.png': (64, 64),
}

for relative, expected_size in EXPECTED.items():
    with Image.open(ROOT / relative) as image:
        assert image.format == 'PNG', relative
        assert image.size == expected_size, (relative, image.size)
        rgba = image.convert('RGBA')
        assert rgba.getchannel('A').getextrema() == (0, 255), relative

for relative in (
    'collection/forest-potion.png',
    'collection/moon-glow-potion.png',
    'collection/flame-potion.png',
    'collection/ice-crystal-potion.png',
    'collection/wind-spirit-potion.png',
):
    assert (ROOT / relative).stat().st_size <= 307_200, relative

print(f'verified {len(EXPECTED)} collection assets')
