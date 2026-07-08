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

function extractReadableText(html) {
  const withoutNoise = String(html || '')
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
    const text = /html/i.test(contentType) ? extractReadableText(raw) : raw.trim();
    return {
      url: response.url || parsedUrl.toString(),
      title: /html/i.test(contentType) ? extractTitle(raw, parsedUrl.toString()) : parsedUrl.toString(),
      contentType,
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

module.exports = {
  decodeHtmlEntities,
  extractReadableText,
  fetchUrlContent,
  getWebMaxBytes,
  getWebTimeoutMs,
  isPrivateIp,
  parsePublicUrl,
  summarizeUrl,
};
