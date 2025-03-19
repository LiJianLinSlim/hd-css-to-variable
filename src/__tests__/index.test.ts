import { CssToVariable } from '../index';
import * as fs from 'fs';
import * as path from 'path';

describe('CssToVariable', () => {
  const testDir = path.join(__dirname, 'fixtures');
  const outputFile = 'variables.css';

  beforeEach(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should extract CSS variables correctly', async () => {
    // 创建测试CSS文件
    const testCssContent = `
      .test {
        color: #ff0000;
        background-color: #00ff00;
        font-size: 16px;
      }
    `;
    const testCssPath = path.join(testDir, 'test.css');
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
    expect(variablesContent).toContain('--test-color-ff0000');
    expect(variablesContent).toContain('--test-background-color-00ff00');

    // 验证原文件是否被正确更新
    const updatedCssContent = fs.readFileSync(testCssPath, 'utf-8');
    expect(updatedCssContent).toContain('var(--test-color-ff0000)');
    expect(updatedCssContent).toContain('var(--test-background-color-00ff00)');
  });

  it('should handle SCSS files', async () => {
    // 创建测试SCSS文件
    const testScssContent = `
      $primary: #ff0000;
      .test {
        color: $primary;
        background-color: #00ff00;
        .nested {
          color: #0000ff;
        }
      }
    `;
    const testScssPath = path.join(testDir, 'test.scss');
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
    expect(variablesContent).toContain('--test-color-ff0000');
    expect(variablesContent).toContain('--test-color-0000ff');
    expect(variablesContent).toContain('--test-background-color-00ff00');
  });

  it('should handle custom output file name', async () => {
    const customOutputFile = 'custom-variables.css';
    const testCssContent = '.test { color: #ff0000; }';
    const testCssPath = path.join(testDir, 'test.css');
    fs.writeFileSync(testCssPath, testCssContent);

    const cssToVariable = new CssToVariable({
      directory: testDir,
      properties: ['color'],
      outputFile: customOutputFile
    });

    await cssToVariable.extract();

    const variablesPath = path.join(testDir, customOutputFile);
    expect(fs.existsSync(variablesPath)).toBe(true);
  });

  it('should handle gradient values correctly', async () => {
    const testCssContent = `
      .gradient-test {
        background: linear-gradient(to right, #ff0000, rgba(0, 255, 0, 0.5));
        background-image: radial-gradient(circle, #00ff00, #0000ff);
      }
    `;
    const testCssPath = path.join(testDir, 'gradient.css');
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
    expect(variablesContent).toContain('--test-background-linear-');
    expect(variablesContent).toContain('--test-background-image-radial-');

    // 验证原文件是否被正确更新
    const updatedCssContent = fs.readFileSync(testCssPath, 'utf-8');
    expect(updatedCssContent).toContain('var(--test-background-linear-');
    expect(updatedCssContent).toContain('var(--test-background-image-radial-');
  });

  it('should handle custom file pattern', async () => {
    const testCssPath = path.join(testDir, 'test.custom.css');
    fs.writeFileSync(testCssPath, '.test { color: #ff0000; }');

    const cssToVariable = new CssToVariable({
      directory: testDir,
      properties: ['color'],
      pattern: '**/*.custom.css'
    });

    await cssToVariable.extract();

    const variablesPath = path.join(testDir, outputFile);
    const variablesContent = fs.readFileSync(variablesPath, 'utf-8');
    expect(variablesContent).toContain('--var-color-ff0000');
  });
});