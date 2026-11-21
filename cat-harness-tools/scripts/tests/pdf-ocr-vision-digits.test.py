"""The optional vision fallback for unsure number words. Owner, 2026-11-15.

"B as a ack optional tool in case bad results": Tesseract's `fas` misreads
single digits on 10665-94830-per with no text layer to correct them, so
`pdf-ocr.py --vision-digits` (or IRIS_VISION_DIGITS=1) asks a vision model to
re-read the number words it is unsure of. The model is faked here: CI never
calls a remote model.

## What these tests hold

1. It is off unless asked for.
2. The misreads it exists for are corrected: page 65 "Annex 6" read "1.",
   page 30 "۳ سال" (3 years), pages 52/55 "فصل ۳" (chapter 3).
3. What Tesseract read right stays: page 5's "۴" (the model agrees) and
   page 15's "۲" (confidence 90, never asked).
4. A reading is kept only when sure: both crops agree, the model did not
   answer UNSURE, and it names as many digits as Tesseract read.
5. Only Arabic-script pages are touched, and a repeated word is replaced at
   its own place, not at its first occurrence.
6. A refusal or an API error leaves the word as read.
"""
import importlib.util
import os
import sys
import tempfile
import types

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)


def load(name: str):
    spec = importlib.util.spec_from_file_location("_t_" + name.replace("-", "_").replace(".py", ""), os.path.join(SCRIPTS, name))
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    rc = 0

    def check(what: str, ok: bool) -> None:
        nonlocal rc
        print(("  ok    " if ok else "  FAIL  ") + what)
        if not ok:
            rc = 1

    o = load("pdf-ocr.py")
    try:
        from PIL import Image
    except ModuleNotFoundError:
        # `typescript-test` runs `bun test` without `pip install -r requirements.txt`
        # (the `python` CI job installs Pillow and exercises the real PIL crop).
        class _FakeImg:
            def __init__(self, size=(1600, 2200)):
                self.width, self.height = size
            def __enter__(self):
                return self
            def __exit__(self, *a):
                pass
            def convert(self, _mode):
                return self
            def crop(self, box):
                return _FakeImg((max(1, box[2] - box[0]), max(1, box[3] - box[1])))
            def resize(self, size, _resample=None):
                return _FakeImg(size)
            def save(self, dst, format=None):
                data = b"\x89PNG\r\n\x1a\n"
                if hasattr(dst, "write"):
                    dst.write(data)
                else:
                    open(dst, "wb").write(data)

        class _FakeImageMod:
            LANCZOS = 1
            @staticmethod
            def new(_mode, size, _color=None):
                return _FakeImg(size)
            @staticmethod
            def open(_path):
                return _FakeImg()

        class _FakeDraw:
            def rectangle(self, *_a, **_kw):
                pass

        class _FakeImageDrawMod:
            @staticmethod
            def Draw(_im):
                return _FakeDraw()

        pil = types.ModuleType("PIL")
        pil.Image = _FakeImageMod
        pil.ImageDraw = _FakeImageDrawMod
        sys.modules["PIL"] = pil
        Image = _FakeImageMod
    tmp = tempfile.mkdtemp()
    png = os.path.join(tmp, "page.png")
    Image.new("RGB", (1600, 2200), "white").save(png)

    def fake(*answers):
        calls = []

        def ask(images, prompt):
            calls.append(images)
            check("each ask sends one PNG crop", len(images) == 1 and images[0][:8] == b"\x89PNG\r\n\x1a\n")
            return answers[min(len(calls) - 1, len(answers) - 1)]
        return ask, calls

    def word(text, conf, box=(1259, 220, 36, 39)):
        return {"text": text, "conf": conf, "box": box, "line": (1, 1, 1)}

    # 1. Off by default.
    saved = os.environ.pop(o.VISION_ENV, None)
    check("off with no flag and no IRIS_VISION_DIGITS", not o.vision_enabled())
    check("on with --vision-digits", o.vision_enabled(True))
    os.environ[o.VISION_ENV] = "1"
    check("on with IRIS_VISION_DIGITS=1", o.vision_enabled())
    os.environ[o.VISION_ENV] = "0"
    check("off with IRIS_VISION_DIGITS=0", not o.vision_enabled())
    os.environ.pop(o.VISION_ENV, None)
    if saved is not None:
        os.environ[o.VISION_ENV] = saved

    # 2. The misreads it exists for.
    ask, _ = fake("6 EASTERN")
    txt, log = o.vision_digits(png, "ضمیمه 1.\nبرنامه", "fas", [word("1.", 38)], ask)
    check("p65: 'ضمیمه 1.' becomes 'ضمیمه ۶.' (Annex 6, Persian six)", txt == "ضمیمه ۶.\nبرنامه")
    check("p65: the change is logged with the OCR and the reading",
          log == [{"box": [1259, 220, 36, 39], "confidence": 38, "ocr": "1.", "read": "۶."}])
    ask, _ = fake("3 EASTERN")
    txt, _ = o.vision_digits(png, "تا ۲ سال", "fas", [word("۲", 71)], ask)
    check("p30: '۲ سال' becomes '۳ سال'", txt == "تا ۳ سال")
    ask, _ = fake("3 EASTERN")
    txt, _ = o.vision_digits(png, "فصل ۲", "fas", [word("۲", 54)], ask)
    check("p52/55: 'فصل ۲' becomes 'فصل ۳'", txt == "فصل ۳")
    ask, _ = fake("6 EASTERN")
    txt, _ = o.vision_digits(png, "الملحق 1", "ara", [word("1", 40)], ask)
    check("an Arabic page takes the Arabic-Indic six", txt == "الملحق ٦")
    ask, _ = fake("1925 WESTERN")
    txt, _ = o.vision_digits(png, "(0-1028)", "fas", [word("(0-1028)", 20)], ask)
    check("a range is not a run of digits and is not asked about", txt == "(0-1028)")
    ask, _ = fake("1925 WESTERN")
    txt, _ = o.vision_digits(png, "سال 1928", "fas", [word("1928", 30)], ask)
    check("a Western-digit year stays Western", txt == "سال 1925")

    # 3. What Tesseract read right stays.
    ask, _ = fake("4 EASTERN")
    txt, log = o.vision_digits(png, "بخش ۴", "fas", [word("۴", 42)], ask)
    check("p5: '۴' stays when the model reads 4", txt == "بخش ۴" and log == [])
    ask, calls = fake("7 EASTERN")
    txt, _ = o.vision_digits(png, "مرحله ۲", "fas", [word("۲", 90)], ask)
    check("p15: '۲' at confidence 90 stays and is never asked", txt == "مرحله ۲" and calls == [])

    # 4. Only a sure reading is kept.
    ask, _ = fake("6 EASTERN", "8 EASTERN")
    txt, _ = o.vision_digits(png, "ضمیمه 1.", "fas", [word("1.", 38)], ask)
    check("two crops that disagree leave the word", txt == "ضمیمه 1.")
    ask, _ = fake("UNSURE")
    txt, _ = o.vision_digits(png, "ضمیمه 1.", "fas", [word("1.", 38)], ask)
    check("UNSURE leaves the word", txt == "ضمیمه 1.")
    ask, _ = fake("16 EASTERN")
    txt, _ = o.vision_digits(png, "ضمیمه 1.", "fas", [word("1.", 38)], ask)
    check("a reading with another digit count leaves the word", txt == "ضمیمه 1.")
    ask, _ = fake("Annex 6")
    txt, _ = o.vision_digits(png, "ضمیمه 1.", "fas", [word("1.", 38)], ask)
    check("an answer that is not digits and a family leaves the word", txt == "ضمیمه 1.")

    # 5. Arabic-script pages only; a repeated word is replaced in its place.
    ask, calls = fake("6 WESTERN")
    txt, _ = o.vision_digits(png, "Annex 1.", "eng", [word("1.", 38)], ask)
    check("a Latin page is never asked about", txt == "Annex 1." and calls == [])
    ask, _ = fake("3 EASTERN")
    txt, _ = o.vision_digits(png, "بند ۲ و فصل ۲", "fas", [word("۲", 95), word("۲", 50)], ask)
    check("the second '۲' is replaced, not the first", txt == "بند ۲ و فصل ۳")
    ask, calls = fake("3 EASTERN")
    txt, _ = o.vision_digits(png, "۲ و ۲ و ۲", "fas", [word("۲", 95), word("۲", 50)], ask)
    check("a word the text holds more often than the OCR's words is left", txt == "۲ و ۲ و ۲" and calls == [])
    check("Persian pages take ۰-۹, Arabic pages ٠-٩",
          o.eastern_family("fas") == o.DIGIT_FAMILIES[2] and o.eastern_family("ara+eng") == o.DIGIT_FAMILIES[1])

    # 6. The API wrapper: a refusal or an error is UNSURE.
    class APIError(Exception):
        pass

    class Block:
        def __init__(self, text):
            self.type, self.text = "text", text

    class Msg:
        def __init__(self, stop, text):
            self.stop_reason, self.content = stop, [Block(text)]

    sent = []
    replies = [Msg("end_turn", "6 EASTERN"), Msg("refusal", "6 EASTERN"), APIError("boom")]

    class Messages:
        def create(self, **kw):
            sent.append(kw)
            r = replies.pop(0)
            if isinstance(r, Exception):
                raise r
            return r

    class Anthropic:
        def __init__(self):
            self.messages = Messages()

    fake_sdk = types.ModuleType("anthropic")
    fake_sdk.Anthropic, fake_sdk.APIError = Anthropic, APIError
    real = sys.modules.get("anthropic")
    sys.modules["anthropic"] = fake_sdk
    try:
        ask = o.anthropic_ask("a-model")
        check("an answer comes back as its text", ask([b"\x89PNG"], "p") == "6 EASTERN")
        check("the request names the configured model and carries the image first",
              sent[0]["model"] == "a-model" and sent[0]["messages"][0]["content"][0]["type"] == "image")
        check("a refusal is UNSURE", ask([b"\x89PNG"], "p") == "UNSURE")
        check("an API error is UNSURE", ask([b"\x89PNG"], "p") == "UNSURE")
    finally:
        if real is not None:
            sys.modules["anthropic"] = real
        else:
            sys.modules.pop("anthropic", None)

    print("all checks passed" if rc == 0 else "SOME CHECKS FAILED")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
