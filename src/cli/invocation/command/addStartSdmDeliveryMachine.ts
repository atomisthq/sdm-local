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

import { Argv } from "yargs";
import { logExceptionsToConsole } from "./support/consoleOutput";
import { startEmbeddedMachine } from "../../embedded/embeddedMachine";
import { SdmCd } from "../../../pack/sdm-cd/SdmCd";

export const DefaultSdmCdPort = 2901;

/**
 * Start an SDM dedicated to SDM CD
 * @param {yargs.Argv} yargs
 */
export function addStartSdmDeliveryMachine(yargs: Argv) {
    yargs.command({
        command: "start delivery [port]",
        aliases: "d",
        describe: "Start SDM delivery machine",
        handler: argv => {
            return logExceptionsToConsole(async () => {
                const port = !!argv.port ? parseInt(argv.port) : DefaultSdmCdPort;
                await startMachine(port);
            }, true);
        },
    });
}

async function startMachine(port: number) {
    return startEmbeddedMachine({
        repositoryOwnerParentDirectory: "x",
        port,
        configure: sdm => {
            sdm.addExtensionPacks(SdmCd);
        },
    });
}
