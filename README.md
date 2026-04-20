# cacopro-site

个人主页与分享目录。

## 结构

- `/`：个人主页壳子
- `/talks/`：分享目录
- `/talks/zmagine-tech-conference/`：Zmagine 技术大会分享
- `/talks/openclaw-first-experiment/`：OpenClaw 分享页
- `/docs/cacopro-site-runbook.md`：站点运维与发布手册
- `/scripts/verify-talk.mjs`：分享页交互 smoke test

## 本地预览

```bash
python3 -m http.server 8080
```

打开 [http://127.0.0.1:8080/](http://127.0.0.1:8080/)

## 分享页验证

```bash
NODE_PATH="$HOME/.agents/skills/dev-browser/node_modules" \
node scripts/verify-talk.mjs http://127.0.0.1:8080/talks/zmagine-tech-conference/
```
