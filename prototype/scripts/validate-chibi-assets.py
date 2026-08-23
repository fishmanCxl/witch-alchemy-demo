from __future__ import annotations

import json
import re
import sys
from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public" / "assets" / "game" / "chibi"
MANIFEST_PATH = ASSET_ROOT / "assets-manifest.json"

EXPECTED_FRAMES = {
    "idle": 18,
    "prepare": 12,
    "raise": 12,
    "cast": 20,
    "celebrate": 14,
    "return": 18,
    "oops": 12,
}
EXPECTED_MAGIC_FRAMES = {"cast": 20, "celebrate": 14}
EXPECTED_PARTICLES = {
    "rose-heart",
    "violet-star",
    "amber-spark",
    "cyan-bubble",
    "mint-leaf",
    "blue-snow",
    "gold-dust",
    "lilac-moon",
}
EXPECTED_BUTTONS = {
    "purple": {"normal", "pressed", "disabled"},
    "gold": {"normal", "pressed", "disabled"},
}
EXPECTED_ICONS = {"undo", "restart", "add-bottle"}
KEBAB_PNG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*\.png$")
FOOT_ANCHOR = (256, 470)
TARGET_ACTION_MEDIAN_HEIGHT = 370
CHARACTER_HEIGHT_TOLERANCE = 3
MIN_DETACHED_COMPONENT_AREA = 128


def fail(message: str) -> None:
    raise AssertionError(message)


def require_file(path: Path) -> Path:
    if not path.is_file():
        fail(f"missing {path.relative_to(ROOT).as_posix()}")
    return path


def require_rgba(path: Path, size: tuple[int, int] | None = None) -> None:
    with Image.open(path) as image:
        assert image.mode == "RGBA", f"{path} must be RGBA"
        if size is not None:
            assert image.size == size, f"{path} expected {size}, got {image.size}"
        assert image.getchannel("A").getextrema() == (0, 255), f"{path} needs real alpha"


def opaque_components(image: Image.Image, threshold: int = 32) -> list[tuple[int, tuple[int, int, int, int]]]:
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int]]] = []
    for start_y in range(height):
        for start_x in range(width):
            offset = start_y * width + start_x
            if visited[offset] or pixels[start_x, start_y] < threshold:
                continue
            visited[offset] = 1
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            area = 0
            left = right = start_x
            top = bottom = start_y
            while queue:
                x, y = queue.popleft()
                area += 1
                left, right = min(left, x), max(right, x)
                top, bottom = min(top, y), max(bottom, y)
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_offset = next_y * width + next_x
                    if not visited[next_offset] and pixels[next_x, next_y] >= threshold:
                        visited[next_offset] = 1
                        queue.append((next_x, next_y))
            components.append((area, (left, top, right + 1, bottom + 1)))
    return components


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


def character_metrics(path: Path) -> tuple[int, tuple[int, int]]:
    with Image.open(path) as image:
        components = opaque_components_with_points(image.convert("RGBA"))
    assert components, f"{path} has no opaque character subject"
    _area, bounds, points = max(components, key=lambda component: component[0])
    left, top, right, bottom = bounds
    character_height = bottom - top
    foot_band_top = bottom - max(8, round(character_height * 0.12))
    foot_points = [(x, y) for x, y in points if y >= foot_band_top]
    assert foot_points, f"{path} has no detectable foot region"
    foot_left = min(x for x, _y in foot_points)
    foot_right = max(x for x, _y in foot_points)
    foot_anchor = (round((foot_left + foot_right) / 2), bottom - 1)
    return character_height, foot_anchor


def require_transparent_center(
    path: Path, center: tuple[int, int], radius: int, minimum_transparent_ratio: float
) -> None:
    with Image.open(path) as image:
        alpha = image.convert("RGBA").getchannel("A")
        pixels = alpha.load()
        sample = [
            pixels[x, y]
            for y in range(center[1] - radius, center[1] + radius + 1)
            for x in range(center[0] - radius, center[0] + radius + 1)
            if (x - center[0]) ** 2 + (y - center[1]) ** 2 <= radius**2
        ]
    transparent_ratio = sum(value == 0 for value in sample) / len(sample)
    assert transparent_ratio >= minimum_transparent_ratio, (
        f"{path} center must be transparent: {transparent_ratio:.1%} transparent, "
        f"expected at least {minimum_transparent_ratio:.1%}"
    )


def reject_foreign_frame_fragments(path: Path) -> None:
    with Image.open(path) as image:
        components = opaque_components(image)
    assert components, f"{path} has no opaque subject"
    main_component = max(components, key=lambda component: component[0])
    _main_area, main_bounds = main_component
    main_left, _main_top, main_right, _main_bottom = main_bounds
    with Image.open(path) as image:
        content_left, _content_top, content_right, _content_bottom = image.getchannel("A").getbbox()
    foreign = [
        (area, bounds)
        for area, bounds in components
        if (area, bounds) != main_component
        and (
            area < MIN_DETACHED_COMPONENT_AREA
            or bounds[2] <= main_left
            or bounds[0] >= main_right
            or bounds[0] <= content_left + 1
            or bounds[2] >= content_right - 1
            or bounds[1] >= main_bounds[3]
        )
    ]
    assert not foreign, f"{path} has foreign strip fragments: {foreign}"


def reject_hard_vertical_subject_cut(path: Path, threshold: int = 32, maximum_run: int = 28) -> None:
    """Reject the long straight alpha edge produced when a pose crosses a strip-cell boundary."""
    with Image.open(path) as image:
        alpha = image.convert("RGBA").getchannel("A")
        bounds = alpha.getbbox()
        assert bounds is not None, f"{path} has no visible pixels"
        left, top, right, bottom = bounds
        pixels = alpha.load()

        def longest_run(x: int) -> int:
            longest = current = 0
            previous_y: int | None = None
            for y in range(top, bottom):
                if pixels[x, y] < threshold:
                    continue
                current = current + 1 if previous_y is not None and y == previous_y + 1 else 1
                longest = max(longest, current)
                previous_y = y
            return longest

        edge_runs = {"left": longest_run(left), "right": longest_run(right - 1)}
        assert max(edge_runs.values()) <= maximum_run, (
            f"{path} has a hard vertical subject cut: {edge_runs}, expected <= {maximum_run}px"
        )


def public_path_to_file(value: str) -> Path:
    assert isinstance(value, str) and value.startswith("/assets/game/chibi/"), (
        f"invalid public asset path: {value!r}"
    )
    return ROOT / "public" / value.removeprefix("/")


def validate_names() -> None:
    for path in ASSET_ROOT.rglob("*.png"):
        assert KEBAB_PNG.fullmatch(path.name), f"invalid asset filename: {path.name}"


def validate_background(manifest: dict[str, object]) -> int:
    path = require_file(public_path_to_file(manifest["background"]))
    with Image.open(path) as image:
        assert image.mode == "RGB", f"{path} must be RGB"
        assert image.size == (786, 1704), f"{path} expected (786, 1704), got {image.size}"
    return 1


def validate_witch(manifest: dict[str, object]) -> int:
    total = 0
    witch = manifest.get("witch")
    assert isinstance(witch, dict), "manifest witch must be an object"
    for action, frame_count in EXPECTED_FRAMES.items():
        entry = witch.get(action)
        assert isinstance(entry, dict), f"missing manifest witch.{action}"
        assert entry.get("frames") == frame_count, f"wrong frame count for {action}"
        pattern = entry.get("pattern")
        assert isinstance(pattern, str) and "{index}" in pattern, f"invalid pattern for {action}"
        action_dir = ASSET_ROOT / "character" / action
        expected_names = {f"{action}-{index:02d}.png" for index in range(frame_count)}
        actual_names = {path.name for path in action_dir.glob("*.png")} if action_dir.is_dir() else set()
        assert actual_names == expected_names, (
            f"{action} frames mismatch: expected {sorted(expected_names)}, got {sorted(actual_names)}"
        )
        character_heights: list[int] = []
        for index in range(frame_count):
            path = require_file(public_path_to_file(pattern.format(index=f"{index:02d}")))
            require_rgba(path, (512, 512))
            with Image.open(path) as image:
                bounds = image.getchannel("A").getbbox()
            assert bounds is not None, f"{path} has no visible pixels"
            left, top, right, bottom = bounds
            assert left >= 41 and top >= 41 and right <= 471 and bottom <= 471, (
                f"{path} violates 8% transparent safe padding: {bounds}"
            )
            assert bottom == 471, f"{path} foot anchor must be y=470, got visible bottom y={bottom - 1}"
            character_height, foot_anchor = character_metrics(path)
            character_heights.append(character_height)
            assert abs(character_height - TARGET_ACTION_MEDIAN_HEIGHT) <= CHARACTER_HEIGHT_TOLERANCE, (
                f"{path} character height must be {TARGET_ACTION_MEDIAN_HEIGHT}+/-"
                f"{CHARACTER_HEIGHT_TOLERANCE}px, got {character_height}px"
            )
            assert foot_anchor == FOOT_ANCHOR, (
                f"{path} foot anchor must be {FOOT_ANCHOR}, got {foot_anchor}"
            )
            reject_foreign_frame_fragments(path)
            reject_hard_vertical_subject_cut(path)
            total += 1
        action_median = median(character_heights)
        assert abs(action_median - TARGET_ACTION_MEDIAN_HEIGHT) <= CHARACTER_HEIGHT_TOLERANCE, (
            f"{action} median character height must be {TARGET_ACTION_MEDIAN_HEIGHT}+/-"
            f"{CHARACTER_HEIGHT_TOLERANCE}px, got {action_median}px"
        )
    return total


def validate_particles(manifest: dict[str, object]) -> int:
    particles = manifest.get("particles")
    assert isinstance(particles, dict), "manifest particles must be an object"
    actual = set()
    for path in (ASSET_ROOT / "effects").glob("particle-*.png"):
        actual.add(path.stem.removeprefix("particle-"))
        require_rgba(path)
    assert actual == EXPECTED_PARTICLES, (
        f"particle motifs mismatch: expected {sorted(EXPECTED_PARTICLES)}, got {sorted(actual)}"
    )
    assert len(particles) == len(EXPECTED_PARTICLES), "manifest must list 8 particle motifs"
    for value in particles.values():
        require_rgba(require_file(public_path_to_file(value)))
    return len(actual)


def validate_witch_magic(manifest: dict[str, object]) -> int:
    effects = manifest.get("effects")
    assert isinstance(effects, dict), "manifest effects must be an object"
    witch_magic = effects.get("witchMagic")
    assert isinstance(witch_magic, dict), "manifest effects.witchMagic must be an object"
    total = 0
    for action, frame_count in EXPECTED_MAGIC_FRAMES.items():
        entry = witch_magic.get(action)
        assert isinstance(entry, dict), f"missing manifest effects.witchMagic.{action}"
        assert entry.get("frames") == frame_count, f"wrong magic frame count for {action}"
        pattern = entry.get("pattern")
        assert isinstance(pattern, str) and "{index}" in pattern, f"invalid magic pattern for {action}"
        action_dir = ASSET_ROOT / "effects" / "witch-magic" / action
        expected_names = {f"{action}-{index:02d}.png" for index in range(frame_count)}
        actual_names = {path.name for path in action_dir.glob("*.png")} if action_dir.is_dir() else set()
        assert actual_names == expected_names, (
            f"{action} magic frames mismatch: expected {sorted(expected_names)}, got {sorted(actual_names)}"
        )
        for index in range(frame_count):
            path = require_file(public_path_to_file(pattern.format(index=f"{index:02d}")))
            with Image.open(path) as image:
                assert image.mode == "RGBA", f"{path} must be RGBA"
                assert image.size == (512, 512), f"{path} expected (512, 512), got {image.size}"
                alpha_minimum, alpha_maximum = image.getchannel("A").getextrema()
                assert alpha_minimum == 0 and alpha_maximum > 0, f"{path} needs visible transparent VFX"
            total += 1
    return total


def validate_ui(manifest: dict[str, object]) -> int:
    ui = manifest.get("ui")
    assert isinstance(ui, dict), "manifest ui must be an object"
    buttons = ui.get("buttons")
    assert isinstance(buttons, dict), "missing manifest ui.buttons"
    for family, states in EXPECTED_BUTTONS.items():
        variants = buttons.get(family)
        assert isinstance(variants, dict), f"missing ui button family {family}"
        assert set(variants) == states, f"missing UI state variants for {family}"
        for state, value in variants.items():
            path = require_file(public_path_to_file(value))
            assert path.name == f"button-{family}-{state}.png", f"unexpected UI button filename: {path.name}"
            require_rgba(path)

    icons = ui.get("icons")
    assert isinstance(icons, dict) and set(icons) == EXPECTED_ICONS, "missing UI icon variants"
    for icon, value in icons.items():
        path = require_file(public_path_to_file(value))
        assert path.name == f"icon-{icon}.png", f"unexpected UI icon filename: {path.name}"
        require_rgba(path)
        if icon == "add-bottle":
            require_transparent_center(path, center=(130, 100), radius=18, minimum_transparent_ratio=0.95)

    badge = require_file(public_path_to_file(ui.get("badgePlus")))
    panel = require_file(public_path_to_file(ui.get("messagePanel")))
    assert badge.name == "badge-plus.png", f"unexpected badge filename: {badge.name}"
    assert panel.name == "message-panel.png", f"unexpected panel filename: {panel.name}"
    require_rgba(badge)
    require_rgba(panel)
    return 11


def validate_other(manifest: dict[str, object]) -> tuple[int, int]:
    bottle = require_file(public_path_to_file(manifest.get("bottle")))
    assert bottle.name == "bottle-frame.png", f"unexpected bottle filename: {bottle.name}"
    require_rgba(bottle)
    effects = manifest.get("effects")
    assert isinstance(effects, dict), "manifest effects must be an object"
    completion = require_file(public_path_to_file(effects.get("completionBurst")))
    assert completion.name == "completion-burst.png", f"unexpected completion filename: {completion.name}"
    require_rgba(completion)
    require_transparent_center(completion, center=(256, 256), radius=48, minimum_transparent_ratio=0.95)
    return 1, 1


def main() -> None:
    require_file(MANIFEST_PATH)
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert isinstance(manifest, dict), "manifest root must be an object"
    validate_names()
    witch_count = validate_witch(manifest)
    magic_count = validate_witch_magic(manifest)
    particle_count = validate_particles(manifest)
    ui_count = validate_ui(manifest)
    completion_count, bottle_count = validate_other(manifest)
    background_count = validate_background(manifest)
    print(
        f"validated {witch_count} witch frames, {magic_count} witch magic frames, "
        f"{particle_count} particle motifs, "
        f"{ui_count} UI assets, {completion_count} completion effect, "
        f"{bottle_count} bottle, {background_count} background"
    )


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
