// Based on https://github.com/chr15m/jsfxr

import {PI, floatToNumber, numberToFloat, abs, sin, sqr, exp, cube, pow, floor} from './math';
import {random, int, range} from './random';

let RIFFWAVE = function(data) {

  this.data = [];        // Byte array containing audio samples
  this.wav = [];         // Array containing the generated wave file
  this.dataURI = '';     // http://en.wikipedia.org/wiki/Data_URI_scheme

  this.header = {                         // OFFS SIZE NOTES
    chunkId      : [0x52,0x49,0x46,0x46], // 0    4    "RIFF" = 0x52494646
    chunkSize    : 0,                     // 4    4    36+SubChunk2Size = 4+(8+SubChunk1Size)+(8+SubChunk2Size)
    format       : [0x57,0x41,0x56,0x45], // 8    4    "WAVE" = 0x57415645
    subChunk1Id  : [0x66,0x6d,0x74,0x20], // 12   4    "fmt " = 0x666d7420
    subChunk1Size: 16,                    // 16   4    16 for PCM
    audioFormat  : 1,                     // 20   2    PCM = 1
    numChannels  : 1,                     // 22   2    Mono = 1, Stereo = 2, etc.
    sampleRate   : 8000,                  // 24   4    8000, 44100, etc
    byteRate     : 0,                     // 28   4    SampleRate*NumChannels*BitsPerSample/8
    blockAlign   : 0,                     // 32   2    NumChannels*BitsPerSample/8
    bitsPerSample: 8,                     // 34   2    8 bits = 8, 16 bits = 16, etc...
    subChunk2Id  : [0x64,0x61,0x74,0x61], // 36   4    "data" = 0x64617461
    subChunk2Size: 0                      // 40   4    data size = NumSamples*NumChannels*BitsPerSample/8
  };

  function u32ToArray(i) { return [i&0xFF, (i>>8)&0xFF, (i>>16)&0xFF, (i>>24)&0xFF]; }

  function u16ToArray(i) { return [i&0xFF, (i>>8)&0xFF]; }

  this.Make = function(data) {
    if (data instanceof Array) this.data = data;
    this.header.byteRate = (this.header.sampleRate * this.header.numChannels * this.header.bitsPerSample) >> 3;
    this.header.blockAlign = (this.header.numChannels * this.header.bitsPerSample) >> 3;
    this.header.subChunk2Size = this.data.length;
    this.header.chunkSize = 36 + this.header.subChunk2Size;

    this.wav = this.header.chunkId.concat(
      u32ToArray(this.header.chunkSize),
      this.header.format,
      this.header.subChunk1Id,
      u32ToArray(this.header.subChunk1Size),
      u16ToArray(this.header.audioFormat),
      u16ToArray(this.header.numChannels),
      u32ToArray(this.header.sampleRate),
      u32ToArray(this.header.byteRate),
      u16ToArray(this.header.blockAlign),
      u16ToArray(this.header.bitsPerSample),
      this.header.subChunk2Id,
      u32ToArray(this.header.subChunk2Size),
      this.data
    );
    this.dataURI = 'data:audio/wav;base64,'+btoa(this.wav);
  };

  if (data instanceof Array) this.Make(data);

}; // end RIFFWAVE


// Wave shapes
let SQUARE = 0;
let SAWTOOTH = 1;
let SINE = 2;
let NOISE = 3;

// Playback volume
let masterVolume = 1;

let OVERSAMPLING = 8;

/*** Core data structure ***/

// Sound generation parameters are on [0,1] unless noted SIGNED & thus
// on [-1,1]
function Params() {
  this.oldParams = true;  // Note what structure this is

  // Wave shape
  this.wave_type = SQUARE;

  // Envelope
  this.p_env_attack = 0;   // Attack time
  this.p_env_sustain = 0.3;  // Sustain time
  this.p_env_punch = 0;    // Sustain punch
  this.p_env_decay = 0.4;    // Decay time

  // Tone
  this.p_base_freq = 0.3;    // Start frequency
  this.p_freq_limit = 0;   // Min frequency cutoff
  this.p_freq_ramp = 0;    // Slide (SIGNED)
  this.p_freq_dramp = 0;   // Delta slide (SIGNED)
  // Vibrato
  this.p_vib_strength = 0; // Vibrato depth
  this.p_vib_speed = 0;    // Vibrato speed

  // Tonal change
  this.p_arp_mod = 0;      // Change amount (SIGNED)
  this.p_arp_speed = 0;    // Change speed

  // Square wave duty (proportion of time signal is high vs. low)
  this.p_duty = 0;         // Square duty
  this.p_duty_ramp = 0;    // Duty sweep (SIGNED)

  // Repeat
  this.p_repeat_speed = 0; // Repeat speed

  // Flanger
  this.p_pha_offset = 0;   // Flanger offset (SIGNED)
  this.p_pha_ramp = 0;     // Flanger sweep (SIGNED)

  // Low-pass filter
  this.p_lpf_freq = 1;     // Low-pass filter cutoff
  this.p_lpf_ramp = 0;     // Low-pass filter cutoff sweep (SIGNED)
  this.p_lpf_resonance = 0;// Low-pass filter resonance
  // High-pass filter
  this.p_hpf_freq = 0;     // High-pass filter cutoff
  this.p_hpf_ramp = 0;     // High-pass filter cutoff sweep (SIGNED)

  // Sample parameters
  this.sound_vol = 0.5;
  this.sample_rate = 44100;
  this.sample_size = 8;
}

// export parameter list to URL friendly base58 string
// https://gist.github.com/diafygi/90a3e80ca1c2793220e5/
let b58alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
let params_order = [
  "wave_type",
  "p_env_attack",
  "p_env_sustain",
  "p_env_punch",
  "p_env_decay",
  "p_base_freq",
  "p_freq_limit",
  "p_freq_ramp",
  "p_freq_dramp",
  "p_vib_strength",
  "p_vib_speed",
  "p_arp_mod",
  "p_arp_speed",
  "p_duty",
  "p_duty_ramp",
  "p_repeat_speed",
  "p_pha_offset",
  "p_pha_ramp",
  "p_lpf_freq",
  "p_lpf_ramp",
  "p_lpf_resonance",
  "p_hpf_freq",
  "p_hpf_ramp"
];

Params.prototype.fromB58 = function(b58encoded) {
  const struct = sfxr.b58decode(b58encoded);
  for (let p in struct) {
    if (struct.hasOwnProperty(p)) {
      this[p] = struct[p];
    }
  }
  return this;
}

/*** Simpler namespaced functional API ***/

let sfxr = {};

sfxr.b58decode = function(b58encoded) {
  let decoded = function(S,A){let d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)}(b58encoded,b58alphabet);
  let result = {};
  for (let pi in params_order) {
    let p = params_order[pi];
    let offset = (pi - 1) * 4 + 1;
    if (p == "wave_type") {
      result[p] = decoded[0];
    } else {
      let val = (decoded[offset] | (decoded[offset + 1] << 8) | (decoded[offset + 2] << 16) | (decoded[offset + 3] << 24));
      result[p] = numberToFloat(val);
    }
  }
  return result;
}

/*** Main entry point ***/

function SoundEffect(ps) {
  if (typeof(ps) == "string") {
    let PARAMS = new Params();
    if (ps.indexOf("#") == 0) {
      ps = ps.slice(1);
    }
    ps = PARAMS.fromB58(ps);
  }
  this.parameters = ps;
  this.initForRepeat();  // First time through, this is a bit of a misnomer

  // Waveform shape
  this.waveShape = parseInt(ps.wave_type);

  // Filter
  this.fltw = pow(ps.p_lpf_freq, 3) * 0.1;
  this.enableLowPassFilter = (ps.p_lpf_freq != 1);
  this.fltw_d = 1 + ps.p_lpf_ramp * 0.0001;
  this.fltdmp = 5 / (1 + pow(ps.p_lpf_resonance, 2) * 20) *
    (0.01 + this.fltw);
  if (this.fltdmp > 0.8) this.fltdmp=0.8;
  this.flthp = pow(ps.p_hpf_freq, 2) * 0.1;
  this.flthp_d = 1 + ps.p_hpf_ramp * 0.0003;

  // Vibrato
  this.vibratoSpeed = pow(ps.p_vib_speed, 2) * 0.01;
  this.vibratoAmplitude = ps.p_vib_strength * 0.5;

  // Envelope
  this.envelopeLength = [
    floor(ps.p_env_attack * ps.p_env_attack * 100000),
    floor(ps.p_env_sustain * ps.p_env_sustain * 100000),
    floor(ps.p_env_decay * ps.p_env_decay * 100000)
  ];
  this.envelopePunch = ps.p_env_punch;

  // Flanger
  this.flangerOffset = pow(ps.p_pha_offset, 2) * 1020;
  if (ps.p_pha_offset < 0) this.flangerOffset = -this.flangerOffset;
  this.flangerOffsetSlide = pow(ps.p_pha_ramp, 2) * 1;
  if (ps.p_pha_ramp < 0) this.flangerOffsetSlide = -this.flangerOffsetSlide;

  // Repeat
  this.repeatTime = floor(pow(1 - ps.p_repeat_speed, 2) * 20000
                               + 32);
  if (ps.p_repeat_speed === 0)
    this.repeatTime = 0;

  this.gain = exp(ps.sound_vol) - 1;

  this.sampleRate = ps.sample_rate;
  this.bitsPerChannel = ps.sample_size;
}

SoundEffect.prototype.initForRepeat = function() {
  let ps = this.parameters;
  this.elapsedSinceRepeat = 0;

  this.period = 100 / (ps.p_base_freq * ps.p_base_freq + 0.001);
  this.periodMax = 100 / (ps.p_freq_limit * ps.p_freq_limit + 0.001);
  this.enableFrequencyCutoff = (ps.p_freq_limit > 0);
  this.periodMult = 1 - pow(ps.p_freq_ramp, 3) * 0.01;
  this.periodMultSlide = -pow(ps.p_freq_dramp, 3) * 0.000001;

  this.dutyCycle = 0.5 - ps.p_duty * 0.5;
  this.dutyCycleSlide = -ps.p_duty_ramp * 0.00005;

  if (ps.p_arp_mod >= 0)
    this.arpeggioMultiplier = 1 - pow(ps.p_arp_mod, 2) * .9;
  else
    this.arpeggioMultiplier = 1 + pow(ps.p_arp_mod, 2) * 10;
  this.arpeggioTime = floor(pow(1 - ps.p_arp_speed, 2) * 20000 + 32);
  if (ps.p_arp_speed === 1)
    this.arpeggioTime = 0;
}

SoundEffect.prototype.getRawBuffer = function () {
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
  let summands = floor(44100 / this.sampleRate);

  for(let t = 0; ; ++t) {

    // Repeats
    if (this.repeatTime != 0 && ++this.elapsedSinceRepeat >= this.repeatTime)
      this.initForRepeat();

    // Arpeggio (single)
    if(this.arpeggioTime != 0 && t >= this.arpeggioTime) {
      this.arpeggioTime = 0;
      this.period *= this.arpeggioMultiplier;
    }

    // Frequency slide, and frequency slide slide!
    this.periodMult += this.periodMultSlide;
    this.period *= this.periodMult;
    if(this.period > this.periodMax) {
      this.period = this.periodMax;
      if (this.enableFrequencyCutoff)
        break;
    }

    // Vibrato
    let rfperiod = this.period;
    if (this.vibratoAmplitude > 0) {
      vibratoPhase += this.vibratoSpeed;
      rfperiod = this.period * (1 + sin(vibratoPhase) * this.vibratoAmplitude);
    }
    let iperiod = floor(rfperiod);
    if (iperiod < OVERSAMPLING) iperiod = OVERSAMPLING;

    // Square wave duty cycle
    this.dutyCycle += this.dutyCycleSlide;
    if (this.dutyCycle < 0) this.dutyCycle = 0;
    if (this.dutyCycle > 0.5) this.dutyCycle = 0.5;

    // Volume envelope
    if (++envelopeElapsed > this.envelopeLength[envelopeStage]) {
      envelopeElapsed = 0;
      if (++envelopeStage > 2)
        break;
    }
    let env_vol;
    let envf = envelopeElapsed / this.envelopeLength[envelopeStage];
    if (envelopeStage === 0) {         // Attack
      env_vol = envf;
    } else if (envelopeStage === 1) {  // Sustain
      env_vol = 1 + (1 - envf) * 2 * this.envelopePunch;
    } else {                           // Decay
      env_vol = 1 - envf;
    }

    // Flanger step
    this.flangerOffset += this.flangerOffsetSlide;
    let iphase = abs(floor(this.flangerOffset));
    if (iphase > 1023) iphase = 1023;

    if (this.flthp_d != 0) {
      this.flthp *= this.flthp_d;
      if (this.flthp < 0.00001)
        this.flthp = 0.00001;
      if (this.flthp > 0.1)
        this.flthp = 0.1;
    }

    // 8x oversampling
    let sample = 0;
    for (let si = 0; si < OVERSAMPLING; ++si) {
      let sub_sample = 0;
      phase++;
      if (phase >= iperiod) {
        phase %= iperiod;
        if (this.waveShape === NOISE)
          for(let i = 0; i < 32; ++i)
            noise_buffer[i] = range(1,2);
      }

      // Base waveform
      let fp = phase / iperiod;
      if (this.waveShape === SQUARE) {
        if (fp < this.dutyCycle)
          sub_sample=0.5;
        else
          sub_sample=-0.5;
      } else if (this.waveShape === SAWTOOTH) {
        if (fp < this.dutyCycle)
          sub_sample = -1 + 2 * fp/this.dutyCycle;
        else
          sub_sample = 1 - 2 * (fp-this.dutyCycle)/(1-this.dutyCycle);
      } else if (this.waveShape === SINE) {
        sub_sample = sin(fp * 2 * PI);
      } else if (this.waveShape === NOISE) {
        sub_sample = noise_buffer[floor(phase * 32 / iperiod)];
      } else {
        throw "ERROR: Bad wave type: " + this.waveShape;
      }

      // Low-pass filter
      let pp = fltp;
      this.fltw *= this.fltw_d;
      if (this.fltw < 0) this.fltw = 0;
      if (this.fltw > 0.1) this.fltw = 0.1;
      if (this.enableLowPassFilter) {
        fltdp += (sub_sample - fltp) * this.fltw;
        fltdp -= fltdp * this.fltdmp;
      } else {
        fltp = sub_sample;
        fltdp = 0;
      }
      fltp += fltdp;

      // High-pass filter
      fltphp += fltp - pp;
      fltphp -= fltphp * this.flthp;
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
    sample *= this.gain;

    if (this.bitsPerChannel === 8) {
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

  return {
    "buffer": buffer,
    "clipped": num_clipped,
  }
}

SoundEffect.prototype.generate = function() {
  let rendered = this.getRawBuffer();
  let wave = new RIFFWAVE();
  let normalized = _sfxr_getNormalized(rendered.buffer, this.bitsPerChannel);
  wave.header.sampleRate = this.sampleRate;
  wave.header.bitsPerSample = this.bitsPerChannel;
  wave.Make(normalized);
  wave.clipping = rendered.clipped;
  wave.buffer = normalized;
  wave.getAudio = _sfxr_getAudioFn(wave);
  return wave;
}

let _sfxr_getNormalized = function(buffer, bitsPerChannel) {
  // normalize buffer
  let normalized = new Float32Array(buffer.length);
  for (let b=0; b<buffer.length; b++) {
    normalized[b] = 2.0 * buffer[b] / pow(2, bitsPerChannel) - 1.0;
  }
  return normalized;
}

let _sfxr_getAudioFn = function(wave) {
  return function() {
    // check for procedural audio
    let actx = null;
    if ('AudioContext' in window) {
      actx = new AudioContext();
    } else if ('webkitAudioContext' in window) {
      actx = new webkitAudioContext();
    }

    if (actx) {
      let buff = actx.createBuffer(1, wave.buffer.length, wave.header.sampleRate);
      let nowBuffering = buff.getChannelData(0);
      for (let i=0;i<wave.buffer.length;i++) {
        nowBuffering[i] = wave.buffer[i];
      }
      return {
        "channels": [],
        "play": function() {
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
  };
};

export default SoundEffect;
//
// {
//   Params,
//   SoundEffect,
//   sfxr,
//   waveforms: {
//     SQUARE,
//     SAWTOOTH,
//     SINE,
//     NOISE
//   }
// };
