# Arabian Nights — Talking Genie (Blender)

A 13-second, 1080p animated short made entirely with code: a genie rises from a
brass lamp in front of a moonlit palace and talks to you, with lip-sync, gestures
and facial expressions, plus voice and music.

The finished video is **`genie_arabian_nights.mp4`**.

Everything — the palace, desert, sky, genie, animation, camera and lights — is
built by Python scripts that drive Blender. There are no downloaded 3D models.

---

## What's in this folder

| File | What it does |
|---|---|
| `scene.py` | Builds the world: desert dunes, palace with onion domes and minarets, moon, starry sky, lanterns, flying carpet. |
| `film.py` | Loads `scene.py`, then adds the genie and lamp, animates everything frame by frame, sets up the camera and character lights, and renders. |
| `make_audio.py` | Creates the genie's voice (text-to-speech), the background music and `lipsync.json` (how far the mouth opens on each frame). |
| `soundtrack.wav`, `lipsync.json` | Ready-made outputs of `make_audio.py`. You can skip step 3 below if you keep the same dialogue. |
| `genie_arabian_nights.mp4` | The final video. |
| `arabian_nights.blend` | The complete scene, ready to open in Blender (double-click it). Press **Space** to play. |

---

## How it was made (overview)

1. **World (`scene.py`)**: simple shapes (spheres, boxes, spun profiles) are
   combined into the palace. The dunes are a big plane pushed up and down with
   noise. The night sky, stars and moon are shaders (procedural materials).
2. **Genie (`film.py`)**:
   - **Body**: built from smooth spheres and spun shapes. The vest is painted
     on with a shader.
   - **Face**: eyes, lids, eyebrows, mustache, mouth and turban are separate
     pieces attached to a "head" control.
   - **Arms**: bendy tubes ("rubber hose" style) that follow curve points.
   - **Lower body**: a smoke tail that flows down into the lamp.
3. **Animation**: no hand keyframing. The script has a list of poses (arms up,
   hand on heart, point at camera…) with frame numbers, and blends smoothly
   between them. Wrists lag slightly behind elbows for a more natural motion.
   Blinks, eye direction, eyebrows and smile have their own timelines.
4. **Lip-sync**: `make_audio.py` measures how loud the voice is on each video
   frame and writes it to `lipsync.json`. `film.py` opens the mouth by that
   amount, and widens it on "ee/s" sounds.
5. **Voice**: [Piper](https://github.com/rhasspy/piper) text-to-speech (free,
   offline). The voice is lowered, warmed up and given a little echo with ffmpeg.
6. **Music**: generated with math in `make_audio.py`: a low drone, a
   plucked-string melody in the Middle-Eastern *Hijaz* scale, and a soft drum.
7. **Rendering**: Blender's **Cycles** renderer with denoising, motion blur
   and depth of field. Frames are saved as PNGs, then **ffmpeg** joins them
   with the audio into an MP4.

---

## Recreate it on your PC

### 1. Install the tools (one time)

- **Blender 5.x**: https://www.blender.org/download/
  (made with Blender 5.3; it uses Blender 5 features, so older versions may not work)
- **Python 3.10+**: https://www.python.org/downloads/ (Windows: tick
  *"Add Python to PATH"* during install). Only needed for the voice and music.
- **ffmpeg**: needed for the audio and to make the MP4.
  - Windows: `winget install ffmpeg`
  - Mac: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

### 2. Get the files

Clone or download this repo, and open a terminal (Windows: *PowerShell*) inside
the `arabian_nights` folder:

```
git clone https://github.com/gattito-blade/test.git
cd test/arabian_nights
git checkout claude/amazing-clarke-kr0j2e
```

### 3. (Optional) Make the voice + music

Skip this if you're happy with the existing `soundtrack.wav`. Run it to change
what the genie says.

```
pip install piper-tts numpy
python make_audio.py
```

To change the dialogue:

```
python make_audio.py --line "Greetings! I am the genie of the golden lamp."
```

> If you change the line, its timing changes. Open `film.py`, find the `CH = [`
> list (the gesture choreography), and shift the frame numbers to match where
> your phrases start. The script prints the frames where speech begins and ends.
> There are 24 frames per second.

### 4. Render the frames with Blender

Find where Blender is installed. Typical paths:

- Windows: `"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe"`
- Mac: `/Applications/Blender.app/Contents/MacOS/Blender`
- Linux: `blender`

**Quick test (one low-res frame, takes seconds):**

```
blender -b -P film.py -- --frames 150 150 --samples 8 --res 50 --gpu
```

Look at `frames/0150.png`.

**Full render (all 312 frames):**

```
blender -b -P film.py -- --frames 1 312 --samples 32 --res 100 --gpu
```

Options (everything after the lone `--`):

| Option | Meaning |
|---|---|
| `--frames A B` | Which frames to render (1–312). |
| `--samples N` | Quality. 16 = good, 32–64 = cleaner, slower. |
| `--res P` | Resolution percent of 1920×1080 (100 = full HD). |
| `--gpu` | Use your graphics card. Much faster than the CPU. Without a supported GPU it falls back to the CPU. |
| `--out DIR/` | Where frames go (default: `frames/`). |

**How long?** The original was rendered on a 4-core cloud CPU at 80% resolution
and 16 samples, about 30 s per frame (~3 hours total). A modern NVIDIA/AMD GPU
or Apple Silicon Mac is typically several times faster.

You can stop and resume: just render the missing range, e.g. `--frames 200 312`.

### 5. Make the video

```
ffmpeg -y -framerate 24 -i frames/%04d.png -i soundtrack.wav -vf "scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 16 -c:a aac -b:a 192k -shortest my_genie.mp4
```

### Open it in Blender's window to explore / tweak

**Easiest:** just double-click `arabian_nights.blend` (included). To regenerate it after editing the scripts:

To browse the scene in the normal Blender interface instead of only rendering:

```
SAVE_BLEND=1 blender -b -P film.py -- --frames 1 1 --samples 1 --res 10
```

(Windows PowerShell: `$env:SAVE_BLEND=1; blender -b -P film.py -- --frames 1 1 --samples 1 --res 10`)

That writes `arabian_nights.blend`. Open it in Blender and press **Space** to
play the animation. You can move lights, change colors and so on, then render
from the GUI (**Render → Render Animation**).

---

## Easy things to change

All in `film.py` unless noted:

- **Genie skin color**: `SKIN_C = (0.20, 0.05, 0.42)` (red, green, blue, 0–1).
- **Vest color**: in `body_build`, `vest.inputs["Base Color"]`.
- **Gestures**: the `POSES` dictionary (elbow/wrist positions) and the `CH`
  timeline (which pose at which frame).
- **Expressions**: the `brow`, `lid_open`, `smile`, `eye_look` timelines and `BLINKS`.
- **Camera**: `cam_tr` (camera path) and `aim_tr` (what it looks at); lens `cam.data.lens`.
- **Palace / sky / desert**: `scene.py`.

## Troubleshooting

- **`blender` is not recognized**: use the full path to `blender.exe` shown in step 4.
- **Errors mentioning a node input or `Subsurface Weight`**: your Blender is too
  old. Install Blender 5.x.
- **Render is very slow**: add `--gpu`, lower `--samples` to 16 and `--res` to 50 for drafts.
- **`piper` voice download fails**: download
  `voice-en-us-ryan-high.tar.gz` from the Piper GitHub releases (v0.0.2) and
  unpack it into an `audio_work` folder inside `arabian_nights`.
