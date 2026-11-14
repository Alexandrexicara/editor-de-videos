module.exports = {
  // Para gravação pelo terminal, informe quatro nomes DirectShow distintos.
  // Pela interface web, selecione USB ou IP em cada cartão de câmera.
  devices: [],
  cameras: [
    "cameras/cam1.mp4",
    "cameras/cam2.mp4",
    "cameras/cam3.mp4",
    "cameras/cam4.mp4"
  ],
  // Sequência padrão: cortes de 10 segundos em cada câmera.
  timeline: [
    { camera: 0, start: 0, end: 10 },
    { camera: 1, start: 0, end: 10 },
    { camera: 2, start: 0, end: 10 },
    { camera: 0, start: 0, end: 10 },
    { camera: 3, start: 0, end: 10 },
    { camera: 1, start: 0, end: 10 },
    { camera: 0, start: 0, end: 10 }
  ],
  recording: {
    duration: 10,
    format: "mp4",
    resolution: "1920x1080",
    fps: 30,
    bitrate: "5000k"
  },
  audio: {
    device: "",
    sampleRate: 44100,
    bitrate: "192k",
    channels: 2
  },
  output: {
    directory: "output",
    finalVideo: "final.mp4",
    clipsDirectory: "clips"
  }
};
