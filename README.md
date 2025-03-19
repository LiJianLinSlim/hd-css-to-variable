# css-to-variable

一个用于扫描CSS/SCSS文件并将指定属性值提取为全局CSS变量的工具。

## 功能特点

- 支持扫描CSS和SCSS文件
- 可配置需要提取的CSS属性
- 自定义变量名前缀
- 自定义输出文件名
- 支持自定义文件匹配模式

## 安装

```bash
npm install css-to-variable
```

## 使用方法

```typescript
import { CssToVariable } from 'css-to-variable';

const cssToVariable = new CssToVariable({
  // 要扫描的目录路径
  directory: './src',
  // 要提取的CSS属性列表
  properties: ['color', 'background-color'],
  // 变量名前缀（可选，默认为'var'）
  prefix: 'theme',
  // 输出的变量文件名（可选，默认为'variables.css'）
  outputFile: 'theme-variables.css',
  // 文件匹配模式（可选，默认为'**/*.{css,scss}'）
  pattern: '**/*.css'
});

// 执行变量提取
await cssToVariable.extract();
```

## 示例

假设有以下CSS文件：

```css
/* styles.css */
.button {
  color: #ff0000;
  background-color: #00ff00;
  padding: 10px;
}

.text {
  color: #0000ff;
}
```

执行以下代码：

```typescript
const cssToVariable = new CssToVariable({
  directory: './src',
  properties: ['color', 'background-color'],
  prefix: 'theme'
});

await cssToVariable.extract();
```

将生成以下文件：

```css
/* variables.css */
:root {
  --theme-color-ff0000: #ff0000;
  --theme-background-color-00ff00: #00ff00;
  --theme-color-0000ff: #0000ff;
}
```

并更新原始CSS文件：

```css
/* styles.css */
.button {
  color: var(--theme-color-ff0000);
  background-color: var(--theme-background-color-00ff00);
  padding: 10px;
}

.text {
  color: var(--theme-color-0000ff);
}
```

## 配置选项

| 选项 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| directory | string | 是 | - | 要扫描的目录路径 |
| properties | string[] | 是 | - | 要提取的CSS属性列表 |
| prefix | string | 否 | 'var' | 变量名前缀 |
| outputFile | string | 否 | 'variables.css' | 输出的变量文件名 |
| pattern | string | 否 | '**/*.{css,scss}' | 文件匹配模式 |

## 注意事项

1. 该工具会直接修改原始文件，建议在使用前备份重要文件
2. 对于SCSS文件，工具会正确处理嵌套的选择器
3. 变量名会根据属性名和值自动生成，确保唯一性

## 许可证

MIT