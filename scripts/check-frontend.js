'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pages = ['cine-series.html', 'avatar-studio.html'];
for (const page of pages) {
  const htmlPath = path.join(__dirname, '..', 'frontend', page);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inlineScripts = scriptTags.filter((match) => !/\bsrc\s*=/i.test(match[1]));

  if (inlineScripts.length === 0) {
    throw new Error('Nenhum script JavaScript inline foi encontrado em frontend/' + page + '.');
  }

  inlineScripts.forEach((match, index) => {
    new vm.Script(match[2], { filename: page + '-inline-' + (index + 1) + '.js' });
  });

  console.log('Sintaxe validada: ' + inlineScripts.length + ' script(s) inline em frontend/' + page + '.');
}
