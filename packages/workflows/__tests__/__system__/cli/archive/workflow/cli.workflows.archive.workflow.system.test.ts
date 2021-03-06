/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

import { ZosmfRestClient } from "../../../../../../rest";
import { Session } from "@zowe/imperative";
import { runCliScript, getUniqueDatasetName } from "../../../../../../../__tests__/__src__/TestUtils";
import { ITestEnvironment } from "../../../../../../../__tests__/__src__/environment/doc/response/ITestEnvironment";
import { ITestSystemSchema } from "../../../../../../../__tests__/__src__/properties/ITestSystemSchema";
import { DeleteWorkflow, CreateWorkflow } from "../../../../..";
import { TestProperties } from "../../../../../../../__tests__/__src__/properties/TestProperties";
import { TestEnvironment } from "../../../../../../../__tests__/__src__/environment/TestEnvironment";
import { Upload } from "../../../../../../zosfiles/src/api/methods/upload";
import { ZosFilesConstants } from "../../../../../../zosfiles/src/api";
import { join } from "path";
import { IWorkflows } from "../../../../../src/api/doc/IWorkflows";
import { ListWorkflows } from "../../../../../src/api/ListWorkflows";
import { IActiveWorkflows } from "../../../../../src/api/doc/IActiveWorkflows";

let REAL_SESSION: Session;
let testEnvironment: ITestEnvironment;
let systemProps: TestProperties;
let defaultSystem: ITestSystemSchema;
let definitionFile: string;
let wfKey: string;
let system: string;
let owner: string;
let wfName: string;
const workflow = join(__dirname, "../../../testfiles/demo.xml");

describe("List workflow cli system tests", () => {
    beforeAll(async () => {
        testEnvironment = await TestEnvironment.setUp({
            tempProfileTypes: ["zosmf"],
            testName: "list_workflow_cli"
        });
        systemProps = new TestProperties(testEnvironment.systemTestProperties);
        defaultSystem = systemProps.getDefaultSystem();
        system = testEnvironment.systemTestProperties.workflows.system;
        owner = defaultSystem.zosmf.user;
        wfName = `${getUniqueDatasetName(owner)}`;
        definitionFile = `${defaultSystem.unix.testdir}/${getUniqueDatasetName(owner)}.xml`;
        REAL_SESSION = TestEnvironment.createZosmfSession(testEnvironment);
    });

    afterAll(async () => {
        await DeleteWorkflow.deleteWorkflow(REAL_SESSION, wfKey);
        await TestEnvironment.cleanUp(testEnvironment);
    });
    describe("List all workflows", () => {
        beforeAll(async () => {
            // Upload files only for successful scenarios
            await Upload.fileToUSSFile(REAL_SESSION, workflow, definitionFile, true);
        });
        afterAll(async () => {
            let error;
            let response;

            const endpoint: string = ZosFilesConstants.RESOURCE + ZosFilesConstants.RES_USS_FILES;
            // deleting uploaded workflow file
            try {
                const wfEndpoint = endpoint + definitionFile;
                response = await ZosmfRestClient.deleteExpectString(REAL_SESSION, wfEndpoint);
            } catch (err) {
                error = err;
            }

            response =  await ZosmfRestClient.getExpectJSON<IWorkflows>(REAL_SESSION, "/zosmf/workflow/rest/1.0/workflows?workflowName=" + wfName);
            response.workflows.forEach(async (element: any) => {
                if(element.workflowName===wfName){
                    wfKey = element.workflowKey;
                    try {
                        await DeleteWorkflow.deleteWorkflow(REAL_SESSION, wfKey);
                    } catch (err) {
                        error = err;
                    }
                }
            });
        });
        describe("Success Scenarios", () => {
            beforeEach(async () =>{
                // Create a workflow to list
                await CreateWorkflow.createWorkflow(REAL_SESSION, wfName, definitionFile, system, owner);
            });
            afterEach (async () => {
                let error;
                const archiveCleanUp =  await ZosmfRestClient.getExpectJSON<any>(REAL_SESSION,
                                                                                "/zosmf/workflow/rest/1.0/archivedworkflows");
                archiveCleanUp.archivedWorkflows.forEach(async (element: any) => {
                    if(element.workflowName===wfName){
                        wfKey = element.workflowKey;
                        try {
                            await ZosmfRestClient.deleteExpectJSON(REAL_SESSION, "/zosmf/workflow/rest/1.0/archivedworkflows/" + wfKey);
                        } catch (err) {
                            error = err;
                        }
                    }
                });
            });
            it("Should return wf key if wf was archived using wf key.", async () => {
                let thisWorkflowKey;
                const actualWfKey =  await ZosmfRestClient.getExpectJSON<IWorkflows>(REAL_SESSION,
                                                                                    "/zosmf/workflow/rest/1.0/workflows?workflowName=" + wfName);
                actualWfKey.workflows.forEach(async (element: any) => {
                    if(element.workflowName===wfName){
                        thisWorkflowKey = element.workflowKey;
                    }
                });
                const response = runCliScript(__dirname + "/__scripts__/command/command_archive_workflow_key.sh",
                testEnvironment, [thisWorkflowKey]);
                expect(response.stderr.toString()).toBe("");
                expect(response.status).toBe(0);
                expect(response.stdout.toString()).toContain(`${thisWorkflowKey}`);
            });
            it("Should return wf key if wf was archived using wf name.", async () => {
                let thisWorkflowKey;
                const actualWfKey =  await ZosmfRestClient.getExpectJSON<IWorkflows>(REAL_SESSION,
                                                                                    "/zosmf/workflow/rest/1.0/workflows?workflowName=" + wfName);
                actualWfKey.workflows.forEach(async (element: any) => {
                    if(element.workflowName===wfName){
                        thisWorkflowKey = element.workflowKey;
                    }
                });
                const response = runCliScript(__dirname + "/__scripts__/command/command_archive_workflow_name.sh",
                testEnvironment, [wfName]);
                expect(response.stderr.toString()).toBe("");
                expect(response.status).toBe(0);
                expect(response.stdout.toString()).toContain(`${thisWorkflowKey}`);
            });
        });
        describe("Fail Scenarions", () => {
            it("Should return a message if search does not match any existing workflow key", async () => {
                const fakeKey = `${wfName}${wfName}${wfName}`;
                const response = await runCliScript(__dirname + "/__scripts__/command/command_archive_workflow_key.sh",
                testEnvironment, [fakeKey]);
                expect(response.status).toBe(1);
                expect(response.stderr.toString()).toContain(`The workflow key \"${fakeKey}\" was not found.`);
            });
            it("Should return a message if search does not match any existing workfow name", async () => {
                const fakeName = `${wfName}${wfName}${wfName}`;
                const response = await runCliScript(__dirname + "/__scripts__/command/command_archive_workflow_name.sh",
                testEnvironment, [fakeName]);
                expect(response.status).toBe(1);
                expect(response.stderr.toString()).toContain("No workflows match the provided workflow name.");
            });
        });
    });
});
