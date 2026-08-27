import { createServer } from 'node:http';

const fixture = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Scrawlix extension fixture</title>
  </head>
  <body>
    <main>
      <p id="initial">well, fuck this</p>
      <p><code id="code">fuck</code></p>
      <div id="editable" contenteditable="true">fuck</div>
      <button id="native-button" type="button">fuck</button>
      <a id="native-link" href="/clicked.html">fuck</a>
      <button id="add-dynamic" type="button">add dynamic</button>
      <button id="replace-body" type="button">replace body</button>
      <section id="dynamic-root"></section>
    </main>
    <script>
      document.querySelector('#add-dynamic').addEventListener('click', () => {
        const paragraph = document.createElement('p');
        paragraph.id = 'dynamic-copy';
        paragraph.textContent = 'dynamic fuck arrived';
        document.querySelector('#dynamic-root').append(paragraph);
      });

      document.querySelector('#replace-body').addEventListener('click', () => {
        const replacement = document.createElement('body');
        replacement.innerHTML = '<main><p id="body-replacement">replacement fuck text</p><a id="replacement-link" href="/clicked.html">fuck</a></main>';
        document.body.replaceWith(replacement);
      });
    </script>
  </body>
</html>`;

const clicked = `<!doctype html><html><body><p id="clicked">native link worked</p></body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4174');
  if (url.pathname === '/fixture.html' || url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(fixture);
    return;
  }

  if (url.pathname === '/clicked.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(clicked);
    return;
  }

  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('not found');
});

server.listen(4174, '127.0.0.1', () => {
  console.log('Scrawlix browser fixture listening on http://127.0.0.1:4174');
});
