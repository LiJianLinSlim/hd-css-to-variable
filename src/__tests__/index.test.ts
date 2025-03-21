import { CssToVariable } from '../index';
import * as fs from 'fs';
import * as path from 'path';

describe('CssToVariable', () => {
  const testDir = path.join(__dirname, 'fixtures');
  const stylesDir = path.join(testDir, 'styles');
  const outputFile = 'variables.css';

  beforeEach(() => {
    // 创建测试目录和styles子目录
    if (!fs.existsSync(stylesDir)) {
      fs.mkdirSync(stylesDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should extract CSS variables correctly', async () => {
    // 创建测试CSS文件在styles目录下
    const testCssContent = `
      .test {
        color: #ff0000;
        background-color: #00ff00;
        font-size: 16px;
      }
    `;
    const testCssPath = path.join(stylesDir, 'test.css');
    fs.writeFileSync(testCssPath, testCssContent);

    const cssToVariable = new CssToVariable({
      directory: testDir,
      properties: ['color', 'background-color'],
      prefix: 'test'
    });

    await cssToVariable.extract();

    // 验证变量文件是否生成
    const variablesPath = path.join(testDir, outputFile);
    expect(fs.existsSync(variablesPath)).toBe(true);

    // 验证变量内容
    const variablesContent = fs.readFileSync(variablesPath, 'utf-8');
    expect(variablesContent).toContain('--test-styles-color');
    expect(variablesContent).toContain('--test-styles-background-color');

    // 验证原文件是否被正确更新
    const updatedCssContent = fs.readFileSync(testCssPath, 'utf-8');
    expect(updatedCssContent).toContain('var(--test-styles-color)');
    expect(updatedCssContent).toContain('var(--test-styles-background-color)');
  });

  it('should handle SCSS files', async () => {
    // 创建测试SCSS文件在styles目录下
    const testScssPath = path.join(stylesDir, 'test.scss');
    // 创建测试SCSS内容
    const testScssContent = `
      .test {
        color: #ff0000;
        background-color: #00ff00;
        font-size: 16px;
      }
    `;
    fs.writeFileSync(testScssPath, testScssContent);

    const cssToVariable = new CssToVariable({
      directory: testDir,
      properties: ['color', 'background-color'],
      prefix: 'test'
    });

    await cssToVariable.extract();

    // 验证变量文件是否生成
    const variablesPath = path.join(testDir, outputFile);
    expect(fs.existsSync(variablesPath)).toBe(true);

    // 验证变量内容
    const variablesContent = fs.readFileSync(variablesPath, 'utf-8');
    expect(variablesContent).toContain('--test-styles-color');
    expect(variablesContent).toContain('--test-styles-color');
    expect(variablesContent).toContain('--test-styles-background-color');
  });

  it('should handle gradient values correctly', async () => {
    // 创建测试CSS文件在styles目录下
    const testCssPath = path.join(stylesDir, 'gradient.css');
    // 创建包含渐变的测试CSS内容
    const testCssContent = `
      .gradient {
        background: linear-gradient(to right, #ff0000, #00ff00);
        background-image: radial-gradient(circle, #ff0000, #00ff00);
      }
    `;
    fs.writeFileSync(testCssPath, testCssContent);

    const cssToVariable = new CssToVariable({
      directory: testDir,
      properties: ['background', 'background-image'],
      prefix: 'test'
    });

    await cssToVariable.extract();

    // 验证变量文件是否生成
    const variablesPath = path.join(testDir, outputFile);
    expect(fs.existsSync(variablesPath)).toBe(true);

    // 验证变量内容
    const variablesContent = fs.readFileSync(variablesPath, 'utf-8');
    expect(variablesContent).toContain('--test-styles-background');
    expect(variablesContent).toContain('--test-styles-background-image');

    // 验证原文件是否被正确更新
    const updatedCssContent = fs.readFileSync(testCssPath, 'utf-8');
    expect(updatedCssContent).toContain('var(--test-styles-background)');
    expect(updatedCssContent).toContain('var(--test-styles-background-image)');
  });

  it('should handle custom file pattern', async () => {
    // 创建测试CSS文件在styles目录下
    const testCssPath = path.join(stylesDir, 'test.custom.css');
    fs.writeFileSync(testCssPath, '.test { color: #ff0000; }');

    const cssToVariable = new CssToVariable({
      directory: testDir,
      properties: ['color'],
      pattern: '**/*.custom.css'
    });

    await cssToVariable.extract();

    const variablesPath = path.join(testDir, outputFile);
    const variablesContent = fs.readFileSync(variablesPath, 'utf-8');
    expect(variablesContent).toContain('--var-styles-color');
  });
});