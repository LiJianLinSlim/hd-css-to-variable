import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import postcss from 'postcss';
import scss from 'postcss-scss';

interface CssToVariableOptions {
  /** 要扫描的目录路径 */
  directory: string;
  /** 要提取的CSS属性列表 */
  properties: string[];
  /** 变量名前缀 */
  prefix?: string;
  /** 输出的变量文件名 */
  outputFile?: string;
  /** 文件匹配模式 */
  pattern?: string;
  /** 自定义变量命名规则 */
  nameFormatter?: (property: string, value: string) => string;
  /** 是否导出变量映射关系 */
  exportMap?: boolean;
}

interface ExtractedVariable {
  property: string;
  value: string;
  variableName: string;
  filePath: string;
  line: number;
}

interface VariableUsage {
  filePath: string;
  line: number;
  property: string;
  value: string;
}

interface VariableReport {
  variableName: string;
  value: string;
  usageCount: number;
  usages: VariableUsage[];
}

export class CssToVariable {
  private options: Required<CssToVariableOptions>;
  private extractedVariables: ExtractedVariable[] = [];
  private variableMap: Map<string, VariableReport> = new Map();

  constructor(options: CssToVariableOptions) {
    this.options = {
      directory: options.directory,
      properties: options.properties,
      prefix: options.prefix || 'var',
      outputFile: options.outputFile || 'variables.css',
      pattern: options.pattern || '**/*.{css,scss}',
      nameFormatter: options.nameFormatter || this.defaultNameFormatter.bind(this),
      exportMap: options.exportMap || false
    };
  }

  /**
   * 默认变量命名规则
   */
  private defaultNameFormatter(property: string, value: string): string {
    // 处理字符串类型的值
    if (value.startsWith('"') || value.startsWith('\'')) {
      // 保留字符串值，但移除引号并替换特殊字符
      const cleanValue = value.slice(1, -1).replace(/[^a-zA-Z0-9]/g, '-');
      return `--${this.options.prefix}-${property}-string-${cleanValue}`;
    }

    // 处理SCSS变量
    if (value.startsWith('$')) {
      // 在变量映射中查找实际值
      const scssVarName = value.replace(/^\$/, '');
      const scssVarValue = this.extractedVariables.find(v => v.variableName === `--${this.options.prefix}-${property}-${scssVarName}`)?.value;
      if (scssVarValue) {
        const cleanValue = scssVarValue.replace(/^#/, '').replace(/[^a-zA-Z0-9]/g, '');
        return `--${this.options.prefix}-${property}-${cleanValue}`;
      }
      return `--${this.options.prefix}-${property}-${scssVarName}`;
    }

    // 处理渐变色
    if (value.includes('gradient')) {
      // 提取渐变类型和颜色值
      const gradientMatch = value.match(/(linear|radial|conic)-gradient\s*\((.*?)\)/);
      if (gradientMatch) {
        const [, type, content] = gradientMatch;
        // 提取所有颜色值（包括十六进制、RGB、RGBA等）
        const colors = content.match(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi) || [];
        // 将所有颜色值组合成一个唯一标识符
        const colorsHash = colors
          .map(color => color.replace(/[^a-zA-Z0-9]/g, ''))
          .join('')
          .slice(0, 32); // 限制长度
        return `--${this.options.prefix}-${property}-${type}-${colorsHash}`;
      }
    }

    const cleanValue = value.replace(/^#/, '').replace(/[^a-zA-Z0-9]/g, '');
    return `--${this.options.prefix}-${property}-${cleanValue}`;
  }

  /**
   * 生成变量名
   */
  private generateVariableName(property: string, value: string): string {
    return this.options.nameFormatter(property, value);
  }

  /**
   * 更新变量使用统计
   */
  private updateVariableUsage(variable: ExtractedVariable): void {
    const key = `${variable.property}:${variable.value}`;
    if (!this.variableMap.has(key)) {
      this.variableMap.set(key, {
        variableName: variable.variableName,
        value: variable.value,
        usageCount: 0,
        usages: []
      });
    }

    const report = this.variableMap.get(key)!;
    report.usageCount++;
    report.usages.push({
      filePath: variable.filePath,
      line: variable.line,
      property: variable.property,
      value: variable.value
    });
  }

  /**
   * 解析单个文件
   */
  private async parseFile(filePath: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const result = await postcss().process(content, {
      from: filePath,
      syntax: path.extname(filePath) === '.scss' ? scss : undefined
    });

    // 创建一个新的PostCSS处理器实例来处理变量替换
    const processor = postcss();
    const root = result.root;

    // 首先处理SCSS变量定义
    if (path.extname(filePath) === '.scss') {
      root.walkDecls((decl) => {
        if (decl.prop.startsWith('$')) {
          const variableName = this.generateVariableName('color', decl.value);
          const variable = {
            property: 'color',
            value: decl.value,
            variableName,
            filePath,
            line: decl.source?.start?.line || 0
          };
          this.extractedVariables.push(variable);
        }
      });
    }

    root.walkDecls((decl) => {
      if (this.options.properties.includes(decl.prop) && !decl.value.startsWith('var(') && !decl.value.startsWith('--')) {
        const variableName = this.generateVariableName(decl.prop, decl.value);
        const variable = {
          property: decl.prop,
          value: decl.value,
          variableName,
          filePath,
          line: decl.source?.start?.line || 0
        };
        this.extractedVariables.push(variable);
        this.updateVariableUsage(variable);
        decl.value = `var(${variableName})`;
      }
    });

    const processedResult = await processor.process(root, {
      from: filePath,
      syntax: path.extname(filePath) === '.scss' ? scss : undefined
    });

    await fs.promises.writeFile(filePath, processedResult.css);
  }

  /**
   * 生成变量定义文件
   */
  private async generateVariablesFile(): Promise<void> {
    // 去重变量定义
    const uniqueVariables = new Map<string, string>();
    for (const variable of this.extractedVariables) {
      // 如果是字符串类型的值，确保保留引号
      const value = variable.value.startsWith('"') || variable.value.startsWith('\'') 
        ? variable.value 
        : variable.value;
      uniqueVariables.set(variable.variableName, value);
    }

    const variableDefinitions = Array.from(uniqueVariables.entries())
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');

    const content = `:root {\n${variableDefinitions}\n}\n`;
    await fs.promises.writeFile(path.join(this.options.directory, this.options.outputFile), content);

    // 如果需要导出变量映射关系
    if (this.options.exportMap) {
      const mapContent = JSON.stringify(Object.fromEntries(this.variableMap), null, 2);
      const mapFilePath = path.join(
        this.options.directory,
        this.options.outputFile.replace(/\.css$/, '.map.json')
      );
      await fs.promises.writeFile(mapFilePath, mapContent);
    }
  }

  /**
   * 执行变量提取
   */
  public async extract(): Promise<void> {
    const files = await glob(this.options.pattern, {
      cwd: this.options.directory,
      absolute: true
    });

    console.log(`\n🔍 正在扫描目录: ${this.options.directory}`);
    console.log(`📁 找到 ${files.length} 个匹配的文件\n`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = Math.round(((i + 1) / files.length) * 100);
      console.log(`⏳ [${progress}%] 正在处理: ${path.relative(this.options.directory, file)}`);
      await this.parseFile(file);
    }

    console.log('\n📝 正在生成变量定义文件...');
    await this.generateVariablesFile();

    const uniqueVariables = new Set(this.extractedVariables.map(v => v.variableName));
    console.log(`\n✨ 处理完成！`);
    console.log(`📊 统计信息:`);
    console.log(`   - 处理文件数: ${files.length} 个`);
    console.log(`   - 提取变量数: ${uniqueVariables.size} 个\n`);
  }

  /**
   * 获取变量使用报告
   */
  public getVariableReport(): VariableReport[] {
    return Array.from(this.variableMap.values());
  }
}