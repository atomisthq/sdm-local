import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { LocalProject } from "@atomist/automation-client/project/local/LocalProject";
import { NodeFsLocalProject } from "@atomist/automation-client/project/local/NodeFsLocalProject";
import { appendOrCreateFileContent } from "@atomist/sdm/api-helper/project/appendOrCreate";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { sprintf } from "sprintf-js";
import { infoMessage } from "..";
import { errorMessage, warningMessage } from "../invocation/cli/support/consoleOutput";
import { HookEvents } from "../invocation/git/handleEventOnRepo";

const AtomistHookScriptName = "script/atomist-hook.sh";
const AtomistJsName = "build/src/entry/onGitHook.js";

/**
 * Add Git hooks to the given repo
 * @param {RemoteRepoRef} id
 * @param {string} projectBaseDir
 * @param gitHookScript absolute path to the script to run when a hook fires
 * @return {Promise<void>}
 */
export async function addGitHooks(id: RemoteRepoRef,
                                  projectBaseDir: string) {
    if (fs.existsSync(`${projectBaseDir}/.git`)) {
        const p = await NodeFsLocalProject.fromExistingDirectory(id, projectBaseDir);
        return addGitHooksToProject(p);
    } else {
        infoMessage(
            chalk.gray(sprintf("addGitHooks: Ignoring directory at %s as it is not a git project\n"),
                projectBaseDir));
    }
}

export async function addGitHooksToProject(p: LocalProject) {
    const atomistHookScriptPath = path.join(__dirname, "../../../", AtomistHookScriptName);
    const gitHookScript = path.join(__dirname, "../../../", AtomistJsName);

    for (const event of HookEvents) {
        const toAppend = scriptFragments(atomistHookScriptPath, gitHookScript)[event];
        if (!toAppend) {
            errorMessage("Unable to create git script for event '%s'", event);
            process.exit(1);
        }
        await appendOrCreateFileContent(
            {
                path: `/.git/hooks/${event}`,
                toAppend: markAsAtomistContent(toAppend),
                leaveAlone: oldContent => oldContent.includes(atomistHookScriptPath),
            })(p);
        await p.makeExecutable(`.git/hooks/${event}`);
        infoMessage(chalk.gray(sprintf(
            `addGitHooks: Adding git ${event} script to project at %s\n`,
            p.baseDir)));
    }
}

export async function removeGitHooks(id: RemoteRepoRef, baseDir: string) {
    if (fs.existsSync(`${baseDir}/.git`)) {
        const p = await NodeFsLocalProject.fromExistingDirectory(id, baseDir);
        for (const hookFile of HookEvents) {
            await deatomizeScript(p, `/.git/hooks/${hookFile}`);
        }
    } else {
        infoMessage(chalk.gray(sprintf(
            "removeGitHooks: Ignoring directory at %s as it is not a git project",
            baseDir)));
    }
}

/**
 * Remove Atomist hook from this script
 * @param {LocalProject} p
 * @param {string} scriptPath
 * @return {Promise<void>}
 */
async function deatomizeScript(p: LocalProject, scriptPath: string) {
    const script = await p.getFile(scriptPath);
    if (!script) {
        process.stdout.write(chalk.gray(sprintf(
            "removeGitHooks: No git hook %s in project at %s\n",
            scriptPath,
            p.baseDir)));
    } else {
        const content = await script.getContent();
        const start = content.indexOf(AtomistStartComment);
        const end = content.indexOf(AtomistEndComment);
        if (start < 0 || end < 0) {
            warningMessage("removeGitHooks: No Atomist content found in git hook %s in project at %s: Saw\n%s\n",
                scriptPath,
                p.baseDir,
                chalk.gray(content));
        }
        const nonAtomist = content.slice(0, start) + content.substr(end + AtomistEndComment.length);
        if (nonAtomist.trim().length > 0) {
            await script.setContent(nonAtomist);
            infoMessage(chalk.gray(sprintf(
                "removeGitHooks: Removing Atomist content from git hook %s in project at %s: Leaving \n%s",
                scriptPath,
                p.baseDir,
                nonAtomist)));
        } else {
            await p.deleteFile(scriptPath);
            infoMessage(chalk.gray(sprintf(
                "removeGitHooks: Removing pure Atomist git hook %s in project at %s\n",
                scriptPath,
                p.baseDir)));
        }
    }
}

/* tslint:disable */

/**
 * Indexed fragments
 * @param {string} atomistHookScriptPath
 * @param {string} gitHookScript
 * @param {string} event
 * @return {{"pre-receive": string}}
 */
function scriptFragments(atomistHookScriptPath: string, gitHookScript: string) {

    return {
        "pre-receive": `while read oldrev newrev refname
	do
		echo "oldrev= $oldrev" # 0 if a new branch
        echo "newrev=$newrev" # sha
        echo "refname=$refname" # refs/heads/<new branch>
        ${atomistHookScriptPath} ${gitHookScript} pre-receive \${PWD} $refname $newrev
	done`,
        "post-commit": `
branch=$(git rev-parse HEAD)
sha=$(git rev-parse --abbrev-ref HEAD)
${atomistHookScriptPath} ${gitHookScript} post-commit \${PWD} $branch $sha
`,

        "post-merge": `
branch=$(git rev-parse HEAD)
sha=$(git rev-parse --abbrev-ref HEAD)
${atomistHookScriptPath} ${gitHookScript} post-merge \${PWD} $branch $sha
`,
    };
}

const AtomistStartComment = "######## Atomist start #######";
const AtomistEndComment = "######## Atomist end #########";

/**
 * Make it clear this is Atomist content. Makes it easy to remove later.
 * @param {string} toAppend
 * @return {string}
 */
function markAsAtomistContent(toAppend: string) {
    return `\n${AtomistStartComment}\n${toAppend}\n${AtomistEndComment}\n`;
}


