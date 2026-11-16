"""Make one demo narration clip with Chatterbox Multilingual (MIT, runs on CPU).

  pip install chatterbox-tts "setuptools<81"
  python narrate-chatterbox.py <lang> <text-file> <out.wav>

Text is read one sentence at a time (a whole paragraph gets cut short) and joined
with short pauses. Spell out letter names, e.g. "T N G bot", "G P G".
Then slow it down and match the loudness of the other clips in that language:

  ffmpeg -i out.wav -af "atempo=0.88,loudnorm=I=<LUFS>:TP=-1.5" -ar 24000 -ac 1 -b:a 64k beat-NN.mp3

(about -30 LUFS for English, -17 LUFS for French). Listen to every take: they vary,
so regenerate any with a garbled word or extra sounds at the end.
"""
import re
import sys

import torch
import torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

lang, text_path, out = sys.argv[1:4]
torch.manual_seed(7)
model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
text = open(text_path, encoding="utf-8").read().strip()
sentences = [s.strip() for s in re.split(r"(?<=[.。])\s*", text) if s.strip()]
pause = torch.zeros(1, int(model.sr * 0.35))
chunks = []
for s in sentences:
    chunks += [model.generate(s, language_id=lang), pause]
torchaudio.save(out, torch.cat(chunks, dim=-1), model.sr)
