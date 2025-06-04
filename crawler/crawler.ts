import type { Project } from "../project";

export interface Crawler {
	listProjectUrls: (url: string) => Promise<string[]>;
	detail: (projectId: string) => Promise<Project>;
}
