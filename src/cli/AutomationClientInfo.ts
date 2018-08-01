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

import { CommandHandlerMetadata } from "@atomist/automation-client/metadata/automationMetadata";
import { AutomationClientConnectionConfig } from "../cli/invocation/http/AutomationClientConnectionConfig";
import { LocalMachineConfig } from "../sdm/configuration/LocalMachineConfig";

/**
 * Parallels what's returned from automation client
 */
export interface ConnectedClient {

    api_version: string;
    name: string;
    version: string;

    team_ids: string[];

    commands: CommandHandlerMetadata[];

}

/**
 * Information held in client about an automation client that we've client to
 */
export interface AutomationClientInfo {

    /**
     * If we client to a sdm.machine, include this
     */
    client?: ConnectedClient;

    connectionConfig: AutomationClientConnectionConfig;

    /**
     * If this is a local sdm.machine, include this
     */
    localConfig?: LocalMachineConfig;

}
