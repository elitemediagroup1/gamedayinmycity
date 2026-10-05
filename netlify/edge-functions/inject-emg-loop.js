const SRC = 'https://app.emgloop.com/sdk/emg-loop.js';
const KEY = ['pk', 'emg', 'gamedayinmycity'].join('_');
const TAG = `<script src="${SRC}" data-property="gamedayinmycity" data-ingest-key="${KEY}" data-organization="servicesinmycity-demo" async></script>`;

export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = await response.text();
  if (html.includes(SRC)) return new Response(html, response);
  const injection = `\n${TAG}\n`;
  if (html.includes('</head>')) html = html.replace('</head>', injection + '</head>');
  else if (html.includes('</body>')) html = html.replace('</body>', injection + '</body>');
  else html += injection;
  return new Response(html, response);
};

export const config = { path: '/*', excludedPath: ['/assets/*', '/.netlify/*'] };
