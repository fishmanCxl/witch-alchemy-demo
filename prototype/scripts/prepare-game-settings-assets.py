from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "artifacts" / "game-settings-ui-raw"
OUTPUT_DIR = ROOT / "public" / "assets" / "game" / "chibi" / "ui"

ASSETS = {
    "icon-settings-gear": (96, 96),
    "settings-dialog-panel": (600, 720),
    "icon-settings-close": (96, 96),
    "icon-settings-home": (96, 96),
}


def is_edge_neutral(pixel: tuple[int, int, int]) -> bool:
    low = min(pixel)
    high = max(pixel)
    luminance = sum(pixel) / 3
    return luminance >= 190 and high - low <= 28


def clear_connected_neutral_background(source: Image.Image) -> Image.Image:
    """Clear only neutral pixels connected to the baked board at a canvas edge."""
    rgb = source.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    connected = bytearray(width * height)
    queue: deque[int] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if connected[index] or not is_edge_neutral(pixels[x, y]):
            return
        connected[index] = 1
        queue.append(index)

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    output = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    output_pixels = output.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if not connected[row + x]:
                red, green, blue = pixels[x, y]
                output_pixels[x, y] = (red, green, blue, 255)
    return output


def normalize_asset(source: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    cleaned = clear_connected_neutral_background(source)
    alpha = cleaned.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("The generated asset contains no subject after background cleanup")

    cropped = cleaned.crop(bounds)
    target_width, target_height = target_size
    available_width = target_width - 8
    available_height = target_height - 8
    scale = min(available_width / cropped.width, available_height / cropped.height)
    resized_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(resized_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    offset = (
        (target_width - resized.width) // 2,
        (target_height - resized.height) // 2,
    )
    canvas.alpha_composite(resized, offset)

    canvas_pixels = canvas.load()
    for y in range(target_height):
        for x in range(target_width):
            red, green, blue, alpha_value = canvas_pixels[x, y]
            if alpha_value == 0:
                canvas_pixels[x, y] = (0, 0, 0, 0)
            else:
                canvas_pixels[x, y] = (red, green, blue, alpha_value)
    return canvas


def make_checkerboard(size: tuple[int, int], cell: int = 24) -> Image.Image:
    board = Image.new("RGBA", size, (41, 23, 50, 255))
    pixels = board.load()
    colors = ((49, 29, 61, 255), (67, 43, 79, 255))
    for y in range(size[1]):
        for x in range(size[0]):
            pixels[x, y] = colors[((x // cell) + (y // cell)) % 2]
    return board


def build_supporting_sheet(assets: dict[str, Image.Image]) -> Image.Image:
    sheet = make_checkerboard((1200, 900))
    panel = assets["settings-dialog-panel"]
    sheet.alpha_composite(panel, (72, 90))

    icon_names = (
        "icon-settings-gear",
        "icon-settings-close",
        "icon-settings-home",
    )
    for index, name in enumerate(icon_names):
        large = assets[name].resize((288, 288), Image.Resampling.NEAREST)
        sheet.alpha_composite(large, (760, 22 + index * 294))
    return sheet


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    normalized: dict[str, Image.Image] = {}

    for name, target_size in ASSETS.items():
        raw_path = RAW_DIR / f"{name}-raw.png"
        with Image.open(raw_path) as source:
            asset = normalize_asset(source, target_size)
        asset.save(OUTPUT_DIR / f"{name}.png", format="PNG", compress_level=9)
        normalized[name] = asset

    supporting_sheet = build_supporting_sheet(normalized)
    supporting_sheet.save(RAW_DIR / "supporting-sheet.png", format="PNG", compress_level=9)


if __name__ == "__main__":
    main()
