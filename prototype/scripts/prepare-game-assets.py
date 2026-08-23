from pathlib import Path

from PIL import Image, ImageOps


ASSET_DIR = Path(__file__).resolve().parents[1] / "public" / "assets" / "game"
SPRITES = (
    "witch-idle.png",
    "witch-cast.png",
    "witch-celebrate.png",
    "bottle-frame.png",
)


def neutral_checker_to_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    converted = []
    for red, green, blue, _alpha in rgba.getdata():
        minimum = min(red, green, blue)
        chroma = max(red, green, blue) - minimum
        if minimum >= 232 and chroma <= 14:
            alpha = 0
        elif minimum >= 218 and chroma <= 20:
            alpha = min(255, max(0, (232 - minimum) * 18))
        else:
            alpha = 255
        converted.append((red, green, blue, alpha))
    rgba.putdata(converted)
    return rgba


def trim_and_resize(image: Image.Image, max_height: int = 768) -> Image.Image:
    bounds = image.getchannel("A").getbbox()
    if bounds:
        image = image.crop(bounds)
    padded = Image.new("RGBA", (image.width + 48, image.height + 48), (0, 0, 0, 0))
    padded.alpha_composite(image, (24, 24))
    if padded.height > max_height:
        width = round(padded.width * max_height / padded.height)
        padded = padded.resize((width, max_height), Image.Resampling.LANCZOS)
    return padded


def main() -> None:
    background_path = ASSET_DIR / "alchemy-lab-bg.png"
    background = Image.open(background_path).convert("RGB")
    background = ImageOps.fit(background, (786, 1704), method=Image.Resampling.LANCZOS)
    background.save(background_path, optimize=True)

    for filename in SPRITES:
        path = ASSET_DIR / filename
        source = Image.open(path)
        if source.mode == "RGBA" and source.getchannel("A").getextrema()[0] == 0:
            sprite = source
        else:
            sprite = neutral_checker_to_alpha(source)
        sprite = trim_and_resize(sprite)
        sprite.save(path, optimize=True)


if __name__ == "__main__":
    main()
