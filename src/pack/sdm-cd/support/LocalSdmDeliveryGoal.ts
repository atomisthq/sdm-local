/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { logger } from "@atomist/automation-client";
import { asSpawnCommand } from "@atomist/automation-client/util/spawned";
import { ExecuteGoal, GenericGoal, GoalInvocation } from "@atomist/sdm";
import { ChildProcess, spawn } from "child_process";
import { isFileSystemRemoteRepoRef } from "../../../sdm/binding/project/FileSystemRemoteRepoRef";
import { DelimitedWriteProgressLogDecorator } from "@atomist/sdm/api-helper/log/DelimitedWriteProgressLogDecorator";
import { AutomationClientInfo } from "../../../cli/AutomationClientInfo";
import { fetchMetadataFromAutomationClient } from "../../../cli/invocation/http/fetchMetadataFromAutomationClient";
import { SdmDeliveryOptions } from "./SdmDeliveryOptions";
import * as os from "os";
import { displayClientInfo } from "../../../cli/invocation/displayClientInfo";

export const LocalSdmDeliveryGoal = new GenericGoal(
    { uniqueName: "sdmDelivery" },
    "Deliver SDM");

/**
 * Deliver this SDM
 */
export function executeLocalSdmDelivery(options: SdmDeliveryOptions): ExecuteGoal {
    const deliveryManager = new DeliveryManager();

    return async goalInvocation => {
        const { id } = goalInvocation;
        if (!isFileSystemRemoteRepoRef(id)) {
            // Should not have been called
            throw new Error("Not a local repo ref: " + JSON.stringify(id));
        }

        try {
            await goalInvocation.addressChannels(`Beginning SDM delivery for SDM at ${id.fileSystemLocation}`);
            const client = await deliveryManager.deliver(id.fileSystemLocation, options, goalInvocation);
            await goalInvocation.addressChannels(`SDM updated: ${displayClientInfo(client)}`);
            return { code: 0 };
        } catch (err) {
            logger.error(err);
            return { code: 1, message: err.stack };
        }
    };
}

// Patterns that show success
const successPatterns = [
    /Starting Atomist automation client/,
];

/**
 * Hold state to manage one SDM
 */
class DeliveryManager {

    private childProcesses: { [baseDir: string]: ChildProcess } = {};

    public async deliver(baseDir: string,
                         options: SdmDeliveryOptions,
                         goalInvocation: GoalInvocation): Promise<AutomationClientInfo> {
        let childProcess = this.childProcesses[baseDir];
        if (!!childProcess) {
            await goalInvocation.addressChannels(`Terminating process with pid \`${childProcess.pid}\` for SDM at ${baseDir}`);
            await poisonAndWait(childProcess);
        } else {
            await goalInvocation.addressChannels(`No previous process found for SDM at ${baseDir}`);
        }

        const spawnCommand = asSpawnCommand("slalom start --install=false --local=true --compile=false");
        childProcess = await spawn(
            spawnCommand.command,
            spawnCommand.args,
            { cwd: baseDir });

        this.childProcesses[baseDir] = childProcess;

        // Record output from child process
        const newLineDelimitedLog = new DelimitedWriteProgressLogDecorator(goalInvocation.progressLog, "\n");
        childProcess.stdout.on("data", what => newLineDelimitedLog.write(what.toString()));
        childProcess.stderr.on("data", what => newLineDelimitedLog.write(what.toString()));

        return new Promise<AutomationClientInfo>((resolve, reject) => {
            let stdout = "";
            childProcess.stdout.addListener("data", async what => {
                if (!!what) {
                    stdout += what;
                }
                if (successPatterns.some(successPattern => successPattern.test(stdout))) {
                    const ccr = {
                        baseEndpoint: `http://${os.hostname()}:${options.port}`,
                    };
                    await fetchMetadataFromAutomationClient(ccr)
                        .then(aca => resolve(aca))
                        .catch(reject);
                }
            });
            childProcess.addListener("exit", () => {
                this.childProcesses.delete[baseDir];
                reject(new Error("Error starting managed SDM. We should have found success message pattern by now! Please check logs"));
            });
            childProcess.addListener("error", err => {
                this.childProcesses.delete[baseDir];
                return reject(err);
            });
        });
    }

}

function poisonAndWait(childProcess: ChildProcess) {
    if (!childProcess.connected) {
        logger.warn("Child process with pid %d is not connected", childProcess.pid);
    } else {
        childProcess.kill();
        return new Promise((resolve, reject) => childProcess.on("close", () => {
            resolve();
        }));
    }
}