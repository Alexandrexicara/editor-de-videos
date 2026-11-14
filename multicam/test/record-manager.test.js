'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCameras } = require('../record-manager');

test('rejeita gravação sem fontes', () => {
  assert.throws(() => validateCameras([], 30), /pelo menos uma câmera/);
});

test('rejeita duração fora do limite', () => {
  assert.throws(() => validateCameras([{ method: 'ip', ip: 'http://192.168.0.10:8080/video' }], 0), /Duração inválida/);
});

test('rejeita URL com protocolo não suportado', () => {
  assert.throws(() => validateCameras([{ method: 'ip', ip: 'file:///etc/passwd' }], 30), /HTTP, HTTPS ou RTSP/);
});

test('rejeita dispositivo USB repetido', () => {
  assert.throws(() => validateCameras([
    { method: 'usb', device: 'Webcam USB' },
    { method: 'usb', device: 'webcam usb' }
  ], 30), /mais de uma vez/);
});

test('aceita quatro fontes distintas USB e IP', () => {
  const cameras = validateCameras([
    { method: 'usb', device: 'Webcam 1' },
    { method: 'usb', device: 'Webcam 2' },
    { method: 'ip', ip: 'http://192.168.0.20:8080/video' },
    { method: 'ip', ip: 'rtsp://192.168.0.21:554/live' }
  ], 60);
  assert.equal(cameras.length, 4);
  assert.deepEqual(cameras.map((camera) => camera.index), [1, 2, 3, 4]);
});

test('preserva o número da posição quando há câmeras não configuradas', () => {
  const cameras = validateCameras([
    { index: 3, method: 'ip', ip: 'http://192.168.0.30:8080/video', duration: 25 }
  ], 25);
  assert.equal(cameras[0].index, 3);
  assert.equal(cameras[0].duration, 25);
});

test('rejeita posições repetidas', () => {
  assert.throws(() => validateCameras([
    { index: 2, method: 'ip', ip: 'http://192.168.0.20:8080/video' },
    { index: 2, method: 'ip', ip: 'http://192.168.0.21:8080/video' }
  ], 30), /posição de câmera inválido ou repetido/);
});
