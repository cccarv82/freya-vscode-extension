import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

let lastGeneratedReportPath: string | null = null;

function getConfig() {
  return vscode.workspace.getConfiguration('freya');
}

function getRootFolder(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder open. Open a folder in VSCode/Cursor first.');
  }
  return folders[0].uri.fsPath;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  output: vscode.OutputChannel
): Promise<number> {
  return new Promise((resolve, reject) => {
    output.appendLine(`$ ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { cwd, shell: true, env: process.env });

    child.stdout.on('data', (d) => output.append(d.toString()));
    child.stderr.on('data', (d) => output.append(d.toString()));

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

function findLatestReport(reportsDir: string, prefix: string): string | null {
  if (!fs.existsSync(reportsDir)) return null;
  const files = fs.readdirSync(reportsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
    .map((f) => ({ f, p: path.join(reportsDir, f) }))
    .filter((x) => fs.statSync(x.p).isFile())
    .sort((a, b) => fs.statSync(b.p).mtimeMs - fs.statSync(a.p).mtimeMs);
  return files[0]?.p ?? null;
}

function postWebhook(urlStr: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!urlStr) return reject(new Error('Webhook URL not configured.'));
    const url = new URL(urlStr);

    // Discord incoming webhook accepts { content }
    // Teams incoming webhook (Office) accepts { text }
    const isDiscord = url.hostname.includes('discord.com') || url.hostname.includes('discordapp.com');
    const body = JSON.stringify(isDiscord ? { content: text } : { text });

    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) return resolve();
          const msg = Buffer.concat(chunks).toString('utf8');
          reject(new Error(`Webhook error ${res.statusCode}: ${msg}`));
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function ensureFreyaFolderPath(): Promise<string> {
  const root = getRootFolder();
  const cfg = getConfig();
  const folderName = cfg.get<string>('workspaceFolder', 'freya');
  return path.join(root, folderName);
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('FREYA');

  const initWorkspace = vscode.commands.registerCommand('freya.initWorkspace', async () => {
    output.show(true);
    const root = getRootFolder();
    const cfg = getConfig();
    const pkg = cfg.get<string>('cliPackage', '@cccarv82/freya');
    const folderName = cfg.get<string>('workspaceFolder', 'freya');
    const target = path.join(root, folderName);

    // init uses default ./freya; we pass explicit dir to be safe.
    const code = await runCommand('npx', [pkg, 'init', target], root, output);
    if (code !== 0) throw new Error(`freya init failed with exit code ${code}`);

    vscode.window.showInformationMessage(`FREYA workspace initialized at ${target}`);
  });

  const updateWorkspace = vscode.commands.registerCommand('freya.updateWorkspace', async () => {
    output.show(true);
    const freyaPath = await ensureFreyaFolderPath();
    const cfg = getConfig();
    const pkg = cfg.get<string>('cliPackage', '@cccarv82/freya');

    // Update in-place: run init inside freyaPath (preserves data/logs)
    fs.mkdirSync(freyaPath, { recursive: true });
    const code = await runCommand('npx', [pkg, 'init', '--here'], freyaPath, output);
    if (code !== 0) throw new Error(`freya update failed with exit code ${code}`);

    vscode.window.showInformationMessage('FREYA workspace updated (data/logs preserved).');
  });

  const generateExecutiveReport = vscode.commands.registerCommand('freya.generateExecutiveReport', async () => {
    output.show(true);
    const freyaPath = await ensureFreyaFolderPath();
    const code = await runCommand('npm', ['run', 'status'], freyaPath, output);
    if (code !== 0) throw new Error(`npm run status failed with exit code ${code}`);

    lastGeneratedReportPath = findLatestReport(path.join(freyaPath, 'docs', 'reports'), 'executive-')
      || findLatestReport(path.join(freyaPath, 'docs', 'reports'), 'status-')
      || null;
    vscode.window.showInformationMessage('Executive report generated.' + (lastGeneratedReportPath ? ` (${path.basename(lastGeneratedReportPath)})` : ''));
  });

  const generateSmWeeklyReport = vscode.commands.registerCommand('freya.generateSmWeeklyReport', async () => {
    output.show(true);
    const freyaPath = await ensureFreyaFolderPath();
    const code = await runCommand('npm', ['run', 'sm-weekly'], freyaPath, output);
    if (code !== 0) throw new Error(`npm run sm-weekly failed with exit code ${code}`);

    lastGeneratedReportPath = findLatestReport(path.join(freyaPath, 'docs', 'reports'), 'sm-weekly-');
    vscode.window.showInformationMessage('SM weekly report generated.' + (lastGeneratedReportPath ? ` (${path.basename(lastGeneratedReportPath)})` : ''));
  });

  const generateBlockersReport = vscode.commands.registerCommand('freya.generateBlockersReport', async () => {
    output.show(true);
    const freyaPath = await ensureFreyaFolderPath();
    const code = await runCommand('npm', ['run', 'blockers'], freyaPath, output);
    if (code !== 0) throw new Error(`npm run blockers failed with exit code ${code}`);

    lastGeneratedReportPath = findLatestReport(path.join(freyaPath, 'docs', 'reports'), 'blockers-');
    vscode.window.showInformationMessage('Blockers report generated.' + (lastGeneratedReportPath ? ` (${path.basename(lastGeneratedReportPath)})` : ''));
  });

  const generateDailySummary = vscode.commands.registerCommand('freya.generateDailySummary', async () => {
    output.show(true);
    const freyaPath = await ensureFreyaFolderPath();
    const code = await runCommand('npm', ['run', 'daily'], freyaPath, output);
    if (code !== 0) throw new Error(`npm run daily failed with exit code ${code}`);
    vscode.window.showInformationMessage('Daily summary generated (see FREYA output).');
  });

  const publishLastReport = vscode.commands.registerCommand('freya.publishLastReport', async () => {
    output.show(true);

    if (!lastGeneratedReportPath || !fs.existsSync(lastGeneratedReportPath)) {
      throw new Error('No report cached. Generate a report first.');
    }

    const cfg = getConfig();
    const discordUrl = cfg.get<string>('discordWebhookUrl', '');
    const teamsUrl = cfg.get<string>('teamsWebhookUrl', '');

    const content = fs.readFileSync(lastGeneratedReportPath, 'utf8');

    // Keep payload small; webhook limits vary. Provide a trimmed message.
    const maxChars = 1800;
    const text = content.length > maxChars ? (content.slice(0, maxChars) + '\n\n(…truncated)') : content;

    const targets: Array<{ name: string; url: string }> = [];
    if (discordUrl) targets.push({ name: 'Discord', url: discordUrl });
    if (teamsUrl) targets.push({ name: 'Teams', url: teamsUrl });

    if (targets.length === 0) {
      throw new Error('No webhook configured. Set freya.discordWebhookUrl and/or freya.teamsWebhookUrl.');
    }

    for (const t of targets) {
      await postWebhook(t.url, text);
      output.appendLine(`Published to ${t.name}.`);
    }

    vscode.window.showInformationMessage(`Published report: ${path.basename(lastGeneratedReportPath)}`);
  });

  context.subscriptions.push(
    output,
    initWorkspace,
    updateWorkspace,
    generateExecutiveReport,
    generateSmWeeklyReport,
    generateBlockersReport,
    generateDailySummary,
    publishLastReport
  );
}

export function deactivate() {}
