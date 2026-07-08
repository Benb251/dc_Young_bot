const dns = require('dns/promises');
const net = require('net');
const fetch = require('node-fetch');
const { getAIChatResponse } = require('./ai_helper.js');

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 512_000;

function getWebTimeoutMs(env = process.env) {
  const value = Number(env.ASSISTANT_WEB_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(value, 60_000);
}

function getWebMaxBytes(env = process.env) {
  const value = Number(env.ASSISTANT_WEB_MAX_BYTES || DEFAULT_MAX_BYTES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_BYTES;
  return Math.min(value, 2_000_000);
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || parts[0] === 0;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === '::1'
      || lower === '::'
      || lower.startsWith('fc')
      || lower.startsWith('fd')
      || lower.startsWith('fe80:');
  }
  return true;
}

function parsePublicUrl(rawUrl) {
  const parsed = new URL(String(rawUrl || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Chỉ hỗ trợ URL http/https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Không hỗ trợ URL có username/password.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Không fetch localhost/private URL.');
  }
  return parsed;
}

async function assertPublicHost(parsedUrl) {
  const hostname = parsedUrl.hostname;
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Không fetch private IP.');
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) {
    throw new Error('Domain này trỏ tới private/local network nên bị chặn.');
  }
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function findElementBlock(html, openTagStart) {
  const source = String(html || '');
  const openEnd = source.indexOf('>', openTagStart);
  if (openEnd < 0) return '';
  const tagMatch = source.slice(openTagStart, openEnd + 1).match(/^<([a-z0-9-]+)/i);
  if (!tagMatch) return '';
  const tagName = tagMatch[1].toLowerCase();
  const tagRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagRegex.lastIndex = openTagStart;

  let depth = 0;
  let match;
  while ((match = tagRegex.exec(source))) {
    if (match[0].startsWith(`</`)) {
      depth -= 1;
      if (depth === 0) return source.slice(openTagStart, tagRegex.lastIndex);
    } else if (!match[0].endsWith('/>')) {
      depth += 1;
    }
  }
  return source.slice(openTagStart);
}

function stripNonContentHtml(html) {
  return String(html || '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<div[^>]+class=["'][^"']*(sidebar|toctree|toc|search|breadcrumb|pagination|article-info|on-this-page)[^"']*["'][\s\S]*?<\/div>/gi, ' ');
}

function extractMainHtml(html) {
  const source = String(html || '');
  const selectors = [
    /<article\b[^>]*role=["']main["'][^>]*>/i,
    /<main\b[^>]*>/i,
    /<div\b[^>]*role=["']main["'][^>]*>/i,
    /<div\b[^>]*class=["'][^"']*(article-container|document|body|content)[^"']*["'][^>]*>/i,
  ];

  for (const selector of selectors) {
    const match = selector.exec(source);
    if (!match) continue;
    const block = findElementBlock(source, match.index);
    if (block) return stripNonContentHtml(block);
  }
  return stripNonContentHtml(source);
}

function extractReadableText(html) {
  const withoutNoise = stripNonContentHtml(String(html || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withoutNoise)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTitle(html, fallbackUrl) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim() : '';
  return title || fallbackUrl;
}

function resolveUrl(baseUrl, value) {
  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString();
  } catch {
    return null;
  }
}

function extractImageUrls(html, baseUrl, limit = 8) {
  const urls = [];
  const seen = new Set();
  const addUrl = value => {
    const resolved = resolveUrl(baseUrl, value);
    if (!resolved || seen.has(resolved)) return;
    if (!/^https?:\/\//i.test(resolved)) return;
    seen.add(resolved);
    urls.push(resolved);
  };

  const imgRegex = /<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(String(html || ''))) && urls.length < limit) {
    addUrl(match[1]);
  }

  const sourceRegex = /<source\b[^>]*srcset=["']([^"']+)["'][^>]*>/gi;
  while ((match = sourceRegex.exec(String(html || ''))) && urls.length < limit) {
    const first = String(match[1]).split(',')[0]?.trim().split(/\s+/)[0];
    if (first) addUrl(first);
  }

  return urls.slice(0, limit);
}

function injectImageMarkers(html, baseUrl, limit = 8) {
  let index = 0;
  const imageUrls = [];
  const seen = new Set();
  const addMarker = value => {
    const resolved = resolveUrl(baseUrl, value);
    if (!resolved || seen.has(resolved) || !/^https?:\/\//i.test(resolved) || index >= limit) return '';
    seen.add(resolved);
    index += 1;
    imageUrls.push(resolved);
    return `\n[HINH_${index}: ${resolved}]\n`;
  };

  const htmlWithMarkers = String(html || '').replace(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi, (_, src) => addMarker(src));
  return { html: htmlWithMarkers, imageUrls };
}

async function fetchUrlContent(rawUrl, env = process.env) {
  const parsedUrl = parsePublicUrl(rawUrl);
  await assertPublicHost(parsedUrl);

  const maxBytes = getWebMaxBytes(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getWebTimeoutMs(env));

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'DiscordAssistantBot/1.0 (+public URL summarizer)',
        Accept: 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.8,*/*;q=0.3',
      },
      redirect: 'follow',
      size: maxBytes,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Fetch lỗi HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!/text\/|html|xml|json/i.test(contentType)) {
      throw new Error(`Content-Type không phải text/html có thể tóm tắt: ${contentType || 'unknown'}.`);
    }

    const raw = await response.text();
    const finalUrl = response.url || parsedUrl.toString();
    const mainHtml = /html/i.test(contentType) ? extractMainHtml(raw) : raw;
    const imageLimit = Number(env.ASSISTANT_WEB_IMAGE_LIMIT || 8);
    const marked = /html/i.test(contentType)
      ? injectImageMarkers(mainHtml, finalUrl, imageLimit)
      : { html: raw, imageUrls: [] };
    const text = /html/i.test(contentType) ? extractReadableText(marked.html) : raw.trim();
    return {
      url: finalUrl,
      title: /html/i.test(contentType) ? extractTitle(raw, finalUrl) : parsedUrl.toString(),
      contentType,
      imageUrls: marked.imageUrls.length ? marked.imageUrls : (/html/i.test(contentType) ? extractImageUrls(mainHtml, finalUrl, imageLimit) : []),
      text: text.slice(0, maxBytes),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function summarizeUrl(args = {}) {
  const url = args.url || args.link;
  if (!url) return 'Thiếu URL cần đọc.';
  const page = await fetchUrlContent(url);
  if (!page.text) return 'Không đọc được nội dung chữ từ URL này.';

  const mode = args.mode || args.format || 'summary';
  const prompt = `
Bạn đang giúp tóm tắt tài liệu/web cho cộng đồng Discord 3D/Game Art/Design.
URL: ${page.url}
Title: ${page.title}
Yêu cầu: ${args.question || args.query || mode}

Nội dung trang đã trích xuất:
${page.text.slice(0, 18_000)}

Hãy trả lời bằng tiếng Việt. Nếu người dùng muốn resource hub, hãy chuyển thành format gọn gồm: mục đích, điểm chính, ai nên đọc, cách áp dụng, link nguồn.
`.trim();

  const summary = await getAIChatResponse([
    { role: 'user', content: prompt },
  ], [], { temperature: 0.25 });

  return [
    `Đã đọc: ${page.title}`,
    `Nguồn: ${page.url}`,
    '',
    summary,
  ].join('\n');
}

function chunkDiscordText(text, max = 1850) {
  const chunks = [];
  let remaining = String(text || '').trim();
  while (remaining.length > max) {
    const cut = remaining.lastIndexOf('\n', max) > 800 ? remaining.lastIndexOf('\n', max) : max;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function buildForumResourcePost(args = {}) {
  const url = args.url || args.link;
  if (!url) return null;
  const page = await fetchUrlContent(url);
  if (!page.text) return null;

  const requestText = String(args.question || args.prompt || args.notes || args.mode || '').toLowerCase();
  const faithfulTranslation = Boolean(args.exact || args.full || args.faithful)
    || /dịch\s*(chính xác|sát|đầy đủ|nguyên)|dich\s*(chinh xac|sat|day du|nguyen)|giữ\s*(nguyên|cấu trúc|noi dung|nội dung)|giu\s*(nguyen|cau truc|noi dung)/i.test(requestText);
  const styleInstruction = faithfulTranslation
    ? [
      'Bạn đang chuyển một trang tài liệu public thành bài hướng dẫn tiếng Việt cho Discord.',
      'Hãy dịch bám sát nội dung chính đã trích xuất, giữ thứ tự ý, heading, bullet và thuật ngữ quan trọng.',
      'Không biến thành bản tóm tắt ngắn. Chỉ lược bỏ điều hướng/sidebar/trùng lặp/rác HTML nếu có.',
      'Nếu nội dung quá dài cho Discord, chia thành các mục rõ ràng và giữ đầy đủ các ý chính quan trọng.',
    ].join('\n')
    : [
      'Bạn đang chuyển một trang tài liệu public thành bài resource hub tiếng Việt cho Discord.',
      'Không copy nguyên văn toàn bộ. Hãy dịch/tái biên tập cô đọng, dễ học, giữ đúng ý chính và ghi nguồn.',
    ].join('\n');
  const contentLimit = faithfulTranslation ? 11000 : 5200;
  const prompt = `
${styleInstruction}
Khi thấy marker dạng [HINH_1: URL], hãy giữ URL ảnh ở đúng vị trí liên quan trong bài Discord.
Không gom toàn bộ ảnh xuống cuối bài. Không xoá URL ảnh trừ khi đó là logo/trang trí rõ ràng.
Trong Discord, ảnh chỉ cần đặt URL ảnh trên một dòng riêng ngay dưới đoạn/caption liên quan để hiện preview.

URL nguồn: ${page.url}
Title nguồn: ${page.title}
Yêu cầu thêm của admin: ${args.question || args.prompt || args.notes || 'Tạo bài hướng dẫn/resource hub tiếng Việt.'}

Nội dung trang đã trích xuất:
${page.text.slice(0, 20_000)}

Trả về JSON hợp lệ, không markdown code block:
{
  "title": "tiêu đề forum tiếng Việt, tối đa 90 ký tự",
  "content": "bài đăng tiếng Việt dùng Markdown Discord, có nguồn rõ ràng; tối đa ${contentLimit} ký tự"
}
`.trim();

  const raw = await getAIChatResponse([
    { role: 'user', content: prompt },
  ], [], { temperature: 0.2 });

  let parsed = null;
  try {
    const clean = String(raw || '').trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = null;
  }

  const title = String(parsed?.title || args.title || page.title || 'Resource tiếng Việt')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  const content = String(parsed?.content || raw || '')
    .trim()
    .slice(0, contentLimit);
  const sourceLine = content.includes(page.url) ? '' : `\n\nNguồn: ${page.url}`;
  const imageUrls = page.imageUrls.slice(0, Math.min(Math.max(Number(args.imageLimit) || 6, 0), 10));

  return {
    title,
    content: `${content}${sourceLine}`.trim(),
    imageUrls,
    sourceUrl: page.url,
    sourceTitle: page.title,
  };
}

module.exports = {
  buildForumResourcePost,
  chunkDiscordText,
  decodeHtmlEntities,
  extractImageUrls,
  injectImageMarkers,
  extractMainHtml,
  extractReadableText,
  fetchUrlContent,
  getWebMaxBytes,
  getWebTimeoutMs,
  isPrivateIp,
  parsePublicUrl,
  summarizeUrl,
};
