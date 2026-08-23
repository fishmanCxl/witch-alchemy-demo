from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = ROOT / "artifacts" / "audio-ui-raw"
OUTPUT_ROOT = ROOT / "public" / "assets" / "game" / "chibi" / "ui"

ASSETS = {
    "audio-settings-panel": ((248, 96), 4),
    "icon-audio-settings": ((96, 96), 7),
    "icon-music-on": ((96, 96), 7),
    "icon-music-off": ((96, 96), 7),
    "icon-sfx-on": ((96, 96), 7),
    "icon-sfx-off": ((96, 96), 7),
}


def is_edge_neutral(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha == 0 or (
        min(red, green, blue) >= 218
        and max(red, green, blue) - min(red, green, blue) <= 24
    )


def remove_connected_preview_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    queued = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        offset = y * width + x
        if not queued[offset] and is_edge_neutral(pixels[x, y]):
            queued[offset] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                enqueue(next_x, next_y)
    return rgba


def fit_without_stretch(image: Image.Image, size: tuple[int, int], padding: int) -> Image.Image:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("audio UI asset has no visible subject after background cleanup")
    subject = image.crop(bounds)
    available_width = size[0] - 2 * padding
    available_height = size[1] - 2 * padding
    scale = min(available_width / subject.width, available_height / subject.height)
    scaled_size = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(scaled_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    position = ((size[0] - subject.width) // 2, (size[1] - subject.height) // 2)
    canvas.alpha_composite(subject, position)
    return canvas


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    normalized_assets: dict[str, Image.Image] = {}
    for stem, (size, padding) in ASSETS.items():
        source = RAW_ROOT / f"{stem}-raw.png"
        if not source.is_file():
            raise FileNotFoundError(f"missing generated audio UI source: {source}")
        cleaned = remove_connected_preview_background(Image.open(source))
        normalized = fit_without_stretch(cleaned, size, padding)
        normalized.save(OUTPUT_ROOT / f"{stem}.png", optimize=True)
        normalized_assets[stem] = normalized

    sheet = Image.new("RGBA", (960, 480), (25, 10, 31, 255))
    panel = normalized_assets["audio-settings-panel"].resize((744, 288), Image.Resampling.LANCZOS)
    sheet.alpha_composite(panel, ((sheet.width - panel.width) // 2, 12))
    icon_names = [
        "icon-audio-settings",
        "icon-music-on",
        "icon-music-off",
        "icon-sfx-on",
        "icon-sfx-off",
    ]
    for index, name in enumerate(icon_names):
        icon = normalized_assets[name].resize((144, 144), Image.Resampling.LANCZOS)
        sheet.alpha_composite(icon, (60 + index * 180, 318))
    sheet.save(RAW_ROOT / "audio-settings-supporting-sheet.png", optimize=True)


if __name__ == "__main__":
    main()
