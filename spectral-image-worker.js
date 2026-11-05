/* Expensive synthesis and FFT analysis stay off the interface thread. */
importScripts('spectral-image-dsp.js?v=3624635b6bad');
self.onmessage = ({ data: { channels, image, viewport = {} } }) => {
  try {
    const progress = value => self.postMessage({ progress: Math.round(value * 100) });
    const pixels = self.SpectralImageDSP.grayscale(image.rgba, image.width, image.height);
    const duration = channels[0].length / self.SpectralImageDSP.SAMPLE_RATE;
    const options = self.SpectralImageDSP.tileLayout(duration, viewport.width, viewport.height);
    const output = self.SpectralImageDSP.synthesize(channels, pixels, undefined, progress, options);
    const recording = self.SpectralImageDSP.measure(output, undefined, progress, options);
    const wav = self.SpectralImageDSP.wav(output);
    self.postMessage({ recording, wav }, [recording.data.buffer, wav]);
  } catch (error) { self.postMessage({ error: error.message }); }
};
