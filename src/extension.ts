import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

/* ───────── alias map ───────── */
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

/* ───────── helpers ───────── */
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

/* ───────── find python executable (reads settings) ───────── */
interface PythonExecResult {
	path: string;
	isFallback: boolean; // true if it's just "python" from PATH
}

async function findPythonExecutable(workspaceFolder?: vscode.WorkspaceFolder): Promise<PythonExecResult> {
	const cfg = vscode.workspace.getConfiguration('pyHoverInstall', workspaceFolder?.uri);
	let configuredPath = cfg.get<string>('installInterpreterPath') ?? '';

	if (configuredPath && configuredPath.trim().length > 0) {
		configuredPath = path.normalize(configuredPath);
		return { path: configuredPath, isFallback: false };
	}

	if (workspaceFolder) {
		const candidateVenvs = ['.venv', 'venv'];
		for (const v of candidateVenvs) {
			const base = path.join(workspaceFolder.uri.fsPath, v);
			const winPy = path.join(base, 'Scripts', 'python.exe');
			const nixPy = path.join(base, 'bin', 'python');

			try {
				if (process.platform === 'win32') {
					await vscode.workspace.fs.stat(vscode.Uri.file(winPy));
					return { path: winPy, isFallback: false };
				} else {
					await vscode.workspace.fs.stat(vscode.Uri.file(nixPy));
					return { path: nixPy, isFallback: false };
				}
			} catch { }
		}
	}

	// Fallback
	return { path: 'python', isFallback: true };
}

/* ───────── activation ───────── */
export function activate(ctx: vscode.ExtensionContext) {
	/* command */
	ctx.subscriptions.push(
		vscode.commands.registerCommand('pyHoverInstall.install', async (pipName: string) => {
			const activeEditor = vscode.window.activeTextEditor;
			const workspaceFolder = activeEditor
				? vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
				: (vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined);

			const { path: pythonExec, isFallback } = await findPythonExecutable(workspaceFolder);

			if (isFallback) {
				const choice = await vscode.window.showWarningMessage(
					`No custom interpreter or virtual environment found. Installing "${pipName}" will go into your system Python.`,
					"Proceed", "Cancel"
				);
				if (choice !== "Proceed") {
					return; // user canceled
				}
			}

			const quotedPython = `"${pythonExec}"`;
			const cmd = `& ${quotedPython} -m pip install ${pipName}`;

			const shellExec = new vscode.ShellExecution(cmd, {
				cwd: workspaceFolder ? workspaceFolder.uri.fsPath : undefined
			});

			const taskName = workspaceFolder ? `${workspaceFolder.name}: pip-${pipName}` : `pip-${pipName}`;

			const task = new vscode.Task(
				{ type: 'shell', task: 'pip-install' },
				vscode.TaskScope.Workspace,
				taskName,
				'pip-installer',
				shellExec
			);

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

				const root = m[1];
				if (pkgInstalled(root)) return;

				const pipName = PIP_ALIAS[root] ?? root;

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
