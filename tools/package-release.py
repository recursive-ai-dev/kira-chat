#!/usr/bin/env python3
"""Package verified offline deliverables and Android binaries with reproducible checksums."""

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from zipfile import BadZipFile, ZipFile, ZipInfo, ZIP_DEFLATED


ROOT = Path(__file__).resolve().parent.parent
SOURCE_ROOTS = {"src", "tools", "tests", "themes", "docs", "examples", "android", ".github"}
SOURCE_FILES = {"Kira.html", "KiraSDK.js", "LICENSE", "README.md", "TODO.md", "package.json", "package-lock.json", ".gitignore", ".gitattributes"}


def digest(path: Path) -> str:
    value = sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def source_paths(root: Path) -> list[Path]:
    raw = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root
    )
    result = []
    for name in sorted(set(raw.decode("utf-8").split("\0")) - {""}):
        relative = Path(name)
        if relative.parts[0] not in SOURCE_ROOTS and name not in SOURCE_FILES:
            continue
        path = root / relative
        if path.is_symlink() or not path.is_file() or root.resolve() not in path.resolve().parents:
            raise ValueError(f"Source archive requires a regular repository file: {name}")
        # Never include signing material or machine-specific Android setup, even if accidentally staged.
        if (path.suffix.lower() in {".jks", ".keystore"}
                or path.name in {"local.properties", ".env"} or path.name.startswith(".env.")):
            raise ValueError(f"Private configuration must not be packaged: {name}")
        result.append(relative)
    if not result:
        raise ValueError("No source files found")
    return result


def write_source_zip(root: Path, target: Path, version: str) -> None:
    with ZipFile(target, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in source_paths(root):
            info = ZipInfo(f"kira-{version}/{relative.as_posix()}", date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.create_system = 3
            mode = 0o755 if relative.as_posix() == "android/gradlew" else 0o644
            info.external_attr = (0o100000 | mode) << 16
            archive.writestr(info, (root / relative).read_bytes())


def validate_embedded_html(binary: Path, member: str, html: bytes) -> None:
    if not binary.is_file():
        raise ValueError(f"Missing Android distribution: {binary}. Run npm run android:verify first.")
    with ZipFile(binary) as archive:
        if archive.read(member) != html:
            raise ValueError(f"{binary.name} embeds stale Kira.html; rebuild Android before packaging")
        if archive.testzip() is not None:
            raise ValueError(f"{binary.name} has a damaged ZIP entry")


def versions(root: Path) -> tuple[str, str, int]:
    version = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Expected a numeric semantic release version")
    sdk = (root / "KiraSDK.js").read_text(encoding="utf-8")
    match = re.search(r"Kira\.NARRATIVE_META=(\{[^;]+\});", sdk)
    if not match:
        raise ValueError("Generated SDK metadata is missing")
    sdk_version = json.loads(match.group(1))["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", sdk_version):
        raise ValueError("Expected a numeric semantic SDK version")
    gradle = (root / "android/app/build.gradle").read_text(encoding="utf-8")
    name = re.search(r"versionName\s+'([^']+)'", gradle)
    code = re.search(r"versionCode\s+(\d+)", gradle)
    if not name or name.group(1) != version or not code:
        raise ValueError("Android and platform versions differ")
    return version, sdk_version, int(code.group(1))


def package(root: Path, output: Path) -> list[Path]:
    subprocess.run([sys.executable, "tools/build.py", "--check"], cwd=root, check=True)
    version, sdk_version, version_code = versions(root)
    apk_dir = root / "android/app/build/outputs/apk/release"
    apk = apk_dir / "app-release.apk"
    aab = root / "android/app/build/outputs/bundle/release/app-release.aab"
    html = (root / "Kira.html").read_bytes()
    validate_embedded_html(apk, "assets/Kira.html", html)
    validate_embedded_html(aab, "base/assets/Kira.html", html)
    metadata = json.loads((apk_dir / "output-metadata.json").read_text(encoding="utf-8"))
    elements = metadata.get("elements", [])
    if len(elements) != 1 or elements[0].get("versionName") != version or elements[0].get("versionCode") != version_code:
        raise ValueError("APK build metadata does not match the release version")
    output.mkdir(parents=True, exist_ok=True)
    # Keep prior distributions intact if any validation or compression fails.
    with tempfile.TemporaryDirectory(prefix=".kira-release-", dir=output.parent) as temporary:
        stage = Path(temporary)
        copies = (
            (root / "Kira.html", f"kira-{version}.html"),
            (root / "KiraSDK.js", f"kira-sdk-{sdk_version}.js"),
            (apk, f"kira-{version}-android.apk"),
            (aab, f"kira-{version}-android.aab"),
        )
        for source, name in copies:
            shutil.copyfile(source, stage / name)
        write_source_zip(root, stage / f"kira-{version}-source.zip", version)
        names = sorted(path.name for path in stage.iterdir())
        (stage / "SHA256SUMS").write_text(
            "".join(f"{digest(stage / name)}  {name}\n" for name in names), encoding="ascii"
        )
        names.append("SHA256SUMS")
        for name in names:
            (stage / name).replace(output / name)
    return [output / name for name in names]


def main() -> int:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist", help="artifact directory (default: dist/)")
    args = parser.parse_args()
    try:
        for path in package(ROOT, args.output.resolve()):
            print(f"Packaged {path.name} ({path.stat().st_size:,} bytes)")
    except (ValueError, OSError, KeyError, BadZipFile, subprocess.CalledProcessError) as error:
        print(f"Release packaging failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
