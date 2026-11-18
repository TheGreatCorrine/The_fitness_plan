# 正式双账户配置

使用项目专属 Supabase 实例。正式入口支持登录、照片打卡、审核、装备购买和金币流水。试玩入口 /demo 使用独立的内存数据。照片提交额外使用仅服务端可读的 SUPABASE_SECRET_KEY。不要提供密码或 service_role key 给聊天或 Git 仓库。

1. 在 Supabase Dashboard → Authentication 关闭 Allow new users to sign up，同时关闭匿名登录。保持 Email/password 登录可用。本地 CLI 的 config.toml 同样关闭注册。Hosted 配置需要在 Dashboard 单独设置。
2. 用 SQL Editor 按顺序各执行一次 migrations 下的 001_game、002_economy、003_rewards 三份 SQL（按文件名升序）；已完成 Phase 3 的项目只需运行 202611180003_rewards.sql，或在已关联的 Supabase CLI 工作目录运行 supabase db push。不要混用两种迁移记录方式。迁移创建 S1 目录、两种角色、默认零余额、RLS 及私有 checkin-evidence 存储桶。
3. 在 Authentication → Users 使用管理员 Create user 创建两位已确认邮箱的密码账号，复制各自的 Auth User UID。仅在 Dashboard SQL Editor 中执行以下语句，以真实 UUID 替换占位符。事务失败时整体回滚。角色绑定不读取用户可编辑的 metadata。

```sql
begin;
insert into public.profiles (id,role) values
 ('<小张的 Auth User UID>'::uuid,'player'),
 ('<女友的 Auth User UID>'::uuid,'admin');
commit;
```

4. 在 .env.local 或 Vercel 项目环境中填写 NEXT_PUBLIC_SUPABASE_URL 、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 和仅服务端的 SUPABASE_SECRET_KEY，重新启动或部署 Next.js。使用 Node 24，安装 npm ci，运行 npm run dev。生产命令 npm run build、npm start。使用服务端 Next.js 部署。
5. 用两个独立浏览器会话登录。玩家抵达 /room，管理员抵达 /sponsor。互访对方路径会跳回自己的入口，退出后访问两条路径均跳回 /login。未绑定的 Auth 用户无法进入正式游戏。
6. 数据库角色只读业务表。照片路径形如 玩家UUID/随机文件名.png，限制 8 MiB 及 JPEG、PNG、WebP。玩家从 /room 上传；表单限制 3 MiB，以适配服务端请求大小。服务端确认玩家、检查文件签名、计算 SHA-256 后写入私有桶。玩家可以读取自己的照片；管理员在 /sponsor 通过五分钟有效的链接审核。对明确被数据库拒绝的提交会尝试删除刚上传的照片；网络中断或清理失败可能留下未关联的私有文件，不会发币。

npm test 包含 PGlite PostgreSQL 权限测试，实际执行同一迁移。测试模拟托管平台的 auth.uid()、存储对象表和 API 角色，不覆盖托管 Auth HTTP、邮件投递、对象上传或 Cookie 跨设备生命周期。正式验收请使用专属项目及两组浏览器会话。

Phase 4 无新增环境变量。玩家在 /room/collection 换装、收信、申请兑奖；管理员在 /sponsor/rewards 发信、授章、维护模板和确认实付。升级时会补记已有库存与历史获批打卡达成的徽章，并沿用原有穿搭。每日信按多伦多审核日期从已启用的日常模板中选一封，附件需本人领取。
