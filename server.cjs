const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

const server = http.createServer((req, res) => {
  // Enable CORS for Vite dev server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint to update manual.mmd
  if (req.method === 'POST' && req.url === '/api/update-manual') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { oldText, newText } = JSON.parse(body);
        
        if (!oldText || !newText) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'oldText and newText are required' }));
          return;
        }

        const filePath = path.join(__dirname, 'manual.mmd');
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Normalize line endings to LF for matching
        const fileLF = content.replace(/\r\n/g, '\n');
        const oldLF = oldText.replace(/\r\n/g, '\n');

        // Try exact match first
        let foundText = oldText;
        let foundMatch = fileLF.includes(oldLF);

        // If not found, try trimming trailing whitespace/newlines
        if (!foundMatch) {
          const trimmedOld = oldLF.replace(/[\t ]+$/gm, '').replace(/\n+$/, '');
          if (fileLF.includes(trimmedOld)) {
            console.log('✓ Found match after trimming trailing whitespace/newlines');
            foundText = trimmedOld;
            foundMatch = true;
          }
        }

        // If still not found, try a regex allowing optional trailing spaces per line
        if (!foundMatch) {
          const escaped = oldLF
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex chars
            .replace(/\n/g, '[\t ]*\\n'); // allow spaces before line breaks
          const re = new RegExp(escaped);
          const m = fileLF.match(re);
          if (m) {
            console.log('✓ Found match via regex with flexible whitespace');
            foundText = m[0];
            foundMatch = true;
          }
        }
        
        if (!foundMatch) {
          console.error('Text not found when updating manual.mmd', { length: oldText.length });
          
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Text not found in file',
            searchedLength: oldText.length,
            firstChars: oldText.substring(0, 50)
          }));
          return;
        }

        // Replace against original content by locating the substring in normalized view first
        const indexInLF = fileLF.indexOf(foundText);
        let updatedContent;
        if (indexInLF !== -1) {
          // Map index back to original content by re-running up to indexInLF
          // Simpler approach: rebuild using normalized slices safely
          const beforeLF = fileLF.slice(0, indexInLF);
          const afterLF = fileLF.slice(indexInLF + foundText.length);
          updatedContent = beforeLF + newText + afterLF;
          // Write LF-only which is fine for markdown.
        } else {
          // Fallback to simple replace (should rarely happen)
          updatedContent = content.replace(foundText, newText);
        }
        fs.writeFileSync(filePath, updatedContent, 'utf-8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'File updated successfully' }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.mmd': 'text/plain'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`API Server running at http://localhost:${PORT}/`);
});

