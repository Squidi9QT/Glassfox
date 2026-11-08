#!/bin/bash
# Собирает glassfox.zip для подписи на addons.mozilla.org: только файлы расширения,
# без служебных (.amo-upload-uuid, web-ext-artifacts, .DS_Store).
set -e

cd "$(dirname "$0")/extension"
OUT="../glassfox.zip"
rm -f "$OUT"
zip -qr "$OUT" manifest.json *.js *.html *.css icons -x "*.DS_Store"
echo "Готово: $(cd .. && pwd)/glassfox.zip"
