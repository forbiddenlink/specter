import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Specter');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'specter.health';
    statusBarItem.tooltip = 'Click to show Specter health details';
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('specter.health', showHealth),
        vscode.commands.registerCommand('specter.morning', showMorningBriefing),
        vscode.commands.registerCommand('specter.scan', scanCodebase)
    );

    // Initial health check
    updateStatusBar();

    // Refresh health every 5 minutes
    const interval = setInterval(updateStatusBar, 5 * 60 * 1000);
    context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

async function runSpecterCommand(command: string): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        throw new Error('No workspace folder open');
    }

    try {
        const { stdout } = await execAsync(`specter ${command}`, {
            cwd: workspaceFolder
        });
        return stdout;
    } catch (error: any) {
        throw new Error(error.stderr || error.message);
    }
}

async function updateStatusBar() {
    try {
        const output = await runSpecterCommand('health --json');
        const health = JSON.parse(output);
        const score = health.score ?? health.overall ?? 0;

        statusBarItem.text = `$(ghost) Health: ${score}`;
        statusBarItem.backgroundColor = undefined;

        if (score < 50) {
            statusBarItem.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.errorBackground'
            );
        } else if (score < 75) {
            statusBarItem.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.warningBackground'
            );
        }

        statusBarItem.show();
    } catch {
        statusBarItem.text = '$(ghost) Specter';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
    }
}

async function showHealth() {
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine('Running Specter health check...\n');

    try {
        const output = await runSpecterCommand('health');
        outputChannel.appendLine(output);
    } catch (error: any) {
        outputChannel.appendLine(`Error: ${error.message}`);
        vscode.window.showErrorMessage(`Specter health check failed: ${error.message}`);
    }
}

async function showMorningBriefing() {
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine('Getting morning briefing...\n');

    try {
        const output = await runSpecterCommand('morning');
        outputChannel.appendLine(output);
    } catch (error: any) {
        outputChannel.appendLine(`Error: ${error.message}`);
        vscode.window.showErrorMessage(`Specter morning briefing failed: ${error.message}`);
    }
}

async function scanCodebase() {
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine('Scanning codebase...\n');

    try {
        const output = await runSpecterCommand('scan');
        outputChannel.appendLine(output);
        await updateStatusBar();
        vscode.window.showInformationMessage('Specter scan complete!');
    } catch (error: any) {
        outputChannel.appendLine(`Error: ${error.message}`);
        vscode.window.showErrorMessage(`Specter scan failed: ${error.message}`);
    }
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}
