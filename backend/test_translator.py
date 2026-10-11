from typing import Dict, List, Any

import numpy as np
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

SAHIDIC_TAG = "з"
BOHAIRIC_TAG = "б"

GENERATION_KWARGS = {
    "max_new_tokens": 128,
    "min_new_tokens": 1,
    "early_stopping": True,
    "num_beams": 5,
    "output_scores": True,
    "return_dict_in_generate": True,
}

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

def greekify(coptic_text: str) -> str:
    chars = []
    for c in coptic_text:
        l_c = c.lower()
        chars.append(COPTIC_TO_GREEK.get(l_c, l_c))
    return "".join(chars)

class CopticEnglishTranslator:
    def __init__(self, model_name: str = "megalaa/coptic-english-translator"):
        print("Loading model...")
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        print("Model loaded.")

    def translate(self, inputs: str, from_bohairic: bool = False, output_confidence: bool = False):
        text = greekify(inputs.lower())

        if from_bohairic:
            text = f"{BOHAIRIC_TAG} {text}"
        else:
            text = f"{SAHIDIC_TAG} {text}"

        print("Processed input:", text)

        input_tensors = self.tokenizer.encode(text, return_tensors="pt")
        outputs = self.model.generate(
            input_tensors[:, : self.tokenizer.model_max_length],
            **GENERATION_KWARGS,
        )

        translated_text = self.tokenizer.decode(
            outputs.sequences[0], skip_special_tokens=True
        )

        if not output_confidence:
            return [{"translation": translated_text}]

        scores = outputs.scores
        confidences = [torch.softmax(score, dim=-1).max().item() for score in scores]
        num_words = max(1, len(translated_text.split()))
        scaled_probability = np.exp(sum(np.log(confidences)) / num_words)

        return [{"translation": translated_text, "confidence": scaled_probability}]

translator = CopticEnglishTranslator()

tests = [
    ("ⲓⲏⲥ ⲡⲭⲥ", True),
    ("ⲓⲏⲥⲟⲩⲥ ⲡⲉⲭⲣⲓⲥⲧⲟⲥ", True),
    ("ⲡⲉⲛⲛⲟⲩϯ", True),
]

for text, is_bohairic in tests:
    print("\nInput:", text)
    result = translator.translate(
        text,
        from_bohairic=is_bohairic,
        output_confidence=True
    )
    print("Result:", result)