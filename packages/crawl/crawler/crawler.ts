import type { Project } from "share";

export interface Crawler {
	listProjectUrls: (url: string) => Promise<string[]>;
	detail: (projectId: string) => Promise<Project>;
}
