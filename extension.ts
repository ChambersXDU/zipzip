import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip = require('adm-zip');
import * as tar from 'tar';

function yieldToUI(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

function collectFiles(dir: string, baseDir: string = dir): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(fullPath, baseDir));
        } else {
            results.push(path.relative(baseDir, fullPath));
        }
    }
    return results;
}

export function activate(context: vscode.ExtensionContext) {

    function getNextAvailablePath(basePath: string): string {
        if (!fs.existsSync(basePath)) return basePath;

        const isTarGz = /\.tar\.gz$/i.test(basePath);
        const ext = isTarGz ? '.tar.gz' : path.extname(basePath);
        const nameWithoutExt = basePath.slice(0, basePath.length - ext.length);
        
        let counter = 1;
        while (fs.existsSync(`${nameWithoutExt}-${counter}${ext}`)) {
            counter++;
        }
        return `${nameWithoutExt}-${counter}${ext}`;
    }

    let compressCmd = vscode.commands.registerCommand('zipzip.compress', async (uri: vscode.Uri) => {
        if (!uri) return;
        const folderPath = uri.fsPath;
        const targetZipPath = getNextAvailablePath(folderPath + ".zip");

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "zipzip 正在压缩...",
            cancellable: false
        }, async (progress) => {
            try {
                const zip = new AdmZip();
                const allFiles = collectFiles(folderPath);
                const total = allFiles.length;

                progress.report({ message: `0/${total} 个文件` });

                for (let i = 0; i < allFiles.length; i++) {
                    const relPath = allFiles[i];
                    const fullPath = path.join(folderPath, relPath);
                    zip.addLocalFile(fullPath, path.dirname(relPath).split(path.sep).join('/'));

                    progress.report({
                        increment: 100 / total,
                        message: `${i + 1}/${total} 个文件`
                    });

                    if (i % 10 === 0) {
                        await yieldToUI();
                    }
                }

                progress.report({ message: "正在写入..." });
                await yieldToUI();
                zip.writeZip(targetZipPath);
                vscode.window.showInformationMessage(`压缩成功: ${path.basename(targetZipPath)}`);
            } catch (err) {
                vscode.window.showErrorMessage("压缩失败: " + err);
            }
        });
    });

    // --- 解压 (zip/tar/tgz -> 文件夹) ---
    let extractCmd = vscode.commands.registerCommand('zipzip.extract', async (uri: vscode.Uri) => {
        if (!uri) return;
        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        
        // 自动识别后缀情况，计算目标文件夹名
        let folderName = fileName.replace(/\.(zip|tar|tgz|tar\.gz)$/i, '');
        const targetDir = getNextAvailablePath(path.join(path.dirname(filePath), folderName));

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "zipzip 正在解压...",
            cancellable: false
        }, async (progress) => {
            try {
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                if (fileName.toLowerCase().endsWith('.zip')) {
                    const zip = new AdmZip(filePath);
                    const entries = zip.getEntries();
                    const total = entries.length;

                    progress.report({ message: `0/${total} 个文件` });

                    for (let i = 0; i < entries.length; i++) {
                        const entry = entries[i];
                        const entryPath = path.join(targetDir, entry.entryName);
                        const resolvedEntryPath = path.resolve(entryPath);
                        const resolvedTargetDir = path.resolve(targetDir);
                        if (!resolvedEntryPath.startsWith(resolvedTargetDir + path.sep) && resolvedEntryPath !== resolvedTargetDir) {
                            throw new Error(`Unsafe path in zip entry: ${entry.entryName}`);
                        }

                        if (entry.isDirectory) {
                            fs.mkdirSync(entryPath, { recursive: true });
                        } else {
                            fs.mkdirSync(path.dirname(entryPath), { recursive: true });
                            fs.writeFileSync(entryPath, entry.getData());
                        }

                        progress.report({
                            increment: 100 / total,
                            message: `${i + 1}/${total} 个文件`
                        });

                        if (i % 10 === 0) {
                            await yieldToUI();
                        }
                    }
                } else {
                    // 处理 tar 相关格式
                    await tar.extract({
                        file: filePath,
                        cwd: targetDir,
                        filter: (entryPath) => {
                            progress.report({ message: entryPath });
                            return true;
                        }
                    });
                }
                vscode.window.showInformationMessage(`解压成功: ${path.basename(targetDir)}`);
            } catch (err) {
                // 如果解压中途失败，清理创建的空目录
                if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length === 0) {
                    fs.rmdirSync(targetDir);
                }
                vscode.window.showErrorMessage("解压失败: " + err);
            }
        });
    });

    context.subscriptions.push(compressCmd, extractCmd);
}

export function deactivate() {}
