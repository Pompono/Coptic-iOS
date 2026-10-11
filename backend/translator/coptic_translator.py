from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import numpy as np
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

SAHIDIC_TAG = "з"
BOHAIRIC_TAG = "б"

COPTIC_TO_GREEK = {
    "ⲁ": "α",
    "ⲃ": "β",
    "ⲅ": "γ",
    "ⲇ": "δ",
    "ⲉ": "ε",
    "ⲋ": "ϛ",
    "ⲍ": "ζ",
    "ⲏ": "η",
    "ⲑ": "θ",
    "ⲓ": "ι",
    "ⲕ": "κ",
    "ⲗ": "λ",
    "ⲙ": "μ",
    "ⲛ": "ν",
    "ⲝ": "ξ",
    "ⲟ": "ο",
    "ⲡ": "π",
    "ⲣ": "ρ",
    "ⲥ": "σ",
    "ⲧ": "τ",
    "ⲩ": "υ",
    "ⲫ": "φ",
    "ⲭ": "χ",
    "ⲯ": "ψ",
    "ⲱ": "ω",
    "ϣ": "s",
    "ϥ": "f",
    "ϧ": "k",
    "ϩ": "h",
    "ϫ": "j",
    "ϭ": "c",
    "ϯ": "t",
}


class TranslatorError(RuntimeError):
    """Base translator error."""


class TranslatorInputError(TranslatorError):
    """Raised when user input is invalid."""


class TranslatorLoadError(TranslatorError):
    """Raised when model/tokenizer load fails."""


class TranslatorRuntimeError(TranslatorError):
    """Raised when generation fails."""


@dataclass(frozen=True)
class ProcessedInput:
    dialect: str
    tagged_text: str


def greekify(coptic_text: str) -> str:
    return "".join(COPTIC_TO_GREEK.get(ch.lower(), ch.lower()) for ch in coptic_text)


def normalize_dialect(dialect: str | None) -> str:
    d = (dialect or "").strip().lower()
    if d in {"bohairic", "boh", "b"}:
        return "bohairic"
    if d in {"sahidic", "sah", "s"}:
        return "sahidic"
    if d == "":
        return "sahidic"
    raise TranslatorInputError("dialect must be one of: sahidic, bohairic")


class CopticEnglishTranslator:
    def __init__(self, model_name: str = "megalaa/coptic-english-translator") -> None:
        try:
            self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        except Exception as exc:  # noqa: BLE001
            raise TranslatorLoadError(f"failed to load model '{model_name}': {exc}") from exc

    def _prepare(self, text: str, dialect: str) -> ProcessedInput:
        normalized_input = (text or "").strip().lower()
        if not normalized_input:
            raise TranslatorInputError("text must not be empty")

        greek_text = greekify(normalized_input)

        if dialect == "bohairic":
            return ProcessedInput(dialect="bohairic", tagged_text=f"{BOHAIRIC_TAG} {greek_text}")
        return ProcessedInput(dialect="sahidic", tagged_text=f"{SAHIDIC_TAG} {greek_text}")

    def translate(
        self,
        text: str,
        dialect: str = "sahidic",
        include_confidence: bool = False,
        include_processed_input: bool = False,
    ) -> dict[str, Any]:
        normalized_dialect = normalize_dialect(dialect)
        processed = self._prepare(text=text, dialect=normalized_dialect)

        try:
            input_tensors = self.tokenizer.encode(processed.tagged_text, return_tensors="pt")
            generation_kwargs: dict[str, Any] = {}
            if include_confidence:
                generation_kwargs["output_scores"] = True
                generation_kwargs["return_dict_in_generate"] = True

            outputs = self.model.generate(
                input_tensors[:, : self.tokenizer.model_max_length],
                **generation_kwargs,
            )
            sequence = outputs.sequences[0] if include_confidence else outputs[0]
            translation = self.tokenizer.decode(sequence, skip_special_tokens=True).strip()
        except Exception as exc:  # noqa: BLE001
            raise TranslatorRuntimeError(f"translation failed: {exc}") from exc

        response: dict[str, Any] = {
            "translation": translation,
            "dialect": processed.dialect,
        }

        if include_confidence:
            scores = outputs.scores
            confidences = [torch.softmax(score, dim=-1).max().item() for score in scores]
            num_words = max(1, len(translation.split()))
            scaled_probability = np.exp(sum(np.log(confidences)) / num_words)
            response["confidence"] = float(scaled_probability)

        if include_processed_input:
            response["processed_input"] = processed.tagged_text

        return response


@lru_cache(maxsize=2)
def get_translator(model_name: str = "megalaa/coptic-english-translator") -> CopticEnglishTranslator:
    return CopticEnglishTranslator(model_name=model_name)
