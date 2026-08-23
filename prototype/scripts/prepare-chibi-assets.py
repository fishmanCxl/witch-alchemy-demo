from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
RAW_ASSETS = ARTIFACTS / "chibi-raw"
ASSET_ROOT = ROOT / "public" / "assets" / "game" / "chibi"
DEFAULT_BACKGROUND = ARTIFACTS / "alchemy-room-source.png"
FRAME_COUNTS = {
    "idle": 18,
    "prepare": 12,
    "raise": 12,
    "cast": 20,
    "celebrate": 14,
    "return": 18,
    "oops": 12,
}
V3_RAW = RAW_ASSETS / "witch-v3"
FRAME_STRIPS = {
    # The breathing loop uses the same nine-pose inhale in reverse for a seamless,
    # identity-stable exhale. It deliberately avoids generated idle sparkles.
    "idle": (("idle-01-09.png", 9, False), ("idle-01-09.png", 9, True)),
    "prepare": (("prepare-01-12.png", 12, False),),
    "raise": (("raise-01-12.png", 12, False),),
    "cast": (("cast-01-10.png", 10, False), ("cast-11-20.png", 10, False)),
    "celebrate": (("celebrate-01-07.png", 7, False), ("celebrate-08-14.png", 7, False)),
    "return": (("return-01-09.png", 9, False), ("return-10-18.png", 9, False)),
    "oops": (("oops-01-12.png", 12, False),),
}
FRAME_CANVAS = (512, 512)
FOOT_ANCHOR = (256, 470)
SAFE_PADDING = 41
TARGET_ACTION_MEDIAN_HEIGHT = 370
MIN_DETACHED_COMPONENT_AREA = 128

ASSET_SIZES = {
    "bottle-frame.png": (256, 384),
    "particle-rose-heart.png": (128, 128),
    "particle-violet-star.png": (128, 128),
    "particle-amber-spark.png": (128, 128),
    "particle-cyan-bubble.png": (128, 128),
    "particle-mint-leaf.png": (128, 128),
    "particle-blue-snow.png": (128, 128),
    "particle-gold-dust.png": (128, 128),
    "particle-lilac-moon.png": (128, 128),
    "completion-burst.png": (512, 512),
    "button-purple-normal.png": (256, 256),
    "button-purple-pressed.png": (256, 256),
    "button-purple-disabled.png": (256, 256),
    "button-gold-normal.png": (256, 256),
    "button-gold-pressed.png": (256, 256),
    "button-gold-disabled.png": (256, 256),
    "icon-undo.png": (192, 192),
    "icon-restart.png": (192, 192),
    "icon-add-bottle.png": (192, 192),
    "badge-plus.png": (128, 128),
    "message-panel.png": (768, 192),
}


def is_removable_neutral(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    # ImageGen's V3 sprite sheets use a softly shaded neutral backdrop whose edge
    # can dip below the earlier 218 threshold. It is still near-achromatic; the
    # edge-connected flood keeps enclosed white/gold character highlights intact.
    return alpha == 0 or (min(red, green, blue) >= 180 and max(red, green, blue) - min(red, green, blue) <= 36)


def remove_connected_neutral_background(image: Image.Image) -> Image.Image:
    """Remove only light neutral pixels connected to an image edge.

    This handles a flat neutral backdrop and the white/gray checkerboard sometimes
    baked into generated previews without erasing enclosed highlights in the art.
    """
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    queue: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def enqueue(x: int, y: int) -> None:
        offset = y * width + x
        if not visited[offset] and is_removable_neutral(pixels[x, y]):
            visited[offset] = 1
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


def clear_neutral_region_at(image: Image.Image, seed: tuple[int, int]) -> Image.Image:
    """Clear an enclosed white/gray generated-preview region from a known art opening."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    seed_x, seed_y = seed
    if not (0 <= seed_x < width and 0 <= seed_y < height):
        raise ValueError(f"neutral cleanup seed {seed} is outside {image.size}")
    pixels = rgba.load()
    if not is_removable_neutral(pixels[seed_x, seed_y]):
        raise ValueError(f"neutral cleanup seed {seed} is not a removable neutral pixel")
    queue: deque[tuple[int, int]] = deque([seed])
    visited = bytearray(width * height)
    visited[seed_y * width + seed_x] = 1
    while queue:
        x, y = queue.popleft()
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= next_x < width and 0 <= next_y < height):
                continue
            offset = next_y * width + next_x
            if not visited[offset] and is_removable_neutral(pixels[next_x, next_y]):
                visited[offset] = 1
                queue.append((next_x, next_y))
    return rgba


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("asset has no visible pixels after background cleanup")
    return bounds


def opaque_components_with_points(
    image: Image.Image, threshold: int = 32
) -> list[tuple[int, tuple[int, int, int, int], list[tuple[int, int]]]]:
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int], list[tuple[int, int]]]] = []
    for start_y in range(height):
        for start_x in range(width):
            offset = start_y * width + start_x
            if visited[offset] or pixels[start_x, start_y] < threshold:
                continue
            visited[offset] = 1
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            points: list[tuple[int, int]] = []
            left = right = start_x
            top = bottom = start_y
            while queue:
                x, y = queue.popleft()
                points.append((x, y))
                left, right = min(left, x), max(right, x)
                top, bottom = min(top, y), max(bottom, y)
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_offset = next_y * width + next_x
                    if not visited[next_offset] and pixels[next_x, next_y] >= threshold:
                        visited[next_offset] = 1
                        queue.append((next_x, next_y))
            components.append((len(points), (left, top, right + 1, bottom + 1), points))
    return components


def character_metrics(image: Image.Image) -> tuple[int, tuple[int, int]]:
    components = opaque_components_with_points(image.convert("RGBA"))
    if not components:
        raise ValueError("frame has no opaque character subject")
    _area, bounds, points = max(components, key=lambda component: component[0])
    _left, top, _right, bottom = bounds
    character_height = bottom - top
    foot_band_top = bottom - max(8, round(character_height * 0.12))
    foot_points = [(x, y) for x, y in points if y >= foot_band_top]
    foot_left = min(x for x, _y in foot_points)
    foot_right = max(x for x, _y in foot_points)
    return character_height, (round((foot_left + foot_right) / 2), bottom - 1)


def remove_foreign_side_components(
    image: Image.Image, threshold: int = 32, minimum_area: int = 16
) -> Image.Image:
    """Discard neighboring-pose fragments clipped into an arithmetic strip cell."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    components = opaque_components_with_points(rgba, threshold)

    if not components:
        return rgba
    main_component = max(components, key=lambda component: component[0])
    _main_area, main_bounds, _main_points = main_component
    main_left, _main_top, main_right, main_bottom = main_bounds
    output_pixels = rgba.load()
    for area, (left, _top, right, _bottom), points in components:
        if points is _main_points:
            continue
        if not (
            area < minimum_area
            or left <= 1
            or right >= width - 1
            or right <= main_left
            or left >= main_right
            or _top >= main_bottom
        ):
            continue
        for x, y in points:
            output_pixels[x, y] = (0, 0, 0, 0)
    return rgba


def scale_frame(image: Image.Image, scale: float) -> Image.Image:
    cropped = image.crop(alpha_bounds(image))
    target = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    return cropped.resize(target, Image.Resampling.LANCZOS) if target != cropped.size else cropped


def anchor_frame(image: Image.Image) -> Image.Image:
    image = remove_foreign_side_components(
        image, threshold=32, minimum_area=MIN_DETACHED_COMPONENT_AREA
    )
    _character_height, foot_anchor = character_metrics(image)
    x = FOOT_ANCHOR[0] - foot_anchor[0]
    y = FOOT_ANCHOR[1] - foot_anchor[1]
    canvas = Image.new("RGBA", FRAME_CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(image, (x, y))
    # Generated action glints may extend beyond the guaranteed transparent moat.
    # Clip only those outliers; the character subject remains fully inside it.
    pixels = canvas.load()
    for pixel_y in range(FRAME_CANVAS[1]):
        for pixel_x in range(FRAME_CANVAS[0]):
            if (
                pixel_x < SAFE_PADDING
                or pixel_x >= FRAME_CANVAS[0] - SAFE_PADDING
                or pixel_y < SAFE_PADDING
                or pixel_y >= FRAME_CANVAS[1] - SAFE_PADDING
            ):
                pixels[pixel_x, pixel_y] = (0, 0, 0, 0)
    return canvas


def normalized_canvas(
    image: Image.Image,
    canvas_size: tuple[int, int],
    padding: int,
    anchor_bottom: int | None = None,
) -> Image.Image:
    image = remove_connected_neutral_background(image)
    image = image.crop(alpha_bounds(image))
    max_width = canvas_size[0] - 2 * padding
    max_height = canvas_size[1] - 2 * padding
    scale = min(max_width / image.width, max_height / image.height, 1.0)
    target = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    if target != image.size:
        image = image.resize(target, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    x = (canvas_size[0] - image.width) // 2
    y = (canvas_size[1] - image.height) // 2 if anchor_bottom is None else anchor_bottom - image.height + 1
    canvas.alpha_composite(image, (x, y))
    return canvas


def prepare_identity_master() -> None:
    source = ARTIFACTS / "witch-identity-source-v2.png"
    target = ARTIFACTS / "witch-identity-master.png"
    if not source.is_file():
        raise FileNotFoundError(f"missing {source}")
    cleaned = remove_connected_neutral_background(Image.open(source))
    cleaned = cleaned.crop(alpha_bounds(cleaned))
    padded = Image.new("RGBA", (cleaned.width + 96, cleaned.height + 96), (0, 0, 0, 0))
    padded.alpha_composite(cleaned, (48, 48))
    padded.save(target, optimize=True)


def prepare_background(source: Path) -> None:
    target = ASSET_ROOT / "background" / "alchemy-room.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    background = Image.open(source).convert("RGB")
    ImageOps.fit(background, (786, 1704), method=Image.Resampling.LANCZOS).save(target, optimize=True)


def prepare_frames() -> None:
    for action, frame_count in FRAME_COUNTS.items():
        cells: list[Image.Image] = []
        character_heights: list[int] = []
        for filename, strip_count, reverse in FRAME_STRIPS[action]:
            strip_path = V3_RAW / filename
            if not strip_path.is_file():
                raise FileNotFoundError(f"missing {strip_path}")
            strip = Image.open(strip_path)
            cleaned_strip = remove_connected_neutral_background(strip)
            strip_components = opaque_components_with_points(cleaned_strip, threshold=32)
            largest_area = max(component[0] for component in strip_components)
            pose_components = sorted(
                (
                    component
                    for component in strip_components
                    if component[0] >= largest_area * 0.35
                    and component[1][3] - component[1][1] >= strip.height * 0.25
                ),
                key=lambda component: (component[1][0] + component[1][2]) / 2,
            )
            if not pose_components:
                raise ValueError(f"{strip_path.name} has no character components")
            strip_cells: list[Image.Image] = []
            for index in range(strip_count):
                source_index = (
                    0
                    if strip_count == 1 or len(pose_components) == 1
                    else round(index * (len(pose_components) - 1) / (strip_count - 1))
                )
                _area, (left, top, right, bottom), _points = pose_components[source_index]
                padding = 12
                cell = cleaned_strip.crop(
                    (
                        max(0, left - padding),
                        max(0, top - padding),
                        min(strip.width, right + padding),
                        min(strip.height, bottom + padding),
                    )
                )
                cell = remove_foreign_side_components(cell, threshold=32, minimum_area=16)
                strip_cells.append(cell)
            if reverse:
                strip_cells.reverse()
            cells.extend(strip_cells)
        if len(cells) != frame_count:
            raise ValueError(f"{action} expected {frame_count} cells, got {len(cells)}")
        character_heights.extend(character_metrics(cell)[0] for cell in cells)
        output_dir = ASSET_ROOT / "character" / action
        output_dir.mkdir(parents=True, exist_ok=True)
        for stale in output_dir.glob("*.png"):
            stale.unlink()
        for index, cell in enumerate(cells):
            # Normalize every frame independently. ImageGen can subtly change the
            # rendered character scale across a strip; an action-level median left
            # visible grow/shrink jitter even though the foot anchor stayed fixed.
            frame_scale = TARGET_ACTION_MEDIAN_HEIGHT / character_heights[index]
            frame = anchor_frame(scale_frame(cell, frame_scale))
            frame.save(output_dir / f"{action}-{index:02d}.png", optimize=True)


def opacity(image: Image.Image, factor: float) -> Image.Image:
    output = image.convert("RGBA").copy()
    output.putalpha(ImageEnhance.Brightness(output.getchannel("A")).enhance(max(0.0, min(1.0, factor))))
    return output


def prepare_magic_frames() -> None:
    atlas_path = V3_RAW / "magic-atlas.png"
    if not atlas_path.is_file():
        raise FileNotFoundError(f"missing {atlas_path}")
    atlas = Image.open(atlas_path)
    edges = [round(index * atlas.width / 3) for index in range(4)]
    motifs = []
    for index in range(3):
        motif = remove_connected_neutral_background(atlas.crop((edges[index], 0, edges[index + 1], atlas.height)))
        motifs.append(motif.crop(alpha_bounds(motif)))

    arc, burst, trail = motifs
    for action, count in (("cast", 20), ("celebrate", 14)):
        output_dir = ASSET_ROOT / "effects" / "witch-magic" / action
        output_dir.mkdir(parents=True, exist_ok=True)
        for stale in output_dir.glob("*.png"):
            stale.unlink()
        for index in range(count):
            canvas = Image.new("RGBA", FRAME_CANVAS, (0, 0, 0, 0))
            progress = index / max(1, count - 1)
            if action == "cast":
                strength = max(0.04, min(1.0, progress * 3.0, (1.0 - progress) * 2.4))
                source = arc.resize((280, 156), Image.Resampling.LANCZOS)
                source = opacity(source, strength * 0.9)
                x = round(128 + progress * 62)
                y = round(105 + progress * 84)
                canvas.alpha_composite(source, (x, y))
                if 0.32 <= progress <= 0.82:
                    sparkle = opacity(trail.resize((176, 58), Image.Resampling.LANCZOS), strength)
                    canvas.alpha_composite(sparkle, (260, 130 + round(progress * 96)))
            else:
                strength = max(0.04, min(1.0, progress * 4.0, (1.0 - progress) * 2.0))
                size = round(82 + 38 * strength)
                source = opacity(burst.resize((size, size), Image.Resampling.LANCZOS), strength)
                canvas.alpha_composite(source, (350 - size // 2, 108 - size // 2))
                sparkle = opacity(trail.resize((138, 45), Image.Resampling.LANCZOS), strength * 0.75)
                canvas.alpha_composite(sparkle, (268, 152))
            canvas.save(output_dir / f"{action}-{index:02d}.png", optimize=True)


def target_for_asset(filename: str) -> Path:
    if filename == "bottle-frame.png":
        return ASSET_ROOT / "items" / filename
    if filename.startswith("particle-") or filename == "completion-burst.png":
        return ASSET_ROOT / "effects" / filename
    return ASSET_ROOT / "ui" / filename


def prepare_supporting_assets() -> None:
    for filename, canvas_size in ASSET_SIZES.items():
        source = RAW_ASSETS / filename
        if not source.is_file():
            raise FileNotFoundError(f"missing {source}")
        padding = 12 if filename == "message-panel.png" else max(8, round(min(canvas_size) * 0.08))
        asset = normalized_canvas(Image.open(source), canvas_size, padding)
        if filename == "completion-burst.png":
            asset = clear_neutral_region_at(asset, (canvas_size[0] // 2, canvas_size[1] // 2))
        elif filename == "icon-add-bottle.png":
            asset = clear_neutral_region_at(asset, (130, 100))
        target = target_for_asset(filename)
        target.parent.mkdir(parents=True, exist_ok=True)
        asset.save(target, optimize=True)


def write_manifest() -> None:
    base = "/assets/game/chibi"
    manifest = {
        "background": f"{base}/background/alchemy-room.png",
        "witch": {
            "idle": {"frames": 18, "durationMs": 3600, "loop": True, "pattern": f"{base}/character/idle/idle-{{index}}.png"},
            "prepare": {"frames": 12, "durationMs": 720, "loop": False, "pattern": f"{base}/character/prepare/prepare-{{index}}.png"},
            "raise": {"frames": 12, "durationMs": 720, "loop": False, "pattern": f"{base}/character/raise/raise-{{index}}.png"},
            "cast": {"frames": 20, "durationMs": 1200, "loop": False, "pattern": f"{base}/character/cast/cast-{{index}}.png"},
            "celebrate": {"frames": 14, "durationMs": 1120, "loop": False, "pattern": f"{base}/character/celebrate/celebrate-{{index}}.png"},
            "return": {"frames": 18, "durationMs": 1080, "loop": False, "pattern": f"{base}/character/return/return-{{index}}.png"},
            "oops": {"frames": 12, "durationMs": 960, "loop": False, "pattern": f"{base}/character/oops/oops-{{index}}.png"},
        },
        "bottle": f"{base}/items/bottle-frame.png",
        "particles": {
            "rose": f"{base}/effects/particle-rose-heart.png",
            "violet": f"{base}/effects/particle-violet-star.png",
            "amber": f"{base}/effects/particle-amber-spark.png",
            "cyan": f"{base}/effects/particle-cyan-bubble.png",
            "mint": f"{base}/effects/particle-mint-leaf.png",
            "blue": f"{base}/effects/particle-blue-snow.png",
            "gold": f"{base}/effects/particle-gold-dust.png",
            "lilac": f"{base}/effects/particle-lilac-moon.png",
        },
        "ui": {
            "buttons": {
                family: {
                    state: f"{base}/ui/button-{family}-{state}.png"
                    for state in ("normal", "pressed", "disabled")
                }
                for family in ("purple", "gold")
            },
            "icons": {
                "undo": f"{base}/ui/icon-undo.png",
                "restart": f"{base}/ui/icon-restart.png",
                "add-bottle": f"{base}/ui/icon-add-bottle.png",
            },
            "badgePlus": f"{base}/ui/badge-plus.png",
            "messagePanel": f"{base}/ui/message-panel.png",
        },
        "effects": {
            "completionBurst": f"{base}/effects/completion-burst.png",
            "witchMagic": {
                "cast": {"frames": 20, "pattern": f"{base}/effects/witch-magic/cast/cast-{{index}}.png"},
                "celebrate": {"frames": 14, "pattern": f"{base}/effects/witch-magic/celebrate/celebrate-{{index}}.png"},
            },
        },
    }
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    (ASSET_ROOT / "assets-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize generated Q-style game art into runtime assets.")
    parser.add_argument("--background-source", type=Path, default=DEFAULT_BACKGROUND)
    parser.add_argument("--identity-only", action="store_true")
    args = parser.parse_args()
    prepare_identity_master()
    if args.identity_only:
        return
    prepare_background(args.background_source)
    prepare_frames()
    prepare_magic_frames()
    prepare_supporting_assets()
    write_manifest()


if __name__ == "__main__":
    main()
