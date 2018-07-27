import { logger } from "@atomist/automation-client";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { ProjectLoader, ProjectLoadingParameters, WithLoadedProject } from "@atomist/sdm";
import * as fs from "fs";
import { LocalMachineConfig } from "..";
import { dirFor } from "../binding/expandedTreeUtils";
import { FileSystemRemoteRepoRef, isFileSystemRemoteRepoRef } from "../binding/FileSystemRemoteRepoRef";
import { runAndLog } from "../util/runAndLog";

/**
 * Project loader that modifies push behavior before acting on project,
 * and prefers local directories if found on disk
 */
export class FileSystemProjectLoader implements ProjectLoader {

    public doWithProject<T>(params: ProjectLoadingParameters, action: WithLoadedProject<T>): Promise<T> {
        // Use local seed as preference if possible
        const localDir = dirFor(this.config.repositoryOwnerParentDirectory, params.id.owner, params.id.repo);
        const foundLocally = fs.existsSync(localDir);
        if (this.config.preferLocalSeeds && !isFileSystemRemoteRepoRef(params.id) && foundLocally) {
            params.id = FileSystemRemoteRepoRef.implied(this.config.repositoryOwnerParentDirectory,
                params.id.owner, params.id.repo);
        }
        const decoratedAction = async p => {
            const p2 = await this.preprocess(p);
            return action(p2);
        };
        return this.delegate.doWithProject(params, decoratedAction);
    }

    constructor(private readonly delegate: ProjectLoader,
                private readonly config: LocalMachineConfig,
                private readonly preprocess: (p: GitProject) => Promise<GitProject> = changeToPushToAtomistBranch(config)) {
    }

}

/**
 * Change the behavior of our project to push to an Atomist branch and merge if it cannot
 * push to the checked out branch.
 */
function changeToPushToAtomistBranch(localConfig: LocalMachineConfig): (p: GitProject) => Promise<GitProject> {
    return async p => {
        p.push = async opts => {
            try {
                // First try to push this branch. If it's the checked out branch
                // we'll get an error
                logger.info(`Pushing to branch ${p.branch} on ${p.id.owner}:${p.id.repo}`);
                await runAndLog(`git push --force --set-upstream origin ${p.branch}`, {
                    cwd: p.baseDir,
                });
            } catch (err) {
                // If this throws an exception it's because we can't push to the checked out branch.
                // Autofix will attempt to do this.
                // So we create a new branch, push that, and then go to the original directory and merge it.
                const newBranch = `atomist/${p.branch}`;
                logger.info(`Pushing to new local branch ${newBranch}`);
                await p.createBranch(newBranch);
                await runAndLog(`git push --force --set-upstream origin ${p.branch}`, { cwd: p.baseDir });

                if (localConfig.mergeAutofixes) {
                    const originalRepoDir = dirFor(localConfig.repositoryOwnerParentDirectory, p.id.owner, p.id.repo);
                    // infoMessage(`Trying merge in ${originalRepoDir}\n`);
                    // Automerge it
                    await runAndLog(`git merge ${newBranch}`, { cwd: originalRepoDir });
                }
            }
            return { target: p, success: true };
        };
        return p;
    };
}
