#!/bin/bash
# Копирует userChrome.css в основной профиль Firefox.
# Если там уже был свой userChrome.css, он сохраняется рядом как userChrome.css.bak.
set -e

FF="$HOME/Library/Application Support/Firefox"
PROFILE=$(awk -F= '/^\[Install/{f=1} f && /^Default=/{print $2; exit}' "$FF/profiles.ini")
if [ -z "$PROFILE" ]; then
  echo "Не нашёл профиль Firefox в $FF/profiles.ini"
  exit 1
fi

CHROME="$FF/$PROFILE/chrome"
mkdir -p "$CHROME"
if [ -f "$CHROME/userChrome.css" ] && [ ! -f "$CHROME/userChrome.css.bak" ]; then
  cp "$CHROME/userChrome.css" "$CHROME/userChrome.css.bak"
  echo "Старый userChrome.css сохранён как userChrome.css.bak"
fi
cp "$(dirname "$0")/userChrome.css" "$CHROME/userChrome.css"
echo "Готово: $CHROME/userChrome.css"
echo "Перезапустите Firefox."
