import type { Project } from "../../share/project";

export interface Crawler {
	listProjectUrls: (url: string) => Promise<string[]>;
	detail: (projectId: string) => Promise<Project>;
}
