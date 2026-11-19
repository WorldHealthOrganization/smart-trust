"""Local OPUS-MT runner for scripts/translation-candidates.ts (and its older name, translate-pot).

Reads one JSON object on stdin, {"model": "<hf id or local dir>", "texts": [...]},
and writes {"translations": [...]} on stdout, same length and order.

The model is a Helsinki-NLP OPUS-MT Marian checkpoint (CC-BY 4.0), loaded with
`transformers` from the local cache or a local directory. Set HF_HUB_OFFLINE=1
to forbid any download. No hosted inference API is called.

Run it with `python -I` (isolated mode), as translation-candidates.ts does, so nothing
from the working directory is imported.
"""

import json
import sys


def main() -> int:
    req = json.load(sys.stdin)
    texts = req["texts"]
    if not texts:
        json.dump({"translations": []}, sys.stdout)
        return 0
    from transformers import MarianMTModel, MarianTokenizer  # deferred: heavy

    tok = MarianTokenizer.from_pretrained(req["model"])
    model = MarianMTModel.from_pretrained(req["model"])
    model.eval()
    out = []
    batch = int(req.get("batch", 16))
    for i in range(0, len(texts), batch):
        chunk = texts[i : i + batch]
        enc = tok(chunk, return_tensors="pt", padding=True, truncation=True)
        gen = model.generate(**enc, num_beams=int(req.get("beams", 4)), max_new_tokens=512)
        out.extend(tok.batch_decode(gen, skip_special_tokens=True))
    json.dump({"translations": out}, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
