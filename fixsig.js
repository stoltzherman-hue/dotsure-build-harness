const fs = require('fs');
const file = 'apps/web/app/pipeline/page.tsx';
let c = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const old = '    governanceMd: string,\n    sessionId: string | null\n  ) => {';
const neu = '    governanceMd: string,\n    evidencePackMd: string,\n    sessionId: string | null\n  ) => {';

if (c.includes(old)) {
  c = c.replace(old, neu);
  console.log('Signature fixed OK');
} else {
  console.log('NOT matched');
}

fs.writeFileSync(file, c, 'utf8');
