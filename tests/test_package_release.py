"""Failure-path and reproducibility checks for release packaging (Python 3.9+)."""

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from zipfile import ZipFile

SPEC = importlib.util.spec_from_file_location("package_release", Path(__file__).resolve().parents[1] / "tools/package-release.py")
RELEASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RELEASE)


class PackagingTests(unittest.TestCase):
    def test_distribution_versions_must_agree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text(json.dumps({"version": "1.2.3"}), encoding="utf-8")
            (root / "KiraSDK.js").write_text('Kira.NARRATIVE_META={"version":"0.4.0"};', encoding="utf-8")
            (root / "android/app").mkdir(parents=True)
            gradle = root / "android/app/build.gradle"
            gradle.write_text("versionName '1.2.3'\nversionCode 5", encoding="utf-8")
            self.assertEqual(RELEASE.versions(root), ("1.2.3", "0.4.0", 5))
            gradle.write_text("versionName '1.2.2'\nversionCode 4", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "versions differ"):
                RELEASE.versions(root)

    def test_rejects_stale_and_missing_android_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / "app.apk"
            with self.assertRaisesRegex(ValueError, "Missing Android"):
                RELEASE.validate_embedded_html(apk, "assets/Kira.html", b"current")
            with ZipFile(apk, "w") as archive:
                archive.writestr("assets/Kira.html", b"old")
            with self.assertRaisesRegex(ValueError, "stale"):
                RELEASE.validate_embedded_html(apk, "assets/Kira.html", b"current")
            RELEASE.validate_embedded_html(apk, "assets/Kira.html", b"old")

    def test_source_archive_is_reproducible_and_excludes_private_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "--quiet", str(root)], check=True)
            (root / "README.md").write_text("hello", encoding="utf-8")
            (root / ".gitignore").write_text("*.keystore\nlocal.properties\n*.zip\n", encoding="utf-8")
            (root / "android").mkdir()
            (root / "android/gradlew").write_text("#!/bin/sh\n", encoding="utf-8")
            (root / "android/local.properties").write_text("sdk.dir=/private", encoding="utf-8")
            (root / "android/private.keystore").write_bytes(b"private")
            first, second = root / "first.zip", root / "second.zip"
            RELEASE.write_source_zip(root, first, "1.2.3")
            RELEASE.write_source_zip(root, second, "1.2.3")
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with ZipFile(first) as archive:
                self.assertEqual(set(archive.namelist()), {
                    "kira-1.2.3/.gitignore", "kira-1.2.3/README.md", "kira-1.2.3/android/gradlew"
                })
                self.assertEqual(archive.getinfo("kira-1.2.3/android/gradlew").external_attr >> 16 & 0o777, 0o755)
            subprocess.run(["git", "add", "--force", "android/private.keystore"], cwd=root, check=True)
            with self.assertRaisesRegex(ValueError, "Private configuration"):
                RELEASE.source_paths(root)


if __name__ == "__main__":
    unittest.main()
