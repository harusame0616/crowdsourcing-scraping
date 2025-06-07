import type { Project } from "../src/share/project";

export interface Crawler {
	listProjectUrls: (url: string) => Promise<string[]>;
	detail: (projectId: string) => Promise<Project>;
}
