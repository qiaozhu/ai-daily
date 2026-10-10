## 关联 Issue
Closes #

## 改了什么
<!-- 简述改动；UI 改动请附 桌面 1440 + 手机 390、浅色 + 深色 截图 -->

## 类型
- [ ] feature　- [ ] bug fix　- [ ] chore / docs

## 检查清单
- [ ] 分支名符合 `feat|fix|chore/<issue>-<slug>`
- [ ] `npm run check` 通过（CI 绿）
- [ ] `node tests/ui-v2.js http://127.0.0.1:8787` 本地全部通过（UI/前端/API 改动必填，贴结果末行）
- [ ] 新功能已补充/更新测试（tests/）
- [ ] 文档已更新（docs/product、docs/design、docs/test、docs/deploy 中受影响的部分）
- [ ] 没有提交任何密钥 / token / .env
- [ ] 数据库结构变更有新的 migrations/NNNN_*.sql，且可重复执行

## 测试 bot 结论
<!-- 测试 bot 填写：测试范围、结果、截图路径；通过后 Approve -->

## 部署说明
<!-- 是否需要迁移、是否只需 daily.sh（纯数据）、回滚方式 -->
