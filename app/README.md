# MCN LiveOS 正式版

这是从当前静态版 `mcn` 升级出来的 React/Vite 正式版项目。

## 当前状态

已完成：

- React + TypeScript 项目骨架
- 登录页
- 本地账号 fallback
- 老板/财务/运营/员工角色
- 财务菜单权限控制
- 总览、达人、商家、直播场次、员工、直播数据、财务模块
- 本地数据新增、编辑、删除 fallback
- Supabase 客户端配置入口
- Supabase 建表和 RLS 初稿
- Supabase 真实登录接入
- Supabase 数据库 CRUD 接入

尚未完成：

- 线上部署配置
- 现有 localStorage 数据导入脚本

## 本地运行

```bash
npm install
npm run dev
```

默认测试账号：

- `weilun / 123456`：老板
- `boss / 123456`：老板
- `finance / 123456`：财务
- 员工姓名 / `123456`：运营或员工

## 接入 Supabase

1. 创建 Supabase 项目
2. 在 Supabase SQL Editor 执行：

```text
supabase/schema.sql
```

3. 复制环境变量：

```bash
cp .env.example .env.local
```

4. 填入：

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

5. 在 Supabase Authentication > Users 创建内部账号：

- `weilun@mcn.local` / `123456`
- `finance@mcn.local` / `123456`
- 其他员工也用 `账号@mcn.local` 的格式

6. 复制每个用户的 User UID，替换并执行：

```text
supabase/auth_profiles_template.sql
```

完成后，用 `weilun`、`finance` 这类账号名登录即可。系统会自动转成 `账号@mcn.local` 去登录 Supabase。

## 构建

```bash
npm run build
```
