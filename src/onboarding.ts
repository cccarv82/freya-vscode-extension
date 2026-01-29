import * as vscode from 'vscode';

export function openOnboardingPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'freyaOnboarding',
    'FREYA Setup',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  const cfg = vscode.workspace.getConfiguration('freya');
  const current = {
    workspaceFolder: cfg.get<string>('workspaceFolder', 'freya'),
    cliPackage: cfg.get<string>('cliPackage', '@cccarv82/freya'),
    discordWebhookUrl: cfg.get<string>('discordWebhookUrl', ''),
    teamsWebhookUrl: cfg.get<string>('teamsWebhookUrl', '')
  };

  panel.webview.html = getHtml(current);

  panel.webview.onDidReceiveMessage(async (msg) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'save') {
      await cfg.update('workspaceFolder', msg.workspaceFolder ?? 'freya', vscode.ConfigurationTarget.Workspace);
      await cfg.update('cliPackage', msg.cliPackage ?? '@cccarv82/freya', vscode.ConfigurationTarget.Workspace);
      await cfg.update('discordWebhookUrl', msg.discordWebhookUrl ?? '', vscode.ConfigurationTarget.Workspace);
      await cfg.update('teamsWebhookUrl', msg.teamsWebhookUrl ?? '', vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage('FREYA settings saved to this workspace.');
      panel.webview.postMessage({ type: 'saved' });
    }

    if (msg.type === 'openSettings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'freya');
    }

    if (msg.type === 'close') {
      panel.dispose();
    }
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getHtml(current: any) {
  const ws = escapeHtml(current.workspaceFolder || 'freya');
  const pkg = escapeHtml(current.cliPackage || '@cccarv82/freya');
  const discord = escapeHtml(current.discordWebhookUrl || '');
  const teams = escapeHtml(current.teamsWebhookUrl || '');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,Cantarell,Helvetica,Arial; padding: 16px; }
    h1 { margin: 0 0 8px; }
    p { max-width: 820px; line-height: 1.4; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 12px; max-width: 820px; }
    label { font-weight: 600; }
    input { width: 100%; padding: 10px 12px; border: 1px solid #8884; border-radius: 6px; }
    .row { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .btns { display: flex; gap: 10px; margin-top: 10px; }
    button { padding: 10px 12px; border-radius: 8px; border: 1px solid #8884; background: #2ea043; color: white; cursor: pointer; }
    button.secondary { background: transparent; color: inherit; }
    code { background: #8882; padding: 2px 6px; border-radius: 6px; }
    .hint { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <h1>FREYA Setup</h1>
  <p>
    Configure sua workspace local-first e (opcionalmente) webhooks para publicar relatórios.
    Você pode editar isso depois em <code>Settings → FREYA</code>.
  </p>

  <div class="grid">
    <div class="row">
      <label>Workspace folder</label>
      <input id="workspaceFolder" value="${ws}" placeholder="freya" />
      <div class="hint">A extensão vai criar/usar <code>./${ws}</code> dentro do workspace aberto no VSCode.</div>
    </div>

    <div class="row">
      <label>CLI package</label>
      <input id="cliPackage" value="${pkg}" placeholder="@cccarv82/freya" />
      <div class="hint">Usado pelo <code>npx</code> para instalar/atualizar a workspace.</div>
    </div>

    <div class="row">
      <label>Discord webhook URL (opcional)</label>
      <input id="discordWebhookUrl" value="${discord}" placeholder="https://discord.com/api/webhooks/..." />
    </div>

    <div class="row">
      <label>Teams webhook URL (opcional)</label>
      <input id="teamsWebhookUrl" value="${teams}" placeholder="https://..." />
    </div>

    <div class="btns">
      <button id="save">Save</button>
      <button class="secondary" id="openSettings">Open Settings</button>
      <button class="secondary" id="close">Close</button>
    </div>

    <div class="hint">Dica: depois de salvar, use os comandos <code>FREYA: Init Workspace</code> e <code>FREYA: Publish Last Generated Report</code>.</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('save').addEventListener('click', () => {
      vscode.postMessage({
        type: 'save',
        workspaceFolder: document.getElementById('workspaceFolder').value,
        cliPackage: document.getElementById('cliPackage').value,
        discordWebhookUrl: document.getElementById('discordWebhookUrl').value,
        teamsWebhookUrl: document.getElementById('teamsWebhookUrl').value,
      });
    });
    document.getElementById('openSettings').addEventListener('click', () => vscode.postMessage({ type: 'openSettings' }));
    document.getElementById('close').addEventListener('click', () => vscode.postMessage({ type: 'close' }));
  </script>
</body>
</html>`;
}
