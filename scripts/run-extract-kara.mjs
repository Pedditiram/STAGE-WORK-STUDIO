import fs from 'fs';
import { extractTextFromPDF, PdfExtractError } from '../src/services/aiScriptParser.js';

const pdfPath =
  process.argv[2] ||
  '/Users/pedditiram/Downloads/RAMAYAN/Kara_Dhushan_War_Script_and_Prompts.pdf';

const buf = fs.readFileSync(pdfPath);
const file = new File([buf], 'Kara_Dhushan_War_Script_and_Prompts.pdf', {
  type: 'application/pdf'
});

try {
  const text = await extractTextFromPDF(file);
  console.log('OK len', text.length);
  console.log('--- preview ---');
  console.log(text.slice(0, 400));
} catch (e) {
  console.log('FAIL', e?.name, e?.code, e?.message);
  process.exitCode = 1;
}
