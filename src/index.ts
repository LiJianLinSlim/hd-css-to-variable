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
  nameFormatter?: (property: string, value: string, decl?: postcss.Declaration) => string;
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
  private defaultNameFormatter(property: string, value: string, decl?: postcss.Declaration): string {
    // 获取文件夹名和类名
    let folderName = '';
    let className = '';

    if (decl) {
      // 获取文件夹名
      const filePath = decl.source?.input.file || '';
      if (filePath) {
        const relativePath = path.relative(this.options.directory, filePath);
        const pathParts = relativePath.split(path.sep);
        if (pathParts.length > 1) {
          folderName = pathParts[pathParts.length - 2];
        }
      }

      // 获取类名
      let parent = decl.parent as postcss.Rule | undefined;
      while (parent) {
        if (parent.type === 'rule') {
          const selectorMatch = parent.selector.match(/\.(([\w-]+))/);
          if (selectorMatch) {
            className = selectorMatch[1];
            break;
          }
        }
        parent = parent.parent as postcss.Rule | undefined;
      }
    }

    // 生成基础变量名
    const baseVariableName = `--${this.options.prefix}${folderName ? `-${folderName}` : ''}${className ? `-${className}` : ''}-${property}`;

    // 检查变量名是否已存在，如果存在则添加序号
    let finalVariableName = baseVariableName;
    let counter = 1;

    while (this.extractedVariables.some(v => v.variableName === finalVariableName)) {
      finalVariableName = `${baseVariableName}-${counter}`;
      counter++;
    }

    return finalVariableName;
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
    console.log(`📝 正在处理文件: ${path.relative(this.options.directory, filePath)}`);  // 添加文件处理提示
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

    let variablesCount = 0;  // 添加变量计数
    root.walkDecls((decl) => {
      if (this.options.properties.includes(decl.prop) && !decl.value.startsWith('var(') && !decl.value.startsWith('--')) {
        // 检查属性值是否为相对路径，如果是则跳过处理
        if (decl.value.startsWith('./') || decl.value.startsWith('../') || decl.value.match(/^[^/].*\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
          return;
        }
        // 如果属性值为transparent，跳过处理
        if (decl.value.toLowerCase() === 'transparent') {
          return;
        }
        const variableName = this.options.nameFormatter(decl.prop, decl.value, decl);
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
        variablesCount++; // 增加变量计数
      }
    });

    if (variablesCount > 0) {
      console.log(`✨ 从文件中提取了 ${variablesCount} 个变量`);  // 显示提取的变量数量
    }

    const processedResult = await processor.process(root, {
      from: filePath,
      syntax: path.extname(filePath) === '.scss' ? scss : undefined
    });

    await fs.promises.writeFile(filePath, processedResult.css);
    console.log(`✅ 文件更新完成: ${path.relative(this.options.directory, filePath)}`);  // 添加文件更新完成提示
  }

  /**
   * 生成变量定义文件
   */
  private async generateVariablesFile(): Promise<void> {
    // 去重变量定义
    const uniqueVariables = new Map<string, string>();
    for (const variable of this.extractedVariables) {
      uniqueVariables.set(variable.variableName, variable.value);
    }

    // 如果没有提取到任何变量，则输出提示信息并返回
    if (uniqueVariables.size === 0) {
      console.log('⚠️ 警告：未提取到任何CSS变量，跳过文件生成。');
      return;
    }

    // 生成CSS变量定义内容
    const variablesContent = ':root {\n' +
      Array.from(uniqueVariables.entries())
        .map(([name, value]) => `  ${name}: ${value};`)
        .join('\n') +
      '\n}\n';

    // 处理文件名冲突
    let outputFilePath = path.join(this.options.directory, this.options.outputFile);
    let counter = 1;
    const ext = path.extname(outputFilePath);
    const base = outputFilePath.slice(0, -ext.length);

    while (fs.existsSync(outputFilePath)) {
      outputFilePath = `${base}-${counter}${ext}`;
      counter++;
    }

    // 写入文件
    await fs.promises.writeFile(outputFilePath, variablesContent);

    // 如果文件名与原始文件名不同，输出提示信息
    if (outputFilePath !== path.join(this.options.directory, this.options.outputFile)) {
      console.log(`ℹ️ 提示：由于文件名冲突，变量文件已保存为：${path.basename(outputFilePath)}`);
    }

    // 如果需要导出变量映射关系
    if (this.options.exportMap) {
      const mapContent = JSON.stringify(Object.fromEntries(this.variableMap), null, 2);
      const mapFilePath = outputFilePath.replace(/.css$/, '.map.json');
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

    console.log(`🔍 找到 ${files.length} 个文件需要处理`);  // 添加文件总数提示

    let processedFiles = 0;  // 添加已处理文件计数
    for (const file of files) {
      await this.parseFile(file);
      processedFiles++;  // 增加已处理文件计数
      const progress = Math.round((processedFiles / files.length) * 100);  // 计算进度百分比
      console.log(`📊 总进度: ${progress}%`);  // 显示总进度
    }

    await this.generateVariablesFile();
    console.log(`🎉 所有文件处理完成！共处理 ${files.length} 个文件，提取 ${this.extractedVariables.length} 个变量`);  // 添加完成统计
  }

  /**
   * 获取变量使用报告
   */
  public getVariableReport(): VariableReport[] {
    return Array.from(this.variableMap.values());
  }
}