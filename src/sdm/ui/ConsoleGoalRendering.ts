import { guid } from "@atomist/automation-client/internal/util/string";
import {
    SdmGoalEvent,
    SdmGoalState,
} from "@atomist/sdm";
import chalk from "chalk";
import * as formatDate from "format-date";
import * as _ from "lodash";

const ProgressBar = require("node-progress-bars");
const term = require("terminal-kit").terminal;

term.options.crlf = true;

const SchemaRequested = ":icon :name :bar :description :link";
const SchemaSuccess = ":icon :name :bar :description :link";

export class ConsoleGoalRendering {

    private goalSets: GoalSet[] = [];

    constructor() {
        term.windowTitle("Atomist - SDM Goals");

        setInterval(() => {
            this.goalSets.forEach(gs => gs.goals.forEach(g => {
                const bar = g.bar;
                if (bar.completed) {
                    bar.setSchema(SchemaSuccess, {
                        name: mapStateToColor(g.name, g.goal.state),
                        description: g.goal.description,
                        link: g.goal.url,
                        icon: mapStateToIcon(g.goal.state),
                    });
                    bar.archived = true;
                }
            }));

            this.goalSets.filter(gs => !gs.goals.some(g => !g.bar.completed))
                .forEach(gs => {
                    this.goalSets.splice(this.goalSets.indexOf(gs), 1);
                });

        }, 200);
    }

    public addGoals(id: string, goals: string[], p: Push) {
        process.stdout.write(push(p) + "\n");

        const ml = _.maxBy(goals, "length");
        const gs = goals.map(g => _.padEnd(g, ml.length, " "));

        const bars = gs.map(g => {
            return {
                name: g,
                goal: {
                    description: "",
                    url: "",
                    stage: "",
                    state: SdmGoalState.planned,
                },
                bar: this.createBar(g),
            };
        });
        this.goalSets.push({
            goals: bars,
            goalSetId: id,
            push: p,
        });
    }

    public updateGoal(goal: SdmGoalEvent) {
        const gs = this.goalSets.find(gs => gs.goalSetId === goal.goalSetId);
        if (gs) {
            const g = gs.goals.find(g => g.name.trim() === goal.name);
            if (g) {
                g.goal.url = goal.externalUrl || "";
                g.goal.description = goal.description || "";
                if (goal.phase) {
                    g.goal.description += chalk.gray(` ${goal.phase}`);
                }
                g.goal.state = goal.state;
                // Update the bar
                g.bar.update(mapStateToRatio(goal.state), {
                    name: mapStateToColor(g.name, g.goal.state),
                    description: g.goal.description,
                    link: g.goal.url,
                    icon: mapStateToIcon(g.goal.state)
                });
            }
        }
    }

    private createBar(name: string): any {
        const bar = new ProgressBar({
            schema: SchemaRequested,
            total: 5,
            clean: false,
            width: 5,
            filled: ".",
            blank: " ",
        });
        bar.tick(0, { name: chalk.grey(name), description: `Planned: ${name}`, link: "", icon: chalk.grey("⏦") });
        return bar;
    }

}

function mapStateToRatio(state: SdmGoalState): number {
    switch (state) {
        case SdmGoalState.planned:
            return 0;
        case SdmGoalState.requested:
            return 0.25;
        case SdmGoalState.in_process:
            return 0.5;
        case SdmGoalState.waiting_for_approval:
        case SdmGoalState.approved:
            return 0.75;
        case SdmGoalState.failure:
        case SdmGoalState.success:
        case SdmGoalState.skipped:
            return 1;
    }
    return 0;
}

function mapStateToIcon(state: SdmGoalState): string {
    switch (state) {
        case SdmGoalState.planned:
        case SdmGoalState.requested:
            return chalk.gray("⏦");
        case SdmGoalState.in_process:
            return chalk.yellow("▸");
        case SdmGoalState.waiting_for_approval:
        case SdmGoalState.approved:
            return chalk.yellow("॥");
        case SdmGoalState.failure:
            return chalk.red("✖");
        case SdmGoalState.success:
            return chalk.green("✔");
        case SdmGoalState.skipped:
            return chalk.yellow("॥");
    }
    return "";
}

function mapStateToColor(label: string, state: SdmGoalState): string {
    switch (state) {
        case SdmGoalState.planned:
        case SdmGoalState.requested:
            return chalk.gray(label);
        case SdmGoalState.in_process:
            return chalk.yellow(label);
        case SdmGoalState.waiting_for_approval:
        case SdmGoalState.approved:
            return chalk.yellow(label);
        case SdmGoalState.failure:
            return chalk.red(label);
        case SdmGoalState.success:
            return chalk.green(label);
        case SdmGoalState.skipped:
            return chalk.yellow(label);
    }
    return "";
}

function date() {
    return chalk.dim(formatDate("{year}-{month}-{day} {hours}:{minutes}:{seconds}", new Date()));
}

function push(p: Push) {
    return `${chalk.grey("#")} ${chalk.bold(p.repo)} ${date()} ${chalk.yellow(`${p.owner}/${p.repo}/${p.branch}`)} - ${chalk.yellow(p.sha)} ${p.message}`;
}

interface GoalSet {
    push: Push;
    goalSetId: string;
    goals: Goal[];
}

interface Push {
    repo: string;
    owner: string;
    branch: string;
    sha: string;
    message: string;
}

interface Goal {
    name: string;
    goal: {
        description: string;
        url: string;
        state: SdmGoalState;
    };
    bar: any;
}

const c = new ConsoleGoalRendering();
const id = guid();
c.addGoals(id, ["autofix", "code review", "code reaction", "build", "deploy locally"], {
    branch: "master",
    repo: "cli",
    owner: "atomist",
    sha: guid(),
    message: "Update dependencies"
});

setTimeout(() => {
    c.updateGoal({
        goalSetId: id,
        name: "autofix",
        description: "Ready to autofix",
        state: SdmGoalState.requested,
    } as SdmGoalEvent);
}, 500);

setTimeout(() => {
    c.updateGoal({
        goalSetId: id,
        name: "autofix",
        description: "Running autofix",
        state: SdmGoalState.in_process,
    } as SdmGoalEvent);
}, 2500);

setTimeout(() => {
    c.updateGoal({
        goalSetId: id,
        name: "autofix",
        description: "Autofixed",
        state: SdmGoalState.success,
    } as SdmGoalEvent);
}, 4500);

setTimeout(() => {
    c.updateGoal({
        goalSetId: id,
        name: "build",
        description: "Ready to build",
        state: SdmGoalState.requested,
    } as SdmGoalEvent);
}, 4500);

setTimeout(() => {
    c.updateGoal({
        goalSetId: id,
        name: "build",
        description: "Building",
        state: SdmGoalState.in_process,
    } as SdmGoalEvent);
}, 5000);

setTimeout(() => {
    c.updateGoal({
        goalSetId: id,
        name: "build",
        description: "Build succussful",
        state: SdmGoalState.success,
        phase: "tsc"
    } as SdmGoalEvent);
}, 8000);