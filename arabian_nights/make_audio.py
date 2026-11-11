"""Make the genie's voice, background music and lip-sync data.

Produces (next to this file):
    soundtrack.wav   voice + music mix used in the final video
    lipsync.json     per-frame mouth "open" / "wide" values read by film.py

Needs:  pip install piper-tts numpy   and   ffmpeg on your PATH.
Run:    python make_audio.py
        python make_audio.py --line "Your own dialogue here."
"""
import argparse, json, os, shutil, subprocess, sys, tarfile, urllib.request, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, SECONDS = 24, 13
LINE = ("Ahh... a thousand years in that lamp! Welcome, traveler, to the city of a thousand "
        "and one nights. Tonight... the stars themselves are yours. So tell me... what is your wish?")
VOICE_URL = "https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-ryan-high.tar.gz"

ap = argparse.ArgumentParser()
ap.add_argument("--line", default=LINE, help="what the genie says (keep it under ~10 s)")
ap.add_argument("--outdir", default=HERE)
args = ap.parse_args()
os.makedirs(args.outdir, exist_ok=True)
work = os.path.join(HERE, "audio_work"); os.makedirs(work, exist_ok=True)

if not shutil.which("ffmpeg"):
    sys.exit("ffmpeg not found - install it first (see README).")

# 1. voice model (downloaded once, ~100 MB)
model = os.path.join(work, "en-us-ryan-high.onnx")
if not os.path.exists(model):
    tgz = os.path.join(work, "voice.tar.gz")
    print("Downloading voice model...")
    urllib.request.urlretrieve(VOICE_URL, tgz)
    with tarfile.open(tgz) as t:
        t.extractall(work)

# 2. speak the line
raw = os.path.join(work, "raw.wav")
subprocess.run([sys.executable, "-m", "piper", "-m", model, "--length-scale", "1.12",
                "--sentence-silence", "0.25", "-f", raw], input=args.line.encode(), check=True)

# 3. make it sound like a genie: deeper, warmer, a little echo; starts after 1.1 s
voice = os.path.join(work, "voice.wav")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                "asetrate=22050*0.88,aresample=44100,atempo=1.08,bass=g=4,"
                "aecho=0.8:0.6:60|120:0.18|0.10,adelay=1100|1100,"
                f"apad=whole_dur={SECONDS}", "-t", str(SECONDS), "-ac", "1", "-ar", "44100", voice], check=True)

def read(p):
    w = wave.open(p)
    d = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return d, w.getframerate()
v, sr = read(voice)

# 4. lip-sync: loudness per video frame -> mouth open; brightness of sound -> mouth wide
hop, N = sr // FPS, SECONDS * FPS
opn, wide = [], []
for i in range(N):
    s = v[i * hop:(i + 1) * hop + hop // 2]
    if len(s) < 16:
        opn.append(0.0); wide.append(0.0); continue
    opn.append(float(np.sqrt(np.mean(s ** 2))))
    sp = np.abs(np.fft.rfft(s * np.hanning(len(s)))); fr = np.fft.rfftfreq(len(s), 1 / sr)
    wide.append(float(sp[fr > 2500].sum() / (sp.sum() + 1e-9)))
opn = np.array(opn); opn = np.clip(opn / np.percentile(opn[opn > 0.01], 90), 0, 1.2)
json.dump({"open": opn.round(3).tolist(), "wide": np.array(wide).round(3).tolist()},
          open(os.path.join(args.outdir, "lipsync.json"), "w"))

# 5. music: low drone + plucked melody in the Hijaz scale + soft frame drum
np.random.seed(1)
t = np.arange(SECONDS * sr) / sr
D = 146.83
music = 0.10 * (np.sin(2 * np.pi * D / 2 * t) + 0.5 * np.sin(2 * np.pi * D * 0.75 * t) + 0.3 * np.sin(2 * np.pi * D * t))
music *= np.minimum(1, t / 2) * (1 + 0.1 * np.sin(2 * np.pi * 0.2 * t))

def pluck(f, dur=1.6):  # Karplus-Strong plucked string
    n = int(sr / f); buf = np.random.uniform(-1, 1, n); out = np.zeros(int(dur * sr))
    for i in range(len(out)):
        out[i] = buf[i % n]; buf[i % n] = 0.996 * 0.5 * (buf[i % n] + buf[(i + 1) % n])
    return out

melody = [(0.3, 7), (0.9, 8), (1.5, 7), (2.1, 4), (2.7, 5), (3.3, 4), (3.9, 1), (4.5, 0), (6.5, 12), (7.1, 10),
          (7.7, 8), (8.3, 7), (9.5, 4), (10.1, 5), (10.7, 4), (11.3, 1), (11.9, 0)]
for start, semi in melody:
    p = pluck(D * 2 * 2 ** (semi / 12)); i = int(start * sr); e = min(len(music), i + len(p))
    music[i:e] += 0.22 * p[:e - i]
for k in np.arange(0.0, SECONDS, 0.6):
    i = int(k * sr); L = int(0.25 * sr); tt = np.arange(L) / sr
    hit = np.sin(2 * np.pi * 70 * tt * np.exp(-tt * 8)) * np.exp(-tt * 18) * (0.35 if round(k / 0.6) % 4 == 0 else 0.15)
    e = min(len(music), i + L); music[i:e] += hit[:e - i]
music *= np.minimum(1, (SECONDS - t) / 1.5)

# 6. mix and save
n = min(len(v), len(music))
mix = 0.95 * v[:n] + 0.35 * music[:n]
mix /= np.abs(mix).max() * 1.05
w = wave.open(os.path.join(args.outdir, "soundtrack.wav"), "w")
w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()

speech = [i for i, x in enumerate(opn) if x > 0.12]
print(f"Done. Speech runs from frame {speech[0]} to {speech[-1]} (of {N}).")
print("If you changed the line, adjust the gesture timing (CH list) in film.py to match.")
