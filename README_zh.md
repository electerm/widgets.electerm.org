# electerm-widgets

[electerm](https://electerm.org) 社区 widget 聚合站：部署在 Cloudflare Workers
Static Assets 上的纯静态站点。没有 Worker 脚本、没有数据库、无登录、无后台、无写接口。

本站**只索引元数据**，widget 代码由客户端从作者仓库按固定 commit 下载。安装
widget 等同于信任作者——其 `main.js` 运行在 electerm 主进程中，拥有完整的
Node.js 权限。

只是把 electerm 内置功能重新打包一遍的 widget 不收录，这里列的是应用本身没有的功能。

## 本地开发

```
npm install          # 生成 package-lock.json，请提交
npm test
npm run lint
npm run build        # 抓取源码，渲染 pug/stylus，生成 public/
npm run wdev         # wrangler dev，端口 26790
```

`public/` 为生成物且已加入 .gitignore，每次部署都由 `npm run build` 重建。
不需要数据库，也没有迁移步骤。

## 站点结构

站点源码在 `src/`，结构与 [electerm.org](https://electerm.org) 一致：

- `src/views/` — pug 页面（`index.pug`、`widgets.pug`、`widget.pug`、`404.pug`）与公共 `parts/`
- `src/css/` — `main.styl` 通过 `@require` 汇总 `css/parts/` 里每个区块的样式
- `src/js/pages/` — 每个页面一个原生 ESM 入口，引用 `js/parts/`

`/widgets/`（`public/widgets/index.html`）是独立清单页：只列出全部 widget，
没有 hero、how-to、trust 等区块。它沿用站点 header/footer 与「复制安装串」
按钮，只加载 `header.js` + `copy.js`。

共用的品牌资源（favicon、`electerm.png` 字标、PWA 图标）直接引用
`https://electerm.org`，不在本站复制一份；该域名已带
`Access-Control-Allow-Origin: *`。构建时只生成本站专属的
`public/site.webmanifest`，里面的图标 URL 用绝对路径。

`npm run build` 会把 stylus parts 编译成带内容哈希的 `styles.<hash>.css`，
渲染所有 pug 页面，并把 `js/` 复制进 `public/`。浏览器脚本是原生
ESM，不需要打包器。

## 数据契约

`GET /api/v1/index.json`、`GET /api/v1/widgets/<id>.json`、
`GET /api/v1/revocations.json` 与 `GET /health` 都是由 `data/widgets.json`
生成的静态文件。`generatedAt` 是构建时间，不是请求时间。`public/_headers`
为 `/api/v1/*` 加上 `Access-Control-Allow-Origin: *` 与
`Cache-Control: public, max-age=300`；未命中的路径通过
`not_found_handling = "404-page"` 返回 `404.html`。

只有带 `.json` 后缀的 URL，注册表里的 `filesUrl` 本来就使用该形式。

## 新增 widget

提 PR 修改 `data/widgets.json`，追加一项：

```json
{
  "host": "github.com",
  "owner": "electerm",
  "repo": "electerm-widget-tftp",
  "subdir": "",
  "ref": "<40 位小写十六进制 commit sha>"
}
```

`ref` **必须**是完整的 40 位小写 hex commit sha（不能是 tag 或分支）；固定 sha
才能保证 digest 可复现。widget 的 `package.json` 必须含 `electerm` 对象，且
`electerm.id` 匹配 `^[a-z0-9-]+$`。

## CI / 部署

`.github/workflows/deploy.yml` 在 push(main)、每日定时与手动触发时运行。需要
以下仓库 secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GITHUB_TOKEN` 由 Actions 自动提供。

工作流执行 `npm run build` 后直接 `wrangler deploy`。请提交 `npm install`
生成的 `package-lock.json`，以便 CI 中的 `npm ci` 正常工作。

## 安全说明

站点只索引元数据，代码从作者仓库下载。安装 widget 即信任作者——`main.js`
在 electerm 主进程中运行，拥有完整 Node.js 权限。
