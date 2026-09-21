// 本地测试：模拟华为云函数内置 HTTP 触发器
const http = require('http');
const { handler } = require('./index');

const server = http.createServer((req, res) => {
  handler(req, res).catch(err => {
    console.error('Handler error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal', msg: String(err) }));
    }
  });
});

const PORT = 3999;
server.listen(PORT, () => {
  console.log(`本地测试服务器运行在 http://localhost:${PORT}`);
  console.log('测试用 DASHSCOPE_API_KEY 环境变量（如未设置会返回 server_key_missing）');
});
