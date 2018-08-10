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

import { verifyJavaTest, verifyMavenTest } from "../../../../../src/cli/invocation/command/support/javaVerification";
import * as assert from "assert";

describe("javaVerification", () => {

    describe("javaVerification", () => {

        it.skip("should reject invalid", () => {
            assert(!verifyJavaTest()("woeiruowieur"));
        });

        it("should parse valid", () => {
            assert(verifyJavaTest()(`Apache Maven 3.5.0 (ff8f5e7444045639af65f6095c62210b5713f426; 2017-04-03T12:39:06-07:00)
Maven home: /usr/local/Cellar/maven/3.5.0/libexec
Java version: 1.8.0_111, vendor: Oracle Corporation
Java home: /Library/Java/JavaVirtualMachines/jdk1.8.0_111.jdk/Contents/Home/jre
Default locale: en_US, platform encoding: UTF-8
OS name: "mac os x", version: "10.13.3", arch: "x86_64", family: "mac"
`));
        });

    });

    describe("mavenVerification", () => {

        it.skip("should reject invalid", () => {
            assert(!verifyMavenTest()("woeiruowieur"));
        });

        it("should parse valid", () => {
            assert(verifyMavenTest()(`java version "1.8.0_111"
Java(TM) SE Runtime Environment (build 1.8.0_111-b14)
Java HotSpot(TM) 64-Bit Server VM (build 25.111-b14, mixed mode)
`));
        });

    });
});
