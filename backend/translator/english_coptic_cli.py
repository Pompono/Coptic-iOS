from __future__ import annotations

import argparse
import json
import sys

from english_coptic_translator import (
    TranslatorError,
    TranslatorInputError,
    get_translator,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate English text to Coptic")
    parser.add_argument("text", nargs="?", default="", help="English input text")
    parser.add_argument("--dialect", default="bohairic", choices=["sahidic", "bohairic"], help="Output dialect")
    parser.add_argument("--include-confidence", action="store_true", help="Include confidence score")
    parser.add_argument("--model", default="megalaa/english-coptic-translator", help="HF model name")
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    args = parse_args()

    try:
        translator = get_translator(args.model)
        result = translator.translate(
            text=args.text,
            dialect=args.dialect,
            include_confidence=args.include_confidence,
        )
    except TranslatorInputError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2
    except TranslatorError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": f"unexpected translator error: {exc}"}), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
