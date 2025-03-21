import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import postcss from 'postcss';
import scss from 'postcss-scss';
import imageToBase64 from 'image-to-base64';
import NameMap from './constant';

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
  /** 是否导出图片资源base64 */
  assetsOutput?: boolean; 
  /** 是否按文件夹拆分变量文件 */
  splitByFolder?: boolean;  
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
  private extractedAssets: ExtractedVariable[] = [];  // 新增：存储资源变量
  private variableMap: Map<string, VariableReport> = new Map();

  constructor(options: CssToVariableOptions) {
    this.options = {
      directory: options.directory,
      properties: options.properties,
      prefix: options.prefix || '',
      outputFile: options.outputFile || 'variables.css',
      pattern: options.pattern || '**/*.{css,scss}',
      nameFormatter: options.nameFormatter || this.defaultNameFormatter.bind(this),
      exportMap: options.exportMap || false,
      assetsOutput: options.assetsOutput || false,
      splitByFolder: options.splitByFolder || false  // 添加 splitByFolder 的初始化
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
    const rewriteProperty = NameMap[property as keyof typeof NameMap] || property;
   
    // 生成基础变量名
    const baseVariableName = `--${this.options.prefix ? this.options.prefix + '-' : ''}${folderName ? `${folderName + '-'}` : ''}${className ? `${className + '-'}` : ''}${rewriteProperty}`;

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

    let variablesCount = 0;
    const declarations: postcss.Declaration[] = [];
    root.walkDecls((decl) => {
      declarations.push(decl);
    });

    for (const decl of declarations) {
      if (this.options.properties.includes(decl.prop) && !decl.value.startsWith('var(') && !decl.value.startsWith('--')) {
        // 检查属性值是否包含SCSS变量（$符号）
        if (decl.value.includes('$')) {
          continue;  // 改用 continue 而不是 return，确保继续处理其他声明
        }

        // 处理所有图片路径，包括相对路径和url()函数
        const isImageUrl = decl.value.match(/url\(['"]?([^'")\s]+\.(?:png|jpg|jpeg|gif|svg|webp))['"]?\)/i);
        
        if (isImageUrl) {
          try {
            const imgPath = path.resolve(
              path.dirname(decl.source?.input.file || ''),
              isImageUrl[1]
            );
            
            if (fs.existsSync(imgPath)) {
              const base64String = await imageToBase64(imgPath);
              const imageType = path.extname(imgPath).slice(1);
              const base64Value = `url(data:image/${imageType};base64,${base64String})`;
              
              const variableName = this.options.nameFormatter(decl.prop, base64Value, decl);
              const variable = {
                property: decl.prop,
                value: base64Value,
                variableName,
                filePath,
                line: decl.source?.start?.line || 0
              };
              
              this.extractedAssets.push(variable);
              this.updateVariableUsage(variable);
              variablesCount++;
            }
          } catch (error) {
            console.warn(`⚠️ 警告：处理图片 ${decl.value} 时出错：`, error);
          }
          continue;  // 改用 continue 而不是 return，确保继续处理其他声明
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
    };

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
    // 按文件夹分组变量
    const variablesByFolder = new Map<string, ExtractedVariable[]>();
    for (const variable of this.extractedVariables) {
      const filePath = variable.filePath;
      const relativePath = path.relative(this.options.directory, filePath);
      const folderPath = path.dirname(relativePath);
      
      if (!variablesByFolder.has(folderPath)) {
        variablesByFolder.set(folderPath, []);
      }
      variablesByFolder.get(folderPath)!.push(variable);
    }

    // 如果没有提取到任何变量，则输出提示信息并返回
    if (this.extractedVariables.length === 0) {
      console.log('⚠️ 警告：未提取到任何CSS变量，跳过文件生成。');
      return;
    }

    // 生成CSS变量定义内容
    let variablesContent = ':root {\n';

    // 按文件夹生成分组注释和变量
    for (const [folder, variables] of variablesByFolder) {
      // 添加文件夹注释
      variablesContent += `\n  /* ${folder === '.' ? '根目录' : folder} */\n`;

      // 去重并生成变量定义
      const uniqueVariables = new Map<string, string>();
      for (const variable of variables) {
        uniqueVariables.set(variable.variableName, variable.value);
      }

      // 添加变量定义
      variablesContent += Array.from(uniqueVariables.entries())
        .map(([name, value]) => `  ${name}: ${value};`)
        .join('\n') + '\n';
    }

    variablesContent += '}\n';


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
   * 生成资源变量文件
   */
  private async generateAssetsFile(): Promise<void> {
    // 如果不需要输出资源文件或没有提取到资源，直接返回
    if (!this.options.assetsOutput || this.extractedAssets.length === 0) {
      return;
    }

    let assetsContent = ':root {\n';
    assetsContent += `\n  /* 资源变量 */\n`;

    const uniqueAssets = new Map<string, string>();
    for (const asset of this.extractedAssets) {
      uniqueAssets.set(asset.variableName, asset.value);
    }

    assetsContent += Array.from(uniqueAssets.entries())
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n') + '\n';

    assetsContent += '}\n';

    const assetsFilePath = path.join(this.options.directory, 'assets.css');
    await fs.promises.writeFile(assetsFilePath, assetsContent);
    console.log(`✨ 生成资源变量文件: assets.css`);
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
    if (this.options.assetsOutput) {
      await this.generateAssetsFile();
    }
    
    console.log(`🎉 所有文件处理完成！共处理 ${files.length} 个文件，提取 ${this.extractedVariables.length} 个变量${this.options.assetsOutput ? `，${this.extractedAssets.length} 个资源变量` : ''}`);
  }

  /**
   * 获取变量使用报告
   */
  public getVariableReport(): VariableReport[] {
    return Array.from(this.variableMap.values());
  }
}