# css-to-variable

一个用于扫描CSS/SCSS文件并将指定属性值提取为全局CSS变量的工具。

## 功能特点

- 支持扫描CSS和SCSS文件
- 可配置需要提取的CSS属性
- 自定义变量名前缀
- 自定义输出文件名
- 支持自定义文件匹配模式
- 支持自定义变量命名规则
- 支持渐变色值提取
- 支持导出变量映射关系
- 提供命令行工具
- 提供变量使用情况报告

## 安装

```bash
# 使用npm安装
npm install css-to-variable

# 使用pnpm安装
pnpm add css-to-variable

# 使用yarn安装
yarn add css-to-variable
```

## 使用方法

### 命令行工具

```bash
# 使用预设参数执行变量提取
hd-css-to-variable build -d ./src

# 使用自定义参数执行变量提取
hd-css-to-variable extract -d ./src -p color,background-color --prefix theme
```

### 代码调用

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
  pattern: '**/*.css',
  // 自定义变量命名规则（可选）
  nameFormatter: (property, value) => `custom-${property}-${value}`,
  // 是否导出变量映射关系（可选，默认为false）
  exportMap: true
});

// 执行变量提取
await cssToVariable.extract();

// 获取变量使用报告
const report = cssToVariable.getVariableReport();
```

## 示例

假设有以下CSS文件：

```css
/* styles.css */
.button {
  color: #ff0000;
  background-color: #00ff00;
  padding: 10px;
  background: linear-gradient(to right, #ff0000, rgba(0, 255, 0, 0.5));
}

.text {
  color: #0000ff;
}
```

执行以下代码：

```typescript
const cssToVariable = new CssToVariable({
  directory: './src',
  properties: ['color', 'background-color', 'background'],
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
  --theme-background-linear-gradient: linear-gradient(to right, #ff0000, rgba(0, 255, 0, 0.5));
}
```

并更新原始CSS文件：

```css
/* styles.css */
.button {
  color: var(--theme-color-ff0000);
  background-color: var(--theme-background-color-00ff00);
  padding: 10px;
  background: var(--theme-background-linear-gradient);
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
| nameFormatter | function | 否 | - | 自定义变量命名规则 |
| exportMap | boolean | 否 | false | 是否导出变量映射关系 |

## 命令行选项

### build 命令

| 选项 | 说明 | 默认值 |
|------|------|--------|
| -d, --directory | 要扫描的目录路径 | ./src |

### extract 命令

| 选项 | 说明 | 默认值 |
|------|------|--------|
| -d, --directory | 要扫描的目录路径 | - |
| -p, --properties | 要提取的CSS属性列表，用逗号分隔 | - |
| --prefix | 变量名前缀 | var |
| --output | 输出的变量文件名 | variables.css |
| --pattern | 文件匹配模式 | **/*.{css,scss} |

## 注意事项

1. 该工具会直接修改原始文件，建议在使用前备份重要文件
2. 对于SCSS文件，工具会正确处理嵌套的选择器
3. 变量名会根据属性名和值自动生成，确保唯一性
4. 支持处理渐变色值，会自动生成对应的变量
5. 支持处理rgba和hsla等带透明度的颜色值
6. 可以通过nameFormatter自定义变量命名规则
7. 可以通过getVariableReport获取变量使用情况报告

## 许可证

MIT