"""Generate scene-timed narration and mix it into the existing 30-second trailer."""
import asyncio
import json
import subprocess
import sys
import wave
from pathlib import Path

TOOLS = Path('C:/Users/Aryl Ross A. Manalo/AppData/Local/Temp/cloudsent-trailer-tools')
sys.path.insert(0, str(TOOLS))
import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
CLIPS = ASSETS / 'narration-clips'
CLIPS.mkdir(exist_ok=True)
FFMPEG = next((TOOLS / 'imageio_ffmpeg' / 'binaries').glob('*.exe'))
VOICE = 'en-PH-RosaNeural'
SR = 48000
SCENES = [
    (0.65, 3.55, 'Some prayers are lighter together.', 'Some prayers are lighter together.'),
    (4.85, 2.90, 'Welcome to CloudSent.', 'Welcome to Cloud Sent.'),
    (8.35, 5.65, 'Write a prayer. Make it yours. Then send it for review.', 'Write a prayer. Make it yours. Then send it for review.'),
    (15.00, 5.85, 'Anonymous by default. Reviewed with care. Shared with our community.', 'Anonymous by default. Reviewed with care. Shared with our community.'),
    (21.90, 2.80, 'A shared moment across our school.', 'A shared moment across our school.'),
    (25.55, 4.00, 'CloudSent. Leave a little hope.', 'Cloud Sent. Leave a little hope.'),
]

def ffmpeg(*args):
    result = subprocess.run([str(FFMPEG), '-hide_banner', '-loglevel', 'error', *map(str, args)], capture_output=True, check=True)
    return result.stdout

def decode(file, channels=1):
    data = ffmpeg('-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', SR, '-ac', channels, 'pipe:1')
    values = np.frombuffer(data, dtype='<f4').copy()
    return values if channels == 1 else values.reshape(-1, channels)

def save_wav(file, values):
    pcm = (np.clip(values, -1, 1) * 32767).astype('<i2')
    with wave.open(str(file), 'wb') as output:
        output.setnchannels(1 if values.ndim == 1 else values.shape[1])
        output.setsampwidth(2)
        output.setframerate(SR)
        output.writeframes(pcm.tobytes())

def trim(values):
    active = np.flatnonzero(np.abs(values) > .0015)
    if not len(active):
        raise RuntimeError('The narration clip contains no speech.')
    return values[max(0, active[0] - int(SR * .12)):min(len(values), active[-1] + int(SR * .24))]

async def synthesize():
    gate = asyncio.Semaphore(2)
    async def one(index, scene):
        async with gate:
            destination = CLIPS / f'{index + 1:02d}.mp3'
            if not destination.exists() or destination.stat().st_size < 1000:
                speaker = edge_tts.Communicate(scene[3], VOICE, rate='-4%', pitch='-2Hz')
                await speaker.save(str(destination))
            print(f'Voice clip {index + 1} ready.', flush=True)
    await asyncio.gather(*(one(i, scene) for i, scene in enumerate(SCENES)))

def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02d}:{milliseconds // 60000 % 60:02d}:{milliseconds // 1000 % 60:02d},{milliseconds % 1000:03d}'

asyncio.run(synthesize())
narration = np.zeros(SR * 30, dtype=np.float32)
time = np.arange(SR * 30) / SR
music_gain = np.full(SR * 30, .30, dtype=np.float32)
subtitles = []
report = []
for i, (start, available, caption, _) in enumerate(SCENES):
    clip = trim(decode(CLIPS / f'{i + 1:02d}.mp3'))
    natural_duration = len(clip) / SR
    tempo = max(1, natural_duration / available)
    if tempo > 1.22:
        raise RuntimeError(f'Scene {i + 1} requires a shorter narration: {natural_duration:.2f}s available {available:.2f}s.')
    if tempo > 1:
        trimmed_file = CLIPS / f'{i + 1:02d}-trimmed.wav'
        save_wav(trimmed_file, clip)
        fitted_file = CLIPS / f'{i + 1:02d}-fitted.wav'
        ffmpeg('-y', '-i', trimmed_file, '-af', f'atempo={tempo * 1.015:.6f}', fitted_file)
        clip = trim(decode(fitted_file))
    if len(clip) > round(available * SR):
        raise RuntimeError(f'Scene {i + 1} would overrun its scene.')
    rms = float(np.sqrt(np.mean(clip ** 2)))
    peak = float(np.max(np.abs(clip)))
    clip *= min(.135 / max(rms, .0001), .82 / max(peak, .0001))
    fade = min(int(.012 * SR), len(clip) // 2)
    clip[:fade] *= np.linspace(0, 1, fade)
    clip[-fade:] *= np.linspace(1, 0, fade)
    offset = round(start * SR)
    narration[offset:offset + len(clip)] += clip
    end = start + len(clip) / SR
    attack = np.clip((time - start + .15) / .15, 0, 1)
    release = np.clip((end + .5 - time) / .5, 0, 1)
    duck = np.minimum(attack, release)
    duck = duck * duck * (3 - 2 * duck)
    music_gain = np.minimum(music_gain, .30 - .15 * duck)
    subtitles.append(f'{i + 1}\n{timestamp(start)} --> {timestamp(end)}\n{caption}\n')
    report.append({'scene': i + 1, 'start': start, 'end': round(end, 3), 'text': caption, 'tempo': round(tempo, 3)})
    print(f'Scene {i + 1}: {start:.2f}-{end:.2f}s (natural {natural_duration:.2f}s)', flush=True)

save_wav(ASSETS / 'narration.wav', narration)
music = decode(ASSETS / 'original-soundtrack.wav', 2)[:SR * 30]
if len(music) != len(narration):
    raise RuntimeError('Music length does not match the 30-second timeline.')
mixed = music * music_gain[:, None] + narration[:, None]
peak = float(np.max(np.abs(mixed)))
if peak > .94:
    mixed *= .94 / peak
save_wav(ASSETS / 'narrated-mix.wav', mixed)
(ROOT / 'cloudsent-trailer-narrated.srt').write_text('\n'.join(subtitles), encoding='utf-8')
(ASSETS / 'narration-timing.json').write_text(json.dumps({'voice': VOICE, 'sampleRate': SR, 'scenes': report}, indent=2), encoding='utf-8')
output = ROOT / 'cloudsent-trailer-30s-narrated.mp4'
ffmpeg('-y', '-i', ROOT / 'cloudsent-trailer-30s.mp4', '-i', ASSETS / 'narrated-mix.wav', '-i', ROOT / 'cloudsent-trailer-narrated.srt',
       '-map', '0:v:0', '-map', '1:a:0', '-map', '2:s:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text',
       '-metadata:s:a:0', 'language=eng', '-metadata:s:a:0', 'title=Narration and music',
       '-metadata:s:s:0', 'language=eng', '-metadata:s:s:0', 'title=English narration', '-disposition:s:0', '0',
       '-t', '30', '-movflags', '+faststart', '-metadata', 'title=CloudSent - Leave a little hope (narrated)', output)
print(f'Finished: {output}', flush=True)
