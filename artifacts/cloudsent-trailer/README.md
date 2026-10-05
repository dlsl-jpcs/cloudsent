# CloudSent trailer

The narrated video is `cloudsent-trailer-30s-narrated.mp4`: 30 seconds, 1920 × 1080, 30 fps, H.264 video and stereo AAC audio. The original music-only version is also preserved as `cloudsent-trailer-30s.mp4`. The closing QR code opens https://cloudsent.vercel.app/.

The trailer uses the supplied JPCS DLSL organization logo, CloudSent's Spectral and Atkinson Hyperlegible fonts, its blue palette, and fictional sample prayers. The prayer form and school display are animated illustrations of the product. The instrumental music was synthesized specifically for this trailer. The narrated version uses the synthetic English (Philippines) Rosa voice, timed to each scene, with the music lowered underneath speech. Optional English captions are included in the MP4 and provided as a separate SRT file.

## Timeline

| Time | Scene |
| --- | --- |
| 0:00–0:04.5 | “Some prayers are lighter together.” |
| 0:04.5–0:08 | CloudSent introduction |
| 0:08–0:14.5 | Write, personalize, and send a prayer for review |
| 0:14.5–0:21.5 | The drifting prayer wall; anonymity and review |
| 0:21.5–0:25 | The school display and QR invitation |
| 0:25–0:30 | JPCS DLSL credit, website address, and scannable QR code |

## Included files

- `cloudsent-trailer-30s-narrated.mp4` — finished video with narration and music
- `cloudsent-trailer-narrated.srt` — English narration captions
- `cloudsent-trailer-30s.mp4` — original music-only video
- `cloudsent-trailer-poster.png` — closing-card poster
- `assets/jpcs-dlsl-logo.png` — supplied logo, copied unchanged
- `assets/original-soundtrack.wav` — original instrumental soundtrack
- `assets/narration.wav` — isolated, timed narration
- `assets/narrated-mix.wav` — narration and music mix
- `assets/narration-timing.json` — exact narration timing and voice information
- `assets/website-qr.svg` — website QR code
- `preview/` — visual review frames and storyboard
- `render.mjs` — editable renderer
- `narrate.py` — narration generation and mixing script

The renderer uses the local bundled `@napi-rs/canvas` runtime, the project's React/QR/font dependencies, and a temporary FFmpeg executable. These locations are declared at the top of `render.mjs` and can be changed for another machine. Run `node artifacts/cloudsent-trailer/render.mjs --preview` to regenerate the poster and review frames, or omit `--preview` to render the complete video.

After rendering the music-only video, run `narrate.py` with the bundled Python runtime to rebuild the narrated version. It uses temporary `edge-tts` and NumPy dependencies plus FFmpeg; existing voice clips are reused. The video stream is copied without re-encoding, preserving the original artwork and QR code.
