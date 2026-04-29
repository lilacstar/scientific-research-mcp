# Scientific Research MCP Server - 故障排除指南

## 目录

1. [安装问题](#安装问题)
2. [API 密钥问题](#api-密钥问题)
3. [工具执行问题](#工具执行问题)
4. [文件相关问题](#文件相关问题)
5. [性能问题](#性能问题)

---

## 安装问题

### Q: npm install 失败

**症状**：安装依赖时报错

**解决方案**：
```bash
# 清理缓存重试
npm cache clean --force
npm install

# 或使用镜像源
npm install --registry=https://registry.npmmirror.com
```

### Q: TypeScript 编译失败

**症状**：`npm run build` 报错

**解决方案**：
1. 检查 `tsconfig.json` 配置是否正确
2. 确保 TypeScript 版本兼容
3. 如果是纯 JavaScript 项目，可以跳过编译步骤

---

## API 密钥问题

### Q: ALIBABA_CLOUD_API_KEY is not set

**症状**：调用工具时报 "ALIBABA_CLOUD_API_KEY environment variable is not set"

**解决方案**：
1. 检查环境变量是否设置
2. 确保在启动 MCP 服务器前已设置密钥
3. Windows 用户在命令行中设置：
   ```cmd
   set ALIBABA_CLOUD_API_KEY=your-key-here
   ```
4. Linux/Mac 用户设置：
   ```bash
   export ALIBABA_CLOUD_API_KEY=your-key-here
   ```

### Q: API 调用失败

**症状**：调用 LLM API 时返回 401 或 403 错误

**解决方案**：
1. 确认 API 密钥有效且未过期
2. 检查账户余额是否充足
3. 确认 API 权限已开启

---

## 工具执行问题

### Q: paper_polisher 润色后内容丢失

**症状**：润色后的文件比原文短很多

**解决方案**：
1. 检查是否已修复分块处理逻辑（v1.1.0+ 已修复）
2. 查看备份文件：`*.backup.*.md`
3. 如果问题仍存在，尝试分章节润色：
   ```
   paper_polisher({ scope: "intro" })
   paper_polisher({ scope: "methods" })
   ```

### Q: paper_writer 生成内容为模板

**症状**：生成的章节只包含"[在此处...]"占位符

**解决方案**：
1. 检查 LLM API 是否正常连接
2. 查看控制台是否有 API 调用错误
3. 如果 API 调用失败，工具会返回模板作为降级方案

### Q: verify_content 验证失败

**症状**：验证工具返回大量错误

**解决方案**：
1. 检查论文草稿是否已完整写入
2. 确认元数据文件 `metadata.json` 存在
3. 如果是新增章节，等待文件写入完成后再验证

---

## 文件相关问题

### Q: 找不到论文文件

**症状**：工具返回 "未找到完整论文草稿"

**解决方案**：
1. 检查 `paper/` 目录是否存在
2. 确认文件名正确（如 `draft-full.md`）
3. 检查 `PAPER_DIR` 环境变量是否指向正确路径

### Q: 文件编码问题

**症状**：读取中文文件时出现乱码

**解决方案**：
1. 确保文件使用 UTF-8 编码保存
2. 在编辑器中设置编码为 UTF-8
3. 重新保存文件

### Q: 自动备份文件过多

**症状**：目录下出现大量 `*.backup.*.md` 文件

**解决方案**：
1. 定期清理旧的备份文件
2. 使用脚本批量删除：
   ```bash
   # Windows PowerShell
   Get-ChildItem *.backup.*.md | Remove-Item
   
   # Linux/Mac
   rm *.backup.*.md
   ```

---

## 性能问题

### Q: 工具响应缓慢

**症状**：调用工具后长时间无响应

**解决方案**：
1. 检查网络连接（LLM API 调用需要联网）
2. 检查 API 服务状态（阿里云 DashScope 可能有维护）
3. 长文本处理会分成多个块，每块都需要调用 API，属正常现象

### Q: 内存占用过高

**症状**：Node.js 进程占用大量内存

**解决方案**：
1. 重启 MCP 服务器
2. 避免同时处理过大的文件
3. 分批次处理任务

---

## 获取帮助

如果以上方法无法解决问题，请：

1. 检查项目 Issues：https://github.com/.../issues
2. 提供以下信息：
   - 错误日志
   - 复现步骤
   - 环境信息（Node.js 版本、操作系统）

---

*最后更新：2026-04-26*