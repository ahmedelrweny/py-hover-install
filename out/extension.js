"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
/* ───────── alias map ─────────
   key   = import-statement root token
   value = PyPI package to install
*/
const PIP_ALIAS = {
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
function onImportLine(doc, pos) {
    const txt = doc.lineAt(pos.line).text;
    return /^\s*(from\s+\S+\s+import|import)\s+/.test(txt);
}
function pkgInstalled(pkg) {
    try {
        cp.execSync(`python -c "import ${pkg}"`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
/* ───────── activation ───────── */
function activate(ctx) {
    /* command */
    ctx.subscriptions.push(vscode.commands.registerCommand('pyHoverInstall.install', async (pipName) => {
        // Build the shell command
        const shellExec = new vscode.ShellExecution(`pip install ${pipName}`);
        // Create a uniquely-named task so each package gets its own terminal tab
        const task = new vscode.Task({ type: 'shell', task: 'pip-install' }, // task definition
        vscode.TaskScope.Workspace, // workspace-scoped
        `pip-${pipName}`, // task/terminal name
        'pip-installer', // “source” label
        shellExec);
        // Launch it
        vscode.tasks.executeTask(task);
    }));
    /* hover provider */
    ctx.subscriptions.push(vscode.languages.registerHoverProvider('python', {
        provideHover(doc, pos) {
            if (!onImportLine(doc, pos))
                return;
            const line = doc.lineAt(pos.line).text;
            const m = line.match(/^\s*(?:from|import)\s+([A-Za-z_][A-Za-z0-9_]*)/);
            if (!m)
                return;
            const root = m[1]; // e.g. sklearn
            if (pkgInstalled(root))
                return;
            const pipName = PIP_ALIAS[root] ?? root; // map if alias exists
            /* build hover */
            const start = line.indexOf(root);
            const range = new vscode.Range(pos.line, start, pos.line, start + root.length);
            const md = new vscode.MarkdownString(`[📦 **Install \`${pipName}\`**](command:pyHoverInstall.install?${encodeURIComponent(JSON.stringify(pipName))})`);
            md.isTrusted = true;
            return new vscode.Hover(md, range);
        }
    }));
}
//# sourceMappingURL=extension.js.map