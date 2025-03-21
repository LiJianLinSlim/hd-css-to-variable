#!/usr/bin/env node

import { program } from 'commander';
import { CssToVariable } from './index';
import * as path from 'path';
import * as fs from 'fs';

program
  .name('hd-css-to-variable')
  .description('将CSS/SCSS文件中的指定属性值提取为全局CSS变量')
  .version('1.0.5')
  .addHelpText('after', `
示例:
  $ hd-css-to-variable build -d ./src
  $ hd-css-to-variable extract -d ./src -p color,background-color
  $ hd-css-to-variable extract -d ./src -p color,background-image --prefix theme --assets-output true

命令:
  build                使用预设参数执行变量提取
  extract              使用自定义参数执行变量提取

选项:
  -d, --directory      要扫描的目录路径
  -p, --properties     要提取的CSS属性列表，用逗号分隔
  --prefix             变量名前缀 (默认: "var")
  --output            输出的变量文件名 (默认: "variables.css")
  --pattern           文件匹配模式 (默认: "**/*.{css,scss}")
  --assets-output     是否输出图片资源的base64变量 (默认: false)
  -h, --help          显示帮助信息
  -v, --version       显示版本号
`);

program
  .command('build')
  .description('使用预设参数执行变量提取')
  .option('-d, --directory <path>', '要扫描的目录路径', './src')
  .action((options) => {
    const directory = path.resolve(options.directory);
    
    // 检查目录是否存在
    if (!fs.existsSync(directory)) {
      console.error('❌ 错误：指定的目录不存在！');
      process.exit(1);
    }

    const cssToVariable = new CssToVariable({
      directory,
      properties: ['color', 'background-color','background-image', 'background'],
      prefix: ''
    });

    cssToVariable.extract()
      .then(() => {
        console.log('✨ CSS变量提取完成！');
      })
      .catch((error) => {
        console.error('❌ 发生错误：', error);
        process.exit(1);
      });
  });

program
  .command('extract')
  .description('使用自定义参数执行变量提取')
  .requiredOption('-d, --directory <path>', '要扫描的目录路径')
  .requiredOption('-p, --properties <items>', '要提取的CSS属性列表，用逗号分隔')
  .option('--prefix <string>', '变量名前缀', 'var')
  .option('--output <filename>', '输出的变量文件名', 'variables.css')
  .option('--pattern <pattern>', '文件匹配模式', '**/*.{css,scss}')
  .option('--assets-output <boolean>', '是否输出图片资源的base64变量', false)
  .option('--split-by-folder <boolean>', '是否按文件夹拆分变量文件', false)  // 添加新参数
  .action((options) => {
    const directory = path.resolve(options.directory);
    
    // 检查目录是否存在
    if (!fs.existsSync(directory)) {
      console.error('❌ 错误：指定的目录不存在！');
      process.exit(1);
    }

    const cssToVariable = new CssToVariable({
      directory,
      properties: options.properties.split(','),
      prefix: options.prefix,
      outputFile: options.output,
      pattern: options.pattern,
      assetsOutput: options.assetsOutput === 'true'  // 将字符串转换为布尔值传递给参数
    });

    cssToVariable.extract()
      .then(() => {
        console.log('✨ CSS变量提取完成！');
      })
      .catch((error) => {
        console.error('❌ 发生错误：', error);
        process.exit(1);
      });
  });

program.parse();