import * as vscode from 'vscode';
import * as cp from 'child_process';

/* ───────── alias map ─────────
   key   = import-statement root token
   value = PyPI package to install
*/
const PIP_ALIAS: Record<string, string> = {
	sklearn: 'scikit-learn',
	skimage: 'scikit-image',
	cv2: 'opencv-python',
	PIL: 'pillow',
	bs4: 'beautifulsoup4',
	Crypto: 'pycryptodome',
	yaml: 'PyYAML',
	dateutil: 'python-dateutil'
};

/* ───────── helpers (unchanged) ───────── */
function onImportLine(doc: vscode.TextDocument, pos: vscode.Position) {
	const txt = doc.lineAt(pos.line).text;
	return /^\s*(from\s+\S+\s+import|import)\s+/.test(txt);
}
function pkgInstalled(pkg: string): boolean {
	try {
		cp.execSync(`python -c "import ${pkg}"`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/* ───────── activation ───────── */
export function activate(ctx: vscode.ExtensionContext) {
	/* command */
	ctx.subscriptions.push(
		vscode.commands.registerCommand('pyHoverInstall.install', async (pipName: string) => {
			// Build the shell command
			const shellExec = new vscode.ShellExecution(`pip install ${pipName}`);

			// Create a uniquely-named task so each package gets its own terminal tab
			const task = new vscode.Task(
				{ type: 'shell', task: 'pip-install' },          // task definition
				vscode.TaskScope.Workspace,                      // workspace-scoped
				`pip-${pipName}`,                                // task/terminal name
				'pip-installer',                                 // “source” label
				shellExec
			);

			// Launch it
			vscode.tasks.executeTask(task);
		})
	);

	/* hover provider */
	ctx.subscriptions.push(
		vscode.languages.registerHoverProvider('python', {
			provideHover(doc, pos) {
				if (!onImportLine(doc, pos)) return;

				const line = doc.lineAt(pos.line).text;
				const m = line.match(/^\s*(?:from|import)\s+([A-Za-z_][A-Za-z0-9_]*)/);
				if (!m) return;

				const root = m[1];                           // e.g. sklearn
				if (pkgInstalled(root)) return;

				const pipName = PIP_ALIAS[root] ?? root;     // map if alias exists

				/* build hover */
				const start = line.indexOf(root);
				const range = new vscode.Range(pos.line, start, pos.line, start + root.length);

				const md = new vscode.MarkdownString(
					`[📦 **Install \`${pipName}\`**](command:pyHoverInstall.install?${encodeURIComponent(
						JSON.stringify(pipName)
					)})`
				);
				md.isTrusted = true;
				return new vscode.Hover(md, range);
			}
		})
	);
}
