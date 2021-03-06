// Based on https://github.com/chr15m/jsfxr

import {PI, floatToNumber, numberToFloat, abs, sin, sqr, exp, cube, pow, floor} from './math';
import {random, int, range} from './random';

// Wave shapes
let SQUARE = 0;
let SAWTOOTH = 1;
let SINE = 2;
let NOISE = 3;

// Playback volume
let masterVolume = 0.1;

let OVERSAMPLING = 8;

// export parameter list to URL friendly base58 string
// https://gist.github.com/diafygi/90a3e80ca1c2793220e5/
let b58alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
                  //"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
// new Array(74).fill(1).map((_,i)=>String.fromCharCode(49+i)).join('').replace(/[^\w\s]|_|l|I|O/g, "")
let b58alphabet2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let params_order = b58alphabet2.split('');
// A = "wave_type",
// B = "p_env_attack",
// C = "p_env_sustain",
// D = "p_env_punch",
// E = "p_env_decay",
// F = "p_base_freq",
// G = "p_freq_limit",
// H = "p_freq_ramp",
// I = "p_freq_dramp",
// J = "p_vib_strength",
// K = "p_vib_speed",
// L = "p_arp_mod",
// M = "p_arp_speed",
// N = "p_duty",
// O = "p_duty_ramp",
// P = "p_repeat_speed",
// Q = "p_pha_offset",
// R = "p_pha_ramp",
// S = "p_lpf_freq",
// T = "p_lpf_ramp",
// U = "p_lpf_resonance",
// V = "p_hpf_freq",
// X = "p_hpf_ramp"

function SoundEffect(ps) {
  let decoded = function(S,A){let d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)}(ps,b58alphabet);
  let struct = {};
  for (let pi in params_order) {
    let p = params_order[pi];
    let offset = (pi - 1) * 4 + 1;
    if (p === 'A') {
      struct[p] = decoded[0];
    } else {
      let val = (decoded[offset] | (decoded[offset + 1] << 8) | (decoded[offset + 2] << 16) | (decoded[offset + 3] << 24));
      struct[p] = numberToFloat(val);
    }
  }
  ps = {};
  for (let p in struct) {
    if (struct.hasOwnProperty(p)) {
      ps[p] = struct[p];
    }
  }
  let parameters = ps;

  let elapsedSinceRepeat, period, periodMax, enableFrequencyCutoff, periodMult,
    periodMultSlide, dutyCycle, dutyCycleSlide, arpeggioMultiplier, arpeggioTime;

  function initForRepeat() {
    elapsedSinceRepeat = 0;

    period = 100 / (ps.F * ps.F + 0.001);
    periodMax = 100 / (ps.G * ps.G + 0.001);
    enableFrequencyCutoff = (ps.G > 0);
    periodMult = 1 - pow(ps.H, 3) * 0.01;
    periodMultSlide = -pow(ps.I, 3) * 0.000001;

    dutyCycle = 0.5 - ps.N * 0.5;
    dutyCycleSlide = -ps.O * 0.00005;

    if (ps.L >= 0)
      arpeggioMultiplier = 1 - pow(ps.L, 2) * .9;
    else
      arpeggioMultiplier = 1 + pow(ps.L, 2) * 10;
    arpeggioTime = floor(pow(1 - ps.M, 2) * 20000 + 32);
    if (ps.M === 1)
      arpeggioTime = 0;
  }

  initForRepeat();  // First time through, this is a bit of a misnomer

  // Waveform shape
  let waveShape = parseInt(ps.A);

  // Filter
  let fltw = pow(ps.S, 3) * 0.1;
  let enableLowPassFilter = (ps.S != 1);
  let fltw_d = 1 + ps.T * 0.0001;
  let fltdmp = 5 / (1 + pow(ps.U, 2) * 20) * (0.01 + fltw);
  if (fltdmp > 0.8) fltdmp = 0.8;
  let flthp = pow(ps.V, 2) * 0.1;
  let flthp_d = 1 + ps.X * 0.0003;

  // Vibrato
  let vibratoSpeed = pow(ps.K, 2) * 0.01;
  let vibratoAmplitude = ps.J * 0.5;

  // Envelope
  let envelopeLength = [
    floor(ps.B * ps.B * 100000),
    floor(ps.C * ps.C * 100000),
    floor(ps.E * ps.E * 100000)
  ];
  let envelopePunch = ps.D;

  // Flanger
  let flangerOffset = pow(ps.Q, 2) * 1020;
  if (ps.Q < 0) flangerOffset = -flangerOffset;
  let flangerOffsetSlide = pow(ps.R, 2) * 1;
  if (ps.R < 0) flangerOffsetSlide = -flangerOffsetSlide;

  // Repeat
  let repeatTime = floor(pow(1 - ps.P, 2) * 20000 + 32);
  if (ps.P === 0) repeatTime = 0;

  let gain = exp(ps.sound_vol || 0.5) - 1;

  let sampleRate = 44100;
  let bitsPerChannel = 8;

  let fltp = 0;
  let fltdp = 0;
  let fltphp = 0;

  let noise_buffer = Array(32);
  for (let i = 0; i < 32; ++i)
    noise_buffer[i] = range(1,2);

  let envelopeStage = 0;
  let envelopeElapsed = 0;

  let vibratoPhase = 0;

  let phase = 0;
  let ipp = 0;
  let flanger_buffer = Array(1024);
  for (let i = 0; i < 1024; ++i)
    flanger_buffer[i] = 0;

  let num_clipped = 0;

  let buffer = [];

  let sample_sum = 0;
  let num_summed = 0;
  let summands = floor(44100 / sampleRate);

  for(let t = 0; ; ++t) {

    // Repeats
    if (repeatTime != 0 && ++elapsedSinceRepeat >= repeatTime)
      initForRepeat();

    // Arpeggio (single)
    if(arpeggioTime != 0 && t >= arpeggioTime) {
      arpeggioTime = 0;
      period *= arpeggioMultiplier;
    }

    // Frequency slide, and frequency slide slide!
    periodMult += periodMultSlide;
    period *= periodMult;
    if(period > periodMax) {
      period = periodMax;
      if (enableFrequencyCutoff)
        break;
    }

    // Vibrato
    let rfperiod = period;
    if (vibratoAmplitude > 0) {
      vibratoPhase += vibratoSpeed;
      rfperiod = period * (1 + sin(vibratoPhase) * vibratoAmplitude);
    }
    let iperiod = floor(rfperiod);
    if (iperiod < OVERSAMPLING) iperiod = OVERSAMPLING;

    // Square wave duty cycle
    dutyCycle += dutyCycleSlide;
    if (dutyCycle < 0) dutyCycle = 0;
    if (dutyCycle > 0.5) dutyCycle = 0.5;

    // Volume envelope
    if (++envelopeElapsed > envelopeLength[envelopeStage]) {
      envelopeElapsed = 0;
      if (++envelopeStage > 2)
        break;
    }
    let env_vol;
    let envf = envelopeElapsed / envelopeLength[envelopeStage];
    if (envelopeStage === 0) {         // Attack
      env_vol = envf;
    } else if (envelopeStage === 1) {  // Sustain
      env_vol = 1 + (1 - envf) * 2 * envelopePunch;
    } else {                           // Decay
      env_vol = 1 - envf;
    }

    // Flanger step
    flangerOffset += flangerOffsetSlide;
    let iphase = abs(floor(flangerOffset));
    if (iphase > 1023) iphase = 1023;

    if (flthp_d != 0) {
      flthp *= flthp_d;
      if (flthp < 0.00001)
        flthp = 0.00001;
      if (flthp > 0.1)
        flthp = 0.1;
    }

    // 8x oversampling
    let sample = 0;
    for (let si = 0; si < OVERSAMPLING; ++si) {
      let sub_sample = 0;
      phase++;
      if (phase >= iperiod) {
        phase %= iperiod;
        if (waveShape === NOISE)
          for(let i = 0; i < 32; ++i)
            noise_buffer[i] = range(1,2);
      }

      // Base waveform
      let fp = phase / iperiod;
      if (waveShape === SQUARE) {
        if (fp < dutyCycle)
          sub_sample=0.5;
        else
          sub_sample=-0.5;
      } else if (waveShape === SAWTOOTH) {
        if (fp < dutyCycle)
          sub_sample = -1 + 2 * fp/dutyCycle;
        else
          sub_sample = 1 - 2 * (fp-dutyCycle)/(1-dutyCycle);
      } else if (waveShape === SINE) {
        sub_sample = sin(fp * 2 * PI);
      } else if (waveShape === NOISE) {
        sub_sample = noise_buffer[floor(phase * 32 / iperiod)];
      }
      //  else {
      //   throw "ERROR: Bad wave type: " + waveShape;
      // }

      // Low-pass filter
      let pp = fltp;
      fltw *= fltw_d;
      if (fltw < 0) fltw = 0;
      if (fltw > 0.1) fltw = 0.1;
      if (enableLowPassFilter) {
        fltdp += (sub_sample - fltp) * fltw;
        fltdp -= fltdp * fltdmp;
      } else {
        fltp = sub_sample;
        fltdp = 0;
      }
      fltp += fltdp;

      // High-pass filter
      fltphp += fltp - pp;
      fltphp -= fltphp * flthp;
      sub_sample = fltphp;

      // Flanger
      flanger_buffer[ipp & 1023] = sub_sample;
      sub_sample += flanger_buffer[(ipp - iphase + 1024) & 1023];
      ipp = (ipp + 1) & 1023;

      // final accumulation and envelope application
      sample += sub_sample * env_vol;
    }

    // Accumulate samples appropriately for sample rate
    sample_sum += sample;
    if (++num_summed >= summands) {
      num_summed = 0;
      sample = sample_sum / summands;
      sample_sum = 0;
    } else {
      continue;
    }

    sample = sample / OVERSAMPLING * masterVolume;
    sample *= gain;

    if (bitsPerChannel === 8) {
      // Rescale [-1, 1) to [0, 256)
      sample = floor((sample + 1) * 128);
      if (sample > 255) {
        sample = 255;
        ++num_clipped;
      } else if (sample < 0) {
        sample = 0;
        ++num_clipped;
      }
      buffer.push(sample);
    } else {
      // Rescale [-1, 1) to [-32768, 32768)
      sample = floor(sample * (1<<15));
      if (sample >= (1<<15)) {
        sample = (1 << 15)-1;
        ++num_clipped;
      } else if (sample < -(1<<15)) {
        sample = -(1 << 15);
        ++num_clipped;
      }
      buffer.push(sample & 0xFF);
      buffer.push((sample >> 8) & 0xFF);
    }
  }

  let rendered_clipped = num_clipped;

  let wave = {};
  wave.data = [];        // Byte array containing audio samples
  wave.wav = [];         // Array containing the generated wave file
  wave.dataURI = '';     // http://en.wikipedia.org/wiki/Data_URI_scheme

  let _chunkId = [0x52,0x49,0x46,0x46], // 0    4    "RIFF" = 0x52494646
    _chunkSize = 0,                     // 4    4    36+SubChunk2Size = 4+(8+SubChunk1Size)+(8+SubChunk2Size)
    _format = [0x57,0x41,0x56,0x45], // 8    4    "WAVE" = 0x57415645
    _subChunk1Id = [0x66,0x6d,0x74,0x20], // 12   4    "fmt " = 0x666d7420
    _subChunk1Size = 16,                    // 16   4    16 for PCM
    _audioFormat = 1,                     // 20   2    PCM = 1
    _numChannels = 1,                     // 22   2    Mono = 1, Stereo = 2, etc.
    _sampleRate = 8000,                  // 24   4    8000, 44100, etc
    _byteRate = 0,                     // 28   4    SampleRate*NumChannels*BitsPerSample/8
    _blockAlign = 0,                     // 32   2    NumChannels*BitsPerSample/8
    _bitsPerSample = 8,                     // 34   2    8 bits = 8, 16 bits = 16, etc...
    _subChunk2Id = [0x64,0x61,0x74,0x61], // 36   4    "data" = 0x64617461
    _subChunk2Size = 0;                      // 40   4    data size = NumSamples*NumChannels*BitsPerSample/8

  function u32ToArray(i) { return [i&0xFF, (i>>8)&0xFF, (i>>16)&0xFF, (i>>24)&0xFF]; }

  function u16ToArray(i) { return [i&0xFF, (i>>8)&0xFF]; }

  wave.Make = function(data) {
    // if (data instanceof Array) wave.data = data;
    _byteRate = (_sampleRate * _numChannels * _bitsPerSample) >> 3;
    _blockAlign = (_numChannels * _bitsPerSample) >> 3;
    _subChunk2Size = wave.data.length;
    _chunkSize = 36 + _subChunk2Size;

    wave.wav = _chunkId.concat(
      u32ToArray(_chunkSize),
      _format,
      _subChunk1Id,
      u32ToArray(_subChunk1Size),
      u16ToArray(_audioFormat),
      u16ToArray(_numChannels),
      u32ToArray(_sampleRate),
      u32ToArray(_byteRate),
      u16ToArray(_blockAlign),
      u16ToArray(_bitsPerSample),
      _subChunk2Id,
      u32ToArray(_subChunk2Size),
      wave.data
    );
    wave.dataURI = 'data:audio/wav;base64,'+btoa(wave.wav);
  };

  let normalized = new Float32Array(buffer.length);
  for (let b=0; b<buffer.length; b++) {
    normalized[b] = 2 * buffer[b] / pow(2, bitsPerChannel) - 1;
  }
  _sampleRate = sampleRate;
  _bitsPerSample = bitsPerChannel;
  wave.Make(normalized);
  wave.clipping = num_clipped;
  wave.buffer = normalized;

  // check for procedural audio
  let actx = null;
  if ('AudioContext' in window) {
    actx = new AudioContext();
  } else if ('webkitAudioContext' in window) {
    actx = new webkitAudioContext();
  }

  if (actx) {
    let buff = actx.createBuffer(1, wave.buffer.length, _sampleRate);
    let nowBuffering = buff.getChannelData(0);
    for (let i=0;i<wave.buffer.length;i++) {
      nowBuffering[i] = wave.buffer[i];
    }
    return {
      channels: [],
      play: function() {
        let proc = actx.createBufferSource();
        proc.buffer = buff;
        proc.connect(actx.destination);
        if ('AudioContext' in window) {
          proc.start();
        } else if ('webkitAudioContext' in window) {
          proc.noteOn(0);
        }
        this.channels.push(proc);
      }
    };
  } else {
    let audio = new Audio();
    audio.src = wave.dataURI;
    return audio;
  }
}

export default SoundEffect;
