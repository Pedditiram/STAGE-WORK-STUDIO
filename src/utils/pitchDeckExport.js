/**
 * Pitch deck → Keynote (.pptx) and Pages (.docx).
 * Store-only ZIP (no extra deps). Keynote opens PPTX; Pages opens DOCX.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function strBytes(s) {
  return new TextEncoder().encode(s);
}

function concat(parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  parts.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}

function u16(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach((f) => {
    const name = strBytes(f.name);
    const data = f.data instanceof Uint8Array ? f.data : strBytes(f.data);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data
    ]);
    locals.push(local);
    centrals.push(concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name
    ]));
    offset += local.length;
  });
  const central = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0)
  ]);
  return concat([...locals, central, end]);
}

function xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseDataUrl(src) {
  if (!src || typeof src !== 'string' || !src.startsWith('data:')) return null;
  const m = src.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!m) return null;
  const mime = m[1].toLowerCase().replace('jpg', 'jpeg');
  const b64 = m[3];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'png' : 'jpeg';
  return { mime: ext === 'png' ? 'image/png' : 'image/jpeg', ext, bytes };
}

function collectImages(deck, placements) {
  const out = [];
  (deck.slides || []).forEach((slide, si) => {
    const frames = slide.frames || [];
    frames.forEach((fr, fi) => {
      const key = `${slide.id}:${fi}`;
      const src = placements[key] || (slide.images && slide.images[fi]) || '';
      const parsed = parseDataUrl(src);
      if (parsed) out.push({ slideIndex: si, frameIndex: fi, label: fr.label, ...parsed });
    });
  });
  return out;
}

const CX = 12192000;
const CY = 6858000;

function pptxTheme() {
  const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const ln = `<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr">${solid}<a:prstDash val="solid"/></a:ln>`;
  const fx = '<a:effectLst/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Stage Work Studio">
<a:themeElements>
<a:clrScheme name="Stage Work Studio"><a:dk1><a:srgbClr val="0C0A08"/></a:dk1><a:lt1><a:srgbClr val="F4EDE3"/></a:lt1>
<a:dk2><a:srgbClr val="1A1612"/></a:dk2><a:lt2><a:srgbClr val="E8DCC8"/></a:lt2>
<a:accent1><a:srgbClr val="C4A574"/></a:accent1><a:accent2><a:srgbClr val="8B1E1E"/></a:accent2>
<a:accent3><a:srgbClr val="3D5A3D"/></a:accent3><a:accent4><a:srgbClr val="2C4A6E"/></a:accent4>
<a:accent5><a:srgbClr val="6B5344"/></a:accent5><a:accent6><a:srgbClr val="9A8B7A"/></a:accent6>
<a:hlink><a:srgbClr val="C4A574"/></a:hlink><a:folHlink><a:srgbClr val="8B1E1E"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Stage Work Studio"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Stage Work Studio">
<a:fillStyleLst>${solid}${solid}${solid}</a:fillStyleLst>
<a:lnStyleLst>${ln}${ln}${ln}</a:lnStyleLst>
<a:effectStyleLst><a:effectStyle>${fx}</a:effectStyle><a:effectStyle>${fx}</a:effectStyle><a:effectStyle>${fx}</a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst>${solid}${solid}${solid}</a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements></a:theme>`;
}

function pptxMaster() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="0C0A08"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CX}" cy="${CY}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`;
}

function pptxLayout() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CX}" cy="${CY}"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function textBox(id, name, x, y, w, h, text, size, bold, color, italic) {
  const sz = Math.round(size * 100);
  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>
<a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="${sz}" b="${bold ? 1 : 0}" i="${italic ? 1 : 0}" dirty="0">
<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${bold ? 'Georgia' : 'Calibri'}"/></a:rPr>
<a:t>${xmlEsc(text).slice(0, 4000)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

function picBox(id, name, rid, x, y, w, h) {
  return `<p:pic>
<p:nvPicPr><p:cNvPr id="${id}" name="${xmlEsc(name)}" descr=""/><p:cNvPicPr><a:picLocks noChangeAspect="0"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function emptyFrame(id, x, y, w, h, label) {
  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${id}" name="Frame"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:noFill/><a:ln w="12700" cmpd="sngDash"><a:solidFill><a:srgbClr val="6B5344"/></a:solidFill></a:ln></p:spPr>
<p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/>
<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1100" i="1"><a:solidFill><a:srgbClr val="6B5344"/></a:solidFill></a:rPr>
<a:t>${xmlEsc(label || 'Still')}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

function buildSlideXml(slide, si, images, placements) {
  const frames = slide.frames || [];
  const n = Math.max(frames.length, 0);
  const cols = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(n / cols) || 1);
  let shapes = '';
  let id = 2;
  shapes += textBox(id++, 'kicker', 457200, 228600, 11277600, 274320, slide.kicker || '', 11, false, 'C4A574', true);
  shapes += textBox(id++, 'title', 457200, 502920, 11277600, 548640, slide.title || '', 28, true, 'F4EDE3', false);
  if (slide.subtitle) {
    shapes += textBox(id++, 'sub', 457200, 1028700, 11277600, 365760, slide.subtitle, 14, false, '9A8B7A', true);
  }
  const bodyY = slide.subtitle ? 1463040 : 1097280;
  const points = (slide.points || []).slice(0, 10).map((p, i) => `${i + 1}. ${p}`).join('\n');
  const hasFrames = n > 0;
  const textW = hasFrames ? 5486400 : 11277600;
  shapes += textBox(id++, 'body', 457200, bodyY, textW, 4114800, points || slide.statusNote || '', 13, false, 'E8DCC8', false);
  if (hasFrames) {
    const gx = 6200000;
    const gy = bodyY;
    const gw = 5486400;
    const gh = 4200000;
    const gap = 91440;
    const cw = Math.floor((gw - gap * (cols - 1)) / cols);
    const ch = Math.floor((gh - gap * (rows - 1)) / rows);
    frames.forEach((fr, fi) => {
      const c = fi % cols;
      const r = Math.floor(fi / cols);
      const x = gx + c * (cw + gap);
      const y = gy + r * (ch + gap);
      const img = images.find((im) => im.slideIndex === si && im.frameIndex === fi);
      if (img) shapes += picBox(id++, fr.label, img.rid, x, y, cw, ch);
      else shapes += emptyFrame(id++, x, y, cw, ch, fr.label);
    });
  }
  if (slide.disclaimer) {
    shapes += textBox(id++, 'disc', 457200, 6400800, 11277600, 274320, slide.disclaimer, 9, false, '6B5344', true);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="0C0A08"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CX}" cy="${CY}"/></a:xfrm></p:grpSpPr>
${shapes}
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

export function buildPitchPptx(deck, placements = {}) {
  const images = collectImages(deck, placements);
  images.forEach((im, i) => {
    im.rid = `rId${i + 2}`;
    im.file = `image${i + 1}.${im.ext}`;
  });
  const slides = deck.slides || [];
  const files = [];
  const slideRels = slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');
  const sldIdLst = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('');

  files.push({
    name: '[Content_Types].xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}
</Types>`
  });
  files.push({
    name: '_rels/.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  });
  files.push({
    name: 'ppt/presentation.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${slides.length + 1}"/></p:sldMasterIdLst>
<p:sldIdLst>${sldIdLst}</p:sldIdLst>
<p:sldSz cx="${CX}" cy="${CY}" type="screen16x9"/>
<p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  });
  files.push({
    name: 'ppt/_rels/presentation.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${slideRels}
<Relationship Id="rId${slides.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`
  });
  files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: pptxMaster() });
  files.push({
    name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
  });
  files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: pptxLayout() });
  files.push({
    name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  });
  files.push({ name: 'ppt/theme/theme1.xml', data: pptxTheme() });

  slides.forEach((slide, si) => {
    const slideImgs = images.filter((im) => im.slideIndex === si);
    files.push({ name: `ppt/slides/slide${si + 1}.xml`, data: buildSlideXml(slide, si, images, placements) });
    const rels = [
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
      ...slideImgs.map((im) => `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${im.file}"/>`)
    ].join('');
    files.push({
      name: `ppt/slides/_rels/slide${si + 1}.xml.rels`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
    });
  });
  images.forEach((im) => files.push({ name: `ppt/media/${im.file}`, data: im.bytes }));
  return zipStore(files);
}

export function buildPitchDocx(deck, placements = {}) {
  const images = collectImages(deck, placements);
  images.forEach((im, i) => {
    im.rid = `rId${i + 2}`;
    im.file = `image${i + 1}.${im.ext}`;
  });
  const body = (deck.slides || []).map((slide, si) => {
    const frames = slide.frames || [];
    const pts = (slide.points || []).map((p) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(p)}</w:t></w:r></w:p>`).join('');
    const imgs = frames.map((fr, fi) => {
      const im = images.find((x) => x.slideIndex === si && x.frameIndex === fi);
      if (!im) {
        return `<w:p><w:r><w:rPr><w:i/><w:color w:val="6B5344"/></w:rPr><w:t>[ ${xmlEsc(fr.label)} — drop still ]</w:t></w:r></w:p>`;
      }
      const cx = 3200400;
      const cy = 1800000;
      return `<w:p><w:r><w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${si * 20 + fi + 1}" name="${xmlEsc(fr.label)}"/>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:nvPicPr><pic:cNvPr id="0" name="${xmlEsc(fr.label)}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${im.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:r><w:rPr><w:i/><w:sz w:val="16"/></w:rPr><w:t>${xmlEsc(fr.label)}</w:t></w:r></w:p>`;
    }).join('');
    return `<w:p><w:r><w:rPr><w:color w:val="C4A574"/><w:sz w:val="18"/></w:rPr><w:t>${xmlEsc(slide.kicker)}</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1A1612"/></w:rPr><w:t>${xmlEsc(slide.title)}</w:t></w:r></w:p>
${slide.subtitle ? `<w:p><w:r><w:rPr><w:i/><w:color w:val="6B5344"/></w:rPr><w:t>${xmlEsc(slide.subtitle)}</w:t></w:r></w:p>` : ''}
${pts}${imgs}
<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  }).join('');

  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    {
      name: 'word/_rels/document.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${images.map((im) => `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.file}"/>`).join('')}
<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
    },
    {
      name: 'word/document.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`
    },
    {
      name: 'word/styles.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>
</w:styles>`
    },
    {
      name: 'word/numbering.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`
    }
  ];
  images.forEach((im) => files.push({ name: `word/media/${im.file}`, data: im.bytes }));
  return zipStore(files);
}

export function downloadBinary(filename, bytes, mime) {
  const blob = new Blob([bytes], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for pitch deck PDF (browser print). */
export function pitchDeckToPrintHtml(deck = {}, { projectTitle = '', roomId = '' } = {}) {
  const title = escapeHtml(projectTitle || deck.projectTitle || 'Pitch');
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  const audience = escapeHtml(deck.audienceLabel || deck.audienceId || '');
  const size = escapeHtml(deck.sizeLabel || deck.sizeId || '');

  const panels = slides
    .map((slide, i) => {
      const points = (slide.points || [])
        .map((p) => `<li>${escapeHtml(p)}</li>`)
        .join('');
      return `<section class="slide">
        <p class="num">Slide ${i + 1}</p>
        <h2>${escapeHtml(slide.title || slide.headline || `Slide ${i + 1}`)}</h2>
        ${slide.subtitle || slide.kicker ? `<p class="sub">${escapeHtml(slide.subtitle || slide.kicker)}</p>` : ''}
        ${points ? `<ul>${points}</ul>` : ''}
        ${slide.body || slide.narrative ? `<p class="body">${escapeHtml(slide.body || slide.narrative)}</p>` : ''}
        ${slide.highlight || slide.callout ? `<blockquote>${escapeHtml(slide.highlight || slide.callout)}</blockquote>` : ''}
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Pitch deck</title>
  <style>
    @page { size: letter landscape; margin: 0.5in; }
    body { font-family: system-ui, sans-serif; font-size: 10pt; color: #111; margin: 0; padding: 16px; line-height: 1.4; }
    h1 { font-size: 14pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 14px; font-size: 9pt; }
    .slide { page-break-inside: avoid; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
    .num { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.12em; color: #8b5a2b; margin: 0 0 4px; font-weight: 700; }
    h2 { font-size: 13pt; margin: 0 0 6px; }
    .sub { color: #444; margin: 0 0 8px; }
    ul { margin: 0; padding-left: 1.2em; }
    li { margin-bottom: 3px; }
    .body { margin: 6px 0 0; white-space: pre-wrap; }
    blockquote { margin: 8px 0 0; padding: 6px 10px; border-left: 3px solid #b8860b; background: #faf7f0; font-style: italic; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Pitch deck</h1>
  <p class="meta">${slides.length} slides${audience ? ` · ${audience}` : ''}${size ? ` · ${size}` : ''}${String(roomId || '').trim() ? ` · Room ${escapeHtml(String(roomId).trim())}` : ''} · ${escapeHtml(new Date().toISOString())}</p>
  ${panels || '<p>No slides.</p>'}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}
