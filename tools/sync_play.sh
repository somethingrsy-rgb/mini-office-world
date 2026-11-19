#!/bin/sh
# src/playScene.ts 를 데스크펫이 쓰는 일반 자바스크립트(desktop-cat/play.js)로 바꿔요
cd "$(dirname "$0")/.." && npx tsc --ignoreConfig src/playScene.ts --target es2019 --module esnext --outDir /tmp/play_out >/dev/null
sed -e 's/^export //' /tmp/play_out/playScene.js > desktop-cat/play.js
