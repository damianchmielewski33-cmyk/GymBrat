#!/usr/bin/env python3
"""Writes dist/ + public/ android-version.json after CI APK build."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

version_code = int(os.environ["VERSION_CODE"])
version_name = os.environ["VERSION_NAME"]
git_sha = os.environ.get("GIT_SHA") or None

info = {
    "versionCode": version_code,
    "versionName": version_name,
    "apkUrl": "https://github.com/damianchmielewski33-cmyk/GymBrat/releases/download/android-latest/gymbrat.apk",
    "releasedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "commit": git_sha,
    "notes": "Aplikacja Android GymBrat (WebView, Java).",
}

Path("dist").mkdir(parents=True, exist_ok=True)
payload = json.dumps(info, indent=2) + "\n"
Path("dist/android-version.json").write_text(payload, encoding="utf-8")
Path("public/android-version.json").write_text(payload, encoding="utf-8")

jb = Path("java-backend/src/main/resources/android-version.json")
jb.parent.mkdir(parents=True, exist_ok=True)
jb.write_text(payload, encoding="utf-8")

print(payload, end="")
