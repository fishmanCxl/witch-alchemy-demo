from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public" / "assets" / "game" / "chibi"
ARTIFACTS = ROOT / "artifacts"
BACKGROUND = (32, 19, 45, 255)
LABEL_COLOR = (246, 240, 250, 255)
FONT = ImageFont.load_default()


def composite_contained(
    sheet: Image.Image,
    asset_path: Path,
    box: tuple[int, int, int, int],
) -> None:
    left, top, right, bottom = box
    with Image.open(asset_path) as source:
        asset = source.convert("RGBA")
    asset.thumbnail((right - left, bottom - top), Image.Resampling.LANCZOS)
    x = left + (right - left - asset.width) // 2
    y = top + (bottom - top - asset.height) // 2
    sheet.alpha_composite(asset, (x, y))


def build_character_sheet() -> None:
    actions = ("idle", "prepare", "raise", "cast", "celebrate", "return", "oops")
    columns, rows = 20, len(actions)
    cell_width, cell_height = 110, 180
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for row, action in enumerate(actions):
        for column, path in enumerate(sorted((ASSET_ROOT / "character" / action).glob("*.png"))):
            x = column * cell_width
            y = row * cell_height
            draw.text((x + 4, y + 5), path.stem, fill=LABEL_COLOR, font=FONT)
            composite_contained(sheet, path, (x + 3, y + 20, x + cell_width - 3, y + cell_height - 4))
    sheet.convert("RGB").save(ARTIFACTS / "qa-character-sheet.png", optimize=True)


def build_magic_sheet() -> None:
    columns, rows = 20, 2
    cell_width, cell_height = 110, 110
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for row, action in enumerate(("cast", "celebrate")):
        for column, path in enumerate(sorted((ASSET_ROOT / "effects" / "witch-magic" / action).glob("*.png"))):
            x = column * cell_width
            y = row * cell_height
            draw.text((x + 4, y + 4), path.stem, fill=LABEL_COLOR, font=FONT)
            composite_contained(sheet, path, (x + 2, y + 18, x + cell_width - 2, y + cell_height - 2))
    sheet.convert("RGB").save(ARTIFACTS / "qa-witch-magic-sheet.png", optimize=True)


def build_supporting_sheet() -> None:
    asset_paths = [ASSET_ROOT / "items" / "bottle-frame.png"]
    asset_paths.extend(sorted((ASSET_ROOT / "effects").glob("*.png")))
    asset_paths.extend(sorted((ASSET_ROOT / "ui").glob("*.png")))
    columns, rows = 5, 5
    cell_width, cell_height = 300, 240
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(asset_paths):
        row, column = divmod(index, columns)
        x = column * cell_width
        y = row * cell_height
        draw.text((x + 8, y + 7), path.name, fill=LABEL_COLOR, font=FONT)
        composite_contained(sheet, path, (x + 12, y + 26, x + cell_width - 12, y + cell_height - 10))
    sheet.convert("RGB").save(ARTIFACTS / "qa-supporting-sheet.png", optimize=True)


if __name__ == "__main__":
    build_character_sheet()
    build_magic_sheet()
    build_supporting_sheet()
